import { NextRequest } from 'next/server';
import { metrics } from '@/lib/metrics';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Prometheus-compatible exposition endpoint. Optional bearer-token gate via
// METRICS_TOKEN — when unset the endpoint is unauthenticated, which matches
// the convention for Prometheus scrapes on a trusted network. Set the token
// if Outage-Map is exposed to the public internet.
export function GET(request: NextRequest) {
  const token = process.env.METRICS_TOKEN;
  if (token) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${token}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  return new Response(metrics.expose(), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
