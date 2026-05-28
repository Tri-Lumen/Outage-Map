import { NextRequest, NextResponse } from 'next/server';
import { getStatusHistory, getPaginatedIncidents } from '@/lib/db';
import { getServices } from '@/lib/services';
import { computeSlaRows, generateCsv, generatePdfHtml } from '@/lib/reports/slaReport';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') === 'pdf' ? 'pdf' : 'csv';

  const defaultFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const defaultTo = new Date().toISOString().slice(0, 10);
  const from = searchParams.get('from') || defaultFrom;
  const to = searchParams.get('to') || defaultTo;
  const slaTarget = parseFloat(searchParams.get('sla') || '99.9');

  try {
    const history = getStatusHistory(null, 90, from, to);
    const { incidents } = getPaginatedIncidents({ dateFrom: from, dateTo: to, limit: 2000 });
    const services = getServices();
    const rows = computeSlaRows(history, incidents, services, slaTarget);

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
