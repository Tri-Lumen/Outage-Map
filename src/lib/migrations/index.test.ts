import { describe, it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations, MIGRATIONS } from './index';

describe('runMigrations', () => {
  it('applies every migration and records it in schema_migrations', () => {
    const db = new Database(':memory:');
    runMigrations(db);

    const applied = db.prepare('SELECT id, name FROM schema_migrations ORDER BY id').all();
    expect(applied).toEqual(MIGRATIONS.map((m) => ({ id: m.id, name: m.name })));

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
    expect(tables.map((t) => t.name)).toContain('alert_rules');
    db.close();
  });

  it('is idempotent — a second call does not re-run any migration', () => {
    const db = new Database(':memory:');
    runMigrations(db);

    const upSpies = MIGRATIONS.map((m) => vi.spyOn(m, 'up'));
    runMigrations(db);
    for (const spy of upSpies) expect(spy).not.toHaveBeenCalled();

    db.close();
  });

  it('only applies migrations not yet recorded', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE schema_migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at DATETIME NOT NULL DEFAULT (datetime('now'))
      );
    `);
    // Pretend every real migration already ran, so a fresh run should be a no-op.
    for (const m of MIGRATIONS) {
      db.prepare('INSERT INTO schema_migrations (id, name) VALUES (?, ?)').run(m.id, m.name);
    }

    const upSpies = MIGRATIONS.map((m) => vi.spyOn(m, 'up'));
    runMigrations(db);
    for (const spy of upSpies) expect(spy).not.toHaveBeenCalled();

    db.close();
  });
});
