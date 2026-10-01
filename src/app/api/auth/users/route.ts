import { NextRequest, NextResponse } from 'next/server';
import { listUsers, insertUser, getUserByEmail } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { isWriteEnabled, isAuthorized } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Admin-only: listing and creating accounts. There is no public self-signup —
// the first admin is bootstrapped via `npm run cli -- users add` (direct DB
// access), after which an admin can create further accounts from here.
export async function GET(request: NextRequest) {
  if (!isWriteEnabled()) {
    return NextResponse.json({ error: 'Auth API is not enabled.' }, { status: 503 });
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const users = listUsers().map((u) => ({ id: u.id, email: u.email, role: u.role, createdAt: u.created_at }));
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  if (!isWriteEnabled()) {
    return NextResponse.json({ error: 'Auth API is not enabled.' }, { status: 503 });
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

  const input = body as Partial<{ email: string; password: string; role: string }>;
  const email = typeof input.email === 'string' ? input.email.trim() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const role = input.role === 'admin' ? 'admin' : 'viewer';

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }
  if (getUserByEmail(email)) {
    return NextResponse.json({ error: 'A user with that email already exists' }, { status: 409 });
  }

  const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    insertUser({ id, email, passwordHash: hashPassword(password), role });
    return NextResponse.json({ user: { id, email, role } }, { status: 201 });
  } catch (err) {
    console.error('[api/auth/users] Create failed:', err);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
