'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TileConfig } from './useBoard';

export interface BoardEntry {
  id: string;
  name: string;
  starred?: boolean;
  tiles: TileConfig[];
}

export interface BoardSet {
  active: string;
  boards: BoardEntry[];
}

const SET_KEY = 'outage-boards-v4';
const LEGACY_KEY = 'outage-board-v3';

const DEFAULT_TILES: TileConfig[] = [
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

function defaultSet(): BoardSet {
  return {
    active: 'main',
    boards: [{ id: 'main', name: 'My board', starred: true, tiles: DEFAULT_TILES }],
  };
}

function readBoardSet(): BoardSet {
  if (typeof window === 'undefined') return defaultSet();
  // Preferred: v4.
  try {
    const raw = localStorage.getItem(SET_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BoardSet;
      if (parsed && Array.isArray(parsed.boards) && parsed.boards.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  // Migrate v3 → v4 (one-shot).
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const tiles = JSON.parse(legacy) as TileConfig[];
      const set: BoardSet = {
        active: 'main',
        boards: [{ id: 'main', name: 'My board', starred: true, tiles }],
      };
      try { localStorage.setItem(SET_KEY, JSON.stringify(set)); } catch { /* ignore */ }
      try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
      return set;
    }
  } catch {
    // ignore
  }
  return defaultSet();
}

function writeBoardSet(set: BoardSet) {
  try { localStorage.setItem(SET_KEY, JSON.stringify(set)); } catch { /* ignore */ }
}

export interface UseBoardSet {
  boards: BoardEntry[];
  activeId: string;
  active: BoardEntry;
  hydrated: boolean;
  setActive: (id: string) => void;
  setActiveTiles: (tiles: TileConfig[]) => void;
  addBoard: (name: string, tiles?: TileConfig[]) => string;
  renameBoard: (id: string, name: string) => void;
  deleteBoard: (id: string) => void;
  duplicateBoard: (id: string) => void;
  starBoard: (id: string) => void;
}

export function useBoardSet(): UseBoardSet {
  const [state, setState] = useState<BoardSet>(defaultSet);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readBoardSet();
    // Honor the last-active board id from localStorage. The starred flag is a
    // marker / sort hint, not a "snap back to me on every reload" instruction
    // — previously this branch forced active = starred on every hydrate, so
    // viewing board B and reloading would dump you back on starred board A.
    // Only fall back to the starred id when the stored active no longer
    // exists (e.g. it was deleted in another tab).
    if (!stored.boards.some((b) => b.id === stored.active)) {
      const starred = stored.boards.find((b) => b.starred);
      stored.active = starred?.id ?? stored.boards[0].id;
    }
    setState(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeBoardSet(state);
  }, [state, hydrated]);

  const active = state.boards.find((b) => b.id === state.active) ?? state.boards[0];

  const setActive = useCallback((id: string) => {
    setState((s) => (s.boards.some((b) => b.id === id) ? { ...s, active: id } : s));
  }, []);

  const setActiveTiles = useCallback((tiles: TileConfig[]) => {
    setState((s) => ({
      ...s,
      boards: s.boards.map((b) => (b.id === s.active ? { ...b, tiles } : b)),
    }));
  }, []);

  const addBoard = useCallback((name: string, tiles: TileConfig[] = []): string => {
    const id = 'b' + Date.now();
    setState((s) => ({
      ...s,
      boards: [...s.boards, { id, name, tiles }],
      active: id,
    }));
    return id;
  }, []);

  const renameBoard = useCallback((id: string, name: string) => {
    setState((s) => ({
      ...s,
      boards: s.boards.map((b) => (b.id === id ? { ...b, name } : b)),
    }));
  }, []);

  const deleteBoard = useCallback((id: string) => {
    setState((s) => {
      if (s.boards.length <= 1) return s;
      const next = s.boards.filter((b) => b.id !== id);
      const active = s.active === id ? next[0].id : s.active;
      return { ...s, boards: next, active };
    });
  }, []);

  const duplicateBoard = useCallback((id: string) => {
    setState((s) => {
      const src = s.boards.find((b) => b.id === id);
      if (!src) return s;
      const newId = 'b' + Date.now();
      const clone: BoardEntry = {
        id: newId,
        name: src.name + ' copy',
        tiles: JSON.parse(JSON.stringify(src.tiles)),
      };
      return { ...s, boards: [...s.boards, clone], active: newId };
    });
  }, []);

  const starBoard = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      boards: s.boards.map((b) => ({ ...b, starred: b.id === id })),
    }));
  }, []);

  return {
    boards: state.boards,
    activeId: state.active,
    active,
    hydrated,
    setActive,
    setActiveTiles,
    addBoard,
    renameBoard,
    deleteBoard,
    duplicateBoard,
    starBoard,
  };
}
