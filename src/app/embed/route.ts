import { NextRequest } from 'next/server';
import { getServices } from '@/lib/services';
import { getServiceStatuses, getActiveIncidentCounts } from '@/lib/db';
import { deriveOverallStatus } from '@/lib/statusUtils';
import { getStatusColor } from '@/lib/boardColors';
import type { ServiceStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ENTITIES[ch]);
}

// Self-contained HTML widget for embedding the current status in an <iframe>.
// Query params: ?service=<slug> (filter to one), ?theme=light|dark.
export function GET(req: NextRequest) {
  const url = new URL(req.url);
  const filter = url.searchParams.get('service');
  const theme = url.searchParams.get('theme') === 'light' ? 'light' : 'dark';

  const statuses = getServiceStatuses();
  const incidentCounts = getActiveIncidentCounts();

  let services = getServices().map((svc) => {
    const official = statuses.find((s) => s.service_slug === svc.slug && s.source === 'official');
    const dd = statuses.find((s) => s.service_slug === svc.slug && s.source === 'downdetector');
    const officialStatus = (official?.status as ServiceStatus) || 'unknown';
    const ddStatus = (dd?.status as ServiceStatus) || 'unknown';
    const overall = deriveOverallStatus(officialStatus, ddStatus, incidentCounts[svc.slug] || 0);
    return { slug: svc.slug, name: svc.name, overall };
  });
  if (filter) services = services.filter((s) => s.slug === filter);

  const down = services.filter((s) => s.overall === 'down' || s.overall === 'major_outage').length;
  const degraded = services.filter((s) => s.overall === 'degraded').length;
  const overall = down > 0 ? 'down' : degraded > 0 ? 'degraded' : 'operational';
  const oc = getStatusColor(overall);
  const headline =
    overall === 'operational'
      ? 'All systems operational'
      : down > 0
        ? `${down} service${down !== 1 ? 's' : ''} down`
        : `${degraded} service${degraded !== 1 ? 's' : ''} degraded`;

  const bg = theme === 'light' ? '#ffffff' : '#0b1014';
  const fg = theme === 'light' ? '#1a2436' : '#e6edf3';
  const sub = theme === 'light' ? '#5b6675' : '#93a1a1';
  const border = theme === 'light' ? '#e3e8ef' : 'rgba(255,255,255,0.08)';

  const rows = services
    .map((s) => {
      const c = getStatusColor(s.overall);
      return `<li style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-top:1px solid ${border}">
      <span style="display:flex;align-items:center;gap:8px;min-width:0">
        <span style="width:8px;height:8px;border-radius:50%;background:${c.dot};flex:0 0 auto"></span>
        <span style="font-size:13px;color:${fg};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.name)}</span>
      </span>
      <span style="font-size:11px;color:${c.text};white-space:nowrap">${c.label}</span>
    </li>`;
    })
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>System status</title></head>
<body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:${bg}">
  <div style="max-width:440px;margin:0 auto;border:1px solid ${border};border-radius:12px;overflow:hidden">
    <div style="padding:12px 14px;background:${oc.bg};display:flex;align-items:center;gap:8px">
      <span style="width:10px;height:10px;border-radius:50%;background:${oc.dot}"></span>
      <span style="font-size:13px;font-weight:600;color:${oc.text}">${esc(headline)}</span>
    </div>
    <ul style="list-style:none;margin:0;padding:0">${rows || `<li style="padding:14px;color:${sub};font-size:12px;text-align:center">No services</li>`}</ul>
  </div>
</body></html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}
