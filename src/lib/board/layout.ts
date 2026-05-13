import type { TileConfig } from '@/hooks/useBoard';

export interface BoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const DEFAULT_COLS = 6;

export function tilesOverlap(a: BoxRect, b: BoxRect): boolean {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
}

export function findCollisions(board: TileConfig[], candidate: TileConfig): TileConfig[] {
  return board.filter((t) => t.id !== candidate.id && tilesOverlap(t, candidate));
}

export function clampToGrid<T extends BoxRect>(t: T, cols = DEFAULT_COLS): T {
  const w = Math.max(1, Math.min(cols, t.w));
  const x = Math.max(0, Math.min(cols - w, t.x));
  const y = Math.max(0, t.y);
  const h = Math.max(1, t.h);
  return { ...t, x, y, w, h };
}

/**
 * Push `target` down past any collisions in `board`, then push any tiles
 * that still overlap further down. Stable: tiles that don't collide stay
 * put. Used as the post-drop reflow.
 */
export function resolveCollisions(board: TileConfig[], targetId: string): TileConfig[] {
  const out = board.map((t) => ({ ...t }));
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 200) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const a = out[i];
      for (let j = 0; j < out.length; j++) {
        if (i === j) continue;
        const b = out[j];
        if (!tilesOverlap(a, b)) continue;
        // Move whichever tile is the "later" one down (target wins ties).
        const moveB = b.id !== targetId;
        if (moveB) {
          b.y = a.y + a.h;
        } else {
          a.y = b.y + b.h;
        }
        changed = true;
      }
    }
  }
  return out;
}

/**
 * Top-down compaction: each tile (in y-then-x order) slides up as far as
 * it can without colliding. Mirrors react-grid-layout's "vertical
 * compact" behaviour.
 */
export function compactDown(board: TileConfig[]): TileConfig[] {
  const sorted = [...board].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: TileConfig[] = [];
  for (const tile of sorted) {
    let y = 0;
    // Slide up until it collides with a placed tile.
    while (placed.some((p) => tilesOverlap(p, { ...tile, y }))) {
      y++;
    }
    placed.push({ ...tile, y });
  }
  return placed;
}

/**
 * Move tile `id` to (x, y); push any colliding tiles down so nothing
 * overlaps. Returns the new board (same length, same ids).
 */
export function moveTile(
  board: TileConfig[],
  id: string,
  x: number,
  y: number,
  cols = DEFAULT_COLS,
): TileConfig[] {
  const target = board.find((t) => t.id === id);
  if (!target) return board;
  const moved = clampToGrid({ ...target, x, y }, cols);
  const next = board.map((t) => (t.id === id ? moved : t));
  return resolveCollisions(next, id);
}

/**
 * Resize tile `id` to (w, h); push any colliding tiles down so nothing
 * overlaps.
 */
export function resizeTile(
  board: TileConfig[],
  id: string,
  w: number,
  h: number,
  cols = DEFAULT_COLS,
): TileConfig[] {
  const target = board.find((t) => t.id === id);
  if (!target) return board;
  const resized = clampToGrid({ ...target, w, h }, cols);
  const next = board.map((t) => (t.id === id ? resized : t));
  return resolveCollisions(next, id);
}

/**
 * "Tidy" the board: compact down, then left-justify each tile into the
 * first available column. Returns the new board and the number of rows
 * saved compared to the input.
 */
export function tidy(board: TileConfig[], cols = DEFAULT_COLS): { next: TileConfig[]; rowsSaved: number } {
  const beforeRows = board.reduce((m, t) => Math.max(m, t.y + t.h), 0);

  // First pass: vertical compaction.
  const compacted = compactDown(board);

  // Second pass: row-by-row left-justify.
  const sorted = [...compacted].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: TileConfig[] = [];
  for (const tile of sorted) {
    let bestX = tile.x;
    let bestY = tile.y;
    // Try each column at every row from 0 up.
    outer: for (let y = 0; y <= bestY; y++) {
      for (let x = 0; x <= cols - tile.w; x++) {
        const candidate = { ...tile, x, y };
        if (!placed.some((p) => tilesOverlap(p, candidate))) {
          bestX = x;
          bestY = y;
          break outer;
        }
      }
    }
    placed.push({ ...tile, x: bestX, y: bestY });
  }

  const afterRows = placed.reduce((m, t) => Math.max(m, t.y + t.h), 0);
  return { next: placed, rowsSaved: Math.max(0, beforeRows - afterRows) };
}
