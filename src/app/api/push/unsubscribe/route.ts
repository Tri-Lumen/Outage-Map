import { NextRequest, NextResponse } from 'next/server';
import { deletePushSubscription } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const endpoint = typeof (body as { endpoint?: unknown }).endpoint === 'string'
    ? (body as { endpoint: string }).endpoint.trim()
    : '';

  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint is required' }, { status: 400 });
  }

  try {
    deletePushSubscription(endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/push/unsubscribe] failed:', err);
    return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
  }
}
