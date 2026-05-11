'use client';

import { useState } from 'react';
import type { TileConfig } from '@/hooks/useBoard';
import type { LiveData } from './tiles/types';
import ServiceWatchTile from './tiles/ServiceWatchTile';
import ServiceGridTile from './tiles/ServiceGridTile';
import IncidentFeedTile from './tiles/IncidentFeedTile';
import BoardStatTile from './tiles/BoardStatTile';
import RssFeedTile from './tiles/RssFeedTile';
import UptimeChartTile from './tiles/UptimeChartTile';
import StatusMapTile from './tiles/StatusMapTile';
import StatusPageTile from './tiles/StatusPageTile';

const GRID_COLS = 6;

interface TileGridProps {
  board: TileConfig[];
  editing: boolean;
  live: LiveData;
  onUpdateTile: (id: string, patch: Partial<TileConfig>) => void;
  onRemoveTile: (id: string) => void;
  onCycleResize: (id: string) => void;
  onToggleDataPoint: (id: string, key: string) => void;
  onSwapTiles: (srcId: string, tgtId: string) => void;
  onAddClick: () => void;
}

function TileComponent({ tile, editing, live, onUpdate, onRemove, onResize, onToggleDataPoint }: {
  tile: TileConfig;
  editing: boolean;
  live: LiveData;
  onUpdate: (patch: Partial<TileConfig>) => void;
  onRemove: () => void;
  onResize: () => void;
  onToggleDataPoint: (key: string) => void;
}) {
  const common = {
    config: tile.config,
    editing,
    dataPoints: tile.dataPoints,
    toggleDataPoint: onToggleDataPoint,
    onConfigChange: (patch: Record<string, unknown>) => onUpdate({ config: patch }),
    onResize,
    onRemove,
    live,
  };

  switch (tile.type) {
    case 'service-watch':  return <ServiceWatchTile  {...common} config={tile.config as { service?: string }} />;
    case 'service-grid':   return <ServiceGridTile   {...common} />;
    case 'incident-feed':  return <IncidentFeedTile  {...common} />;
    case 'stat':           return <BoardStatTile      {...common} />;
    case 'rss':            return <RssFeedTile        {...common} />;
    case 'uptime-chart':   return <UptimeChartTile    {...common} />;
    case 'status-map':     return <StatusMapTile      {...common} />;
    case 'statuspage':     return <StatusPageTile     {...common} />;
    default:               return null;
  }
}

export default function TileGrid({
  board,
  editing,
  live,
  onUpdateTile,
  onRemoveTile,
  onCycleResize,
  onToggleDataPoint,
  onSwapTiles,
  onAddClick,
}: TileGridProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const sorted = [...board].sort((a, b) => a.y - b.y || a.x - b.x);

  return (
    <div
      className={`tile-grid ${editing ? 'tile-grid-edit' : ''}`}
      style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}
    >
      {sorted.map((tile) => (
        <div
          key={tile.id}
          className={[
            'tile',
            editing ? 'tile-edit-mode' : '',
            dragId === tile.id ? 'tile-dragging' : '',
            dragOverId === tile.id && dragId !== tile.id ? 'tile-drag-over' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{
            gridColumn: `span ${Math.min(tile.w, GRID_COLS)}`,
            gridRow: `span ${tile.h}`,
          }}
          draggable={editing}
          onDragStart={() => { setDragId(tile.id); setDragOverId(null); }}
          onDragOver={(e) => { e.preventDefault(); setDragOverId(tile.id); }}
          onDragLeave={() => setDragOverId(null)}
          onDrop={() => {
            if (dragId) onSwapTiles(dragId, tile.id);
            setDragId(null);
            setDragOverId(null);
          }}
          onDragEnd={() => { setDragId(null); setDragOverId(null); }}
        >
          {editing && (
            <div className="drag-handle" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="9" cy="6"  r="1.4" />
                <circle cx="9" cy="12" r="1.4" />
                <circle cx="9" cy="18" r="1.4" />
                <circle cx="15" cy="6"  r="1.4" />
                <circle cx="15" cy="12" r="1.4" />
                <circle cx="15" cy="18" r="1.4" />
              </svg>
            </div>
          )}
          <TileComponent
            tile={tile}
            editing={editing}
            live={live}
            onUpdate={(patch) => onUpdateTile(tile.id, patch)}
            onRemove={() => onRemoveTile(tile.id)}
            onResize={() => onCycleResize(tile.id)}
            onToggleDataPoint={(key) => onToggleDataPoint(tile.id, key)}
          />
        </div>
      ))}

      {editing && (
        <button
          className="add-tile-slot"
          style={{ gridColumn: 'span 2', gridRow: 'span 2' }}
          onClick={onAddClick}
        >
          <div style={{ fontSize: 36, fontWeight: 200, color: 'var(--muted)' }}>＋</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Add tile</div>
          <div style={{ fontSize: 11, color: 'var(--muted-strong)', marginTop: 2 }}>
            or drag from palette
          </div>
        </button>
      )}
    </div>
  );
}
