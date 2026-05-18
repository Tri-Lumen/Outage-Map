import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export function GET() {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, service_slug, incident_id, alert_type, sent_at
      FROM alert_log
      ORDER BY sent_at DESC
      LIMIT 50
    `).all() as Array<{
      id: number;
      service_slug: string;
      incident_id: string | null;
      alert_type: string;
      sent_at: string;
    }>;
    return NextResponse.json({ log: rows });
  } catch (err) {
    console.error('[api/alerts/log] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch log' }, { status: 500 });
  }
}
