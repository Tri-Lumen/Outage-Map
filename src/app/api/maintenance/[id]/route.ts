import { NextRequest, NextResponse } from 'next/server';
import { updateMaintenanceWindow, deleteMaintenanceWindow } from '@/lib/db';
import { isWriteEnabled, isAuthorized } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isWriteEnabled()) {
    return NextResponse.json(
      { error: 'Maintenance API is not enabled. Set ENABLE_RULES_API=true or configure CRON_SECRET.' },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const input = body as Partial<{
    serviceSlugs: unknown;
    startTime: unknown;
    endTime: unknown;
    note: unknown;
    recurrence: unknown;
    recurrenceUntil: unknown;
  }>;

  const patch: Parameters<typeof updateMaintenanceWindow>[1] = {};
  if (Array.isArray(input.serviceSlugs)) {
    patch.serviceSlugs = input.serviceSlugs.filter((s): s is string => typeof s === 'string');
  }
  if (typeof input.startTime === 'string') patch.startTime = input.startTime;
  if (typeof input.endTime === 'string') patch.endTime = input.endTime;
  if (typeof input.note === 'string' || input.note === null) patch.note = input.note ?? null;
  if (input.recurrence === 'none' || input.recurrence === 'weekly') patch.recurrence = input.recurrence;
  if (typeof input.recurrenceUntil === 'string' || input.recurrenceUntil === null) {
    patch.recurrenceUntil = input.recurrenceUntil ?? null;
  }

  if (patch.startTime && patch.endTime && new Date(patch.startTime) >= new Date(patch.endTime)) {
    return NextResponse.json({ error: 'startTime must be before endTime' }, { status: 400 });
  }

  try {
    const ok = updateMaintenanceWindow(params.id, patch);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/maintenance/:id] PATCH failed:', err);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isWriteEnabled()) {
    return NextResponse.json(
      { error: 'Maintenance API is not enabled. Set ENABLE_RULES_API=true or configure CRON_SECRET.' },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const ok = deleteMaintenanceWindow(params.id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/maintenance/:id] DELETE failed:', err);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
