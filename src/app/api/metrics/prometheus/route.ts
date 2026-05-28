import { NextRequest, NextResponse } from 'next/server';
import { metrics } from '@/lib/metrics';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = process.env.METRICS_TOKEN;
  if (token) {
    if (request.headers.get('authorization') !== `Bearer ${token}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }

  const body = metrics.expose();
  return new NextResponse(body, {
    headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' },
  });
}
