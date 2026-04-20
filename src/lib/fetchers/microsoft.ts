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

export async function fetchMicrosoftStatus(serviceSlug: string): Promise<FetchResult> {
  const statusResult: StatusResult = {
    serviceSlug,
    source: 'official',
    status: 'unknown',
    details: null,
    reportCount: null,
  };
  const incidents: IncidentResult[] = [];

  try {
    const res = await fetch('https://status.office365.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const $ = cheerio.load(html);

    const statusTexts: string[] = [];
    $('[class*="status"], [class*="Status"], [data-status]').each((_, el) => {
      statusTexts.push($(el).text().trim());
    });

    // Look for status indicators in common patterns
    const pageText = $('body').text();
    let worstStatus: ServiceStatus = 'operational';

    if (pageText.toLowerCase().includes('service incident') || pageText.toLowerCase().includes('service degradation')) {
      worstStatus = 'degraded';
    }
    if (pageText.toLowerCase().includes('extended outage') || pageText.toLowerCase().includes('service interruption')) {
      worstStatus = 'major_outage';
    }

    // Parse any visible status sections
    $('tr, .service-status-row, [class*="service"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 5 && text.length < 500) {
        const status = parseStatusFromText(text);
        if (status === 'major_outage' || status === 'down') {
          worstStatus = status;
        } else if (status === 'degraded' && worstStatus === 'operational') {
          worstStatus = 'degraded';
        }
      }
    });

    statusResult.status = worstStatus;
    statusResult.details = worstStatus === 'operational'
      ? 'All Microsoft 365 services operational'
      : `Some services experiencing issues`;

    // Try to extract incident information
    $('[class*="incident"], [class*="advisory"], [class*="message"]').each((_, el) => {
      const title = $(el).find('h3, h4, .title, [class*="title"]').first().text().trim();
      const desc = $(el).find('p, .description, [class*="desc"]').first().text().trim();
      if (title && title.length > 5) {
        const startedAt = new Date().toISOString();
        const hash = crypto.createHash('sha256').update(`${title}|${startedAt}`).digest('hex').slice(0, 16);
        incidents.push({
          serviceSlug,
          incidentId: `ms-${hash}`,
          title,
          status: 'investigating',
          severity: worstStatus === 'major_outage' || worstStatus === 'down' ? 'major' : 'minor',
          startedAt,
          resolvedAt: null,
          description: desc || null,
          sourceUrl: 'https://status.office365.com/',
        });
      }
    });
  } catch (err) {
    console.error('[microsoft] Failed to fetch status:', err);
    statusResult.details = 'Unable to fetch Microsoft 365 status';
  }

  return { status: statusResult, incidents };
}
