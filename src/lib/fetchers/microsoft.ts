import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { FetchResult, StatusResult, IncidentResult, ServiceStatus } from '../types';

function parseStatusFromText(text: string): ServiceStatus {
  const lower = text.toLowerCase();
  if (lower.includes('normal') || lower.includes('operational') || lower.includes('healthy')) {
    return 'operational';
  }
  if (lower.includes('degraded') || lower.includes('advisory') || lower.includes('warning')) {
    return 'degraded';
  }
  if (lower.includes('disruption') || lower.includes('outage') || lower.includes('major')) {
    return 'major_outage';
  }
  if (lower.includes('down') || lower.includes('critical') || lower.includes('extended')) {
    return 'down';
  }
  return 'unknown';
}

const STATUS_ORDER: Record<ServiceStatus, number> = {
  operational: 0,
  unknown: 1,
  degraded: 2,
  major_outage: 3,
  down: 4,
};

function worseOf(a: ServiceStatus, b: ServiceStatus): ServiceStatus {
  return STATUS_ORDER[b] > STATUS_ORDER[a] ? b : a;
}

interface MsSource {
  name: string;
  url: string;
  degradedRe: RegExp;
  majorRe: RegExp;
}

// status.office365.com already covers Exchange, SharePoint, Teams and
// OneDrive for Business, but Azure has its own dashboard — without it we
// miss identity/backbone outages that still affect M365 tenants. We fetch
// both in parallel and take the worst status.
const SOURCES: MsSource[] = [
  {
    name: 'Microsoft 365',
    url: 'https://status.office365.com/',
    degradedRe: /\b(service incident|service degradation|advisory)\b/i,
    majorRe: /\b(extended outage|service interruption)\b/i,
  },
  {
    name: 'Microsoft Azure',
    url: 'https://azure.status.microsoft/en-us/status/',
    degradedRe: /\b(active event|service degradation|advisory)\b/i,
    majorRe: /\b(service outage|widespread outage|extended outage)\b/i,
  },
];

interface SourceResult {
  source: MsSource;
  status: ServiceStatus;
  incidents: IncidentResult[];
  reachable: boolean;
}

async function fetchSource(source: MsSource, serviceSlug: string): Promise<SourceResult> {
  const result: SourceResult = {
    source,
    status: 'unknown',
    incidents: [],
    reachable: false,
  };

  try {
    const res = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const $ = cheerio.load(html);
    const pageText = $('body').text();

    let worstStatus: ServiceStatus = 'operational';
    if (source.degradedRe.test(pageText)) worstStatus = 'degraded';
    if (source.majorRe.test(pageText)) worstStatus = 'major_outage';

    $('tr, .service-status-row, [class*="service"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 5 && text.length < 500) {
        const status = parseStatusFromText(text);
        if (status === 'major_outage' || status === 'down') {
          worstStatus = worseOf(worstStatus, status);
        } else if (status === 'degraded' && worstStatus === 'operational') {
          worstStatus = 'degraded';
        }
      }
    });

    result.status = worstStatus;
    result.reachable = true;

    $('[class*="incident"], [class*="advisory"], [class*="message"]').each((_, el) => {
      const title = $(el).find('h3, h4, .title, [class*="title"]').first().text().trim();
      const desc = $(el).find('p, .description, [class*="desc"]').first().text().trim();
      if (title && title.length > 5) {
        const startedAt = new Date().toISOString();
        // Hash on a stable identity only — including the per-poll timestamp
        // would give the same incident a new ID on every poll and flood the
        // DB with duplicates.
        const hash = crypto
          .createHash('sha256')
          .update(`${source.name}|${title}`)
          .digest('hex')
          .slice(0, 16);
        result.incidents.push({
          serviceSlug,
          incidentId: `ms-${hash}`,
          title: `[${source.name}] ${title}`,
          status: 'investigating',
          severity: worstStatus === 'major_outage' || worstStatus === 'down' ? 'major' : 'minor',
          startedAt,
          resolvedAt: null,
          description: desc || null,
          sourceUrl: source.url,
        });
      }
    });
  } catch (err) {
    console.error(`[microsoft] Failed to fetch ${source.name}:`, err);
  }

  return result;
}

export async function fetchMicrosoftStatus(serviceSlug: string): Promise<FetchResult> {
  const statusResult: StatusResult = {
    serviceSlug,
    source: 'official',
    status: 'unknown',
    details: null,
    reportCount: null,
  };
  const incidents: IncidentResult[] = [];

  const results = await Promise.all(SOURCES.map((src) => fetchSource(src, serviceSlug)));

  const reachable = results.filter((r) => r.reachable);
  if (reachable.length === 0) {
    statusResult.details = 'Unable to fetch Microsoft 365 status';
    return { status: statusResult, incidents };
  }

  let worstStatus: ServiceStatus = 'operational';
  const impacted: string[] = [];
  for (const r of reachable) {
    worstStatus = worseOf(worstStatus, r.status);
    if (r.status !== 'operational' && r.status !== 'unknown') {
      impacted.push(r.source.name);
    }
    incidents.push(...r.incidents);
  }

  statusResult.status = worstStatus;
  statusResult.details =
    worstStatus === 'operational'
      ? 'All Microsoft 365 and Azure services operational'
      : `Issues reported on ${impacted.join(', ') || 'one or more Microsoft platforms'}`;

  return { status: statusResult, incidents };
}
