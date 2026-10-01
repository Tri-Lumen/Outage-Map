import { NextRequest, NextResponse } from 'next/server';
import { runPollCycle } from '@/lib/poller';
import { bearerMatches } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// In-memory rate limiter. The cron endpoint should fire at most once every
// few minutes — this guards against a misconfigured external scheduler that
// retries in a tight loop, or someone with the secret accidentally hammering
// the endpoint. Per-process state is fine because Next.js serverful mode
// pins this to one node-cron instance anyway.
//
// Keyed globally, not per-IP: there's exactly one shared CRON_SECRET for the
// whole deployment, so every authorized caller shares one bucket regardless
// of what X-Forwarded-For/X-Real-IP claim — those headers are client-settable
// unless a trusted reverse proxy overwrites them, which this app can't
// assume, so per-IP keying let a caller bypass the limit just by varying them.
const RATE_LIMIT_WINDOW_MS = 30_000;
let lastHitAt = 0;

export async function POST(request: NextRequest) {
  // Verify authorization. A missing or empty CRON_SECRET must NOT open
  // the endpoint — reject so an unconfigured deployment isn't a free
  // poll-trigger for the public internet.
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[api/cron] CRON_SECRET is not configured; refusing request');
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  if (!bearerMatches(request, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  if (now - lastHitAt < RATE_LIMIT_WINDOW_MS) {
    const retryAfterSec = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - lastHitAt)) / 1000);
    return NextResponse.json(
      { error: 'Rate limited' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    );
  }
  lastHitAt = now;

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
