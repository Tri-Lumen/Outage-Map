import { NextRequest, NextResponse } from 'next/server';
import {
  insertAlertRule,
  listAlertRules,
} from '@/lib/db';
import { rowToRule } from '@/lib/alerts/rules';
import { SERVICES } from '@/lib/services';
import { isIncidentSeverity } from '@/lib/types';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isWriteEnabled(): boolean {
  return process.env.ENABLE_RULES_API === 'true' || !!process.env.CRON_SECRET;
}

function isAuthorized(request: NextRequest): boolean {
  // If ENABLE_RULES_API=true, the endpoint is open (intended for trusted/internal
  // deployments). Otherwise CRON_SECRET Bearer is required.
  if (process.env.ENABLE_RULES_API === 'true') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

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
    enabled: unknown;
  }>;

  const email = typeof input.email === 'string' ? input.email.trim() : '';
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const validSlugs = new Set(SERVICES.map((s) => s.slug));
  const services = Array.isArray(input.services)
    ? input.services.filter((s): s is string => typeof s === 'string' && validSlugs.has(s))
    : [];

  const minSeverity = isIncidentSeverity(input.minSeverity) ? input.minSeverity : 'major';
  const emailEnabled = input.emailEnabled !== false;
  const enabled = input.enabled !== false;

  const id = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    insertAlertRule({
      id,
      email,
      services: JSON.stringify(services),
      minSeverity,
      emailEnabled,
      enabled,
    });
    return NextResponse.json({
      rule: { id, email, services, minSeverity, emailEnabled, enabled },
    }, { status: 201 });
  } catch (err) {
    console.error('[api/alerts/rules] Insert failed:', err);
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 });
  }
}
