import { NextRequest, NextResponse } from 'next/server';
import { getBoardsByDevice, syncBoardsForDevice } from '@/lib/db';

export const dynamic = 'force-dynamic';

const TOKEN_RE = /^[a-z0-9-]{8,64}$/i;
// Generous but bounded: a power user might keep a dozen named boards with a
// few dozen tiles each; thousands of either is a bug or abuse, not a real
// layout, and would otherwise let one PUT write an unbounded amount of JSON
// per device_token with no limit beyond server memory.
const MAX_BOARDS = 50;
const MAX_TILES_PER_BOARD = 200;
const MAX_BODY_BYTES = 2 * 1024 * 1024;

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
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: `Request body exceeds ${MAX_BODY_BYTES} bytes` }, { status: 413 });
  }

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
  if (input.boards.length > MAX_BOARDS) {
    return NextResponse.json({ error: `Too many boards (max ${MAX_BOARDS})` }, { status: 413 });
  }

  const boards: Array<{ boardId: string; name: string; starred: boolean; tiles: string; theme: string | null }> = [];
  for (const b of input.boards as Array<{
    boardId?: unknown; name?: unknown; starred?: unknown; tiles?: unknown; theme?: unknown;
  }>) {
    if (typeof b.boardId !== 'string' || typeof b.name !== 'string') continue;
    const tiles = Array.isArray(b.tiles) ? b.tiles : [];
    if (tiles.length > MAX_TILES_PER_BOARD) {
      return NextResponse.json(
        { error: `Board "${b.boardId}" has too many tiles (max ${MAX_TILES_PER_BOARD})` },
        { status: 413 },
      );
    }
    boards.push({
      boardId: b.boardId,
      name: b.name,
      starred: !!b.starred,
      tiles: JSON.stringify(tiles),
      theme: typeof b.theme === 'string' ? b.theme : null,
    });
  }

  try {
    syncBoardsForDevice(token, boards);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/boards] PUT failed:', err);
    return NextResponse.json({ error: 'Failed to sync boards' }, { status: 500 });
  }
}
