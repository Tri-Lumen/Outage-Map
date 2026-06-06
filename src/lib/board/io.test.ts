import { describe, it, expect } from 'vitest';
import { serializeBoard, parseBoardFile } from './io';
import type { TileConfig, TileType } from '@/hooks/useBoard';

function tile(id: string, type: TileType): TileConfig {
  return { id, type, x: 0, y: 0, w: 2, h: 2, config: {}, dataPoints: [] };
}

describe('board io', () => {
  it('round-trips a board containing the newer tile types', () => {
    // Regression: these types were previously dropped on import.
    const board: TileConfig[] = [
      tile('1', 'stat'),
      tile('2', 'incident-metrics'),
      tile('3', 'fetcher-health'),
      tile('4', 'alert-audit'),
      tile('6', 'service-grid'),
    ];
    const parsed = parseBoardFile(serializeBoard({ board }));
    expect(parsed).not.toBeNull();
    expect(parsed!.board).toHaveLength(board.length);
    expect(parsed!.board.map((t) => t.type)).toEqual(board.map((t) => t.type));
  });

  it('strips tiles whose type is no longer known, keeping valid ones', () => {
    // A saved board containing the retired 'anomaly-alert' tile must still load,
    // with the unknown tile dropped rather than the whole board rejected.
    const raw = JSON.stringify({
      board: [
        { id: '1', type: 'stat', x: 0, y: 0, w: 2, h: 2, config: {}, dataPoints: [] },
        { id: '2', type: 'anomaly-alert', x: 0, y: 2, w: 2, h: 2, config: {}, dataPoints: [] },
      ],
    });
    const parsed = parseBoardFile(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.board.map((t) => t.type)).toEqual(['stat']);
  });

  it('tolerates a bare array of tiles', () => {
    const parsed = parseBoardFile(JSON.stringify([tile('1', 'stat')]));
    expect(parsed).not.toBeNull();
    expect(parsed!.board).toHaveLength(1);
  });

  it('returns null for malformed input', () => {
    expect(parseBoardFile('not json')).toBeNull();
    expect(parseBoardFile(JSON.stringify({ board: [{ id: 1 }] }))).toBeNull();
  });
});
