import { NextResponse } from 'next/server';
import { getServiceStatuses } from '@/lib/db';
import { SERVICES } from '@/lib/services';
import { ServiceStatus, ServiceStatusResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

function deriveOverallStatus(
  official: ServiceStatus,
  downdetector: ServiceStatus
): ServiceStatus {
  // If official reports an issue, trust it
  if (official === 'down' || official === 'major_outage') return official;
  if (downdetector === 'down' || downdetector === 'major_outage') return 'major_outage';
  if (official === 'degraded' || downdetector === 'degraded') return 'degraded';
  if (official === 'operational') return 'operational';
  // If official is unknown, use downdetector
  if (official === 'unknown' && downdetector !== 'unknown') return downdetector;
  return official;
}

export async function GET() {
  try {
    const statuses = getServiceStatuses();

    const services: ServiceStatusResponse[] = SERVICES.map((service) => {
      const official = statuses.find(
        (s) => s.service_slug === service.slug && s.source === 'official'
      );
      const dd = statuses.find(
        (s) => s.service_slug === service.slug && s.source === 'downdetector'
      );

      const officialStatus = (official?.status as ServiceStatus) || 'unknown';
      const ddStatus = (dd?.status as ServiceStatus) || 'unknown';

      return {
        slug: service.slug,
        name: service.name,
        color: service.color,
        officialStatus,
        downdetectorStatus: ddStatus,
        downdetectorReports: dd?.report_count || 0,
        overallStatus: deriveOverallStatus(officialStatus, ddStatus),
        details: official?.details || null,
        lastChecked: official?.checked_at || dd?.checked_at || null,
      };
    });

    const latestCheck = statuses.reduce((latest, s) => {
      if (!latest || s.checked_at > latest) return s.checked_at;
      return latest;
    }, null as string | null);

    return NextResponse.json({
      services,
      lastUpdated: latestCheck || new Date().toISOString(),
    });
  } catch (err) {
    console.error('[api/status] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}
