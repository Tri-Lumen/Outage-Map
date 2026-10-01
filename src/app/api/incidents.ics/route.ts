import { NextRequest, NextResponse } from 'next/server';
import { getPaginatedIncidents } from '@/lib/db';
import { getServices } from '@/lib/services';

export const dynamic = 'force-dynamic';

function toIcsDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function foldLine(line: string): string {
  // RFC 5545 §3.1: lines SHOULD be folded at 75 octets, continuation lines
  // start with a single space.
  if (line.length <= 75) return line;
  let out = line.slice(0, 75);
  let rest = line.slice(75);
  while (rest.length > 0) {
    out += '\r\n ' + rest.slice(0, 74);
    rest = rest.slice(74);
  }
  return out;
}

function escapeIcsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// RFC 5545 calendar feed of incidents — one VEVENT per incident, spanning
// startedAt -> resolvedAt (DTSTART only, no DTEND, while still unresolved).
// `?service=slug` filters to one service; `?days=` bounds how far back to
// look (default/max 90, matching /api/incidents).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const daysParam = Number(searchParams.get('days'));
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(Math.floor(daysParam), 90) : 90;

  const validSlugs = new Set(getServices().map((s) => s.slug));
  const serviceParam = searchParams.get('service');
  const service = serviceParam && validSlugs.has(serviceParam) ? serviceParam : null;

  const { incidents } = getPaginatedIncidents({ days, service, limit: 500 });

  const now = toIcsDate(new Date().toISOString());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Outage Map//Incidents//EN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Outage Map Incidents',
  ];

  for (const i of incidents) {
    const dtstart = toIcsDate(i.started_at) ?? toIcsDate(i.created_at);
    if (!dtstart) continue;
    const dtend = toIcsDate(i.resolved_at);

    lines.push('BEGIN:VEVENT');
    lines.push(foldLine(`UID:${i.incident_id}@${i.service_slug}.outage-map`));
    lines.push(foldLine(`DTSTAMP:${now}`));
    lines.push(foldLine(`DTSTART:${dtstart}`));
    if (dtend) lines.push(foldLine(`DTEND:${dtend}`));
    lines.push(foldLine(`SUMMARY:${escapeIcsText(`[${i.severity.toUpperCase()}] ${i.service_slug}: ${i.title}`)}`));
    if (i.description) lines.push(foldLine(`DESCRIPTION:${escapeIcsText(i.description)}`));
    if (i.source_url) lines.push(foldLine(`URL:${escapeIcsText(i.source_url)}`));
    lines.push(foldLine(`STATUS:${i.status === 'resolved' ? 'CONFIRMED' : 'TENTATIVE'}`));
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return new NextResponse(lines.join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="outage-map-incidents.ics"',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
