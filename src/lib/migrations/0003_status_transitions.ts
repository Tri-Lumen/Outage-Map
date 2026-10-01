import type { Migration } from './types';

// A durable log of every officialStatus change the poller observes, independent
// of whether that change triggered an email (sendStatusChangeAlert only fires
// for down/major_outage, and only when SMTP is configured) — this table exists
// so "what did this service's status actually do over time" can be answered
// even when no alert was ever sent for most of those changes.
export const migration0003StatusTransitions: Migration = {
  id: 3,
  name: 'status_transitions',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS status_transitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_slug TEXT NOT NULL,
        old_status TEXT NOT NULL,
        new_status TEXT NOT NULL,
        during_maintenance INTEGER NOT NULL DEFAULT 0,
        occurred_at DATETIME NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_status_transitions_service_time
        ON status_transitions(service_slug, occurred_at);
    `);
  },
};
