import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { email: session.email, role: session.role } });
}
