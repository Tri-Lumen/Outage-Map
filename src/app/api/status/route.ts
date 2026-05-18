import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServiceStatuses, getActiveIncidentCounts } from '@/lib/db';
import { getServices } from '@/lib/services';
import { ServiceStatus, ServiceStatusResponse } from '@/lib/types';
import { deriveOverallStatus } from '@/lib/statusUtils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const statuses = getServiceStatuses();
    const activeIncidentCounts = getActiveIncidentCounts();

    const services: ServiceStatusResponse[] = getServices().map((service) => {
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
        downdetectorUrl: service.downdetectorSlug
          ? `https://downdetector.com/status/${service.downdetectorSlug}/`
          : '',
        brandFont: service.brandFont,
      };
    });

    const latestCheck = statuses.reduce((latest, s) => {
      if (!latest || s.checked_at > latest) return s.checked_at;
      return latest;
    }, null as string | null);

    const responseData = {
      services,
      lastUpdated: latestCheck || new Date().toISOString(),
    };

    const body = JSON.stringify(responseData);
    const etag = `"${createHash('md5').update(body).digest('hex')}"`;
    if (request.headers.get('if-none-match') === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }

    return NextResponse.json(responseData, {
      headers: { ETag: etag, 'Cache-Control': 'no-cache' },
    });
  } catch (err) {
    console.error('[api/status] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}
