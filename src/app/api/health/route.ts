import { NextRequest, NextResponse } from 'next/server';
import { health } from '@/lib/health';

// Liveness probe target for the container HEALTHCHECK. The default response
// intentionally does NOT touch the database, the filesystem, or any
// application module — it only confirms that the Next.js HTTP server has
// bound the port and is serving routes. /api/status was previously used
// here, but it opens SQLite, runs the initial CREATE TABLE migrations on
// first boot, and queries two tables, so the first probe on a fresh volume
// can take several seconds — long enough for `docker compose up --wait`
// (which Portainer uses on redeploy) to keep the stack-update HTTP call
// open past upstream proxy timeouts and hang the "Saving…" spinner in the
// UI.
//
// `?probe=ready` opts into a deeper readiness check that reports whether
// any fetcher has been failing for too long. Leave the default liveness
// behavior intact so Docker / k8s `HEALTHCHECK` lines don't need to be
// updated.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function GET(request: NextRequest) {
  const probe = request.nextUrl.searchParams.get('probe') ?? 'live';

  if (probe === 'ready') {
    const { ready, reason } = health.isReady();
    return NextResponse.json(
      { ok: ready, probe: 'ready', reason },
      { status: ready ? 200 : 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
