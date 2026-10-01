import { NextRequest, NextResponse } from 'next/server';
import { getStatusHistory, getPaginatedIncidents, IncidentRow } from '@/lib/db';
import { getServices } from '@/lib/services';
import { computeSlaRows, generateCsv, generatePdfHtml } from '@/lib/reports/slaReport';
import { getPollIntervalMinutes } from '@/lib/pollInterval';

export const dynamic = 'force-dynamic';

// getPaginatedIncidents caps a single page at 200; a report must cover every
// incident in range, so page through with plain offset pagination (cursor
// mode intentionally drops the date-range filter, so it can't be used here).
// Capped at 50 pages (50k incidents) as a sanity bound.
function collectAllIncidents(dateFrom: string, dateTo: string, service: string | null): IncidentRow[] {
  const pageSize = 1000;
  const all: IncidentRow[] = [];
  for (let page = 0; page < 100; page++) {
    const { incidents } = getPaginatedIncidents({ dateFrom, dateTo, service, limit: pageSize, offset: page * pageSize });
    all.push(...incidents);
    if (incidents.length < pageSize) break;
  }
  return all;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') === 'pdf' ? 'pdf' : 'csv';

  const defaultFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const defaultTo = new Date().toISOString().slice(0, 10);
  const from = searchParams.get('from') || defaultFrom;
  const to = searchParams.get('to') || defaultTo;
  const slaTarget = parseFloat(searchParams.get('sla') || '99.9');

  const allServices = getServices();
  const serviceParam = searchParams.get('service');
  const service = serviceParam && allServices.some((s) => s.slug === serviceParam) ? serviceParam : null;
  const services = service ? allServices.filter((s) => s.slug === service) : allServices;

  try {
    const history = getStatusHistory(service, 90, from, to);
    const incidents = collectAllIncidents(from, to, service);
    const rows = computeSlaRows(history, incidents, services, slaTarget, getPollIntervalMinutes());

    if (format === 'pdf') {
      const html = generatePdfHtml(rows, { from, to, slaTarget });
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="sla-report-${from}-to-${to}.html"`,
        },
      });
    }

    const csv = generateCsv(rows, { from, to, slaTarget });
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="sla-report-${from}-to-${to}.csv"`,
      },
    });
  } catch (err) {
    console.error('[api/reports/sla] Error:', err);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
