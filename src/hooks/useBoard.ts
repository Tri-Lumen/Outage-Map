'use client';

import { useEffect, useState, useCallback } from 'react';

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

export interface BoardActions {
  updateTile: (id: string, patch: Partial<TileConfig>) => void;
  removeTile: (id: string) => void;
  cycleResize: (id: string) => void;
  toggleDataPoint: (id: string, key: string) => void;
  addTile: (type: TileType, extraConfig?: Record<string, unknown>) => void;
  swapTiles: (srcId: string, tgtId: string) => void;
  resetBoard: () => void;
}

export function useBoard(): [TileConfig[], BoardActions] {
  const [board, setBoard] = useState<TileConfig[]>(DEFAULT_BOARD);

  // Hydrate from localStorage after mount
  useEffect(() => {
    setBoard(readBoard());
  }, []);

  // Persist whenever board changes
  useEffect(() => {
    writeBoard(board);
  }, [board]);

  const updateTile = useCallback((id: string, patch: Partial<TileConfig>) => {
    setBoard((b) =>
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
  }, []);

  const removeTile = useCallback((id: string) => {
    setBoard((b) => b.filter((t) => t.id !== id));
  }, []);

  const cycleResize = useCallback((id: string) => {
    setBoard((b) =>
      b.map((t) => {
        if (t.id !== id) return t;
        const idx = TILE_SIZES.findIndex((s) => s.w === t.w && s.h === t.h);
        const next = TILE_SIZES[(idx + 1) % TILE_SIZES.length];
        return { ...t, w: next.w, h: next.h };
      })
    );
  }, []);

  const toggleDataPoint = useCallback((id: string, key: string) => {
    setBoard((b) =>
      b.map((t) => {
        if (t.id !== id) return t;
        const has = t.dataPoints.includes(key);
        return {
          ...t,
          dataPoints: has ? t.dataPoints.filter((k) => k !== key) : [...t.dataPoints, key],
        };
      })
    );
  }, []);

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
    setBoard((b) => [
      ...b,
      {
        id,
        type,
        x: 0,
        y: 99,
        w: size.w,
        h: size.h,
        config: { ...defaultConfigs[type], ...extraConfig },
        dataPoints: defaultDataPoints[type],
      },
    ]);
  }, []);

  const swapTiles = useCallback((srcId: string, tgtId: string) => {
    if (srcId === tgtId) return;
    setBoard((b) => {
      const src = b.find((t) => t.id === srcId);
      const tgt = b.find((t) => t.id === tgtId);
      if (!src || !tgt) return b;
      return b.map((t) => {
        if (t.id === srcId) return { ...t, x: tgt.x, y: tgt.y, w: tgt.w, h: tgt.h };
        if (t.id === tgtId) return { ...t, x: src.x, y: src.y, w: src.w, h: src.h };
        return t;
      });
    });
  }, []);

  const resetBoard = useCallback(() => {
    setBoard(DEFAULT_BOARD);
  }, []);

  const actions: BoardActions = {
    updateTile,
    removeTile,
    cycleResize,
    toggleDataPoint,
    addTile,
    swapTiles,
    resetBoard,
  };

  return [board, actions];
}
