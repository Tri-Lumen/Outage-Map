import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { FetchResult, StatusResult, IncidentResult, ServiceStatus } from '../types';

const DASHBOARD_URL = 'https://www.google.com/appsstatus/dashboard/';
const INCIDENTS_URL = 'https://www.google.com/appsstatus/dashboard/incidents.json';

const GOOGLE_SERVICES = [
  'Gmail', 'Google Drive', 'Google Meet', 'Google Calendar',
  'Google Chat', 'Google Docs', 'Google Sheets', 'Google Slides',
];

const MAJOR_RE = /\b(service disruption|outage in progress|service outage)\b/i;
const DEGRADED_RE = /\b(service information|minor issue|degraded performance|disrupted)\b/i;

// Google's incidents.json status numbers. 1 = available/normal, higher = worse.
function severityFromStatus(status: number): ServiceStatus {
  switch (status) {
    case 1: return 'operational';
    case 2: return 'degraded';
    case 3: return 'major_outage';
    case 4: return 'down';
    default: return 'unknown';
  }
}

interface GoogleIncident {
  id?: string | number;
  external_desc?: string;
  service_name?: string;
  begin?: string;
  end?: string | null;
  most_recent_update?: {
    status?: number;
    text?: string;
    when?: string;
  };
  uri?: string;
}

function hashId(seed: string): string {
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16);
}

async function fetchIncidentsJson(): Promise<GoogleIncident[] | null> {
  try {
    const res = await fetch(INCIDENTS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data)) return data as GoogleIncident[];
    return null;
  } catch {
    return null;
  }
}

export async function fetchGoogleStatus(serviceSlug: string): Promise<FetchResult> {
  const statusResult: StatusResult = {
    serviceSlug,
    source: 'official',
    status: 'unknown',
    details: null,
    reportCount: null,
  };
  const incidents: IncidentResult[] = [];

  // Primary: parse the incidents JSON feed. A service is "active" only when
  // there is an incident without an end time whose service_name matches a
  // tracked Google Workspace product.
  const feed = await fetchIncidentsJson();
  if (feed) {
    let worstStatus: ServiceStatus = 'operational';
    const affectedServices = new Set<string>();

    for (const inc of feed) {
      const serviceName = inc.service_name || '';
      const tracked = GOOGLE_SERVICES.some((gs) => serviceName.includes(gs));
      if (!tracked) continue;

      const isOpen = !inc.end;
      const statusNum = inc.most_recent_update?.status ?? 1;
      const mapped = severityFromStatus(statusNum);

      if (isOpen && mapped !== 'operational') {
        affectedServices.add(serviceName);
        if (mapped === 'down' || mapped === 'major_outage') {
          worstStatus = mapped;
        } else if (mapped === 'degraded' && worstStatus === 'operational') {
          worstStatus = 'degraded';
        }

        const startedAt = inc.begin || new Date().toISOString();
        const title = inc.external_desc?.slice(0, 140) || `${serviceName} incident`;
        incidents.push({
          serviceSlug,
          incidentId: `gws-${hashId(String(inc.id ?? `${serviceName}|${startedAt}`))}`,
          title,
          status: 'investigating',
          severity: mapped === 'major_outage' || mapped === 'down' ? 'major' : 'minor',
          startedAt,
          resolvedAt: null,
          description: inc.most_recent_update?.text || inc.external_desc || null,
          sourceUrl: inc.uri ? `https://www.google.com${inc.uri}` : DASHBOARD_URL,
        });
      }
    }

    statusResult.status = worstStatus;
    statusResult.details =
      worstStatus === 'operational'
        ? 'All Google Workspace services operational'
        : `Issues: ${Array.from(affectedServices).join(', ') || 'Some services affected'}`;
    return { status: statusResult, incidents };
  }

  // Fallback: scrape the HTML dashboard. Only match rows that contain BOTH a
  // tracked service name AND a disruption keyword — this avoids flipping the
  // whole status to major_outage when generic text (e.g. "Report a disruption"
  // in the page chrome) matches the regex.
  try {
    const res = await fetch(DASHBOARD_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const $ = cheerio.load(html);

    let worstStatus: ServiceStatus = 'operational';
    const affectedServices: string[] = [];

    $('tr, [role="row"], [data-service-name]').each((_, el) => {
      const text = $(el).text().trim();
      if (!text) return;
      const matchedService = GOOGLE_SERVICES.find((gs) => text.includes(gs));
      if (!matchedService) return;

      if (MAJOR_RE.test(text)) {
        worstStatus = 'major_outage';
        affectedServices.push(matchedService);
      } else if (DEGRADED_RE.test(text) && worstStatus === 'operational') {
        worstStatus = 'degraded';
        affectedServices.push(matchedService);
      }
    });

    statusResult.status = worstStatus;
    statusResult.details =
      worstStatus === 'operational'
        ? 'All Google Workspace services operational'
        : `Issues: ${Array.from(new Set(affectedServices)).join(', ') || 'Some services affected'}`;
  } catch (err) {
    console.error('[google] Failed to fetch status:', err);
    statusResult.status = 'unknown';
    statusResult.details = 'Unable to fetch Google Workspace status';
  }

  return { status: statusResult, incidents };
}
