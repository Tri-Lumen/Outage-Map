import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH || './data/outage.db';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initTables(db);
  return db;
}

function initTables(db: Database.Database) {
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
  `);

  // Safe migration for pre-existing databases — add incident_count if missing.
  const cols = db.prepare(`PRAGMA table_info(status_history)`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'incident_count')) {
    db.exec(`ALTER TABLE status_history ADD COLUMN incident_count INTEGER DEFAULT 0`);
  }
}

export function upsertServiceStatus(
  serviceSlug: string,
  source: 'official' | 'downdetector',
  status: string,
  details: string | null,
  reportCount: number | null
) {
  const db = getDb();
  db.prepare(`
    INSERT INTO service_status (service_slug, source, status, details, report_count, checked_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(service_slug, source) DO UPDATE SET
      status = excluded.status,
      details = excluded.details,
      report_count = excluded.report_count,
      checked_at = excluded.checked_at
  `).run(serviceSlug, source, status, details, reportCount);
}

export function insertStatusHistory(
  serviceSlug: string,
  status: string,
  reportCount: number,
  incidentCount: number = 0
) {
  const db = getDb();
  db.prepare(`
    INSERT INTO status_history (service_slug, status, report_count, incident_count, recorded_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(serviceSlug, status, reportCount, incidentCount);
}

export function upsertIncident(
  serviceSlug: string,
  incidentId: string,
  title: string,
  status: string,
  severity: string,
  startedAt: string | null,
  resolvedAt: string | null,
  description: string | null,
  sourceUrl: string | null
): { isNew: boolean } {
  const db = getDb();
  const existing = db.prepare(
    'SELECT id FROM incidents WHERE service_slug = ? AND incident_id = ?'
  ).get(serviceSlug, incidentId);

  if (existing) {
    db.prepare(`
      UPDATE incidents SET
        title = ?, status = ?, severity = ?, started_at = ?,
        resolved_at = ?, description = ?, source_url = ?,
        updated_at = datetime('now')
      WHERE service_slug = ? AND incident_id = ?
    `).run(title, status, severity, startedAt, resolvedAt, description, sourceUrl, serviceSlug, incidentId);
    return { isNew: false };
  }

  db.prepare(`
    INSERT INTO incidents (service_slug, incident_id, title, status, severity,
      started_at, resolved_at, description, source_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(serviceSlug, incidentId, title, status, severity, startedAt, resolvedAt, description, sourceUrl);
  return { isNew: true };
}

export function getServiceStatuses() {
  const db = getDb();
  return db.prepare('SELECT * FROM service_status ORDER BY service_slug, source').all() as Array<{
    service_slug: string;
    source: string;
    status: string;
    details: string | null;
    report_count: number | null;
    checked_at: string;
  }>;
}

export function getActiveIncidentCounts(): Record<string, number> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT service_slug, COUNT(*) as count
    FROM incidents
    WHERE resolved_at IS NULL
    GROUP BY service_slug
  `).all() as Array<{ service_slug: string; count: number }>;
  const out: Record<string, number> = {};
  for (const r of rows) out[r.service_slug] = r.count;
  return out;
}

export function getRecentIncidents(days: number = 7) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM incidents
    WHERE created_at >= datetime('now', '-' || ? || ' days')
    ORDER BY started_at DESC, created_at DESC
  `).all(days) as Array<{
    id: number;
    service_slug: string;
    incident_id: string;
    title: string;
    status: string;
    severity: string;
    started_at: string | null;
    resolved_at: string | null;
    description: string | null;
    source_url: string | null;
    created_at: string;
    updated_at: string;
  }>;
}

export function getStatusHistory(serviceSlug: string | null, days: number = 30) {
  const db = getDb();
  if (serviceSlug) {
    return db.prepare(`
      SELECT service_slug, status, report_count, incident_count, recorded_at
      FROM status_history
      WHERE service_slug = ? AND recorded_at >= datetime('now', '-' || ? || ' days')
      ORDER BY recorded_at ASC
    `).all(serviceSlug, days) as Array<{
      service_slug: string;
      status: string;
      report_count: number;
      incident_count: number;
      recorded_at: string;
    }>;
  }
  return db.prepare(`
    SELECT service_slug, status, report_count, incident_count, recorded_at
    FROM status_history
    WHERE recorded_at >= datetime('now', '-' || ? || ' days')
    ORDER BY recorded_at ASC
  `).all(days) as Array<{
    service_slug: string;
    status: string;
    report_count: number;
    incident_count: number;
    recorded_at: string;
  }>;
}

export function hasRecentAlert(serviceSlug: string, incidentId: string | null, alertType: string): boolean {
  const db = getDb();
  const row = db.prepare(`
    SELECT id FROM alert_log
    WHERE service_slug = ? AND (incident_id = ? OR (incident_id IS NULL AND ? IS NULL))
      AND alert_type = ? AND sent_at >= datetime('now', '-1 hour')
  `).get(serviceSlug, incidentId, incidentId, alertType);
  return !!row;
}

export function logAlert(serviceSlug: string, incidentId: string | null, alertType: string) {
  const db = getDb();
  db.prepare(`
    INSERT INTO alert_log (service_slug, incident_id, alert_type)
    VALUES (?, ?, ?)
  `).run(serviceSlug, incidentId, alertType);
}

export function cleanupOldHistory(days: number = 35) {
  const db = getDb();
  db.prepare(`
    DELETE FROM status_history WHERE recorded_at < datetime('now', '-' || ? || ' days')
  `).run(days);
}

export function cleanupOldIncidents(days: number = 90) {
  const db = getDb();
  // Only prune resolved incidents past the retention window — unresolved ones
  // must stay visible regardless of age.
  const result = db.prepare(`
    DELETE FROM incidents
    WHERE resolved_at IS NOT NULL
      AND created_at < datetime('now', '-' || ? || ' days')
  `).run(days);
  return result.changes;
}

export function vacuumDb() {
  const db = getDb();
  db.exec('VACUUM;');
}

export interface AlertRuleRow {
  id: string;
  email: string;
  services: string;
  min_severity: string;
  email_enabled: number;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export function listAlertRules(): AlertRuleRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT id, email, services, min_severity, email_enabled, enabled, created_at, updated_at
    FROM alert_rules
    ORDER BY created_at DESC
  `).all() as AlertRuleRow[];
}

