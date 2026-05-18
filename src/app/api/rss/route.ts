import * as cheerio from 'cheerio';
import { NextRequest, NextResponse } from 'next/server';
import { httpFetch } from '@/lib/fetchers/httpFetch';

export const dynamic = 'force-dynamic';

const ALLOWED_FEEDS: Record<string, string> = {
  'aws-blog': 'https://aws.amazon.com/blogs/aws/feed/',
  'gh-blog': 'https://github.blog/engineering/feed/',
};

const PRIVATE_IP_RE =
  /^(localhost|127\.|0\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1|fc00:|fe80:)/i;

interface RssItem {
  title: string;
  url: string | null;
  publishedAt: string | null;
}

interface CacheEntry {
  items: RssItem[];
  feedTitle: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function parseRss(xml: string): { title: string; items: RssItem[] } {
  const $ = cheerio.load(xml, { xmlMode: true });
  const feedTitle = $('channel > title').first().text() || $('feed > title').first().text() || 'RSS Feed';

  const items: RssItem[] = [];
  // Support both RSS <item> and Atom <entry>
  $('item, entry').each((_: number, el: cheerio.AnyNode) => {
    const title = $(el).find('title').first().text().trim();
    const link =
      $(el).find('link').attr('href') ||
      $(el).find('link').first().text().trim() ||
      null;
    const pubDate =
      $(el).find('pubDate').text().trim() ||
      $(el).find('published').text().trim() ||
      $(el).find('updated').text().trim() ||
      null;

    if (title) {
      items.push({ title, url: link || null, publishedAt: pubDate || null });
    }
  });

  return { title: feedTitle, items: items.slice(0, 10) };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const feedId = searchParams.get('feed') || '';
  const customUrl = searchParams.get('url') || '';

  let feedUrl: string;
  let cacheKey: string;

  if (feedId === 'custom') {
    if (!customUrl || !/^https?:\/\//i.test(customUrl)) {
      return NextResponse.json({ error: 'Invalid custom URL: must start with http:// or https://' }, { status: 400 });
    }
    let hostname: string;
    try {
      hostname = new URL(customUrl).hostname;
    } catch {
      return NextResponse.json({ error: 'Invalid custom URL' }, { status: 400 });
    }
    if (PRIVATE_IP_RE.test(hostname)) {
      return NextResponse.json({ error: 'Private/internal URLs are not allowed' }, { status: 400 });
    }
    feedUrl = customUrl;
    cacheKey = `custom:${customUrl}`;
  } else {
    feedUrl = ALLOWED_FEEDS[feedId];
    if (!feedUrl) {
      return NextResponse.json(
        { error: `Unknown feed. Valid values: ${Object.keys(ALLOWED_FEEDS).join(', ')}, custom` },
        { status: 400 },
      );
    }
    cacheKey = feedId;
  }

  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json({ feed: feedId, title: cached.feedTitle, items: cached.items });
  }

  try {
    const res = await httpFetch(feedUrl, {
      headers: { Accept: 'application/rss+xml, application/atom+xml, text/xml, */*' },
      timeoutMs: 10000,
      maxRetries: 1,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const xml = await res.text();
    const { title: feedTitle, items } = parseRss(xml);

    cache.set(cacheKey, { items, feedTitle, expiresAt: now + CACHE_TTL_MS });

    return NextResponse.json({ feed: feedId, title: feedTitle, items });
  } catch (err) {
    console.error(`[api/rss] Failed to fetch feed "${feedId}":`, err);

    if (cached) {
      return NextResponse.json({ feed: feedId, title: cached.feedTitle, items: cached.items });
    }

    return NextResponse.json({ error: 'Failed to fetch RSS feed' }, { status: 502 });
  }
}
