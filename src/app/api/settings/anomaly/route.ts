import { NextRequest, NextResponse } from 'next/server';
import { setJsonSetting } from '@/lib/db';
import { getAnomalyConfig, ANOMALY_SETTINGS_KEY } from '@/lib/anomaly';

export const dynamic = 'force-dynamic';

function isWriteEnabled(): boolean {
  return process.env.ENABLE_RULES_API === 'true' || !!process.env.CRON_SECRET;
}

function isAuthorized(request: NextRequest): boolean {
  if (process.env.ENABLE_RULES_API === 'true') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export function GET() {
  return NextResponse.json(getAnomalyConfig());
}

export async function POST(request: NextRequest) {
  if (!isWriteEnabled()) {
    return NextResponse.json(
      { error: 'Settings API is not enabled. Set ENABLE_RULES_API=true or configure CRON_SECRET.' },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let threshold: number | undefined;
  let minPoints: number | undefined;
  try {
    const body = await request.json();
    if (typeof body?.threshold === 'number') threshold = body.threshold;
    if (typeof body?.minPoints === 'number') minPoints = body.minPoints;
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const current = getAnomalyConfig();
  const next = {
    threshold: threshold !== undefined && threshold > 0 && threshold <= 10 ? threshold : current.threshold,
    minPoints: minPoints !== undefined && minPoints >= 3 && minPoints <= 200 ? Math.round(minPoints) : current.minPoints,
  };
  setJsonSetting(ANOMALY_SETTINGS_KEY, next);
  return NextResponse.json(next);
}