export function listEnabledAlertRules(): AlertRuleRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT id, email, services, min_severity, email_enabled, enabled, created_at, updated_at
    FROM alert_rules
    WHERE enabled = 1
  `).all() as AlertRuleRow[];
}

export function insertAlertRule(row: {
  id: string;
  email: string;
  services: string;
  minSeverity: string;
  emailEnabled: boolean;
  enabled: boolean;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO alert_rules (id, email, services, min_severity, email_enabled, enabled)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    row.id,
    row.email,
    row.services,
    row.minSeverity,
    row.emailEnabled ? 1 : 0,
    row.enabled ? 1 : 0,
  );
}

export function updateAlertRule(
  id: string,
  patch: Partial<{
    email: string;
    services: string;
    minSeverity: string;
    emailEnabled: boolean;
    enabled: boolean;
  }>,
): boolean {
  const db = getDb();
  const fields: string[] = [];
  const values: Array<string | number> = [];
  if (patch.email !== undefined) { fields.push('email = ?'); values.push(patch.email); }
  if (patch.services !== undefined) { fields.push('services = ?'); values.push(patch.services); }
  if (patch.minSeverity !== undefined) { fields.push('min_severity = ?'); values.push(patch.minSeverity); }
  if (patch.emailEnabled !== undefined) { fields.push('email_enabled = ?'); values.push(patch.emailEnabled ? 1 : 0); }
  if (patch.enabled !== undefined) { fields.push('enabled = ?'); values.push(patch.enabled ? 1 : 0); }
  if (fields.length === 0) return false;
  fields.push(`updated_at = datetime('now')`);
  values.push(id);
  const result = db.prepare(`UPDATE alert_rules SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return result.changes > 0;
}

export function deleteAlertRule(id: string): boolean {
  const db = getDb();
  return db.prepare('DELETE FROM alert_rules WHERE id = ?').run(id).changes > 0;
}
