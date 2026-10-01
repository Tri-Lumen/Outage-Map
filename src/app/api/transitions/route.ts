import { NextRequest, NextResponse } from 'next/server';
import { listStatusTransitions } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceSlug = searchParams.get('service') || undefined;
    const limitParam = Number(searchParams.get('limit'));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 200) : 50;

    const rows = listStatusTransitions(serviceSlug, limit);
    const transitions = rows.map((r) => ({
      id: r.id,
      serviceSlug: r.service_slug,
      oldStatus: r.old_status,
      newStatus: r.new_status,
      duringMaintenance: !!r.during_maintenance,
      occurredAt: r.occurred_at,
    }));

    return NextResponse.json({ transitions });
  } catch (err) {
    console.error('[api/transitions] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch status transitions' }, { status: 500 });
  }
}
