import { describe, it, expect } from 'vitest';
import { parseGoogleFeed } from './impl/google';

type Feed = Parameters<typeof parseGoogleFeed>[0];
const NOW = Date.parse('2026-06-06T12:00:00Z');
const ago = (hours: number) => new Date(NOW - hours * 3600_000).toISOString();

describe('google connector', () => {
  it('reports operational for an empty feed', () => {
    const r = parseGoogleFeed([] as Feed, 'google-workspace', NOW);
    expect(r.status.status).toBe('operational');
    expect(r.incidents).toEqual([]);
  });

  it('#17: does not resurrect a zombie incident (end null but stale last update)', () => {
    const feed = [
      {
        id: 'z1', service_name: 'Gmail', external_desc: 'Old issue', begin: ago(80), end: null,
        most_recent_update: { status: 2, text: 'Investigating', when: ago(72) },
      },
    ] as Feed;
    const r = parseGoogleFeed(feed, 'google-workspace', NOW);
    expect(r.status.status).toBe('operational');
    expect(r.incidents).toEqual([]);
  });

  it('treats a back-to-normal (status 1) entry as resolved even when end is null', () => {
    const feed = [
      {
        id: 'r1', service_name: 'Gmail', begin: ago(3), end: null,
        most_recent_update: { status: 1, text: 'The issue is resolved', when: ago(0.5) },
      },
    ] as Feed;
    expect(parseGoogleFeed(feed, 'google-workspace', NOW).status.status).toBe('operational');
  });

  it('surfaces a fresh, ongoing incident with a stable id and real start time', () => {
    const feed = [
      {
        id: 'a1', service_name: 'Google Drive', external_desc: 'Drive disruption', begin: ago(2), end: null,
        most_recent_update: { status: 3, text: 'Ongoing', when: ago(1) },
      },
    ] as Feed;
    const r = parseGoogleFeed(feed, 'google-workspace', NOW);
    expect(r.status.status).toBe('major_outage');
    expect(r.incidents).toHaveLength(1);
    expect(r.incidents[0].incidentId).toMatch(/^gws-/);
    expect(r.incidents[0].startedAt).toBe(ago(2));
    // Stable across polls.
    const later = parseGoogleFeed(feed, 'google-workspace', NOW + 180_000);
    expect(later.incidents[0].incidentId).toBe(r.incidents[0].incidentId);
  });

  it('ignores untracked products', () => {
    const feed = [
      {
        id: 'u1', service_name: 'Google Voice', begin: ago(1), end: null,
        most_recent_update: { status: 3, when: ago(0.5) },
      },
    ] as Feed;
    expect(parseGoogleFeed(feed, 'google-workspace', NOW).status.status).toBe('operational');
  });
});
