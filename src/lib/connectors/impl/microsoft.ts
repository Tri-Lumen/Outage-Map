import type { IncidentResult, ServiceStatus } from '../../types';
import type { Connector, ConnectorContext, ConnectorResult } from '../types';
import { unknownResult } from '../types';
import { fetchRssItems, RssItem } from '../shared/fetchXml';
import { stableIncidentId } from '../shared/incidentId';

// Microsoft 365 (Exchange/Teams/SharePoint) has no public, unauthenticated,
// machine-readable status feed — the real one is the tenant-authenticated
// Service Health API. Azure publishes an RSS feed, which is the best public
// signal for the Microsoft platform, so we use it and are explicit in the
// details that M365 proper is not separately tracked. We do NOT scrape HTML or
// fabricate incidents (the old connector invented them from DOM class names).
const AZURE_RSS_URL = 'https://azure.status.microsoft/en-us/status/feed/';

const MAJOR_KEYWORDS = /(service outage|widespread outage|extended outage|service interruption)/i;
const DEGRADED_KEYWORDS = /(active event|service degradation|advisory|degraded performance)/i;

const WINDOW_MS = 24 * 60 * 60 * 1000;

export function parseAzureRss(items: RssItem[], serviceSlug: string, now: number = Date.now()): ConnectorResult {
  let worst: ServiceStatus = 'operational';
  const recentTitles: string[] = [];
  const incidents: IncidentResult[] = [];

  for (const item of items) {
    if (!item.pubDate) continue;
    if (now - item.pubDate.getTime() > WINDOW_MS) continue;

    const haystack = `${item.title} ${item.description ?? ''}`;
    const isMajor = MAJOR_KEYWORDS.test(haystack);
    const isDegraded = DEGRADED_KEYWORDS.test(haystack);
    if (!isMajor && !isDegraded) continue;

    if (isMajor) worst = 'major_outage';
    else if (worst === 'operational') worst = 'degraded';

    recentTitles.push(item.title);
    incidents.push({
      serviceSlug,
      incidentId: stableIncidentId('ms', item.guid || `${item.title}|${item.pubDate.toISOString()}`),
      title: item.title,
      status: 'investigating',
      severity: isMajor ? 'major' : 'minor',
      startedAt: item.pubDate.toISOString(),
      resolvedAt: null,
      description: item.description,
      sourceUrl: item.link || 'https://azure.status.microsoft/en-us/status',
    });
  }

  const details =
    worst === 'operational'
      ? 'Azure status nominal (Microsoft 365 has no public status feed)'
      : `Azure events: ${recentTitles.slice(0, 3).join('; ')}`;

  return { status: { status: worst, details }, incidents };
}

export const microsoftConnector: Connector = {
  kind: 'microsoft',
  async fetch(ctx: ConnectorContext): Promise<ConnectorResult> {
    const r = await fetchRssItems(AZURE_RSS_URL, { timeoutMs: 15000 });
    if (!r.ok) return unknownResult('Unable to fetch Microsoft/Azure status feed');
    return parseAzureRss(r.items, ctx.serviceSlug);
  },
};
