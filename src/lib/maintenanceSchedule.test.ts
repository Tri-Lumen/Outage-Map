import { describe, expect, it } from 'vitest';
import { isWindowActiveAt, windowOverlapsRange } from './maintenanceSchedule';

describe('isWindowActiveAt', () => {
  it('matches a one-off window only within its range', () => {
    const w = { startTime: '2026-01-01T10:00:00Z', endTime: '2026-01-01T12:00:00Z', recurrence: 'none', recurrenceUntil: null };
    expect(isWindowActiveAt(w, new Date('2026-01-01T11:00:00Z'))).toBe(true);
    expect(isWindowActiveAt(w, new Date('2026-01-01T09:00:00Z'))).toBe(false);
    expect(isWindowActiveAt(w, new Date('2026-01-08T11:00:00Z'))).toBe(false);
  });

  it('matches a weekly window on later occurrences', () => {
    const w = { startTime: '2026-01-01T10:00:00Z', endTime: '2026-01-01T12:00:00Z', recurrence: 'weekly', recurrenceUntil: null };
    expect(isWindowActiveAt(w, new Date('2026-01-08T11:00:00Z'))).toBe(true);
    expect(isWindowActiveAt(w, new Date('2026-01-15T11:00:00Z'))).toBe(true);
    expect(isWindowActiveAt(w, new Date('2026-01-08T13:00:00Z'))).toBe(false);
    expect(isWindowActiveAt(w, new Date('2025-12-25T11:00:00Z'))).toBe(false);
  });

  it('stops matching after recurrenceUntil', () => {
    const w = {
      startTime: '2026-01-01T10:00:00Z', endTime: '2026-01-01T12:00:00Z',
      recurrence: 'weekly', recurrenceUntil: '2026-01-08T23:59:59Z',
    };
    expect(isWindowActiveAt(w, new Date('2026-01-08T11:00:00Z'))).toBe(true);
    expect(isWindowActiveAt(w, new Date('2026-01-15T11:00:00Z'))).toBe(false);
  });

  it('rejects malformed windows', () => {
    const w = { startTime: 'not-a-date', endTime: '2026-01-01T12:00:00Z', recurrence: 'none', recurrenceUntil: null };
    expect(isWindowActiveAt(w, new Date())).toBe(false);
  });
});

describe('windowOverlapsRange', () => {
  it('matches a one-off window overlapping a day', () => {
    const w = { startTime: '2026-01-01T10:00:00Z', endTime: '2026-01-01T12:00:00Z', recurrence: 'none', recurrenceUntil: null };
    expect(windowOverlapsRange(w, new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T23:59:59Z'))).toBe(true);
    expect(windowOverlapsRange(w, new Date('2026-01-02T00:00:00Z'), new Date('2026-01-02T23:59:59Z'))).toBe(false);
  });

  it('matches a weekly window on the right day-of-week each week', () => {
    const w = { startTime: '2026-01-01T10:00:00Z', endTime: '2026-01-01T12:00:00Z', recurrence: 'weekly', recurrenceUntil: null };
    expect(windowOverlapsRange(w, new Date('2026-01-08T00:00:00Z'), new Date('2026-01-08T23:59:59Z'))).toBe(true);
    expect(windowOverlapsRange(w, new Date('2026-01-09T00:00:00Z'), new Date('2026-01-09T23:59:59Z'))).toBe(false);
    expect(windowOverlapsRange(w, new Date('2025-12-24T00:00:00Z'), new Date('2025-12-24T23:59:59Z'))).toBe(false);
  });
});
