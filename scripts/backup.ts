#!/usr/bin/env -S npx tsx
/**
 * Backs up the live SQLite database using better-sqlite3's online backup API
 * (sqlite3_backup under the hood), which is safe to run against a database
 * that's open and being written to — unlike `cp`, which can grab a torn
 * snapshot of a WAL-mode database (the main file, -wal, and -shm can be
 * copied at inconsistent points relative to each other).
 *
 * Usage:
 *   npm run backup                      Back up to ./backups/outage-<timestamp>.db
 *   npm run backup -- /path/to/dest.db  Back up to an explicit path
 *   npm run backup -- --keep 30         Keep only the 30 most recent default-dir backups
 */
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DB_PATH = process.env.DATABASE_PATH || './data/outage.db';
const DEFAULT_BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const DEFAULT_KEEP = 14;

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function parseArgs(argv: string[]): { dest: string | null; keep: number } {
  let dest: string | null = null;
  let keep = DEFAULT_KEEP;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--keep') {
      keep = Number(argv[i + 1]);
      if (!Number.isFinite(keep) || keep < 1) throw new Error('--keep must be a positive number');
      i++;
    } else if (!argv[i].startsWith('--')) {
      dest = argv[i];
    }
  }
  return { dest, keep };
}

function pruneOldBackups(dir: string, keep: number) {
  const entries = fs.readdirSync(dir)
    .filter((f) => f.startsWith('outage-') && f.endsWith('.db'))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const entry of entries.slice(keep)) {
    fs.unlinkSync(path.join(dir, entry.name));
    console.log(`Pruned old backup: ${entry.name}`);
  }
}

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`Error: database not found at ${DB_PATH} (set DATABASE_PATH to override)`);
    process.exit(1);
  }

  const { dest, keep } = parseArgs(process.argv.slice(2));
  const usingDefaultDir = !dest;
  const destPath = dest ?? path.join(DEFAULT_BACKUP_DIR, `outage-${timestamp()}.db`);

  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  // Opening read-only avoids creating/locking the source if it somehow
  // doesn't exist yet, and makes intent explicit — this script only reads.
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  try {
    console.log(`Backing up ${DB_PATH} -> ${destPath} ...`);
    await db.backup(destPath);
  } finally {
    db.close();
  }

  const sizeMb = (fs.statSync(destPath).size / (1024 * 1024)).toFixed(2);
  console.log(`Backup complete: ${destPath} (${sizeMb} MB)`);

  if (usingDefaultDir) pruneOldBackups(DEFAULT_BACKUP_DIR, keep);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
