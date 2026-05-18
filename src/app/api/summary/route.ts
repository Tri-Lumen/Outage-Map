import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServiceStatuses, getActiveIncidentCounts } from '@/lib/db';
import { getServices } from '@/lib/services';
import { ServiceStatus, SummaryResponse } from '@/lib/types';
import { deriveOverallStatus } from '@/lib/statusUtils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const statuses = getServiceStatuses();
    const activeIncidentCounts = getActiveIncidentCounts();
    const services = getServices();

    const statusMap = new Map(statuses.map((s) => [`${s.service_slug}:${s.source}`, s]));

    let operational = 0;
    let degraded = 0;
    let majorOutage = 0;
    let down = 0;
    let unknown = 0;
    let activeIncidents = 0;
    let latestCheck: string | null = null;

    for (const service of services) {
      const official = statusMap.get(`${service.slug}:official`);
      const dd = statusMap.get(`${service.slug}:downdetector`);

      const officialStatus: ServiceStatus = (official?.status as ServiceStatus) || 'unknown';
      const ddStatus: ServiceStatus = (dd?.status as ServiceStatus) || 'unknown';
      const incidentCount = activeIncidentCounts[service.slug] || 0;
      activeIncidents += incidentCount;

      const overall = deriveOverallStatus(officialStatus, ddStatus, incidentCount);
      switch (overall) {
        case 'operational': operational++; break;
        case 'degraded': degraded++; break;
        case 'major_outage': majorOutage++; break;
        case 'down': down++; break;
        default: unknown++;
      }

      const checkedAt = official?.checked_at || dd?.checked_at;
      if (checkedAt && (!latestCheck || checkedAt > latestCheck)) latestCheck = checkedAt;
    }

    const totalServices = services.length;
    const uptimePct = totalServices > 0
      ? Math.round((operational / totalServices) * 1000) / 10
      : 100;

    const response: SummaryResponse = {
      totalServices,
      operational,
      degraded,
      majorOutage,
      down,
      unknown,
      activeIncidents,
      uptimePct,
      lastUpdated: latestCheck || new Date().toISOString(),
    };

    const body = JSON.stringify(response);
    const etag = `"${createHash('md5').update(body).digest('hex')}"`;
    if (request.headers.get('if-none-match') === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }

    return NextResponse.json(response, {
      headers: { ETag: etag, 'Cache-Control': 'no-cache' },
    });
  } catch (err) {
    console.error('[api/summary] Error:', err);
    return NextResponse.json({ error: 'Failed to compute summary' }, { status: 500 });
  }
}
