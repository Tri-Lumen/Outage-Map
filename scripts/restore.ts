#!/usr/bin/env -S npx tsx
/**
 * Restores the live SQLite database from a backup file created by
 * scripts/backup.ts (or any valid SQLite file). Destructive: overwrites
 * DATABASE_PATH. Run this with the app server STOPPED — swapping the
 * database file out from under a running better-sqlite3 connection in
 * another process is not safe, WAL mode or not.
 *
 * Usage:
 *   npm run restore -- /path/to/backup.db
 *   npm run restore -- /path/to/backup.db --yes   # skip the confirmation prompt
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline/promises';
import Database from 'better-sqlite3';

const DB_PATH = process.env.DATABASE_PATH || './data/outage.db';
const SQLITE_MAGIC = 'SQLite format 3\0';

function looksLikeSqliteFile(filePath: string): boolean {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    return buf.toString('utf8') === SQLITE_MAGIC;
  } finally {
    fs.closeSync(fd);
  }
}

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${message} [y/N] `);
    return answer.trim().toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const skipConfirm = args.includes('--yes') || args.includes('-y');
  const backupPath = args.find((a) => !a.startsWith('-'));

  if (!backupPath) {
    console.error('Usage: npm run restore -- <path-to-backup.db> [--yes]');
    process.exit(1);
  }
  if (!fs.existsSync(backupPath)) {
    console.error(`Error: backup file not found: ${backupPath}`);
    process.exit(1);
  }
  if (!looksLikeSqliteFile(backupPath)) {
    console.error(`Error: ${backupPath} does not look like a SQLite database file`);
    process.exit(1);
  }

  // Validate the backup opens and passes an integrity check before touching
  // the live database at all.
  const check = new Database(backupPath, { readonly: true, fileMustExist: true });
  let integrityOk: boolean;
  try {
    const result = check.pragma('integrity_check') as Array<{ integrity_check: string }>;
    integrityOk = result.length === 1 && result[0].integrity_check === 'ok';
    if (!integrityOk) console.error('Error: backup file failed integrity check:', result);
  } finally {
    check.close();
  }
  if (!integrityOk) process.exit(1);

  console.log(`This will overwrite ${DB_PATH} with ${backupPath}.`);
  console.log('Make sure the app server is stopped first — restoring into a live database is not safe.');
  if (!skipConfirm) {
    const ok = await confirm('Proceed?');
    if (!ok) {
      console.log('Aborted.');
      process.exit(1);
    }
  }

  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  // Keep a safety copy of whatever was live before overwriting it.
  if (fs.existsSync(DB_PATH)) {
    const safetyPath = `${DB_PATH}.pre-restore-${Date.now()}`;
    fs.copyFileSync(DB_PATH, safetyPath);
    console.log(`Saved pre-restore safety copy: ${safetyPath}`);
  }

  fs.copyFileSync(backupPath, DB_PATH);
  // A restored file shouldn't carry over WAL/SHM sidecars from whatever was
  // live before it — they'd belong to the old database's write-ahead log,
  // not this one.
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = `${DB_PATH}${suffix}`;
    if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
  }

  console.log(`Restored ${DB_PATH} from ${backupPath}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
