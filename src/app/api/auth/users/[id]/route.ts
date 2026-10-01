import { NextRequest, NextResponse } from 'next/server';
import { getUserById, deleteUser, updateUserRole, countAdmins } from '@/lib/db';
import { isWriteEnabled, isAuthorized } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: { id: string };
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
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

  const input = body as Partial<{ role: string }>;
  if (input.role !== 'admin' && input.role !== 'viewer') {
    return NextResponse.json({ error: 'role must be "admin" or "viewer"' }, { status: 400 });
  }

  const user = getUserById(params.id);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Never let the last admin demote themselves (or be demoted) — that would
  // lock everyone out of every admin-only action with no way back in short
  // of the CLI.
  if (user.role === 'admin' && input.role === 'viewer' && countAdmins() <= 1) {
    return NextResponse.json({ error: 'Cannot demote the last remaining admin' }, { status: 400 });
  }

  updateUserRole(params.id, input.role);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  if (!isWriteEnabled()) {
    return NextResponse.json({ error: 'Auth API is not enabled.' }, { status: 503 });
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = getUserById(params.id);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (user.role === 'admin' && countAdmins() <= 1) {
    return NextResponse.json({ error: 'Cannot delete the last remaining admin' }, { status: 400 });
  }

  const ok = deleteUser(params.id);
  if (!ok) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
