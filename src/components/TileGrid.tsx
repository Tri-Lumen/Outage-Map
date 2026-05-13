'use client';

import { useRef, useState } from 'react';
import type { TileConfig } from '@/hooks/useBoard';
import { DEFAULT_COLS } from '@/lib/board/layout';
import type { LiveData } from './tiles/types';
import ServiceWatchTile from './tiles/ServiceWatchTile';
import ServiceGridTile from './tiles/ServiceGridTile';
import IncidentFeedTile from './tiles/IncidentFeedTile';
import BoardStatTile from './tiles/BoardStatTile';
import RssFeedTile from './tiles/RssFeedTile';
import UptimeChartTile from './tiles/UptimeChartTile';
import StatusMapTile from './tiles/StatusMapTile';
import StatusPageTile from './tiles/StatusPageTile';

const GRID_COLS = DEFAULT_COLS;
const ROW_HEIGHT = 88;            // matches .tile-grid grid-auto-rows in globals.css
const ROW_HEIGHT_COMPACT = 72;    // ".compact" density override
const GAP = 16;
const GAP_COMPACT = 10;

interface TileGridProps {
  board: TileConfig[];
  editing: boolean;
  live: LiveData;
  onUpdateTile: (id: string, patch: Partial<TileConfig>) => void;
  onRemoveTile: (id: string) => void;
  onCycleResize: (id: string) => void;
  onToggleDataPoint: (id: string, key: string) => void;
  onSwapTiles: (srcId: string, tgtId: string) => void;
  onDuplicateTile: (id: string) => void;
  onRenameTile: (id: string, label: string | null) => void;
  onMoveTile: (id: string, x: number, y: number) => void;
  onResizeTile: (id: string, w: number, h: number) => void;
  onAddClick: () => void;
}

function TileComponent({ tile, editing, live, onUpdate, onRemove, onResize, onToggleDataPoint, onDuplicate, onRename }: {
  tile: TileConfig;
  editing: boolean;
  live: LiveData;
  onUpdate: (patch: Partial<TileConfig>) => void;
  onRemove: () => void;
  onResize: () => void;
  onToggleDataPoint: (key: string) => void;
  onDuplicate: () => void;
  onRename: (label: string | null) => void;
}) {
  const common = {
    config: tile.config,
    editing,
    dataPoints: tile.dataPoints,
    toggleDataPoint: onToggleDataPoint,
    onConfigChange: (patch: Record<string, unknown>) => onUpdate({ config: patch }),
    onResize,
    onRemove,
    onDuplicate,
    onRename,
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
  onDuplicateTile,
  onRenameTile,
  onMoveTile,
  onResizeTile,
  onAddClick,
}: TileGridProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [resizePreview, setResizePreview] = useState<{ id: string; w: number; h: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const dropTargetRef = useRef<{ x: number; y: number } | null>(null);
  const shiftRef = useRef(false);

  const cellSize = (): { colW: number; rowH: number; gap: number } => {
    const el = gridRef.current;
    const compact = typeof document !== 'undefined' && document.documentElement.dataset.density === 'compact';
    const rowH = compact ? ROW_HEIGHT_COMPACT : ROW_HEIGHT;
    const gap = compact ? GAP_COMPACT : GAP;
    const colW = el ? (el.getBoundingClientRect().width - gap * (GRID_COLS - 1)) / GRID_COLS : 100;
    return { colW, rowH, gap };
  };

  const startResize = (tile: TileConfig, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { colW, rowH, gap } = cellSize();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = tile.w;
    const startH = tile.h;
    setResizePreview({ id: tile.id, w: startW, h: startH });

    const move = (ev: MouseEvent) => {
      const dw = Math.round((ev.clientX - startX) / (colW + gap));
      const dh = Math.round((ev.clientY - startY) / (rowH + gap));
      const w = Math.max(1, Math.min(GRID_COLS - tile.x, startW + dw));
      const h = Math.max(1, startH + dh);
      setResizePreview({ id: tile.id, w, h });
    };
    const cancel = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        cleanup();
        setResizePreview(null);
      }
    };
    const up = () => {
      cleanup();
      setResizePreview((p) => {
        if (p && (p.w !== startW || p.h !== startH)) onResizeTile(tile.id, p.w, p.h);
        return null;
      });
    };
    const cleanup = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('keydown', cancel);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('keydown', cancel);
  };

  const pointerToCell = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const el = gridRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const { colW, rowH, gap } = cellSize();
    const x = Math.max(0, Math.min(GRID_COLS - 1, Math.floor((clientX - r.left) / (colW + gap))));
    const y = Math.max(0, Math.floor((clientY - r.top) / (rowH + gap)));
    return { x, y };
  };

  return (
    <div
      ref={gridRef}
      className={`tile-grid ${editing ? 'tile-grid-edit' : ''}`}
      style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}
      onDragOver={(e) => {
        if (!dragId) return;
        e.preventDefault();
        shiftRef.current = e.shiftKey;
        dropTargetRef.current = pointerToCell(e.clientX, e.clientY);
      }}
      onDrop={(e) => {
        if (!dragId) return;
        e.preventDefault();
        if (shiftRef.current && dragOverId) {
          onSwapTiles(dragId, dragOverId);
        } else if (dropTargetRef.current) {
          const { x, y } = dropTargetRef.current;
          onMoveTile(dragId, x, y);
        }
        setDragId(null);
        setDragOverId(null);
        dropTargetRef.current = null;
      }}
    >
      {board.map((tile) => {
        const previewSize = resizePreview && resizePreview.id === tile.id
          ? { w: resizePreview.w, h: resizePreview.h }
          : { w: tile.w, h: tile.h };
        return (
        <div
          key={tile.id}
          className={[
            'tile',
            editing ? 'tile-edit-mode' : '',
            dragId === tile.id ? 'tile-dragging' : '',
            dragOverId === tile.id && dragId !== tile.id ? 'tile-drag-over' : '',
            resizePreview?.id === tile.id ? 'tile-resizing' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{
            gridColumnStart: tile.x + 1,
            gridColumnEnd: `span ${Math.min(previewSize.w, GRID_COLS - tile.x)}`,
            gridRowStart: tile.y + 1,
            gridRowEnd: `span ${previewSize.h}`,
          }}
          draggable={editing && resizePreview?.id !== tile.id}
          onDragStart={() => { setDragId(tile.id); setDragOverId(null); }}
          onDragOver={(e) => { e.preventDefault(); setDragOverId(tile.id); }}
          onDragLeave={() => setDragOverId(null)}
          onDragEnd={() => { setDragId(null); setDragOverId(null); dropTargetRef.current = null; }}
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
          {editing && (
            <div
              className="tile-resize-handle"
              role="separator"
              aria-label="Resize tile"
              onMouseDown={(e) => startResize(tile, e)}
              onContextMenu={(e) => { e.preventDefault(); onCycleResize(tile.id); }}
              title="Drag to resize · right-click to cycle preset sizes"
            />
          )}
          <TileComponent
            tile={tile}
            editing={editing}
            live={live}
            onUpdate={(patch) => onUpdateTile(tile.id, patch)}
            onRemove={() => onRemoveTile(tile.id)}
            onResize={() => onCycleResize(tile.id)}
            onToggleDataPoint={(key) => onToggleDataPoint(tile.id, key)}
            onDuplicate={() => onDuplicateTile(tile.id)}
            onRename={(label) => onRenameTile(tile.id, label)}
          />
        </div>
        );
      })}

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
