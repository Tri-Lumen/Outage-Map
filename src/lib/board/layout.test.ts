import { describe, it, expect } from 'vitest';
import {
  tilesOverlap,
  clampToGrid,
  compactDown,
  moveTile,
  resizeTile,
  tidy,
  DEFAULT_COLS,
} from './layout';
import type { TileConfig } from '@/hooks/useBoard';

function tile(id: string, x: number, y: number, w: number, h: number): TileConfig {
  return { id, type: 'stat', x, y, w, h, config: {}, dataPoints: [] };
}

function anyOverlap(board: TileConfig[]): boolean {
  for (let i = 0; i < board.length; i += 1) {
    for (let j = i + 1; j < board.length; j += 1) {
      if (tilesOverlap(board[i], board[j])) return true;
    }
  }
  return false;
}

describe('tilesOverlap', () => {
  it('detects overlapping rects', () => {
    expect(tilesOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 1, y: 1, w: 2, h: 2 })).toBe(true);
  });
  it('treats edge-adjacent rects as non-overlapping', () => {
    expect(tilesOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 2, h: 2 })).toBe(false);
    expect(tilesOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 0, y: 2, w: 2, h: 2 })).toBe(false);
  });
});

describe('clampToGrid', () => {
  it('clamps width to the column count and keeps the tile in bounds', () => {
    const c = clampToGrid({ x: 5, y: 0, w: 4, h: 2 }, DEFAULT_COLS);
    expect(c.w).toBeLessThanOrEqual(DEFAULT_COLS);
    expect(c.x + c.w).toBeLessThanOrEqual(DEFAULT_COLS);
    expect(c.x).toBeGreaterThanOrEqual(0);
  });
  it('never produces negative coordinates', () => {
    const c = clampToGrid({ x: -3, y: -2, w: 2, h: 2 }, DEFAULT_COLS);
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.y).toBeGreaterThanOrEqual(0);
  });
});

describe('compactDown', () => {
  it('slides tiles up to remove vertical gaps without overlapping', () => {
    const board = [tile('a', 0, 0, 2, 2), tile('b', 0, 5, 2, 2)];
    const out = compactDown(board);
    const b = out.find((t) => t.id === 'b')!;
    expect(b.y).toBe(2);
    expect(anyOverlap(out)).toBe(false);
  });
});

describe('moveTile / resizeTile', () => {
  it('resolves collisions after a move', () => {
    const board = [tile('a', 0, 0, 2, 2), tile('b', 2, 0, 2, 2)];
    const out = moveTile(board, 'b', 0, 0); // move b onto a
    expect(anyOverlap(out)).toBe(false);
    // the moved tile keeps its requested position
    expect(out.find((t) => t.id === 'b')!.x).toBe(0);
  });
  it('clamps and resolves collisions after a resize', () => {
    const board = [tile('a', 0, 0, 2, 2), tile('b', 0, 2, 2, 2)];
    const out = resizeTile(board, 'a', 6, 4);
    expect(anyOverlap(out)).toBe(false);
    expect(out.find((t) => t.id === 'a')!.w).toBeLessThanOrEqual(DEFAULT_COLS);
  });
});

describe('tidy', () => {
  it('returns a non-overlapping board and a non-negative rowsSaved', () => {
    const board = [tile('a', 0, 0, 2, 2), tile('b', 0, 4, 2, 2), tile('c', 2, 6, 2, 2)];
    const { next, rowsSaved } = tidy(board);
    expect(anyOverlap(next)).toBe(false);
    expect(rowsSaved).toBeGreaterThanOrEqual(0);
    expect(next).toHaveLength(board.length);
  });
});
