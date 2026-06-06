import { describe, it, expect } from 'vitest';
import { parseSalesforceActive } from './impl/salesforce';

type Active = Parameters<typeof parseSalesforceActive>[0];

describe('salesforce connector', () => {
  it('reports operational with an empty active set', () => {
    const r = parseSalesforceActive([] as Active, 'salesforce');
    expect(r.status.status).toBe('operational');
    expect(r.incidents).toEqual([]);
  });

  it('escalates to major_outage on a critical impact', () => {
    const r = parseSalesforceActive(
      [
        {
          id: 'i1', message: { subject: 'Login outage' },
          IncidentImpacts: [{ severity: 'critical', startTime: '2026-01-01T00:00:00Z', endTime: null }],
        },
      ] as Active,
      'salesforce',
    );
    expect(r.status.status).toBe('major_outage');
    expect(r.incidents[0].incidentId).toBe('i1');
    expect(r.incidents[0].startedAt).toBe('2026-01-01T00:00:00Z');
  });

  it('does not fabricate per-poll ids or start times when fields are missing', () => {
    const input = [{ message: { subject: 'Unnamed' } }] as Active;
    const a = parseSalesforceActive(input, 'salesforce');
    const b = parseSalesforceActive(input, 'salesforce');
    expect(a.incidents[0].incidentId).toMatch(/^sf-/);
    expect(a.incidents[0].incidentId).toBe(b.incidents[0].incidentId); // stable, not sf-<Date.now()>
    expect(a.incidents[0].startedAt).toBeNull();
  });
});
