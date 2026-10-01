import { z } from 'zod';
import type { IncidentResult, ServiceStatus } from '../../types';
import type { Connector, ConnectorContext, ConnectorResult } from '../types';
import { unknownResult } from '../types';
import { fetchJson } from '../shared/fetchJson';
import { worseOf } from '../shared/normalize';
import { stableIncidentId } from '../shared/incidentId';

const DASHBOARD_URL = 'https://www.google.com/appsstatus/dashboard/';
const INCIDENTS_URL = 'https://www.google.com/appsstatus/dashboard/incidents.json';

const GOOGLE_PRODUCTS = [
  'Gmail', 'Google Drive', 'Google Meet', 'Google Calendar',
  'Google Chat', 'Google Docs', 'Google Sheets', 'Google Slides',
];

// An incident is only "active" if its last update is recent. Google leaves
// many incidents with `end: null` for hours/days after they actually recover,
// which is the root of the #17 zombie-incident bug.
const FRESHNESS_MS = 24 * 60 * 60 * 1000;

const UpdateSchema = z
  .object({
    // Google's live feed sends this as a numeric string (e.g. "2"), not a
    // number, despite the field looking numeric — coerce rather than reject.
    status: z.union([z.number(), z.string()]).nullish().transform((v) => (v == null ? v : Number(v))),
    text: z.string().nullish(),
    when: z.string().nullish(),
  })
  .passthrough();

const IncidentSchema = z
  .object({
    id: z.union([z.string(), z.number()]).nullish(),
    external_desc: z.string().nullish(),
    service_name: z.string().nullish(),
    begin: z.string().nullish(),
    end: z.string().nullish(),
    most_recent_update: UpdateSchema.nullish(),
    uri: z.string().nullish(),
  })
  .passthrough();

const FeedSchema = z.array(IncidentSchema);
type GoogleIncident = z.infer<typeof IncidentSchema>;

// Treat unknown/out-of-range status codes as operational to avoid false
// positives if Google changes their numbering.
function severityFromStatus(status: number): ServiceStatus {
  switch (status) {
    case 2: return 'degraded';
    case 3: return 'major_outage';
    case 4: return 'down';
    default: return 'operational';
  }
}

/**
 * #17 fix. An incident counts toward status/incidents only if ALL hold:
 *   (a) `end` is null/absent              — Google's own "ongoing" signal
 *   (b) most_recent_update.status is non-operational
 *   (c) most_recent_update.when is within the freshness window
 * Anything ambiguous (stale `when`, missing `when`, operational latest status)
 * is treated as resolved — no fabricated incident, no inflated downtime.
 */
export function parseGoogleFeed(
  feed: GoogleIncident[],
  serviceSlug: string,
  now: number = Date.now(),
): ConnectorResult {
  let worst: ServiceStatus = 'operational';
  const affected = new Set<string>();
  const incidents: IncidentResult[] = [];

  for (const inc of feed) {
    const serviceName = inc.service_name || '';
    if (!GOOGLE_PRODUCTS.some((p) => serviceName.includes(p))) continue;

    const mapped = severityFromStatus(inc.most_recent_update?.status ?? 1);
    const whenText = inc.most_recent_update?.when;
    const whenMs = whenText ? Date.parse(whenText) : NaN;
    const fresh = !Number.isNaN(whenMs) && now - whenMs <= FRESHNESS_MS;
    const active = !inc.end && mapped !== 'operational' && fresh;
    if (!active) continue;

    affected.add(serviceName);
    worst = worseOf(worst, mapped);

    const seed = inc.id != null ? String(inc.id) : `${serviceName}|${inc.begin ?? 'unknown'}`;
    incidents.push({
      serviceSlug,
      incidentId: stableIncidentId('gws', seed),
      title: inc.external_desc?.slice(0, 140) || `${serviceName} incident`,
      status: 'investigating',
      severity: mapped === 'major_outage' || mapped === 'down' ? 'major' : 'minor',
      startedAt: inc.begin || inc.most_recent_update?.when || null,
      resolvedAt: null,
      description: inc.most_recent_update?.text || inc.external_desc || null,
      sourceUrl: inc.uri ? `https://www.google.com${inc.uri}` : DASHBOARD_URL,
    });
  }

  const details =
    worst === 'operational'
      ? 'All Google Workspace services operational'
      : `Issues: ${Array.from(affected).join(', ') || 'Some services affected'}`;

  return { status: { status: worst, details }, incidents };
}

export const googleConnector: Connector = {
  kind: 'google',
  async fetch(ctx: ConnectorContext): Promise<ConnectorResult> {
    const r = await fetchJson(INCIDENTS_URL, FeedSchema, ctx.serviceSlug, {
      timeoutMs: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json, text/plain, */*',
      },
    });
    if (!r.ok) return unknownResult('Unable to fetch Google Workspace status');
    return parseGoogleFeed(r.data, ctx.serviceSlug);
  },
};
