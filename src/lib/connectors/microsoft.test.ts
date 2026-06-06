import { describe, it, expect } from 'vitest';
import { parseAzureRss } from './impl/microsoft';
import type { RssItem } from './shared/fetchXml';

const NOW = Date.parse('2026-06-06T12:00:00Z');
const ago = (hours: number) => new Date(NOW - hours * 3600_000);
const item = (over: Partial<RssItem>): RssItem =>
  ({ title: '', description: null, link: null, guid: null, pubDate: null, ...over });

describe('microsoft connector', () => {
  it('reports operational when there are no recent matching events', () => {
    const r = parseAzureRss([item({ title: 'Informational note', pubDate: ago(2) })], 'microsoft-365', NOW);
    expect(r.status.status).toBe('operational');
    expect(r.incidents).toEqual([]);
  });

  it('maps a service outage to major_outage with an incident', () => {
    const r = parseAzureRss([item({ title: 'Service outage affecting Azure AD', pubDate: ago(1) })], 'microsoft-365', NOW);
    expect(r.status.status).toBe('major_outage');
    expect(r.incidents).toHaveLength(1);
    expect(r.incidents[0].incidentId).toMatch(/^ms-/);
  });

  it('ignores events older than the recency window', () => {
    const r = parseAzureRss([item({ title: 'Service outage', pubDate: ago(30) })], 'microsoft-365', NOW);
    expect(r.status.status).toBe('operational');
  });
});
