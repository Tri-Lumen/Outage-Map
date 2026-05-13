'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import * as layout from '@/lib/board/layout';

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
}

const BOARD_STORAGE_KEY = 'outage-board-v3';
const HISTORY_LIMIT = 50;

const DEFAULT_BOARD: TileConfig[] = [
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

function readBoard(): TileConfig[] {
  if (typeof window === 'undefined') return DEFAULT_BOARD;
  try {
    const raw = localStorage.getItem(BOARD_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as TileConfig[];
  } catch {
    // ignore
  }
  return DEFAULT_BOARD;
}

function writeBoard(board: TileConfig[]) {
  try {
    localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(board));
  } catch {
    // ignore
  }
}

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
  tidy: () => void;
  lastTidyDelta: number | null;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useBoard(): [TileConfig[], BoardActions] {
  const [history, setHistory] = useState<History>({ past: [], present: DEFAULT_BOARD, future: [] });
  const [lastTidyDelta, setLastTidyDelta] = useState<number | null>(null);
  const hydrated = useRef(false);

  // Hydrate from localStorage after mount. Compact once on load so any
  // historical overlaps (the DEFAULT_BOARD relied on grid auto-flow, and
  // older saves used y=99 as a "place at end" sentinel) collapse into
  // valid (x, y) positions before we switch to explicit grid placement.
  useEffect(() => {
    const stored = readBoard();
    setHistory({ past: [], present: layout.compactDown(stored), future: [] });
    hydrated.current = true;
  }, []);

  // Persist whenever the present board changes (after hydration)
  useEffect(() => {
    if (!hydrated.current) return;
    writeBoard(history.present);
  }, [history.present]);

  const mutate = useCallback((producer: (b: TileConfig[]) => TileConfig[]) => {
    setHistory((h) => pushHistory(h, producer(h.present)));
  }, []);

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
    mutate((b) =>
      b.map((t) => {
        if (t.id !== id) return t;
        const idx = TILE_SIZES.findIndex((s) => s.w === t.w && s.h === t.h);
        const next = TILE_SIZES[(idx + 1) % TILE_SIZES.length];
        return { ...t, w: next.w, h: next.h };
      })
    );
  }, [mutate]);

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
      const bottom = b.reduce((m, t) => Math.max(m, t.y + t.h), 0);
      return [
        ...b,
        {
          id,
          type,
          x: 0,
          y: bottom,
          w: size.w,
          h: size.h,
          config: { ...defaultConfigs[type], ...extraConfig },
          dataPoints: defaultDataPoints[type],
        },
      ];
    });
  }, [mutate]);

  const swapTiles = useCallback((srcId: string, tgtId: string) => {
    if (srcId === tgtId) return;
    mutate((b) => {
      const src = b.find((t) => t.id === srcId);
      const tgt = b.find((t) => t.id === tgtId);
      if (!src || !tgt) return b;
      return b.map((t) => {
        if (t.id === srcId) return { ...t, x: tgt.x, y: tgt.y, w: tgt.w, h: tgt.h };
        if (t.id === tgtId) return { ...t, x: src.x, y: src.y, w: src.w, h: src.h };
        return t;
      });
    });
  }, [mutate]);

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
      const bottom = b.reduce((m, t) => Math.max(m, t.y + t.h), 0);
      const clone: TileConfig = {
        ...src,
        id: 't' + Date.now(),
        x: 0,
        y: bottom,
        config: { ...src.config },
        dataPoints: [...src.dataPoints],
      };
      return [...b, clone];
    });
  }, [mutate]);

  const moveTile = useCallback((id: string, x: number, y: number) => {
    mutate((b) => layout.moveTile(b, id, x, y));
  }, [mutate]);

  const resizeTile = useCallback((id: string, w: number, h: number) => {
    mutate((b) => layout.resizeTile(b, id, w, h));
  }, [mutate]);

  const tidy = useCallback(() => {
    setHistory((h) => {
      const { next, rowsSaved } = layout.tidy(h.present);
      setLastTidyDelta(rowsSaved);
      return pushHistory(h, next);
    });
  }, []);

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
    tidy,
    lastTidyDelta,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };

  return [history.present, actions];
}
