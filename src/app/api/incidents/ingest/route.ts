import { NextRequest, NextResponse } from 'next/server';
import { upsertIncident, isServiceInMaintenance } from '@/lib/db';
import { getServiceBySlug } from '@/lib/services';
import { asIncidentStatus, asIncidentSeverity, type IncidentResult } from '@/lib/types';
import { isWriteEnabled, isAuthorized } from '@/lib/apiAuth';
import { evaluateRulesForIncident, evaluateRulesForWebhook } from '@/lib/alerts/rules';
import { sendIncidentAlert } from '@/lib/email';
import { sendWebhookAlerts } from '@/lib/webhook';
import { metrics } from '@/lib/metrics';
import { broadcastSSE } from '@/lib/sse';

export const dynamic = 'force-dynamic';

// Lets an external tool (an internal monitoring system, a manual NOC entry,
// a script watching something this app has no connector for) push an
// incident in directly, going through the same dedup/alerting path a
// connector-discovered incident does. Gated the same way every other write
// endpoint is (ENABLE_RULES_API / CRON_SECRET) — there's no separate token
// for this, since a caller trusted to create alert rules is equally trusted
// to report an incident.
export async function POST(request: NextRequest) {
  if (!isWriteEnabled()) {
    return NextResponse.json(
      { error: 'Ingestion API is not enabled. Set ENABLE_RULES_API=true or configure CRON_SECRET.' },
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
    serviceSlug: unknown;
    incidentId: unknown;
    title: unknown;
    status: unknown;
    severity: unknown;
    startedAt: unknown;
    resolvedAt: unknown;
    description: unknown;
    sourceUrl: unknown;
  }>;

  const serviceSlug = typeof input.serviceSlug === 'string' ? input.serviceSlug.trim() : '';
  if (!serviceSlug || !getServiceBySlug(serviceSlug)) {
    return NextResponse.json({ error: 'Unknown or missing serviceSlug' }, { status: 400 });
  }

  const title = typeof input.title === 'string' ? input.title.trim().slice(0, 200) : '';
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const status = asIncidentStatus(input.status);
  const severity = asIncidentSeverity(input.severity);
  const incidentId = typeof input.incidentId === 'string' && input.incidentId.trim()
    ? input.incidentId.trim().slice(0, 200)
    : `ingest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = typeof input.startedAt === 'string' && input.startedAt.trim() ? input.startedAt.trim() : new Date().toISOString();
  const resolvedAt = typeof input.resolvedAt === 'string' && input.resolvedAt.trim() ? input.resolvedAt.trim() : null;
  const description = typeof input.description === 'string' ? input.description.slice(0, 2000) : null;
  const sourceUrl = typeof input.sourceUrl === 'string' ? input.sourceUrl.slice(0, 500) : null;

  try {
    const { isNew } = upsertIncident(
      serviceSlug, incidentId, title, status, severity, startedAt, resolvedAt, description, sourceUrl,
    );

    if (isNew) {
      metrics.incIncidents(serviceSlug, severity);
      broadcastSSE({ type: 'poll_complete', ts: Date.now(), services_changed: [serviceSlug] });

      if ((severity === 'major' || severity === 'critical') && !isServiceInMaintenance(serviceSlug)) {
        const incident: IncidentResult = {
          serviceSlug, incidentId, title, status, severity, startedAt, resolvedAt, description, sourceUrl,
        };
        const ruleRecipients = evaluateRulesForIncident(incident);
        const webhooks = evaluateRulesForWebhook(incident);
        await Promise.all([
          sendIncidentAlert(incident, ruleRecipients),
          sendWebhookAlerts(incident, webhooks),
        ]);
      }
    }

    return NextResponse.json({ ok: true, incidentId, isNew }, { status: isNew ? 201 : 200 });
  } catch (err) {
    console.error('[api/incidents/ingest] Failed:', err);
    return NextResponse.json({ error: 'Failed to ingest incident' }, { status: 500 });
  }
}
