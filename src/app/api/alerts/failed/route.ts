import { NextRequest, NextResponse } from 'next/server';
import { listUnresolvedFailedAlerts } from '@/lib/db';
import { isWriteEnabled, isAuthorized } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

// Gated the same as the write endpoints (not just a read) because a failed
// webhook_incident row's payload can carry that rule's signing secret —
// unlike GET /api/alerts/rules, this isn't safe to leave open.
export async function GET(request: NextRequest) {
  if (!isWriteEnabled()) {
    return NextResponse.json(
      { error: 'Alerts API is not enabled. Set ENABLE_RULES_API=true or configure CRON_SECRET.' },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = listUnresolvedFailedAlerts(100);
    const failedAlerts = rows.map((r) => {
      let summary = r.kind;
      try {
        const p = JSON.parse(r.payload);
        summary = p.incident?.title || p.incidentTitle || p.url || r.kind;
      } catch {
        // keep the kind as the summary
      }
      return {
        id: r.id,
        kind: r.kind,
        serviceSlug: r.service_slug,
        incidentId: r.incident_id,
        summary,
        attempts: r.attempts,
        lastError: r.last_error,
        createdAt: r.created_at,
        lastAttemptAt: r.last_attempt_at,
      };
    });
    return NextResponse.json({ failedAlerts });
  } catch (err) {
    console.error('[api/alerts/failed] List failed:', err);
    return NextResponse.json({ error: 'Failed to list failed alerts' }, { status: 500 });
  }
}
