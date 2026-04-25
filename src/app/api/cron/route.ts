import { NextRequest, NextResponse } from 'next/server';
import { runPollCycle } from '@/lib/poller';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// In-memory rate limiter. The cron endpoint should fire at most once every
// few minutes — this guards against a misconfigured external scheduler that
// retries in a tight loop, or someone with the secret accidentally hammering
// the endpoint. Per-process state is fine because Next.js serverful mode
// pins this to one node-cron instance anyway.
const RATE_LIMIT_WINDOW_MS = 30_000;
const lastHitByKey = new Map<string, number>();

function rateLimitKey(request: NextRequest): string {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  return ip;
}

export async function POST(request: NextRequest) {
  // Verify authorization. A missing or empty CRON_SECRET must NOT open
  // the endpoint — reject so an unconfigured deployment isn't a free
  // poll-trigger for the public internet.
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[api/cron] CRON_SECRET is not configured; refusing request');
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const key = rateLimitKey(request);
  const now = Date.now();
  const last = lastHitByKey.get(key) ?? 0;
  if (now - last < RATE_LIMIT_WINDOW_MS) {
    const retryAfterSec = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - last)) / 1000);
    return NextResponse.json(
      { error: 'Rate limited' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    );
  }
  lastHitByKey.set(key, now);
  // Best-effort cleanup so the map doesn't grow unbounded.
  if (lastHitByKey.size > 1000) {
    lastHitByKey.forEach((t, k) => {
      if (now - t > RATE_LIMIT_WINDOW_MS * 4) lastHitByKey.delete(k);
    });
  }

  try {
    const result = await runPollCycle();
    return NextResponse.json({
      success: result.success,
      polled: result.polled,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[api/cron] Error:', err);
    return NextResponse.json(
      { error: 'Poll cycle failed' },
      { status: 500 }
    );
  }
}
