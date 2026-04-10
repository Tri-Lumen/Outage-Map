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
      recorded_at DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_history_service_date
      ON status_history(service_slug, recorded_at);

    CREATE TABLE IF NOT EXISTS alert_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_slug TEXT NOT NULL,
      incident_id TEXT,
      alert_type TEXT NOT NULL,
      sent_at DATETIME NOT NULL DEFAULT (datetime('now'))
    );
  `);
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
  reportCount: number
) {
  const db = getDb();
  db.prepare(`
    INSERT INTO status_history (service_slug, status, report_count, recorded_at)
    VALUES (?, ?, ?, datetime('now'))
  `).run(serviceSlug, status, reportCount);
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
      SELECT service_slug, status, report_count, recorded_at
      FROM status_history
      WHERE service_slug = ? AND recorded_at >= datetime('now', '-' || ? || ' days')
      ORDER BY recorded_at ASC
    `).all(serviceSlug, days) as Array<{
      service_slug: string;
      status: string;
      report_count: number;
      recorded_at: string;
    }>;
  }
  return db.prepare(`
    SELECT service_slug, status, report_count, recorded_at
    FROM status_history
    WHERE recorded_at >= datetime('now', '-' || ? || ' days')
    ORDER BY recorded_at ASC
  `).all(days) as Array<{
    service_slug: string;
    status: string;
    report_count: number;
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
