import { describe, it, expect, vi, beforeEach } from 'vitest';

const getHistoricalDDReports = vi.fn();
const getJsonSetting = vi.fn();

// Mock the db module so anomaly scoring runs without better-sqlite3.
vi.mock('@/lib/db', () => ({
  getHistoricalDDReports: (...args: unknown[]) => getHistoricalDDReports(...args),
  getJsonSetting: (...args: unknown[]) => getJsonSetting(...args),
}));

import { computeZScore } from './anomaly';

beforeEach(() => {
  getHistoricalDDReports.mockReset();
  getJsonSetting.mockReset();
  getJsonSetting.mockReturnValue({}); // fall back to defaults (threshold 2.5, minPoints 24)
});

describe('computeZScore', () => {
  it('returns no anomaly with too few data points', () => {
    getHistoricalDDReports.mockReturnValue([1, 2, 3]);
    expect(computeZScore('svc', 100).isAnomaly).toBe(false);
  });

  it('returns no anomaly for a near-constant signal', () => {
    getHistoricalDDReports.mockReturnValue(Array(30).fill(10));
    expect(computeZScore('svc', 11).isAnomaly).toBe(false);
  });

  it('flags a clear spike as an anomaly', () => {
    const history = Array.from({ length: 30 }, (_, i) => 10 + (i % 5));
    getHistoricalDDReports.mockReturnValue(history);
    const r = computeZScore('svc', 1000);
    expect(r.isAnomaly).toBe(true);
    expect(r.zScore).toBeGreaterThan(2.5);
  });

  it('respects a configured threshold override from settings', () => {
    const history = Array.from({ length: 30 }, (_, i) => 10 + (i % 5));
    getHistoricalDDReports.mockReturnValue(history);
    getJsonSetting.mockReturnValue({ threshold: 100, minPoints: 24 });
    expect(computeZScore('svc', 30).isAnomaly).toBe(false);
  });
});
