import { NextRequest, NextResponse } from 'next/server';
import { runPollCycle } from '@/lib/poller';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
