import { NextRequest, NextResponse } from 'next/server';
import { health } from '@/lib/health';
import { circuit } from '@/lib/fetchers/circuit';
import { getServices } from '@/lib/services';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: { slug: string; source: string } },
) {
  const { slug, source } = params;

  const validSlugs = new Set(getServices().map((s) => s.slug));
  if (!validSlugs.has(slug)) {
    return NextResponse.json({ error: 'Unknown service slug' }, { status: 404 });
  }
  if (source !== 'official') {
    return NextResponse.json({ error: 'source must be official' }, { status: 400 });
  }

  try {
    circuit.reset(slug, source);
    health.reset(slug, source);
    return NextResponse.json({ ok: true, slug, source });
  } catch (err) {
    console.error('[api/health/fetchers/reset] failed:', err);
    return NextResponse.json({ error: 'Failed to reset circuit' }, { status: 500 });
  }
}
