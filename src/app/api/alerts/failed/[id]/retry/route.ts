import { NextRequest, NextResponse } from 'next/server';
import { retryFailedAlertById } from '@/lib/alerts/retry';
import { isWriteEnabled, isAuthorized } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: Ctx) {
  if (!isWriteEnabled()) {
    return NextResponse.json(
      { error: 'Alerts API is not enabled. Set ENABLE_RULES_API=true or configure CRON_SECRET.' },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const result = await retryFailedAlertById(id);
  if (result.ok) return NextResponse.json(result);
  const status = result.error === 'not_found' ? 404 : 502;
  return NextResponse.json(result, { status });
}
