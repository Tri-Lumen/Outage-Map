import { describe, it, expect } from 'vitest';
import { parseAwsItems } from './impl/aws';
import type { RssItem } from './shared/fetchXml';

const NOW = Date.parse('2026-06-06T12:00:00Z');
const ago = (hours: number) => new Date(NOW - hours * 3600_000);
const item = (over: Partial<RssItem>): RssItem =>
  ({ title: '', description: null, link: null, guid: null, pubDate: null, ...over });

describe('aws connector', () => {
  it('reports operational when the only events are outside the window', () => {
    const r = parseAwsItems([item({ title: 'Old service disruption', pubDate: ago(5) })], 'aws', NOW);
    expect(r.status.status).toBe('operational');
    expect(r.incidents).toEqual([]);
  });

  it('maps a service disruption within the hour to major_outage', () => {
    const r = parseAwsItems(
      [item({ title: 'Service disruption in us-east-1', pubDate: ago(0.5), guid: 'g1' })],
      'aws',
      NOW,
    );
    expect(r.status.status).toBe('major_outage');
    expect(r.incidents[0].incidentId).toMatch(/^aws-/);
    expect(r.incidents[0].startedAt).toBe(ago(0.5).toISOString());
  });

  it('maps elevated error rates to degraded', () => {
    const r = parseAwsItems([item({ title: 'Elevated error rates', pubDate: ago(1.5) })], 'aws', NOW);
    expect(r.status.status).toBe('degraded');
  });

  it('keeps a service disruption major_outage past the one-hour mark, as long as it is within the two-hour window', () => {
    const r = parseAwsItems(
      [item({ title: 'Service disruption in us-east-1', pubDate: ago(1.5), guid: 'g2' })],
      'aws',
      NOW,
    );
    expect(r.status.status).toBe('major_outage');
    expect(r.incidents[0].severity).toBe('major');
  });

  it('skips items without a valid pubDate', () => {
    const r = parseAwsItems([item({ title: 'Service disruption', pubDate: null })], 'aws', NOW);
    expect(r.status.status).toBe('operational');
  });
});
