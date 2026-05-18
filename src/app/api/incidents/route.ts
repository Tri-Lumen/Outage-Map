import { NextRequest, NextResponse } from 'next/server';
import { getPaginatedIncidents } from '@/lib/db';
import { getServices } from '@/lib/services';
import { IncidentResponse, asIncidentSeverity, asIncidentStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const daysParam = Number(searchParams.get('days'));
    const days = Number.isFinite(daysParam) && daysParam > 0
      ? Math.min(Math.floor(daysParam), 90)
      : 7;

    const limitParam = Number(searchParams.get('limit'));
    const limit = Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.floor(limitParam), 200)
      : 50;

    const offsetParam = Number(searchParams.get('offset'));
    const offset = Number.isFinite(offsetParam) && offsetParam >= 0
      ? Math.floor(offsetParam)
      : 0;

    const since = searchParams.get('since') || null;

    const allServices = getServices();
    const validSlugs = new Set(allServices.map((s) => s.slug));
    const serviceFilter = searchParams.get('service');
    const service = serviceFilter && serviceFilter !== 'all' && validSlugs.has(serviceFilter)
      ? serviceFilter
      : null;

    const { incidents, total } = getPaginatedIncidents({ days, service, limit, offset, since });

    const serviceMap = new Map(allServices.map((s) => [s.slug, s.name]));

    const response: IncidentResponse[] = incidents.map((i) => ({
      id: i.id,
      service: i.service_slug,
      serviceName: serviceMap.get(i.service_slug) || i.service_slug,
      title: i.title,
      status: asIncidentStatus(i.status),
      severity: asIncidentSeverity(i.severity),
      startedAt: i.started_at,
      resolvedAt: i.resolved_at,
      description: i.description,
      sourceUrl: i.source_url,
      updatedAt: i.updated_at,
    }));

    return NextResponse.json({ incidents: response, total, limit, offset });
  } catch (err) {
    console.error('[api/incidents] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch incidents' },
      { status: 500 }
    );
  }
}
