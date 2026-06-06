import { describe, it, expect } from 'vitest';
import { parseStatuspage } from './impl/statuspage';

type StatusArg = Parameters<typeof parseStatuspage>[0];
type IncidentsArg = Parameters<typeof parseStatuspage>[1];

const statusJson = (indicator: string, description: string | null = null): StatusArg =>
  ({ status: { indicator, description } } as StatusArg);
const incidentsJson = (incidents: unknown[]): IncidentsArg =>
  ({ incidents } as IncidentsArg);

describe('statuspage connector', () => {
  it('maps a healthy global indicator to operational', () => {
    const r = parseStatuspage(statusJson('none'), incidentsJson([]), incidentsJson([]), 'cloudflare');
    expect(r.status.status).toBe('operational');
    expect(r.incidents).toEqual([]);
  });

  it('#18: drops maintenance-only elevation (minor indicator, no active incident) to operational', () => {
    const r = parseStatuspage(statusJson('minor', 'Scheduled maintenance'), incidentsJson([]), incidentsJson([]), 'cloudflare');
    expect(r.status.status).toBe('operational');
  });

  it('keeps degraded when a real active incident exists', () => {
    const active = incidentsJson([
      { id: 'i1', name: 'API errors', status: 'investigating', impact: 'minor', created_at: '2026-01-01T00:00:00Z' },
    ]);
    const r = parseStatuspage(statusJson('minor'), active, incidentsJson([]), 'cloudflare');
    expect(r.status.status).toBe('degraded');
  });

  it('maps a critical indicator with an active incident to down', () => {
    const active = incidentsJson([
      { id: 'i2', name: 'Major outage', status: 'identified', impact: 'critical', created_at: '2026-01-01T00:00:00Z' },
    ]);
    const r = parseStatuspage(statusJson('critical'), active, incidentsJson([]), 'x');
    expect(r.status.status).toBe('down');
  });

  it('returns unknown when status.json could not be fetched (never fabricates)', () => {
    const r = parseStatuspage(null, null, null, 'x');
    expect(r.status.status).toBe('unknown');
  });

  it('extracts active and resolved incidents for display', () => {
    const list = incidentsJson([
      { id: 'a', name: 'Active', status: 'monitoring', impact: 'major', created_at: '2026-01-01T00:00:00Z' },
      { id: 'b', name: 'Done', status: 'resolved', impact: 'minor', created_at: '2026-01-01T00:00:00Z', resolved_at: '2026-01-01T01:00:00Z' },
    ]);
    const r = parseStatuspage(statusJson('none'), incidentsJson([]), list, 'x');
    expect(r.incidents).toHaveLength(2);
    expect(r.incidents[0].resolvedAt).toBeNull();
    expect(r.incidents[1].status).toBe('resolved');
    expect(r.incidents[1].resolvedAt).toBe('2026-01-01T01:00:00Z');
  });
});
