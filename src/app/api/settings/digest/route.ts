import { NextRequest, NextResponse } from 'next/server';
import { getDigestConfig, setDigestConfig, sendDigestNow } from '@/lib/digest';

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
  return NextResponse.json(getDigestConfig());
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

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  if (body.sendNow) {
    const res = await sendDigestNow();
    return NextResponse.json(res, { status: res.ok ? 200 : 502 });
  }

  const patch: Record<string, unknown> = {};
  if (body.frequency === 'off' || body.frequency === 'daily' || body.frequency === 'weekly') patch.frequency = body.frequency;
  if (typeof body.hour === 'number' && body.hour >= 0 && body.hour <= 23) patch.hour = Math.round(body.hour);
  if (Array.isArray(body.recipients)) patch.recipients = (body.recipients as unknown[]).filter((x) => typeof x === 'string');
  if (typeof body.webhookUrl === 'string') patch.webhookUrl = body.webhookUrl.trim();
  if (typeof body.channelType === 'string') patch.channelType = body.channelType;

  return NextResponse.json(setDigestConfig(patch));
}
