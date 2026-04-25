import { NextRequest, NextResponse } from 'next/server';
import { deleteAlertRule, updateAlertRule } from '@/lib/db';
import { SERVICES } from '@/lib/services';
import { isIncidentSeverity } from '@/lib/types';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isWriteEnabled(): boolean {
  return process.env.ENABLE_RULES_API === 'true' || !!process.env.CRON_SECRET;
}

function isAuthorized(request: NextRequest): boolean {
  if (process.env.ENABLE_RULES_API === 'true') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

interface Ctx {
  params: { id: string };
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  if (!isWriteEnabled()) {
    return NextResponse.json(
      { error: 'Rules API is not enabled. Set ENABLE_RULES_API=true or configure CRON_SECRET.' },
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
    email: string;
    services: unknown;
    minSeverity: unknown;
    emailEnabled: unknown;
    enabled: unknown;
  }>;

  const patch: Parameters<typeof updateAlertRule>[1] = {};

  if (input.email !== undefined) {
    const email = typeof input.email === 'string' ? input.email.trim() : '';
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    patch.email = email;
  }
  if (input.services !== undefined) {
    const validSlugs = new Set(SERVICES.map((s) => s.slug));
    const services = Array.isArray(input.services)
      ? input.services.filter((s): s is string => typeof s === 'string' && validSlugs.has(s))
      : [];
    patch.services = JSON.stringify(services);
  }
  if (input.minSeverity !== undefined) {
    if (!isIncidentSeverity(input.minSeverity)) {
      return NextResponse.json({ error: 'Invalid severity' }, { status: 400 });
    }
    patch.minSeverity = input.minSeverity;
  }
  if (input.emailEnabled !== undefined) patch.emailEnabled = !!input.emailEnabled;
  if (input.enabled !== undefined) patch.enabled = !!input.enabled;

  try {
    const ok = updateAlertRule(params.id, patch);
    if (!ok) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/alerts/rules] Update failed:', err);
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  if (!isWriteEnabled()) {
    return NextResponse.json(
      { error: 'Rules API is not enabled. Set ENABLE_RULES_API=true or configure CRON_SECRET.' },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const ok = deleteAlertRule(params.id);
    if (!ok) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/alerts/rules] Delete failed:', err);
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 });
  }
}
