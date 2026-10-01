import type Database from 'better-sqlite3';
import type { Migration } from './types';
import { migration0001Baseline } from './0001_baseline';
import { migration0002MaintenanceRecurrence } from './0002_maintenance_recurrence';
import { migration0003StatusTransitions } from './0003_status_transitions';
import { migration0004AlertRuleSecret } from './0004_alert_rule_secret';

// Ordered oldest-first. Append new migrations here — never edit or
// renumber a shipped one; add the next id instead, even to fix a mistake
// in an earlier one (a second migration correcting the first keeps
// deployments that already applied it consistent with ones that haven't).
export const MIGRATIONS: Migration[] = [
  migration0001Baseline,
  migration0002MaintenanceRecurrence,
  migration0003StatusTransitions,
  migration0004AlertRuleSecret,
];

/**
 * Applies every migration not yet recorded in schema_migrations, in order,
 * each in its own transaction. Safe to call on every boot: already-applied
 * migrations are skipped via the schema_migrations row, not by re-checking
 * the schema itself (only migration 0001 — which predates this table —
 * needs to guard its own statements for that reason).
 */
export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    (db.prepare('SELECT id FROM schema_migrations').all() as Array<{ id: number }>).map((r) => r.id),
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    const apply = db.transaction(() => {
      migration.up(db);
      db.prepare('INSERT INTO schema_migrations (id, name) VALUES (?, ?)').run(migration.id, migration.name);
    });
    apply();
  }
}
