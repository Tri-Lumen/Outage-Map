import * as cheerio from 'cheerio';
import { StatusResult, ServiceStatus } from '../types';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];

function getRandomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

const THRESHOLD_DEGRADED = parseInt(process.env.DD_REPORT_THRESHOLD_DEGRADED || '100', 10);
const THRESHOLD_MAJOR = parseInt(process.env.DD_REPORT_THRESHOLD_MAJOR || '500', 10);

function reportCountToStatus(count: number): ServiceStatus {
  if (count >= THRESHOLD_MAJOR) return 'major_outage';
  if (count >= THRESHOLD_DEGRADED) return 'degraded';
  return 'operational';
}

export async function fetchDowndetectorStatus(
  slug: string,
  serviceSlug: string
): Promise<StatusResult> {
  const result: StatusResult = {
    serviceSlug,
    source: 'downdetector',
    status: 'unknown',
    details: null,
    reportCount: null,
  };

  if (process.env.DOWNDETECTOR_ENABLED === 'false') {
    result.status = 'operational';
    result.details = 'Downdetector monitoring disabled';
    result.reportCount = 0;
    return result;
  }

  try {
    const res = await fetch(`https://downdetector.com/status/${slug}/`, {
      headers: {
        'User-Agent': getRandomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Try to extract report count from chart data or page elements
    let reportCount = 0;

    // Pattern 1: Look for report count in the page text
    const countMatch = $('body').text().match(/(\d{1,6})\s*(?:reports?|problems?)/i);
    if (countMatch) {
      reportCount = parseInt(countMatch[1], 10);
    }

    // Pattern 2: Look for chart data in script tags
    $('script').each((_, el) => {
      const script = $(el).html() || '';
      // Downdetector often embeds chart data as JSON arrays
      const dataMatch = script.match(/data\s*:\s*\[([\d,\s]+)\]/);
      if (dataMatch) {
        const values = dataMatch[1].split(',').map(v => parseInt(v.trim(), 10)).filter(v => !isNaN(v));
        if (values.length > 0) {
          // Use the most recent value
          reportCount = Math.max(reportCount, values[values.length - 1]);
        }
      }
    });

    // Pattern 3: Check the status indicator on the page
    const statusText = $('.entry-title, .main-title, [class*="status"]').first().text().toLowerCase();
    if (statusText.includes('problems') || statusText.includes('outage')) {
      if (reportCount === 0) reportCount = THRESHOLD_DEGRADED; // Assume degraded if we can't parse count
    } else if (statusText.includes('no problems') || statusText.includes('no issues')) {
      reportCount = Math.min(reportCount, THRESHOLD_DEGRADED - 1);
    }

    // Pattern 4: Check for warning/danger CSS classes
    const hasWarning = $('.text-warning, .warning, [class*="warning"]').length > 0;
    const hasDanger = $('.text-danger, .danger, [class*="danger"]').length > 0;

    if (hasDanger && reportCount < THRESHOLD_MAJOR) {
      reportCount = THRESHOLD_MAJOR;
    } else if (hasWarning && reportCount < THRESHOLD_DEGRADED) {
      reportCount = THRESHOLD_DEGRADED;
    }

    result.reportCount = reportCount;
    result.status = reportCountToStatus(reportCount);
    result.details = `${reportCount} reports on Downdetector`;
  } catch (err) {
    console.error(`[downdetector] Failed to fetch ${slug}:`, err);
    // On failure, return unknown - don't affect overall status
    result.status = 'unknown';
    result.details = 'Unable to reach Downdetector';
    result.reportCount = 0;
  }

  return result;
}
