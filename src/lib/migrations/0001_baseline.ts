import type { Migration } from './types';

// The schema as it stood the day the migration framework landed. Every
// statement here is written defensively (IF NOT EXISTS / guarded ADD
// COLUMN) because this migration runs unconditionally on any database that
// predates schema_migrations — on a database that already has this shape
// (applied years ago through the old inline initTables() checks) it's a
// correct no-op; on a brand new database it builds the whole baseline in
// one pass. Every migration after this one doesn't need that guard: the
// schema_migrations table itself guarantees each one runs exactly once.
export const migration0001Baseline: Migration = {
  id: 1,
  name: 'baseline',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS service_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_slug TEXT NOT NULL,
        source TEXT NOT NULL,
        status TEXT NOT NULL,
        details TEXT,
        report_count INTEGER,
        checked_at DATETIME NOT NULL DEFAULT (datetime('now')),
        UNIQUE(service_slug, source)
      );

      CREATE TABLE IF NOT EXISTS incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_slug TEXT NOT NULL,
        incident_id TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        severity TEXT NOT NULL,
        started_at DATETIME,
        resolved_at DATETIME,
        description TEXT,
        source_url TEXT,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        UNIQUE(service_slug, incident_id)
      );

      CREATE TABLE IF NOT EXISTS status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_slug TEXT NOT NULL,
        status TEXT NOT NULL,
        report_count INTEGER DEFAULT 0,
        incident_count INTEGER DEFAULT 0,
        recorded_at DATETIME NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_history_service_date
        ON status_history(service_slug, recorded_at);

      CREATE INDEX IF NOT EXISTS idx_incidents_service_created
        ON incidents(service_slug, created_at);

      CREATE INDEX IF NOT EXISTS idx_incidents_resolved
        ON incidents(resolved_at);

      CREATE TABLE IF NOT EXISTS alert_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_slug TEXT NOT NULL,
        incident_id TEXT,
        alert_type TEXT NOT NULL,
        sent_at DATETIME NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_alert_log_lookup
        ON alert_log(service_slug, alert_type, sent_at);

      CREATE TABLE IF NOT EXISTS alert_rules (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        services TEXT NOT NULL DEFAULT '[]',
        min_severity TEXT NOT NULL DEFAULT 'major',
        email_enabled INTEGER NOT NULL DEFAULT 1,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled
        ON alert_rules(enabled);

      CREATE TABLE IF NOT EXISTS custom_services (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#268bd2',
        status_url TEXT NOT NULL,
        downdetector_slug TEXT,
        fetcher TEXT NOT NULL,
        brand_font TEXT NOT NULL DEFAULT 'var(--font-brand-inter), Inter, system-ui, sans-serif',
        refresh_seconds INTEGER NOT NULL DEFAULT 180,
        kind TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_custom_services_enabled
        ON custom_services(enabled);

      CREATE TABLE IF NOT EXISTS maintenance_windows (
        id TEXT PRIMARY KEY,
        service_slugs TEXT NOT NULL DEFAULT '[]',
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        note TEXT,
        created_by TEXT,
        created_at DATETIME NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_maint_active
        ON maintenance_windows(start_time, end_time);

      CREATE TABLE IF NOT EXISTS fetcher_latency (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_slug TEXT NOT NULL,
        source TEXT NOT NULL,
        latency_ms INTEGER NOT NULL,
        recorded_at DATETIME NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_fetcher_latency_lookup
        ON fetcher_latency(service_slug, source, recorded_at);

      CREATE TABLE IF NOT EXISTS boards (
        id TEXT PRIMARY KEY,
        device_token TEXT NOT NULL,
        board_id TEXT NOT NULL,
        name TEXT NOT NULL,
        starred INTEGER NOT NULL DEFAULT 0,
        tiles TEXT NOT NULL DEFAULT '[]',
        theme TEXT,
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        UNIQUE(device_token, board_id)
      );

      CREATE INDEX IF NOT EXISTS idx_boards_device
        ON boards(device_token);

      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id TEXT PRIMARY KEY,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_agent TEXT,
        created_at DATETIME NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS postmortems (
        id TEXT PRIMARY KEY,
        incident_db_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        generated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        last_edited_at DATETIME,
        exported_at DATETIME
      );

      CREATE INDEX IF NOT EXISTS idx_postmortems_incident
        ON postmortems(incident_db_id);

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // FTS5 virtual table for incident full-text search.
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS incidents_fts
        USING fts5(title, description, content='incidents', content_rowid='id');

      CREATE TRIGGER IF NOT EXISTS incidents_ai AFTER INSERT ON incidents BEGIN
        INSERT INTO incidents_fts(rowid, title, description)
          VALUES (new.id, new.title, COALESCE(new.description, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS incidents_au AFTER UPDATE ON incidents BEGIN
        INSERT INTO incidents_fts(incidents_fts, rowid, title, description)
          VALUES ('delete', old.id, old.title, COALESCE(old.description, ''));
        INSERT INTO incidents_fts(rowid, title, description)
          VALUES (new.id, new.title, COALESCE(new.description, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS incidents_ad AFTER DELETE ON incidents BEGIN
        INSERT INTO incidents_fts(incidents_fts, rowid, title, description)
          VALUES ('delete', old.id, old.title, COALESCE(old.description, ''));
      END;
    `);

    const historyCols = db.prepare(`PRAGMA table_info(status_history)`).all() as Array<{ name: string }>;
    if (!historyCols.some((c) => c.name === 'incident_count')) {
      db.exec(`ALTER TABLE status_history ADD COLUMN incident_count INTEGER DEFAULT 0`);
    }

    const ruleCols = db.prepare(`PRAGMA table_info(alert_rules)`).all() as Array<{ name: string }>;
    if (!ruleCols.some((c) => c.name === 'webhook_url')) {
      db.exec(`ALTER TABLE alert_rules ADD COLUMN webhook_url TEXT`);
    }
    if (!ruleCols.some((c) => c.name === 'webhook_enabled')) {
      db.exec(`ALTER TABLE alert_rules ADD COLUMN webhook_enabled INTEGER NOT NULL DEFAULT 0`);
    }
    if (!ruleCols.some((c) => c.name === 'channel_type')) {
      db.exec(`ALTER TABLE alert_rules ADD COLUMN channel_type TEXT NOT NULL DEFAULT 'generic'`);
    }
    if (!ruleCols.some((c) => c.name === 'escalation_enabled')) {
      db.exec(`ALTER TABLE alert_rules ADD COLUMN escalation_enabled INTEGER NOT NULL DEFAULT 0`);
    }
    if (!ruleCols.some((c) => c.name === 'escalation_intervals')) {
      db.exec(`ALTER TABLE alert_rules ADD COLUMN escalation_intervals TEXT NOT NULL DEFAULT '[240,1440]'`);
    }
    if (!ruleCols.some((c) => c.name === 'notify_on_anomaly')) {
      db.exec(`ALTER TABLE alert_rules ADD COLUMN notify_on_anomaly INTEGER NOT NULL DEFAULT 0`);
    }

    const logCols = db.prepare(`PRAGMA table_info(alert_log)`).all() as Array<{ name: string }>;
    if (!logCols.some((c) => c.name === 'escalation_level')) {
      db.exec(`ALTER TABLE alert_log ADD COLUMN escalation_level INTEGER NOT NULL DEFAULT 1`);
    }

    const statusCols = db.prepare(`PRAGMA table_info(service_status)`).all() as Array<{ name: string }>;
    if (!statusCols.some((c) => c.name === 'is_anomaly')) {
      db.exec(`ALTER TABLE service_status ADD COLUMN is_anomaly INTEGER NOT NULL DEFAULT 0`);
    }
    if (!statusCols.some((c) => c.name === 'anomaly_z_score')) {
      db.exec(`ALTER TABLE service_status ADD COLUMN anomaly_z_score REAL`);
    }

    // One-time cleanup: Downdetector was removed as a data source. The unused
    // columns (report_count, is_anomaly, anomaly_z_score, downdetector_slug,
    // notify_on_anomaly) are left in place — SQLite DROP COLUMN is risky with
    // the FTS triggers/WAL — but we purge the stale 'downdetector' status
    // rows so the dashboard doesn't surface ghost entries. Sentinel-guarded
    // (rather than a second migration) because it predates this framework.
    const ddPurged = db.prepare(`SELECT value FROM app_settings WHERE key = 'downdetector_rows_purged'`).get();
    if (!ddPurged) {
      db.exec(`DELETE FROM service_status WHERE source = 'downdetector'`);
      db.prepare(`INSERT INTO app_settings (key, value) VALUES ('downdetector_rows_purged', '1')`).run();
    }
  },
};
