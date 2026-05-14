import type { TileConfig, TileType } from '@/hooks/useBoard';
import type { Tweaks } from '@/hooks/useTweaks';

export interface BoardFile {
  version: 1;
  exportedAt: string;
  board: TileConfig[];
  tweaks?: Tweaks;
}

const TILE_TYPES: TileType[] = [
  'stat', 'service-watch', 'service-grid', 'incident-feed',
  'rss', 'uptime-chart', 'status-map', 'statuspage',
];

export function serializeBoard(input: { board: TileConfig[]; tweaks?: Tweaks }): string {
  const payload: BoardFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    board: input.board,
    tweaks: input.tweaks,
  };
  return JSON.stringify(payload, null, 2);
}

function isTile(value: unknown): value is TileConfig {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.id === 'string' &&
    typeof t.type === 'string' &&
    TILE_TYPES.includes(t.type as TileType) &&
    typeof t.x === 'number' &&
    typeof t.y === 'number' &&
    typeof t.w === 'number' &&
    typeof t.h === 'number' &&
    typeof t.config === 'object' && t.config !== null &&
    Array.isArray(t.dataPoints)
  );
}

function isTweaks(value: unknown): value is Tweaks {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.accent === 'string' &&
    (t.density === 'compact' || t.density === 'comfortable') &&
    typeof t.showGridLines === 'boolean' &&
    typeof t.tileRadius === 'number'
  );
}

export function parseBoardFile(raw: string): { board: TileConfig[]; tweaks?: Tweaks } | null {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || typeof parsed !== 'object') return null;
  const p = parsed as Record<string, unknown>;
  const boardCandidate = p.board ?? parsed; // tolerate bare array too
  if (!Array.isArray(boardCandidate)) return null;
  if (!boardCandidate.every(isTile)) return null;
  const tweaks = isTweaks(p.tweaks) ? p.tweaks : undefined;
  return { board: boardCandidate, tweaks };
}
