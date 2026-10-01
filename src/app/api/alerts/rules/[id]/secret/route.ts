import { NextRequest, NextResponse } from 'next/server';
import { getAlertRuleSecret, rotateAlertRuleSecret } from '@/lib/db';
import { isWriteEnabled, isAuthorized } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: { id: string };
}

// Reveals a rule's current webhook signing secret. Gated the same way writes
// are (ENABLE_RULES_API / CRON_SECRET) even though this is a read, since the
// secret is sensitive — unlike the rest of an alert rule, which the GET
// /api/alerts/rules list exposes to anyone.
export async function GET(request: NextRequest, { params }: Ctx) {
  if (!isWriteEnabled()) {
    return NextResponse.json(
      { error: 'Rules API is not enabled. Set ENABLE_RULES_API=true or configure CRON_SECRET.' },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const secret = getAlertRuleSecret(params.id);
  if (!secret) {
    return NextResponse.json({ error: 'No secret set for this rule' }, { status: 404 });
  }
  return NextResponse.json({ secret });
}

// Rotates (regenerates) a rule's webhook signing secret, invalidating the old one.
export async function POST(request: NextRequest, { params }: Ctx) {
  if (!isWriteEnabled()) {
    return NextResponse.json(
      { error: 'Rules API is not enabled. Set ENABLE_RULES_API=true or configure CRON_SECRET.' },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const secret = rotateAlertRuleSecret(params.id);
  if (!secret) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  }
  return NextResponse.json({ secret });
}
