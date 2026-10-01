import type { Migration } from './types';

// Adds weekly recurrence to maintenance windows. `start_time`/`end_time`
// on a recurring row still describe the FIRST occurrence (day-of-week +
// time-of-day + duration are all derived from that one pair); matching
// "is this window active now" projects that onto the current week — see
// isWindowActiveAt in db.ts. `recurrence_until` bounds how long the series
// repeats; null means "repeats until deleted".
export const migration0002MaintenanceRecurrence: Migration = {
  id: 2,
  name: 'maintenance_recurrence',
  up(db) {
    db.exec(`ALTER TABLE maintenance_windows ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'none'`);
    db.exec(`ALTER TABLE maintenance_windows ADD COLUMN recurrence_until DATETIME`);
  },
};
