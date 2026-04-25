import { NextRequest, NextResponse } from 'next/server';
import { getRecentIncidents } from '@/lib/db';
import { SERVICES } from '@/lib/services';
import { IncidentResponse, asIncidentSeverity, asIncidentStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daysParam = Number(searchParams.get('days'));
    const days = Number.isFinite(daysParam) && daysParam > 0
      ? Math.min(Math.floor(daysParam), 90)
      : 7;
    const serviceFilter = searchParams.get('service');
    const validSlugs = new Set(SERVICES.map((s) => s.slug));
    const service = serviceFilter && serviceFilter !== 'all' && validSlugs.has(serviceFilter)
      ? serviceFilter
      : null;

    let incidents = getRecentIncidents(days);

    if (service) {
      incidents = incidents.filter((i) => i.service_slug === service);
    }

    const serviceMap = new Map(SERVICES.map((s) => [s.slug, s.name]));

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

    return NextResponse.json({ incidents: response });
  } catch (err) {
    console.error('[api/incidents] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch incidents' },
      { status: 500 }
    );
  }
}
