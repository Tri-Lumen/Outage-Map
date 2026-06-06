import type { IncidentResult, ServiceStatus } from '../../types';
import type { Connector, ConnectorContext, ConnectorResult } from '../types';
import { unknownResult } from '../types';
import { fetchRssItems, RssItem } from '../shared/fetchXml';
import { stableIncidentId } from '../shared/incidentId';

const AWS_RSS_URL = 'https://health.aws.amazon.com/health/status/feed';
const AWS_SOURCE_URL = 'https://health.aws.amazon.com/health/status';

const MAJOR_KEYWORDS = /(service disruption|outage|unavailable)/i;
const DEGRADED_KEYWORDS = /(increased error|elevated|degraded|performance|latenc)/i;

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

// Authoritative-by-recency: only RSS items within the window count, so old
// events never linger as a false "degraded".
export function parseAwsItems(items: RssItem[], serviceSlug: string, now: number = Date.now()): ConnectorResult {
  let worst: ServiceStatus = 'operational';
  const recentTitles: string[] = [];
  const incidents: IncidentResult[] = [];

  for (const item of items) {
    if (!item.title || !item.pubDate) continue;
    const ageMs = now - item.pubDate.getTime();
    if (ageMs > TWO_HOURS_MS) continue;

    const isMajor = MAJOR_KEYWORDS.test(item.title) && ageMs <= ONE_HOUR_MS;
    const isDegraded = DEGRADED_KEYWORDS.test(item.title) || MAJOR_KEYWORDS.test(item.title);

    if (isMajor) worst = 'major_outage';
    else if (isDegraded && worst === 'operational') worst = 'degraded';

    recentTitles.push(item.title);

    incidents.push({
      serviceSlug,
      incidentId: stableIncidentId('aws', item.guid || `${item.title}|${item.pubDate.toISOString()}`),
      title: item.title,
      status: 'investigating',
      severity: isMajor ? 'major' : 'minor',
      startedAt: item.pubDate.toISOString(),
      resolvedAt: null,
      description: item.description,
      sourceUrl: item.link || AWS_SOURCE_URL,
    });
  }

  const details =
    worst === 'operational'
      ? 'All AWS services operating normally'
      : `Recent events: ${recentTitles.slice(0, 3).join('; ')}`;

  return { status: { status: worst, details }, incidents };
}

export const awsConnector: Connector = {
  kind: 'aws',
  async fetch(ctx: ConnectorContext): Promise<ConnectorResult> {
    const r = await fetchRssItems(AWS_RSS_URL, { timeoutMs: 15000 });
    if (!r.ok) return unknownResult('Unable to fetch AWS health feed');
    return parseAwsItems(r.items, ctx.serviceSlug);
  },
};
