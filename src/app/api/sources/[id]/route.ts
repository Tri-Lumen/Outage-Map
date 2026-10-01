import { NextRequest, NextResponse } from 'next/server';
import {
  cleanupServiceData,
  deleteCustomService,
  getCustomServiceById,
  updateCustomService,
} from '@/lib/db';
import { isWriteEnabled, isAuthorized } from '@/lib/apiAuth';
import { health } from '@/lib/health';
import { circuit } from '@/lib/fetchers/circuit';

export const dynamic = 'force-dynamic';

const URL_RE = /^https?:\/\/[^\s]+$/i;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

interface Ctx {
  params: { id: string };
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  if (!isWriteEnabled()) {
    return NextResponse.json(
      { error: 'Sources API is not enabled.' },
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
    name: string;
    color: string;
    statusUrl: string;
    refreshSeconds: number;
    enabled: boolean;
  }>;

  const patch: Parameters<typeof updateCustomService>[1] = {};

  if (input.name !== undefined) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    patch.name = name;
  }
  if (input.color !== undefined) {
    if (typeof input.color !== 'string' || !COLOR_RE.test(input.color)) {
      return NextResponse.json({ error: 'Invalid color' }, { status: 400 });
    }
    patch.color = input.color;
  }
  if (input.statusUrl !== undefined) {
    if (typeof input.statusUrl !== 'string' || !URL_RE.test(input.statusUrl)) {
      return NextResponse.json({ error: 'Invalid statusUrl' }, { status: 400 });
    }
    patch.statusUrl = input.statusUrl;
  }
  if (input.refreshSeconds !== undefined) {
    const r = Number(input.refreshSeconds);
    if (!Number.isFinite(r) || r < 30 || r > 3600) {
      return NextResponse.json({ error: 'Refresh must be 30–3600' }, { status: 400 });
    }
    patch.refreshSeconds = Math.floor(r);
  }
  if (input.enabled !== undefined) patch.enabled = !!input.enabled;

  try {
    const ok = updateCustomService(params.id, patch);
    if (!ok) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/sources] Update failed:', err);
    return NextResponse.json({ error: 'Failed to update source' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  if (!isWriteEnabled()) {
    return NextResponse.json(
      { error: 'Sources API is not enabled.' },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const row = getCustomServiceById(params.id);
    if (!row) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }
    const ok = deleteCustomService(params.id);
    if (ok) {
      // Drop the orphaned status/history/incidents, plus the in-memory
      // health/circuit state, so a future slug re-use doesn't inherit the
      // previous service's data.
      cleanupServiceData(row.slug);
      health.deleteService(row.slug);
      circuit.deleteService(row.slug);
    }
    return NextResponse.json({ ok });
  } catch (err) {
    console.error('[api/sources] Delete failed:', err);
    return NextResponse.json({ error: 'Failed to delete source' }, { status: 500 });
  }
}
