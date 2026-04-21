import { NextRequest, NextResponse } from 'next/server';
import { sendTestAlert } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let email = '';
  try {
    const body = await request.json();
    email = typeof body?.email === 'string' ? body.email.trim() : '';
  } catch {
    return NextResponse.json(
      { ok: false, reason: 'invalid_request' },
      { status: 400 },
    );
  }

  const result = await sendTestAlert(email);
  if (result.ok) {
    return NextResponse.json({ ok: true });
  }

  const status = result.reason === 'smtp_not_configured' ? 503 : 400;
  return NextResponse.json(result, { status });
}
