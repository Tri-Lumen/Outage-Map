import { NextRequest, NextResponse } from 'next/server';
import { getServiceStatuses } from '@/lib/db';
import { getServiceBySlug } from '@/lib/services';
import { deriveOverallStatus } from '@/lib/statusUtils';
import { statusHex, statusLabel } from '@/lib/statusColors';
import type { ServiceStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Rough per-character width at the badge's 11px font — shields.io measures
// exact glyph metrics; this is a close-enough estimate for a monospace-ish
// sans body font and keeps the route dependency-free.
const CHAR_WIDTH = 6.7;
const PAD = 10;

function textWidth(s: string): number {
  return Math.round(s.length * CHAR_WIDTH) + PAD * 2;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderBadge(label: string, message: string, color: string): string {
  const labelW = textWidth(label);
  const messageW = textWidth(message);
  const totalW = labelW + messageW;
  const height = 20;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${height}" role="img" aria-label="${escapeXml(label)}: ${escapeXml(message)}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalW}" height="${height}" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="${height}" fill="#555"/>
    <rect x="${labelW}" width="${messageW}" height="${height}" fill="${color}"/>
    <rect width="${totalW}" height="${height}" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelW / 2}" y="14">${escapeXml(label)}</text>
    <text x="${labelW + messageW / 2}" y="14">${escapeXml(message)}</text>
  </g>
</svg>`;
}

// Shields.io-style status badge for a single service, suitable for embedding
// in a README (`![status](https://.../api/badge/slack.svg)`) or any <img>.
// The ".svg" suffix is accepted but optional — [slug] captures it verbatim.
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const slug = params.slug.replace(/\.svg$/i, '');
  const service = getServiceBySlug(slug);
  if (!service) {
    return NextResponse.json({ error: `Unknown service slug "${slug}"` }, { status: 404 });
  }

  const statuses = getServiceStatuses();
  const official = statuses.find((s) => s.service_slug === slug && s.source === 'official');
  const officialStatus: ServiceStatus = (official?.status as ServiceStatus) || 'unknown';
  const overall = deriveOverallStatus(officialStatus);

  const svg = renderBadge(service.name, statusLabel(overall), statusHex(overall));

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=60',
    },
  });
}
