import { NextRequest, NextResponse } from 'next/server';
import { getRecentIncidents } from '@/lib/db';
import { SERVICES } from '@/lib/services';
import { IncidentResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7', 10);
    const serviceFilter = searchParams.get('service') || null;

    let incidents = getRecentIncidents(Math.min(days, 90));

    if (serviceFilter && serviceFilter !== 'all') {
      incidents = incidents.filter((i) => i.service_slug === serviceFilter);
    }

    const serviceMap = new Map(SERVICES.map((s) => [s.slug, s.name]));

    const response: IncidentResponse[] = incidents.map((i) => ({
      id: i.id,
      service: i.service_slug,
      serviceName: serviceMap.get(i.service_slug) || i.service_slug,
      title: i.title,
      status: i.status as IncidentResponse['status'],
      severity: i.severity as IncidentResponse['severity'],
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
