'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import * as layout from '@/lib/board/layout';
import type { BoxRect } from '@/lib/board/layout';
import { COLS_FOR, type Breakpoint } from './useBreakpoint';

export type TileType =
  | 'stat'
  | 'service-watch'
  | 'service-grid'
  | 'incident-feed'
  | 'rss'
  | 'uptime-chart'
  | 'status-map'
  | 'statuspage';

export interface TileConfig {
  id: string;
  type: TileType;
  x: number;
  y: number;
  w: number;
  h: number;
  config: Record<string, unknown>;
  dataPoints: string[];
  layouts?: Partial<Record<Breakpoint, BoxRect>>;
}

const BOARD_STORAGE_KEY = 'outage-board-v3';
const HISTORY_LIMIT = 50;

export const DEFAULT_BOARD: TileConfig[] = [
  { id: 't1', type: 'stat',          x: 0, y: 0, w: 1, h: 2, config: { metric: 'uptime' },     dataPoints: [] },
  { id: 't2', type: 'stat',          x: 1, y: 0, w: 1, h: 2, config: { metric: 'incidents' },   dataPoints: [] },
  { id: 't3', type: 'stat',          x: 2, y: 0, w: 1, h: 2, config: { metric: 'mttr' },        dataPoints: [] },
  { id: 't4', type: 'stat',          x: 3, y: 0, w: 1, h: 2, config: { metric: 'dd' },          dataPoints: [] },
  { id: 't5', type: 'service-watch', x: 0, y: 1, w: 2, h: 2, config: { service: 'slack' },      dataPoints: ['sparkline', 'uptime', 'official', 'downdetector'] },
  { id: 't6', type: 'service-watch', x: 2, y: 1, w: 2, h: 2, config: { service: 'github' },     dataPoints: ['sparkline', 'uptime', 'official', 'downdetector'] },
  { id: 't7', type: 'incident-feed', x: 4, y: 0, w: 2, h: 3, config: {},                        dataPoints: [] },
  { id: 't8', type: 'service-grid',  x: 0, y: 3, w: 4, h: 2, config: {},                        dataPoints: [] },
  { id: 't9', type: 'status-map',    x: 4, y: 3, w: 2, h: 2, config: {},                        dataPoints: [] },
];

const TILE_SIZES: { w: number; h: number }[] = [
  { w: 1, h: 1 }, { w: 1, h: 2 }, { w: 2, h: 1 }, { w: 2, h: 2 }, { w: 3, h: 2 }, { w: 2, h: 3 },
];

// Persistence now lives in `useBoardSet` (storage key 'outage-boards-v4').
// useBoard is controlled by an external (tiles, onCommit) pair and no longer
// reads or writes localStorage itself. BOARD_STORAGE_KEY is retained only as
// a doc-string anchor so the historical key shows up in code search.
void BOARD_STORAGE_KEY;

interface History {
  past: TileConfig[][];
  present: TileConfig[];
  future: TileConfig[][];
}

function pushHistory(h: History, next: TileConfig[]): History {
  if (next === h.present) return h;
  const past = [...h.past, h.present];
  if (past.length > HISTORY_LIMIT) past.shift();
  return { past, present: next, future: [] };
}

function effectiveRect(t: TileConfig, bp: Breakpoint): BoxRect {
  const stored = t.layouts?.[bp];
  if (stored) return stored;
  return { x: t.x, y: t.y, w: t.w, h: t.h };
}

/** Return a synthetic TileConfig view where (x,y,w,h) reflect the breakpoint. */
function asEffective(t: TileConfig, bp: Breakpoint): TileConfig {
  if (bp === 'desktop') return t;
  const r = effectiveRect(t, bp);
  return { ...t, x: r.x, y: r.y, w: r.w, h: r.h };
}

