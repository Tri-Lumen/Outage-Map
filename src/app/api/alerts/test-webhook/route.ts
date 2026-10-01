import { NextRequest, NextResponse } from 'next/server';
import { isValidWebhookUrl, sendWebhookAlert } from '@/lib/webhook';
import { buildChannelPayload } from '@/lib/alerts/channelPayloads';
import type { IncidentResult } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Sends a sample alert to a webhook URL so users can verify their integration
// (and the optional HMAC signature) before relying on it. Reuses the same
// SSRF guard and channel payload builder as live alerts.
export async function POST(request: NextRequest) {
  let url = '';
  let channelType = 'generic';
  try {
    const body = await request.json();
    url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (typeof body?.channelType === 'string') channelType = body.channelType;
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_request' }, { status: 400 });
  }

  if (!(await isValidWebhookUrl(url))) {
    return NextResponse.json({ ok: false, reason: 'invalid_url' }, { status: 400 });
  }

  const sample: IncidentResult = {
    serviceSlug: 'test',
    incidentId: 'test-' + Date.now(),
    title: 'Test alert from Outage Map',
    status: 'investigating',
    severity: 'minor',
    startedAt: new Date().toISOString(),
    resolvedAt: null,
    description: 'This is a test webhook delivery. If you can see this, your integration works.',
    sourceUrl: null,
  };

  const payload = buildChannelPayload(channelType, sample, 'Outage Map');
  const ok = await sendWebhookAlert(url, payload, channelType);
  return NextResponse.json({ ok }, { status: ok ? 200 : 502 });
}
