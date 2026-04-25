import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { FetchResult, StatusResult, IncidentResult, ServiceStatus } from '../types';

const AWS_RSS_URL = 'https://health.aws.amazon.com/health/status/feed';
const AWS_SOURCE_URL = 'https://health.aws.amazon.com/health/status';

const MAJOR_KEYWORDS = /(service disruption|outage|unavailable)/i;
const DEGRADED_KEYWORDS = /(increased error|elevated|degraded|performance|latenc)/i;

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

export async function fetchAwsStatus(serviceSlug: string): Promise<FetchResult> {
  const statusResult: StatusResult = {
    serviceSlug,
    source: 'official',
    status: 'unknown',
    details: null,
    reportCount: null,
  };
  const incidents: IncidentResult[] = [];

  try {
    const res = await fetch(AWS_RSS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OutageMap/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });

    const now = Date.now();
    let worstStatus: ServiceStatus = 'operational';
    const recentTitles: string[] = [];

    $('item').each((_, el) => {
      const title = $(el).find('title').first().text().trim();
      const description = $(el).find('description').first().text().trim();
      const link = $(el).find('link').first().text().trim();
      const guid = $(el).find('guid').first().text().trim();
      const pubDateText = $(el).find('pubDate').first().text().trim();
      // new Date(badString) yields an Invalid Date — truthy but .getTime() is NaN
      // and .toISOString() throws. Validate explicitly before using.
      const parsed = pubDateText ? new Date(pubDateText) : null;
      const pubDate = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
      const ageMs = pubDate ? now - pubDate.getTime() : Infinity;

      if (!title || !pubDate || ageMs > TWO_HOURS_MS) return;

      const isMajor = MAJOR_KEYWORDS.test(title) && ageMs <= ONE_HOUR_MS;
      const isDegraded = DEGRADED_KEYWORDS.test(title) || MAJOR_KEYWORDS.test(title);

      if (isMajor) {
        worstStatus = 'major_outage';
      } else if (isDegraded && worstStatus === 'operational') {
        worstStatus = 'degraded';
      }

      recentTitles.push(title);

      const hash = crypto
        .createHash('sha256')
        .update(guid || `${title}|${pubDate.toISOString()}`)
        .digest('hex')
        .slice(0, 16);

      incidents.push({
        serviceSlug,
        incidentId: `aws-${hash}`,
        title,
        status: 'investigating',
        severity: isMajor ? 'major' : 'minor',
        startedAt: pubDate.toISOString(),
        resolvedAt: null,
        description: description || null,
        sourceUrl: link || AWS_SOURCE_URL,
      });
    });

    statusResult.status = worstStatus;
    statusResult.details =
      worstStatus === 'operational'
        ? 'All AWS services operating normally'
        : `Recent events: ${recentTitles.slice(0, 3).join('; ')}`;
  } catch (err) {
    console.error('[aws] Failed to fetch status:', err);
    statusResult.details = 'Unable to fetch AWS health feed';
  }

  return { status: statusResult, incidents };
}
