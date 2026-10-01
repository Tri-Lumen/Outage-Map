import type { Migration } from './types';

// Multi-user accounts for logging into the UI with a personal identity
// instead of sharing one CRON_SECRET/ENABLE_RULES_API bearer across every
// caller. 'admin' can do everything the existing write API already allows;
// 'viewer' can log in and read, but isAuthorized() (src/lib/apiAuth.ts)
// never treats a viewer session as authorized for a mutation.
export const migration0006Users: Migration = {
  id: 6,
  name: 'users',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer',
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
      );
    `);
  },
};
