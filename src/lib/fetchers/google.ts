import * as cheerio from 'cheerio';
import { FetchResult, StatusResult, IncidentResult, ServiceStatus } from '../types';

const GOOGLE_SERVICES = [
  'Gmail', 'Google Drive', 'Google Meet', 'Google Calendar',
  'Google Chat', 'Google Docs', 'Google Sheets', 'Google Slides',
];

function statusFromIndicator(indicator: number): ServiceStatus {
  switch (indicator) {
    case 1: return 'operational';
    case 2: return 'degraded';
    case 3: return 'major_outage';
    case 4: return 'down';
    default: return 'unknown';
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

  try {
    // Fetch the Google Workspace Status Dashboard page
    const res = await fetch('https://www.google.com/appsstatus/dashboard/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const $ = cheerio.load(html);

    // Google embeds status data in script tags as JSON
    let worstStatus: ServiceStatus = 'operational';
    const affectedServices: string[] = [];
    let jsonBranchMatched = false;

    // Try to find embedded JSON data
    $('script').each((_, el) => {
      const scriptContent = $(el).html() || '';
      // Look for dashboard data patterns
      const jsonMatch = scriptContent.match(/dashboard\.jsonp\(([\s\S]*?)\);/);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          if (Array.isArray(data?.services)) {
            jsonBranchMatched = true;
            for (const service of data.services) {
              const name = service.name || '';
              const status = service.status || 1;
              const mappedStatus = statusFromIndicator(status);
              if (mappedStatus !== 'operational' && GOOGLE_SERVICES.some(gs => name.includes(gs))) {
                affectedServices.push(name);
                if (mappedStatus === 'down' || mappedStatus === 'major_outage') {
                  worstStatus = mappedStatus;
                } else if (mappedStatus === 'degraded' && worstStatus === 'operational') {
                  worstStatus = 'degraded';
                }
              }
            }
          }
        } catch {
          // JSON parse error, continue
        }
      }
    });

    // Fallback: parse HTML status indicators.
    // Only run when the JSON branch didn't match — otherwise generic "disruption"
    // text elsewhere on the page (e.g. "Report a disruption") can flip a green
    // dashboard to major_outage. Scope the selector to actual service rows only,
    // and require whole-word matches.
    if (!jsonBranchMatched) {
      const majorRe = /\b(service disruption|outage in progress|disrupted)\b/i;
      const degradedRe = /\b(service information|minor issue|degraded performance)\b/i;

      $('table.ps-table tr, .ps-service-row, [data-service-name]').each((_, el) => {
        const text = $(el).text().trim();
        const rowName = $(el).find('.name, td:first, [data-service-name]').first().text().trim();
        if (majorRe.test(text)) {
          worstStatus = 'major_outage';
          if (rowName) affectedServices.push(rowName);
        } else if (degradedRe.test(text)) {
          if (worstStatus === 'operational') worstStatus = 'degraded';
          if (rowName) affectedServices.push(rowName);
        }
      });
    }

    statusResult.status = worstStatus;
    statusResult.details = worstStatus === 'operational'
      ? 'All Google Workspace services operational'
      : `Issues: ${affectedServices.filter(Boolean).join(', ') || 'Some services affected'}`;

    // Parse incidents from the page
    $('[class*="incident"], .message, [class*="disruption"]').each((_, el) => {
      const title = $(el).find('h3, .summary, [class*="title"]').first().text().trim();
      const desc = $(el).find('.detail, p, [class*="desc"]').first().text().trim();
      const dateText = $(el).find('.date, time, [class*="date"]').first().text().trim();

      if (title && title.length > 5) {
        incidents.push({
          serviceSlug,
          incidentId: `gws-${Buffer.from(title).toString('base64').slice(0, 16)}`,
          title,
          status: 'investigating',
          severity: worstStatus === 'major_outage' || worstStatus === 'down' ? 'major' : 'minor',
          startedAt: dateText || new Date().toISOString(),
          resolvedAt: null,
          description: desc || null,
          sourceUrl: 'https://www.google.com/appsstatus/dashboard/',
        });
      }
    });
  } catch (err) {
    console.error('[google] Failed to fetch status:', err);
    statusResult.details = 'Unable to fetch Google Workspace status';
  }

  return { status: statusResult, incidents };
}
