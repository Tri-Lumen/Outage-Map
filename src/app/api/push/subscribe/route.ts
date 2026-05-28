import { NextRequest, NextResponse } from 'next/server';
import { upsertPushSubscription } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const input = body as Partial<{
    endpoint: unknown;
    keys: Partial<{ p256dh: unknown; auth: unknown }>;
    userAgent: unknown;
  }>;

  const endpoint = typeof input.endpoint === 'string' ? input.endpoint.trim() : '';
  const p256dh = typeof input.keys?.p256dh === 'string' ? input.keys.p256dh : '';
  const auth = typeof input.keys?.auth === 'string' ? input.keys.auth : '';

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'endpoint, keys.p256dh, and keys.auth are required' }, { status: 400 });
  }

  if (!/^https?:\/\//i.test(endpoint)) {
    return NextResponse.json({ error: 'Invalid endpoint URL' }, { status: 400 });
  }

  const userAgent = typeof input.userAgent === 'string' ? input.userAgent.slice(0, 200) : null;
  const id = `push_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    upsertPushSubscription({ id, endpoint, p256dh, auth, userAgent });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error('[api/push/subscribe] failed:', err);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}
