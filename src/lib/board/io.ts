import type { TileConfig, TileType } from '@/hooks/useBoard';
import type { Tweaks } from '@/hooks/useTweaks';

export interface BoardFile {
  version: 1;
  exportedAt: string;
  board: TileConfig[];
  tweaks?: Tweaks;
}

// Keyed by TileType so the compiler forces this to stay in sync with the
// union in useBoard.ts — adding a tile type without listing it here is a build
// error. Previously this list omitted several types, which silently dropped
// those tiles on import.
const TILE_TYPE_SET: Record<TileType, true> = {
  'stat': true,
  'service-watch': true,
  'service-grid': true,
  'incident-feed': true,
  'rss': true,
  'uptime-chart': true,
  'status-map': true,
  'statuspage': true,
  'incident-metrics': true,
  'fetcher-health': true,
  'alert-audit': true,
};
const TILE_TYPES = Object.keys(TILE_TYPE_SET) as TileType[];

export function serializeBoard(input: { board: TileConfig[]; tweaks?: Tweaks }): string {
  const payload: BoardFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    board: input.board,
    tweaks: input.tweaks,
  };
  return JSON.stringify(payload, null, 2);
}

// Structural check only — does NOT validate the tile `type` against the known
// set. That lets us tell a malformed entry (reject the whole import) apart from
// a structurally-valid tile whose type was retired (drop just that tile).
function isStructurallyTile(value: unknown): value is TileConfig {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.id === 'string' &&
    typeof t.type === 'string' &&
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
  // Reject structurally malformed input, but silently strip tiles whose `type`
  // is no longer known (e.g. the removed 'anomaly-alert') so an otherwise-valid
  // saved board still loads instead of being discarded wholesale.
  if (!boardCandidate.every(isStructurallyTile)) return null;
  const board = boardCandidate.filter((t) => TILE_TYPES.includes(t.type as TileType));
  const tweaks = isTweaks(p.tweaks) ? p.tweaks : undefined;
  return { board, tweaks };
}
