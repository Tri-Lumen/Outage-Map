import * as cheerio from 'cheerio';
import { httpFetch, HttpFetchOptions } from '../../fetchers/httpFetch';

export interface RssItem {
  title: string;
  description: string | null;
  link: string | null;
  guid: string | null;
  // Parsed and validated — `new Date(badString)` yields an Invalid Date whose
  // .toISOString() throws, so callers get `null` rather than a land-mine.
  pubDate: Date | null;
}

export type FetchRssResult =
  | { ok: true; items: RssItem[] }
  | { ok: false; reason: 'network' | 'http'; status?: number; message: string };

export function parseRssItems(xml: string): RssItem[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items: RssItem[] = [];
  $('item').each((_, el) => {
    const title = $(el).find('title').first().text().trim();
    const description = $(el).find('description').first().text().trim();
    const link = $(el).find('link').first().text().trim();
    const guid = $(el).find('guid').first().text().trim();
    const pubDateText = $(el).find('pubDate').first().text().trim();
    const parsed = pubDateText ? new Date(pubDateText) : null;
    const pubDate = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
    items.push({
      title,
      description: description || null,
      link: link || null,
      guid: guid || null,
      pubDate,
    });
  });
  return items;
}

export async function fetchRssItems(url: string, init: HttpFetchOptions = {}): Promise<FetchRssResult> {
  let res: Response;
  try {
    res = await httpFetch(url, {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml',
        'User-Agent': 'Mozilla/5.0 (compatible; OutageMap/1.0)',
      },
      ...init,
    });
  } catch (err) {
    return { ok: false, reason: 'network', message: err instanceof Error ? err.message : String(err) };
  }
  if (!res.ok) return { ok: false, reason: 'http', status: res.status, message: `HTTP ${res.status}` };
  const xml = await res.text();
  return { ok: true, items: parseRssItems(xml) };
}
