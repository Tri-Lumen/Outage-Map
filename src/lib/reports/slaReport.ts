import type { IncidentRow } from '../db';
import type { ServiceConfig } from '../types';

export interface SlaRow {
  slug: string;
  name: string;
  color: string;
  uptimePct: number;
  downtimeMinutes: number;
  mttrMinutes: number | null;
  incidentCount: number;
  criticalCount: number;
  majorCount: number;
  minorCount: number;
  slaMet: boolean;
}

type HistoryPoint = {
  service_slug: string;
  status: string;
  report_count: number;
  incident_count: number;
  recorded_at: string;
};

const STATUS_OUTAGE_WEIGHT: Record<string, number> = {
  operational: 0,
  degraded: 0.5,
  major_outage: 1,
  down: 1,
  unknown: 0,
};

export function computeSlaRows(
  history: HistoryPoint[],
  incidents: IncidentRow[],
  services: ServiceConfig[],
  slaTarget: number = 99.9,
  pollIntervalMinutes: number = 3,
): SlaRow[] {
  const bySlug: Record<string, HistoryPoint[]> = {};
  for (const h of history) {
    (bySlug[h.service_slug] ??= []).push(h);
  }

  const incidentsBySlug: Record<string, IncidentRow[]> = {};
  for (const i of incidents) {
    (incidentsBySlug[i.service_slug] ??= []).push(i);
  }

  return services.map((svc) => {
    const points = bySlug[svc.slug] ?? [];
    const totalPoints = points.length;
    const outagePoints = points.reduce((s, p) => s + (STATUS_OUTAGE_WEIGHT[p.status] ?? 0), 0);
    const uptimePct = totalPoints > 0 ? ((totalPoints - outagePoints) / totalPoints) * 100 : 100;
    const downtimeMinutes = Math.round(outagePoints * pollIntervalMinutes);

    const svcIncidents = incidentsBySlug[svc.slug] ?? [];
    const resolved = svcIncidents.filter((i) => i.resolved_at && i.started_at);
    let mttrMinutes: number | null = null;
    if (resolved.length > 0) {
      const totalMs = resolved.reduce((s, i) => {
        const d = new Date(i.resolved_at!).getTime() - new Date(i.started_at!).getTime();
        return s + Math.max(0, d);
      }, 0);
      mttrMinutes = Math.round(totalMs / resolved.length / 60000);
    }

    const criticalCount = svcIncidents.filter((i) => i.severity === 'critical').length;
    const majorCount = svcIncidents.filter((i) => i.severity === 'major').length;
    const minorCount = svcIncidents.filter((i) => i.severity === 'minor').length;

    return {
      slug: svc.slug,
      name: svc.name,
      color: svc.color,
      uptimePct: parseFloat(uptimePct.toFixed(3)),
      downtimeMinutes,
      mttrMinutes,
      incidentCount: svcIncidents.length,
      criticalCount,
      majorCount,
      minorCount,
      slaMet: uptimePct >= slaTarget,
    };
  });
}

export function generateCsv(rows: SlaRow[], meta: { from: string; to: string; slaTarget: number }): string {
  const header = [
    'Service', 'Uptime %', 'Downtime (min)', 'MTTR (min)', 'Incidents', 'Critical', 'Major', 'Minor', `SLA ≥${meta.slaTarget}%`
  ].join(',');

  const dataRows = rows.map((r) =>
    [
      `"${r.name}"`,
      r.uptimePct.toFixed(3),
      r.downtimeMinutes,
      r.mttrMinutes ?? '',
      r.incidentCount,
      r.criticalCount,
      r.majorCount,
      r.minorCount,
      r.slaMet ? 'Yes' : 'No',
    ].join(',')
  );

  const metaLine = `"Generated: ${new Date().toISOString()} | Period: ${meta.from} to ${meta.to} | SLA target: ${meta.slaTarget}%"`;
  return [metaLine, header, ...dataRows].join('\n');
}

// PDF generation without pdfkit dependency — produce an HTML page instead
// that the browser can print-to-PDF. This avoids a server binary dependency
// while still providing a downloadable formatted report.
export function generatePdfHtml(rows: SlaRow[], meta: { from: string; to: string; slaTarget: number }): string {
  const rowsHtml = rows.map((r) => `
    <tr style="border-bottom: 1px solid #e2e8f0; ${!r.slaMet ? 'background: #fff1f2;' : ''}">
      <td style="padding: 8px 12px;">${r.name}</td>
      <td style="padding: 8px 12px; text-align: right; font-weight: 600; color: ${r.slaMet ? '#16a34a' : '#dc2626'};">${r.uptimePct.toFixed(3)}%</td>
      <td style="padding: 8px 12px; text-align: right;">${r.downtimeMinutes}</td>
      <td style="padding: 8px 12px; text-align: right;">${r.mttrMinutes ?? '—'}</td>
      <td style="padding: 8px 12px; text-align: right;">${r.incidentCount}</td>
      <td style="padding: 8px 12px; text-align: center;">${r.slaMet ? '✓' : '✗'}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>SLA Report — ${meta.from} to ${meta.to}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 40px auto; color: #1e293b; }
  h1 { color: #0f172a; }
  .meta { color: #64748b; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1e293b; color: white; padding: 10px 12px; text-align: left; }
  th:not(:first-child) { text-align: right; }
  tr:nth-child(even) { background: #f8fafc; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
<h1>SLA Report</h1>
<div class="meta">
  <strong>Period:</strong> ${meta.from} — ${meta.to}<br>
  <strong>SLA Target:</strong> ${meta.slaTarget}%<br>
  <strong>Generated:</strong> ${new Date().toISOString()}
</div>
<table>
  <thead>
    <tr>
      <th>Service</th><th>Uptime %</th><th>Downtime (min)</th><th>MTTR (min)</th><th>Incidents</th><th>SLA Met</th>
    </tr>
  </thead>
  <tbody>${rowsHtml}</tbody>
</table>
</body>
</html>`;
}
