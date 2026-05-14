import { NextRequest, NextResponse } from 'next/server';
import {
  CustomServiceRow,
  getCustomServiceBySlug,
  insertCustomService,
  listCustomServices,
} from '@/lib/db';
import { SERVICES } from '@/lib/services';
import { FetcherType } from '@/lib/types';

export const dynamic = 'force-dynamic';

const URL_RE = /^https?:\/\/[^\s]+$/i;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_BRAND_FONT = 'var(--font-brand-inter), Inter, system-ui, sans-serif';

function isWriteEnabled(): boolean {
  return process.env.ENABLE_RULES_API === 'true' || !!process.env.CRON_SECRET;
}

function isAuthorized(request: NextRequest): boolean {
  if (process.env.ENABLE_RULES_API === 'true') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

function slugify(name: string): string {
  const cleaned = name.toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `custom-${cleaned}`;
}

function randomId(): string {
  return `cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Maps the ImportSlideOver "type" to a concrete fetcher. v1 only supports
// statuspage.io-compatible sources; rss/http/aws are recognised but rejected
// pending dedicated fetcher implementations.
function mapKindToFetcher(kind: string): FetcherType | null {
  switch (kind) {
    case 'statuspage':
    case 'github':
      return 'statuspage';
    default:
      return null;
  }
}

function rowToApi(row: CustomServiceRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    color: row.color,
    statusUrl: row.status_url,
    downdetectorSlug: row.downdetector_slug,
    fetcher: row.fetcher,
    kind: row.kind,
    refreshSeconds: row.refresh_seconds,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  try {
    const rows = listCustomServices();
    return NextResponse.json({ sources: rows.map(rowToApi) });
  } catch (err) {
    console.error('[api/sources] List failed:', err);
    return NextResponse.json({ error: 'Failed to list sources' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isWriteEnabled()) {
    return NextResponse.json(
      { error: 'Sources API is not enabled. Set ENABLE_RULES_API=true or configure CRON_SECRET.' },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const input = body as Partial<{
    type: string;
    name: string;
    url: string;
    refresh: number;
    color: string;
    downdetectorSlug: string | null;
  }>;

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const url = typeof input.url === 'string' ? input.url.trim() : '';
  if (!URL_RE.test(url)) {
    return NextResponse.json({ error: 'URL must be http(s)://…' }, { status: 400 });
  }

  const color = typeof input.color === 'string' ? input.color.trim() : '#268bd2';
  if (!COLOR_RE.test(color)) {
    return NextResponse.json({ error: 'Color must be a 6-digit hex like #268bd2' }, { status: 400 });
  }

  const refresh = Number(input.refresh ?? 180);
  if (!Number.isFinite(refresh) || refresh < 30 || refresh > 3600) {
    return NextResponse.json({ error: 'Refresh must be 30–3600 seconds' }, { status: 400 });
  }

  const kind = typeof input.type === 'string' ? input.type : 'statuspage';
  const fetcher = mapKindToFetcher(kind);
  if (!fetcher) {
    return NextResponse.json(
      { error: `Source type "${kind}" is not yet supported. Try statuspage or github.` },
      { status: 400 },
    );
  }

  const slug = slugify(name);
  if (!slug || slug === 'custom-') {
    return NextResponse.json({ error: 'Name produces an empty slug' }, { status: 400 });
  }

  if (SERVICES.some((s) => s.slug === slug) || getCustomServiceBySlug(slug)) {
    return NextResponse.json(
      { error: `Slug "${slug}" already exists in the catalog` },
      { status: 409 },
    );
  }

  const downdetectorSlug = typeof input.downdetectorSlug === 'string' && input.downdetectorSlug.trim()
    ? input.downdetectorSlug.trim()
    : null;

  const id = randomId();
  try {
    insertCustomService({
      id,
      slug,
      name,
      color,
      statusUrl: url,
      downdetectorSlug,
      fetcher,
      brandFont: DEFAULT_BRAND_FONT,
      refreshSeconds: Math.floor(refresh),
      kind,
      enabled: true,
    });
  } catch (err) {
    console.error('[api/sources] Insert failed:', err);
    return NextResponse.json({ error: 'Failed to insert source' }, { status: 500 });
  }

  const row = getCustomServiceBySlug(slug);
  return NextResponse.json({ source: row ? rowToApi(row) : null }, { status: 201 });
}
