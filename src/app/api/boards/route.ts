import { NextRequest, NextResponse } from 'next/server';
import { getBoardsByDevice, upsertBoard, deleteBoard } from '@/lib/db';

export const dynamic = 'force-dynamic';

const TOKEN_RE = /^[a-z0-9-]{8,64}$/i;

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token || !TOKEN_RE.test(token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  try {
    const rows = getBoardsByDevice(token);
    const boards = rows.map((r) => ({
      boardId: r.board_id,
      name: r.name,
      starred: r.starred === 1,
      tiles: JSON.parse(r.tiles),
      theme: r.theme,
      updatedAt: r.updated_at,
    }));
    return NextResponse.json({ boards });
  } catch (err) {
    console.error('[api/boards] GET failed:', err);
    return NextResponse.json({ error: 'Failed to fetch boards' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const input = body as Partial<{ token: unknown; boards: unknown }>;
  const token = typeof input.token === 'string' ? input.token : '';
  if (!token || !TOKEN_RE.test(token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  if (!Array.isArray(input.boards)) {
    return NextResponse.json({ error: 'boards must be an array' }, { status: 400 });
  }

  try {
    // Delete boards not in the new set
    const existing = getBoardsByDevice(token);
    const newIds = new Set((input.boards as Array<{ boardId?: unknown }>).map((b) => b.boardId));
    for (const row of existing) {
      if (!newIds.has(row.board_id)) {
        deleteBoard(token, row.board_id);
      }
    }

    for (const b of input.boards as Array<{
      boardId?: unknown; name?: unknown; starred?: unknown; tiles?: unknown; theme?: unknown;
    }>) {
      if (typeof b.boardId !== 'string' || typeof b.name !== 'string') continue;
      upsertBoard({
        deviceToken: token,
        boardId: b.boardId,
        name: b.name,
        starred: !!b.starred,
        tiles: JSON.stringify(Array.isArray(b.tiles) ? b.tiles : []),
        theme: typeof b.theme === 'string' ? b.theme : null,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/boards] PUT failed:', err);
    return NextResponse.json({ error: 'Failed to sync boards' }, { status: 500 });
  }
}
