import { NextResponse } from 'next/server';
import { getServiceStatuses, getActiveIncidentCounts } from '@/lib/db';
import { SERVICES } from '@/lib/services';
import { ServiceStatus, ServiceStatusResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

function deriveOverallStatus(
  official: ServiceStatus,
  downdetector: ServiceStatus,
  officialIncidentCount: number,
): ServiceStatus {
  // Official outage signal always wins.
  if (official === 'down' || official === 'major_outage') return official;
  // Only escalate to major based on Downdetector alone if the official source
  // also has an active incident — Downdetector spikes by themselves are noisy.
  if ((downdetector === 'down' || downdetector === 'major_outage') && officialIncidentCount > 0) {
    return 'major_outage';
  }
  if (official === 'degraded' || downdetector === 'degraded') return 'degraded';
  if (official === 'operational') return 'operational';
  if (official === 'unknown' && downdetector !== 'unknown') return downdetector;
  return official;
}

export async function GET() {
  try {
    const statuses = getServiceStatuses();
    const activeIncidentCounts = getActiveIncidentCounts();

    const services: ServiceStatusResponse[] = SERVICES.map((service) => {
      const official = statuses.find(
        (s) => s.service_slug === service.slug && s.source === 'official'
      );
      const dd = statuses.find(
        (s) => s.service_slug === service.slug && s.source === 'downdetector'
      );

      const officialStatus: ServiceStatus = (official?.status as ServiceStatus) || 'unknown';
      const ddStatus: ServiceStatus = (dd?.status as ServiceStatus) || 'unknown';
      const incidentCount = activeIncidentCounts[service.slug] || 0;

      return {
        slug: service.slug,
        name: service.name,
        color: service.color,
        officialStatus,
        downdetectorStatus: ddStatus,
        downdetectorReports: dd?.report_count || 0,
        incidentCount,
        overallStatus: deriveOverallStatus(officialStatus, ddStatus, incidentCount),
        details: official?.details || null,
        lastChecked: official?.checked_at || dd?.checked_at || null,
        statusUrl: service.statusUrl,
        downdetectorUrl: `https://downdetector.com/status/${service.downdetectorSlug}/`,
        brandFont: service.brandFont,
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
