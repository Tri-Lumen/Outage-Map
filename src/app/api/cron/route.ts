import { NextRequest, NextResponse } from 'next/server';
import { runPollCycle } from '@/lib/poller';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
