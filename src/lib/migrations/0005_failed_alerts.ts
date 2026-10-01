import type { Migration } from './types';

// Dead-letter queue for alert dispatch failures. Email sends had zero retry
// and webhook sends had one retry inside httpFetch but nothing persisted for
// replay once that was exhausted — a failure just vanished into a log line.
// `payload` holds whatever the original call's arguments were (JSON), so a
// retry can simply re-invoke the same send function rather than
// reconstructing the alert from scratch.
export const migration0005FailedAlerts: Migration = {
  id: 5,
  name: 'failed_alerts',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS failed_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        service_slug TEXT NOT NULL,
        incident_id TEXT,
        payload TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 1,
        last_error TEXT,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        last_attempt_at DATETIME NOT NULL DEFAULT (datetime('now')),
        resolved_at DATETIME
      );

      CREATE INDEX IF NOT EXISTS idx_failed_alerts_unresolved
        ON failed_alerts(resolved_at, created_at);
    `);
  },
};
