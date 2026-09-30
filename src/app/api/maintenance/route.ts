import { NextRequest, NextResponse } from 'next/server';
import { listMaintenanceWindows, insertMaintenanceWindow } from '@/lib/db';
import type { MaintenanceWindow } from '@/lib/types';
import { isWriteEnabled, isAuthorized } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

function rowToWindow(row: {
  id: string; service_slugs: string; start_time: string; end_time: string;
  note: string | null; created_by: string | null; created_at: string;
}): MaintenanceWindow {
  let serviceSlugs: string[] = [];
  try { serviceSlugs = JSON.parse(row.service_slugs); } catch { /* empty array */ }
  return {
    id: row.id,
    serviceSlugs,
    startTime: row.start_time,
    endTime: row.end_time,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function GET() {
  try {
    const rows = listMaintenanceWindows();
    return NextResponse.json({ windows: rows.map(rowToWindow) });
  } catch (err) {
    console.error('[api/maintenance] GET failed:', err);
    return NextResponse.json({ error: 'Failed to fetch maintenance windows' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
    createdBy: unknown;
  }>;

  const startTime = typeof input.startTime === 'string' ? input.startTime.trim() : '';
  const endTime = typeof input.endTime === 'string' ? input.endTime.trim() : '';
  if (!startTime || !endTime) {
    return NextResponse.json({ error: 'startTime and endTime are required' }, { status: 400 });
  }
  if (new Date(startTime) >= new Date(endTime)) {
    return NextResponse.json({ error: 'startTime must be before endTime' }, { status: 400 });
  }

  const serviceSlugs = Array.isArray(input.serviceSlugs)
    ? input.serviceSlugs.filter((s): s is string => typeof s === 'string')
    : [];
  const note = typeof input.note === 'string' ? input.note.trim() : null;
  const createdBy = typeof input.createdBy === 'string' ? input.createdBy.trim() : null;

  const id = `maint_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    insertMaintenanceWindow({ id, serviceSlugs, startTime, endTime, note, createdBy });
    return NextResponse.json({ window: { id, serviceSlugs, startTime, endTime, note, createdBy } }, { status: 201 });
  } catch (err) {
    console.error('[api/maintenance] POST failed:', err);
    return NextResponse.json({ error: 'Failed to create maintenance window' }, { status: 500 });
  }
}
