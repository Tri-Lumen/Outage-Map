import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = Math.max(1, Math.min(365, parseInt(searchParams.get('days') || '30', 10)));

  try {
    const db = getDb();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const mttrRows = db.prepare(`
      SELECT severity,
             AVG((julianday(resolved_at) - julianday(started_at)) * 1440) AS avg_minutes,
             COUNT(*) AS count
      FROM incidents
      WHERE started_at >= ? AND resolved_at IS NOT NULL AND status = 'resolved'
      GROUP BY severity
    `).all(since) as { severity: string; avg_minutes: number; count: number }[];

    const totals = db.prepare(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved
      FROM incidents
      WHERE started_at >= ?
    `).get(since) as { total: number; resolved: number };

    const topServices = db.prepare(`
      SELECT service_slug, COUNT(*) AS count
      FROM incidents
      WHERE started_at >= ?
      GROUP BY service_slug
      ORDER BY count DESC
      LIMIT 5
    `).all(since) as { service_slug: string; count: number }[];

    const bySeverity = db.prepare(`
      SELECT severity, COUNT(*) AS count
      FROM incidents
      WHERE started_at >= ?
      GROUP BY severity
    `).all(since) as { severity: string; count: number }[];

    const mttrBySeverity: Record<string, number> = {};
    for (const row of mttrRows) {
      if (row.avg_minutes !== null) {
        mttrBySeverity[row.severity] = Math.round(row.avg_minutes);
      }
    }

    const countBySeverity: Record<string, number> = {};
    for (const row of bySeverity) {
      countBySeverity[row.severity] = row.count;
    }

    return NextResponse.json({
      days,
      mttrBySeverity,
      resolutionRate: totals.total > 0 ? (totals.resolved / totals.total) * 100 : 100,
      totalIncidents: totals.total,
      resolvedIncidents: totals.resolved,
      countBySeverity,
      topServices,
    });
  } catch (err) {
    console.error('[api/incidents/metrics]', err);
    return NextResponse.json({ error: 'Failed to compute metrics' }, { status: 500 });
  }
}