/** Write a new rect for tile `id` at breakpoint `bp`. */
function writeRect(tile: TileConfig, bp: Breakpoint, rect: BoxRect): TileConfig {
  if (bp === 'desktop') {
    return { ...tile, x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  }
  return { ...tile, layouts: { ...tile.layouts, [bp]: rect } };
}

/**
 * Auto-generate a layout for `bp` for any tile that doesn't have one yet.
 * Mobile = single-column stack sorted by current placement; tablet =
 * clamp width to the tablet column count, then compact down.
 */
function ensureBreakpointLayouts(board: TileConfig[], bp: Breakpoint): TileConfig[] {
  if (bp === 'desktop') return board;
  if (board.every((t) => t.layouts?.[bp])) return board;
  const cols = COLS_FOR[bp];
  const sorted = [...board].sort((a, b) => a.y - b.y || a.x - b.x);
  const generated: { id: string; rect: BoxRect }[] = [];
  if (bp === 'mobile') {
    let y = 0;
    for (const t of sorted) {
      generated.push({ id: t.id, rect: { x: 0, y, w: 1, h: t.h } });
      y += t.h;
    }
  } else {
    // tablet — clamp width, then compact down.
    const widened = sorted.map((t) => ({
      ...t,
      w: Math.min(t.w, cols),
      x: Math.min(t.x, cols - 1),
    }));
    const packed = layout.tidy(widened, cols).next;
    for (const t of packed) generated.push({ id: t.id, rect: { x: t.x, y: t.y, w: t.w, h: t.h } });
  }
  const byId = new Map(generated.map((g) => [g.id, g.rect]));
  return board.map((t) =>
    t.layouts?.[bp]
      ? t
      : { ...t, layouts: { ...t.layouts, [bp]: byId.get(t.id) ?? effectiveRect(t, bp) } }
  );
}

export interface BoardActions {
  updateTile: (id: string, patch: Partial<TileConfig>) => void;
  removeTile: (id: string) => void;
  cycleResize: (id: string) => void;
  toggleDataPoint: (id: string, key: string) => void;
  addTile: (type: TileType, extraConfig?: Record<string, unknown>) => void;
  swapTiles: (srcId: string, tgtId: string) => void;
  resetBoard: () => void;
  setBoard: (next: TileConfig[]) => void;
  duplicateTile: (id: string) => void;
  renameTile: (id: string, label: string | null) => void;
  moveTile: (id: string, x: number, y: number) => void;
  resizeTile: (id: string, w: number, h: number) => void;
  bulkMove: (ids: string[], dx: number, dy: number) => void;
  bulkDelete: (ids: string[]) => void;
  bulkDuplicate: (ids: string[]) => void;
  tidy: () => void;
  lastTidyDelta: number | null;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export interface UseBoardParams {
  bp?: Breakpoint;
  boardId: string;
  tiles: TileConfig[];
  onCommit: (tiles: TileConfig[]) => void;
}

export function useBoard({ bp = 'desktop', boardId, tiles, onCommit }: UseBoardParams): [TileConfig[], BoardActions] {
  const [history, setHistory] = useState<History>(() => ({
    past: [],
    present: layout.compactDown(tiles),
    future: [],
  }));
  const [lastTidyDelta, setLastTidyDelta] = useState<number | null>(null);
  const cols = COLS_FOR[bp];

  // Track which tiles array reference came from our own commits, so we can
  // distinguish an external tiles change (active-board switch, import) from
  // the parent echoing our last commit back at us.
  const ownCommit = useRef<TileConfig[] | null>(null);
  const lastBoardId = useRef(boardId);

  // External tiles change: either the active board id changed, or the parent
  // replaced the tiles outside our knowledge (e.g. an import). Reset history
  // to the new tiles.
  useEffect(() => {
    if (boardId !== lastBoardId.current) {
      const next = layout.compactDown(tiles);
      setHistory({ past: [], present: next, future: [] });
      lastBoardId.current = boardId;
      ownCommit.current = tiles;
      return;
    }
    if (ownCommit.current === tiles) return;
    // Parent changed tiles by a hand that wasn't us — reset.
    setHistory({ past: [], present: tiles, future: [] });
    ownCommit.current = tiles;
  }, [boardId, tiles]);

  // Notify parent whenever our present changes.
  useEffect(() => {
    if (history.present === ownCommit.current) return;
    ownCommit.current = history.present;
    onCommit(history.present);
  }, [history.present, onCommit]);

  // When the breakpoint changes, auto-generate any missing per-breakpoint
  // layouts so tablet / mobile have something to render before the user
  // touches the board.
  useEffect(() => {
    setHistory((h) => {
      const generated = ensureBreakpointLayouts(h.present, bp);
      return generated === h.present ? h : { ...h, present: generated };
    });
  }, [bp]);

  const mutate = useCallback((producer: (b: TileConfig[]) => TileConfig[]) => {
    setHistory((h) => pushHistory(h, producer(h.present)));
  }, []);

  // Run a layout-module operation against the effective view, then
  // back-merge each tile's new rect into its appropriate breakpoint slot.
  const runLayoutOp = useCallback((op: (effective: TileConfig[], cols: number) => TileConfig[]) => {
    mutate((b) => {
      const effective = b.map((t) => asEffective(t, bp));
      const next = op(effective, cols);
      const byId = new Map(next.map((t) => [t.id, { x: t.x, y: t.y, w: t.w, h: t.h }]));
      return b.map((t) => {
        const rect = byId.get(t.id);
        if (!rect) return t;
        return writeRect(t, bp, rect);
      });
    });
  }, [mutate, bp, cols]);

  const updateTile = useCallback((id: string, patch: Partial<TileConfig>) => {
    mutate((b) =>
      b.map((t) =>
        t.id === id
          ? {
              ...t,
              ...patch,
              config: patch.config ? { ...t.config, ...patch.config } : t.config,
            }
          : t
      )
    );
  }, [mutate]);

  const removeTile = useCallback((id: string) => {
    mutate((b) => b.filter((t) => t.id !== id));
  }, [mutate]);

  const cycleResize = useCallback((id: string) => {
    runLayoutOp((effective) =>
      effective.map((t) => {
        if (t.id !== id) return t;
        const idx = TILE_SIZES.findIndex((s) => s.w === t.w && s.h === t.h);
        const next = TILE_SIZES[(idx + 1) % TILE_SIZES.length];
        return { ...t, w: Math.min(next.w, cols), h: next.h };
      })
    );
  }, [runLayoutOp, cols]);

  const toggleDataPoint = useCallback((id: string, key: string) => {
    mutate((b) =>
      b.map((t) => {
        if (t.id !== id) return t;
        const has = t.dataPoints.includes(key);
        return {
          ...t,
          dataPoints: has ? t.dataPoints.filter((k) => k !== key) : [...t.dataPoints, key],
        };
      })
    );
  }, [mutate]);

  const addTile = useCallback((type: TileType, extraConfig: Record<string, unknown> = {}) => {
    const defaultConfigs: Record<TileType, Record<string, unknown>> = {
      'stat':          { metric: 'uptime' },
      'service-watch': { service: 'github' },
      'service-grid':  {},
      'incident-feed': {},
      'rss':           { feed: 'aws-blog' },
      'uptime-chart':  { service: 'github' },
      'status-map':    {},
      'statuspage':    { name: 'New Service', color: '#268bd2' },
    };
    const defaultSizes: Record<TileType, { w: number; h: number }> = {
      'stat':          { w: 1, h: 2 },
      'service-watch': { w: 2, h: 2 },
      'service-grid':  { w: 4, h: 2 },
      'incident-feed': { w: 2, h: 3 },
      'rss':           { w: 2, h: 2 },
      'uptime-chart':  { w: 2, h: 2 },
      'status-map':    { w: 2, h: 2 },
      'statuspage':    { w: 2, h: 2 },
    };
    const defaultDataPoints: Record<TileType, string[]> = {
      'stat':          [],
      'service-watch': ['sparkline', 'uptime', 'official', 'downdetector'],
      'service-grid':  [],
      'incident-feed': [],
      'rss':           [],
      'uptime-chart':  [],
      'status-map':    [],
      'statuspage':    [],
    };
    const id = 't' + Date.now();
    const size = defaultSizes[type];
    mutate((b) => {
      const bottom = b.reduce((m, t) => {
        const r = effectiveRect(t, bp);
        return Math.max(m, r.y + r.h);
      }, 0);
      const w = Math.min(size.w, cols);
      const newTile: TileConfig = {
        id,
        type,
        x: 0,
        y: bottom,
        w,
        h: size.h,
        config: { ...defaultConfigs[type], ...extraConfig },
        dataPoints: defaultDataPoints[type],
      };
      // For non-desktop, also seed the breakpoint layout so the tile
      // doesn't render at its desktop coords on the active breakpoint.
      if (bp !== 'desktop') {
        newTile.layouts = { [bp]: { x: 0, y: bottom, w, h: size.h } };
      }
      return [...b, newTile];
    });
  }, [mutate, bp, cols]);

  const swapTiles = useCallback((srcId: string, tgtId: string) => {
    if (srcId === tgtId) return;
    runLayoutOp((effective) => {
      const src = effective.find((t) => t.id === srcId);
      const tgt = effective.find((t) => t.id === tgtId);
      if (!src || !tgt) return effective;
      return effective.map((t) => {
        if (t.id === srcId) return { ...t, x: tgt.x, y: tgt.y, w: tgt.w, h: tgt.h };
        if (t.id === tgtId) return { ...t, x: src.x, y: src.y, w: src.w, h: src.h };
        return t;
      });
    });
  }, [runLayoutOp]);

  const resetBoard = useCallback(() => {
    mutate(() => DEFAULT_BOARD);
  }, [mutate]);

  const setBoard = useCallback((next: TileConfig[]) => {
    mutate(() => next);
  }, [mutate]);

  const duplicateTile = useCallback((id: string) => {
    mutate((b) => {
      const src = b.find((t) => t.id === id);
      if (!src) return b;
      const bottom = b.reduce((m, t) => {
        const r = effectiveRect(t, bp);
        return Math.max(m, r.y + r.h);
      }, 0);
      const w = Math.min(src.w, cols);
      const clone: TileConfig = {
        ...src,
        id: 't' + Date.now(),
        x: 0,
        y: bottom,
        w,
        config: { ...src.config },
        dataPoints: [...src.dataPoints],
        layouts: bp !== 'desktop' ? { [bp]: { x: 0, y: bottom, w, h: src.h } } : src.layouts,
      };
      return [...b, clone];
    });
  }, [mutate, bp, cols]);

  const moveTile = useCallback((id: string, x: number, y: number) => {
    runLayoutOp((effective, c) => layout.moveTile(effective, id, x, y, c));
  }, [runLayoutOp]);

  const resizeTile = useCallback((id: string, w: number, h: number) => {
    runLayoutOp((effective, c) => layout.resizeTile(effective, id, w, h, c));
  }, [runLayoutOp]);

  const bulkMove = useCallback((ids: string[], dx: number, dy: number) => {
    if (ids.length === 0 || (dx === 0 && dy === 0)) return;
    runLayoutOp((effective, c) => {
      let next = effective;
      for (const id of ids) {
        const t = next.find((x) => x.id === id);
        if (!t) continue;
        next = layout.moveTile(next, id, t.x + dx, t.y + dy, c);
      }
      return next;
    });
  }, [runLayoutOp]);

  const bulkDelete = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    mutate((b) => b.filter((t) => !ids.includes(t.id)));
  }, [mutate]);

  const bulkDuplicate = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    mutate((b) => {
      const bottomStart = b.reduce((m, t) => {
        const r = effectiveRect(t, bp);
        return Math.max(m, r.y + r.h);
      }, 0);
      const additions: TileConfig[] = [];
      let yCursor = bottomStart;
      ids.forEach((id, i) => {
        const src = b.find((t) => t.id === id);
        if (!src) return;
        const w = Math.min(src.w, cols);
        const clone: TileConfig = {
          ...src,
          id: 't' + Date.now() + '_' + i,
          x: 0,
          y: yCursor,
          w,
          config: { ...src.config },
          dataPoints: [...src.dataPoints],
          layouts: bp !== 'desktop' ? { [bp]: { x: 0, y: yCursor, w, h: src.h } } : src.layouts,
        };
        yCursor += src.h;
        additions.push(clone);
      });
      return [...b, ...additions];
    });
  }, [mutate, bp, cols]);

  const tidy = useCallback(() => {
    setHistory((h) => {
      const effective = h.present.map((t) => asEffective(t, bp));
      const { next, rowsSaved } = layout.tidy(effective, cols);
      setLastTidyDelta(rowsSaved);
      const byId = new Map(next.map((t) => [t.id, { x: t.x, y: t.y, w: t.w, h: t.h }]));
      const newRaw = h.present.map((t) => {
        const rect = byId.get(t.id);
        return rect ? writeRect(t, bp, rect) : t;
      });
      return pushHistory(h, newRaw);
    });
  }, [bp, cols]);

  const renameTile = useCallback((id: string, label: string | null) => {
    mutate((b) =>
      b.map((t) => {
        if (t.id !== id) return t;
        const nextConfig = { ...t.config };
        if (label === null || label.trim() === '') delete nextConfig.label;
        else nextConfig.label = label;
        return { ...t, config: nextConfig };
      })
    );
  }, [mutate]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h;
      const previous = h.past[h.past.length - 1];
      return {
        past: h.past.slice(0, -1),
        present: previous,
        future: [h.present, ...h.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h;
      const [next, ...rest] = h.future;
      return {
        past: [...h.past, h.present],
        present: next,
        future: rest,
      };
    });
  }, []);

  // The effective view that consumers render. Each tile's (x,y,w,h) is
  // substituted with the active breakpoint's stored rect when present.
  const effectiveBoard = useMemo(
    () => history.present.map((t) => asEffective(t, bp)),
    [history.present, bp],
  );

  const actions: BoardActions = {
    updateTile,
    removeTile,
    cycleResize,
    toggleDataPoint,
    addTile,
    swapTiles,
    resetBoard,
    setBoard,
    duplicateTile,
    renameTile,
    moveTile,
    resizeTile,
    bulkMove,
    bulkDelete,
    bulkDuplicate,
    tidy,
    lastTidyDelta,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };

  return [effectiveBoard, actions];
}
