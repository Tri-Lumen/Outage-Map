import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail } from '@/lib/db';
import { verifyPassword, createSessionCookieValue, SESSION_COOKIE_NAME, SESSION_TTL_MS } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Simple in-memory rate limit: a handful of attempts per (ip, email) pair
// within a window — deters credential-stuffing without a new dependency or
// persisted state. Resets on restart; an accepted tradeoff for a lightweight,
// self-rolled defense, consistent with the rest of this app's security code.
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(request: NextRequest) {
  if (!process.env.SESSION_SECRET) {
    return NextResponse.json(
      { error: 'Login is not configured on this server. Set SESSION_SECRET.' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const input = body as Partial<{ email: string; password: string }>;
  const email = typeof input.email === 'string' ? input.email.trim() : '';
  const password = typeof input.password === 'string' ? input.password : '';

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(`${ip}:${email.toLowerCase()}`)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  // Same generic error for a bad email format, an unknown email, and a wrong
  // password — never reveal which one it was, to avoid account enumeration.
  const invalid = () => NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });

  if (!EMAIL_RE.test(email) || !password) return invalid();

  const user = getUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) return invalid();

  const role = user.role === 'admin' ? 'admin' : 'viewer';
  const cookieValue = createSessionCookieValue({ id: user.id, email: user.email, role });
  if (!cookieValue) {
    return NextResponse.json({ error: 'Login is not configured on this server.' }, { status: 503 });
  }

  const res = NextResponse.json({ ok: true, user: { email: user.email, role } });
  res.cookies.set(SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}
