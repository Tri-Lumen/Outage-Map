import { NextRequest, NextResponse } from 'next/server';
import {
  insertAlertRule,
  listAlertRules,
} from '@/lib/db';
import { rowToRule } from '@/lib/alerts/rules';
import { getServices } from '@/lib/services';
import { isIncidentSeverity, isChannelType } from '@/lib/types';
import { isWriteEnabled, isAuthorized } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  // Reads are always allowed — rules are not sensitive data on their own
  // (no SMTP creds). Wrap them so the UI can populate.
  try {
    const rows = listAlertRules();
    return NextResponse.json({ rules: rows.map(rowToRule) });
  } catch (err) {
    console.error('[api/alerts/rules] List failed:', err);
    return NextResponse.json({ error: 'Failed to list rules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isWriteEnabled()) {
    return NextResponse.json(
      { error: 'Rules API is not enabled. Set ENABLE_RULES_API=true or configure CRON_SECRET.' },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const input = body as Partial<{
    email: string;
    services: unknown;
    minSeverity: unknown;
    emailEnabled: unknown;
    webhookUrl: unknown;
    webhookEnabled: unknown;
    channelType: unknown;
    escalationEnabled: unknown;
    escalationIntervals: unknown;
    enabled: unknown;
  }>;

  const email = typeof input.email === 'string' ? input.email.trim() : '';
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const validSlugs = new Set(getServices().map((s) => s.slug));
  const services = Array.isArray(input.services)
    ? input.services.filter((s): s is string => typeof s === 'string' && validSlugs.has(s))
    : [];

  const minSeverity = isIncidentSeverity(input.minSeverity) ? input.minSeverity : 'major';
  const emailEnabled = input.emailEnabled !== false;
  const enabled = input.enabled !== false;

  let webhookUrl: string | null = null;
  if (typeof input.webhookUrl === 'string' && input.webhookUrl.trim()) {
    const { isValidWebhookUrl } = await import('@/lib/webhook');
    if (!(await isValidWebhookUrl(input.webhookUrl.trim()))) {
      return NextResponse.json({ error: 'Invalid or disallowed webhook URL' }, { status: 400 });
    }
    webhookUrl = input.webhookUrl.trim();
  }
  const webhookEnabled = !!input.webhookEnabled && webhookUrl !== null;

  if (input.channelType !== undefined && !isChannelType(input.channelType)) {
    return NextResponse.json({ error: 'Invalid channelType' }, { status: 400 });
  }
  const channelType = isChannelType(input.channelType) ? input.channelType : 'generic';

  const escalationEnabled = !!input.escalationEnabled;
  let escalationIntervals: number[] | undefined;
  if (Array.isArray(input.escalationIntervals)) {
    const cleaned = input.escalationIntervals.filter(
      (n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0,
    );
    if (cleaned.length > 0) escalationIntervals = cleaned;
  }

  const id = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    insertAlertRule({
      id,
      email,
      services: JSON.stringify(services),
      minSeverity,
      emailEnabled,
      webhookUrl,
      webhookEnabled,
      channelType,
      escalationEnabled,
      escalationIntervals,
      enabled,
    });
    return NextResponse.json({
      rule: {
        id, email, services, minSeverity, emailEnabled, webhookUrl, webhookEnabled,
        channelType, escalationEnabled, escalationIntervals: escalationIntervals ?? [240, 1440], enabled,
      },
    }, { status: 201 });
  } catch (err) {
    console.error('[api/alerts/rules] Insert failed:', err);
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 });
  }
}
