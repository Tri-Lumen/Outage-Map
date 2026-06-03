import { NextResponse } from 'next/server';
import { sendPushToAll, isPushConfigured } from '@/lib/push';

export const dynamic = 'force-dynamic';

export async function POST() {
  if (!isPushConfigured()) {
    return NextResponse.json({ ok: false, reason: 'vapid_not_configured' }, { status: 503 });
  }
  const sent = await sendPushToAll({ title: 'Outage Map', body: 'Test push notification ✓', url: '/' });
  return NextResponse.json({ ok: true, sent });
}
