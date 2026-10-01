import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const limitParam = Number(searchParams.get('limit'));
    const limit = Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.floor(limitParam), 200)
      : 50;

    const offsetParam = Number(searchParams.get('offset'));
    const offset = Number.isFinite(offsetParam) && offsetParam >= 0
      ? Math.floor(offsetParam)
      : 0;

    const db = getDb();
    const total = (db.prepare('SELECT COUNT(*) as n FROM alert_log').get() as { n: number }).n;
    const rows = db.prepare(`
      SELECT id, service_slug, incident_id, alert_type, sent_at
      FROM alert_log
      ORDER BY sent_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as Array<{
      id: number;
      service_slug: string;
      incident_id: string | null;
      alert_type: string;
      sent_at: string;
    }>;
    return NextResponse.json({ log: rows, total, limit, offset });
  } catch (err) {
    console.error('[api/alerts/log] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch log' }, { status: 500 });
  }
}
