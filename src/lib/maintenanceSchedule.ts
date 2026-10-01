// Pure scheduling logic for maintenance windows, shared between the server
// (src/lib/db.ts) and client components (MaintenanceView.tsx). Kept free of
// better-sqlite3 and other server-only imports so it can be bundled client-side.

export interface MaintenanceSchedule {
  startTime: string;
  endTime: string;
  recurrence: string;
  recurrenceUntil: string | null;
}

// A 'weekly' window's startTime/endTime describe only the FIRST occurrence
// (day-of-week + time-of-day + duration); every later occurrence repeats
// exactly 7 days apart, forever unless recurrenceUntil is set. There's no
// clean way to express "same time every week, indefinitely" as a SQL range
// check, so recurring windows are matched here in JS instead of in the query.
export function isWindowActiveAt(window: MaintenanceSchedule, at: Date): boolean {
  const start = new Date(window.startTime);
  const end = new Date(window.endTime);
  const durationMs = end.getTime() - start.getTime();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || durationMs <= 0) return false;

  if (window.recurrence !== 'weekly') {
    return start.getTime() <= at.getTime() && at.getTime() <= end.getTime();
  }

  if (window.recurrenceUntil) {
    const until = new Date(window.recurrenceUntil);
    if (!Number.isNaN(until.getTime()) && at.getTime() > until.getTime()) return false;
  }
  if (at.getTime() < start.getTime()) return false;

  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const elapsedInWeek = (at.getTime() - start.getTime()) % WEEK_MS;
  return elapsedInWeek < durationMs;
}

// Does this window ever overlap the given [dayStart, dayEnd] range, on any
// occurrence? For a one-off window that's a plain range check; for a weekly
// one, project the day range back onto the first-occurrence week and compare
// phase, since occurrences repeat every 7 days indefinitely (or until
// recurrenceUntil).
export function windowOverlapsRange(window: MaintenanceSchedule, rangeStart: Date, rangeEnd: Date): boolean {
  const start = new Date(window.startTime);
  const end = new Date(window.endTime);
  const durationMs = end.getTime() - start.getTime();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || durationMs <= 0) return false;

  if (window.recurrence !== 'weekly') {
    return start.getTime() <= rangeEnd.getTime() && end.getTime() >= rangeStart.getTime();
  }

  if (window.recurrenceUntil) {
    const until = new Date(window.recurrenceUntil);
    if (!Number.isNaN(until.getTime()) && rangeStart.getTime() > until.getTime()) return false;
  }
  if (rangeEnd.getTime() < start.getTime()) return false;

  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  // Walk back from rangeStart to the nearest occurrence start at or before
  // it (at most one week early), then check that occurrence and the next.
  const sinceStart = rangeStart.getTime() - start.getTime();
  const weeksElapsed = Math.floor(sinceStart / WEEK_MS);
  for (const w of [weeksElapsed - 1, weeksElapsed, weeksElapsed + 1]) {
    if (w < 0) continue;
    const occStart = start.getTime() + w * WEEK_MS;
    const occEnd = occStart + durationMs;
    if (occStart <= rangeEnd.getTime() && occEnd >= rangeStart.getTime()) return true;
  }
  return false;
}
