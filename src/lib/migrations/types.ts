import type Database from 'better-sqlite3';

export interface Migration {
  /** Monotonically increasing, never reused once shipped. */
  id: number;
  name: string;
  up: (db: Database.Database) => void;
}
