import { NextRequest, NextResponse } from 'next/server';
import { sendPushToAll, isPushConfigured } from '@/lib/push';
import { isWriteEnabled, isAuthorized } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

// Broadcasts to every stored subscriber, so — unlike the per-recipient
// alerts/test and alerts/test-webhook endpoints — this needs the same
// admin gate as other dashboard-wide actions.
export async function POST(request: NextRequest) {
  if (!isWriteEnabled()) {
    return NextResponse.json(
      { error: 'Push test is not enabled. Set ENABLE_RULES_API=true or configure CRON_SECRET.' },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isPushConfigured()) {
    return NextResponse.json({ ok: false, reason: 'vapid_not_configured' }, { status: 503 });
  }
  const sent = await sendPushToAll({ title: 'Outage Map', body: 'Test push notification ✓', url: '/' });
  return NextResponse.json({ ok: true, sent });
}
