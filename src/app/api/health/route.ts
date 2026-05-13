import { NextResponse } from 'next/server';

// Liveness probe target for the container HEALTHCHECK. Intentionally does NOT
// touch the database, the filesystem, or any application module — it only
// confirms that the Next.js HTTP server has bound the port and is serving
// routes. /api/status was previously used here, but it opens SQLite, runs the
// initial CREATE TABLE migrations on first boot, and queries two tables, so
// the first probe on a fresh volume can take several seconds — long enough
// for `docker compose up --wait` (which Portainer uses on redeploy) to keep
// the stack-update HTTP call open past upstream proxy timeouts and hang the
// "Saving…" spinner in the UI.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function GET() {
  return NextResponse.json({ ok: true });
}
