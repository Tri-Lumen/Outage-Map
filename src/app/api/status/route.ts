import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServiceStatuses, getActiveIncidentCounts, listActiveMaintenanceWindows } from '@/lib/db';
import { getServices } from '@/lib/services';
import { ServiceStatus, ServiceStatusResponse } from '@/lib/types';
import { deriveOverallStatus } from '@/lib/statusUtils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const statuses = getServiceStatuses();
    const activeIncidentCounts = getActiveIncidentCounts();
    const activeWindows = listActiveMaintenanceWindows();

    const maintenanceSet = new Set<string>();
    for (const w of activeWindows) {
      let slugs: string[] = [];
      try { slugs = JSON.parse(w.service_slugs); } catch { /* ignore */ }
      if (slugs.length === 0) {
        // All services in maintenance
        for (const s of getServices()) maintenanceSet.add(s.slug);
      } else {
        for (const s of slugs) maintenanceSet.add(s);
      }
    }

    // A service is "stale" if its last successful check is older than a few
    // poll cycles — i.e. the poller stopped updating it. checked_at is stored as
    // SQLite UTC ("YYYY-MM-DD HH:MM:SS"); normalize to an ISO instant to compare.
    const pollMinutes = Number(process.env.POLL_INTERVAL_MINUTES) || 3;
    const staleMs = pollMinutes * 3 * 60 * 1000;
    const now = Date.now();
    const parseChecked = (s: string): number => Date.parse(s.replace(' ', 'T') + 'Z');

    const services: ServiceStatusResponse[] = getServices().map((service) => {
      const official = statuses.find(
        (s) => s.service_slug === service.slug && s.source === 'official'
      );

      const officialStatus: ServiceStatus = (official?.status as ServiceStatus) || 'unknown';
      const incidentCount = activeIncidentCounts[service.slug] || 0;
      const lastChecked = official?.checked_at || null;
      const stale = lastChecked ? now - parseChecked(lastChecked) > staleMs : true;

      return {
        slug: service.slug,
        name: service.name,
        color: service.color,
        officialStatus,
        incidentCount,
        overallStatus: deriveOverallStatus(officialStatus),
        details: official?.details || null,
        lastChecked,
        stale,
        statusUrl: service.statusUrl,
        brandFont: service.brandFont,
        category: service.category ?? null,
        inMaintenance: maintenanceSet.has(service.slug),
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
