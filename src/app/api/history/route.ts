import { NextRequest, NextResponse } from 'next/server';
import { getStatusHistory } from '@/lib/db';
import { SERVICES } from '@/lib/services';
import { HistoryPoint, ServiceStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

function statusToMinutes(status: ServiceStatus): number {
  switch (status) {
    case 'major_outage':
    case 'down':
      return 3; // Each poll interval represents ~3 minutes
    case 'degraded':
      return 1;
    default:
      return 0;
  }
}

function aggregateByDay(
  rows: Array<{ service_slug: string; status: string; report_count: number; incident_count: number; recorded_at: string }>
): Record<string, HistoryPoint[]> {
  const byService: Record<string, Map<string, { statuses: string[]; reports: number[]; incidents: number[]; outageMinutes: number }>> = {};

  for (const row of rows) {
    if (!byService[row.service_slug]) {
      byService[row.service_slug] = new Map();
    }

    const date = row.recorded_at.split(/[T ]/)[0];
    const dayData = byService[row.service_slug].get(date) || {
      statuses: [],
      reports: [],
      incidents: [],
      outageMinutes: 0,
    };

    dayData.statuses.push(row.status);
    dayData.reports.push(row.report_count || 0);
    dayData.incidents.push(row.incident_count || 0);
    dayData.outageMinutes += statusToMinutes(row.status as ServiceStatus);

    byService[row.service_slug].set(date, dayData);
  }

  const result: Record<string, HistoryPoint[]> = {};

  for (const [serviceSlug, dayMap] of Object.entries(byService)) {
    result[serviceSlug] = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => {
        // Determine the worst status of the day
        const statusPriority: Record<string, number> = {
          down: 4, major_outage: 3, degraded: 2, operational: 1, unknown: 0,
        };
        let worstStatus: ServiceStatus = 'operational';
        for (const s of data.statuses) {
          if ((statusPriority[s] || 0) > (statusPriority[worstStatus] || 0)) {
            worstStatus = s as ServiceStatus;
          }
        }

        return {
          date,
          status: worstStatus,
          reports: Math.max(...data.reports, 0),
          incidents: Math.max(...data.incidents, 0),
          outageMinutes: data.outageMinutes,
        };
      });
  }

  return result;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const serviceFilter = searchParams.get('service') || null;

    const serviceSlug = serviceFilter && serviceFilter !== 'all' ? serviceFilter : null;
    const rows = getStatusHistory(serviceSlug, Math.min(days, 90));

    const history = aggregateByDay(rows);

    // Ensure all services have entries (even if empty)
    for (const service of SERVICES) {
      if (!history[service.slug]) {
        history[service.slug] = [];
      }
    }

    return NextResponse.json({ history });
  } catch (err) {
    console.error('[api/history] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    );
  }
}
