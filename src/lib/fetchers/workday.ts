import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { FetchResult, StatusResult, IncidentResult, ServiceStatus } from '../types';

export async function fetchWorkdayStatus(serviceSlug: string): Promise<FetchResult> {
  const statusResult: StatusResult = {
    serviceSlug,
    source: 'official',
    status: 'unknown',
    details: null,
    reportCount: null,
  };
  const incidents: IncidentResult[] = [];

  try {
    const res = await fetch('https://status.workday.com/', {
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
    const issues: string[] = [];

    // Check for Statuspage.io patterns (Workday may use Statuspage)
    const statuspageData = $('script[type="application/json"]').text();
    if (statuspageData) {
      try {
        const data = JSON.parse(statuspageData);
        if (data?.status?.indicator) {
          switch (data.status.indicator) {
            case 'none': worstStatus = 'operational'; break;
            case 'minor': worstStatus = 'degraded'; break;
            case 'major': worstStatus = 'major_outage'; break;
            case 'critical': worstStatus = 'down'; break;
          }
        }
      } catch {
        // Not JSON, continue with HTML parsing
      }
    }

    // Parse HTML status indicators
    $('[class*="component-status"], [class*="status"], .component-inner-container').each((_, el) => {
      const text = $(el).text().trim().toLowerCase();
      if (text.includes('major outage') || text.includes('service disruption')) {
        worstStatus = 'major_outage';
        issues.push($(el).closest('.component-container, tr').find('.name, .component-name').text().trim());
      } else if (text.includes('degraded') || text.includes('partial')) {
        if (worstStatus === 'operational') worstStatus = 'degraded';
        issues.push($(el).closest('.component-container, tr').find('.name, .component-name').text().trim());
      }
    });

    // Check overall page status text
    const pageStatus = $('.page-status, [class*="overall-status"]').text().trim().toLowerCase();
    if (pageStatus.includes('all systems operational') || pageStatus.includes('all good')) {
      worstStatus = 'operational';
    } else if (pageStatus.includes('minor') || pageStatus.includes('degraded')) {
      if (worstStatus === 'operational') worstStatus = 'degraded';
    } else if (pageStatus.includes('major') || pageStatus.includes('outage')) {
      worstStatus = 'major_outage';
    }

    statusResult.status = worstStatus;
    statusResult.details = worstStatus === 'operational'
      ? 'All Workday services operational'
      : `Issues: ${issues.filter(Boolean).join(', ') || 'Some services affected'}`;

    // Parse incidents
    $('.incident, [class*="incident"], .unresolved-incident').each((_, el) => {
      const title = $(el).find('.incident-title, h4, [class*="title"]').first().text().trim();
      const desc = $(el).find('.update, .body, p').first().text().trim();
      const dateText = $(el).find('small, time, .date').first().text().trim();

      if (title && title.length > 3) {
        const startedAt = dateText || new Date().toISOString();
        const hash = crypto.createHash('sha256').update(`${title}|${startedAt}`).digest('hex').slice(0, 16);
        incidents.push({
          serviceSlug,
          incidentId: `wd-${hash}`,
          title,
          status: 'investigating',
          severity: worstStatus === 'major_outage' || worstStatus === 'down' ? 'major' : 'minor',
          startedAt,
          resolvedAt: null,
          description: desc || null,
          sourceUrl: 'https://status.workday.com/',
        });
      }
    });
  } catch (err) {
    console.error('[workday] Failed to fetch status:', err);
    statusResult.details = 'Unable to fetch Workday status';
  }

  return { status: statusResult, incidents };
}
