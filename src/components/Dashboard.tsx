'use client';

import { useEffect, useMemo, useState } from 'react';
import { useServiceStatus, useIncidents, useHistory } from '@/hooks/useStatus';
import { usePreferences } from '@/hooks/usePreferences';
import { useBoard } from '@/hooks/useBoard';
import { useBoardSet } from '@/hooks/useBoardSet';
import { useBreakpoint, COLS_FOR } from '@/hooks/useBreakpoint';
import { useTweaks } from '@/hooks/useTweaks';
import { useShortcuts } from '@/hooks/useShortcuts';
import { usePresentMode, enterPresent, exitPresent } from '@/hooks/usePresentMode';
import { useTheme } from './ThemeProvider';
import { formatRelativeTime } from '@/lib/format';
import type { LiveData } from './tiles/types';
import type { TileType } from '@/hooks/useBoard';
import TileGrid from './TileGrid';
import BoardTabs from './BoardTabs';
import ImportSlideOver from './ImportSlideOver';
import AddTilePopover from './AddTilePopover';
import TweaksPanel from './TweaksPanel';
import ShortcutsOverlay from './ShortcutsOverlay';
import PresentControls from './PresentControls';
import TileConfigDrawer from './TileConfigDrawer';

export default function Dashboard() {
  const { theme, setTheme } = useTheme();
  const [tweaks, tweaksApi] = useTweaks();
  const { setTweak, setTweaks } = tweaksApi;
  const breakpoint         = useBreakpoint();
  const boardSet           = useBoardSet();
  const [board, actions]   = useBoard({
    bp: breakpoint,
    boardId: boardSet.activeId,
    tiles: boardSet.active.tiles,
    onCommit: boardSet.setActiveTiles,
  });
  const prefs              = usePreferences();
  const present            = usePresentMode();

  const [editing, setEditing]             = useState(false);
  const [importOpen, setImportOpen]       = useState(false);
  const [addOpen, setAddOpen]             = useState(false);
  const [tweaksOpen, setTweaksOpen]       = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [configTileId, setConfigTileId]   = useState<string | null>(null);
  const configTile = configTileId ? board.find((t) => t.id === configTileId) ?? null : null;

  // Force-disable edit + overlays in present mode.
  useEffect(() => {
    if (!present.present) return;
    setEditing(false);
    setImportOpen(false);
    setAddOpen(false);
    setTweaksOpen(false);
    setShortcutsOpen(false);
  }, [present.present]);

  // Auto-rotate active board in present mode.
  useEffect(() => {
    if (!present.present || !present.rotateMs || boardSet.boards.length <= 1) return;
    const id = setInterval(() => {
      const i = boardSet.boards.findIndex((b) => b.id === boardSet.activeId);
      const next = boardSet.boards[(i + 1) % boardSet.boards.length];
      if (next) boardSet.setActive(next.id);
    }, present.rotateMs);
    return () => clearInterval(id);
  }, [present.present, present.rotateMs, boardSet]);

  // Fullscreen shortcut (F) in present mode.
  useShortcuts(
    {
      'f': () => {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => { /* ignore */ });
        else document.documentElement.requestFullscreen().catch(() => { /* ignore */ });
      },
    },
    { enabled: present.present },
  );

  const closeAllOverlays = () => {
    setImportOpen(false);
    setAddOpen(false);
    setTweaksOpen(false);
    setShortcutsOpen(false);
    setConfigTileId(null);
    if (present.present) exitPresent();
  };

  useShortcuts({
    'e':                 () => setEditing((v) => !v),
    'a':                 () => setAddOpen((v) => !v),
    'i':                 () => setImportOpen((v) => !v),
    't':                 () => setTweaksOpen((v) => !v),
    '?':                 () => setShortcutsOpen((v) => !v),
    'shift+?':           () => setShortcutsOpen((v) => !v),
    'shift+/':           () => setShortcutsOpen((v) => !v),
    'Escape':            closeAllOverlays,
    'mod+z':             () => actions.undo(),
    'mod+shift+z':       () => actions.redo(),
    'mod+y':             () => actions.redo(),
  });

  const refreshMs = prefs.refreshInterval * 1000;
  const { data: statusData, isLoading } = useServiceStatus(refreshMs);
  const { data: incidentData }          = useIncidents(7);
  const { data: historyData }           = useHistory(30);

  const live: LiveData = useMemo(() => ({
    services:    statusData?.services    ?? [],
    incidents:   incidentData?.incidents ?? [],
    history:     historyData?.history    ?? {},
    isLoading,
    lastUpdated: statusData?.lastUpdated,
  }), [statusData, incidentData, historyData, isLoading]);

  const stats = useMemo(() => {
    const total       = live.services.length;
    const operational = live.services.filter((s) => s.overallStatus === 'operational').length;
    const active      = live.incidents.filter((i) => i.status !== 'resolved').length;
    return { total, operational, active };
  }, [live]);

  const handleAddImported = (svc: { type: string; name: string; url: string; refresh: number; color: string }) => {
    actions.addTile('statuspage', {
      name:  svc.name,
      color: svc.color,
      url:   svc.url,
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Board tabs (hidden in present mode) ── */}
      {!present.present && <BoardTabs boardSet={boardSet} />}

      {/* ── Board toolbar (hidden in present mode) ── */}
      {!present.present && (
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Left: headline */}
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 11, color: 'var(--muted-strong)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600 }}>
            Live overview
          </div>
          <h1 style={{ margin: '4px 0 4px', fontSize: 24, fontWeight: 700, color: 'var(--foreground)', letterSpacing: -0.4 }}>
            My outage board
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
            {stats.operational}/{stats.total} services healthy
            {' · '}
            {stats.active} active incident{stats.active !== 1 ? 's' : ''}
            {statusData?.lastUpdated
              ? ` · Updated ${formatRelativeTime(statusData.lastUpdated)}`
              : ''}
          </p>
        </div>

        {/* Right: actions + live pill */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="live-pill">
            <span className="live-dot" />
            <span>Auto-refresh · {prefs.refreshInterval < 60 ? `${prefs.refreshInterval}s` : `${prefs.refreshInterval / 60}m`}</span>
          </div>

          <button
            className="board-btn board-btn-icon"
            onClick={actions.undo}
            disabled={!actions.canUndo}
            aria-disabled={!actions.canUndo}
            title="Undo (Ctrl/Cmd+Z)"
            aria-label="Undo"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7v6h6" />
              <path d="M3 13a9 9 0 1 0 3-7.7L3 8" />
            </svg>
          </button>

          <button
            className="board-btn board-btn-icon"
            onClick={actions.redo}
            disabled={!actions.canRedo}
            aria-disabled={!actions.canRedo}
            title="Redo (Ctrl/Cmd+Shift+Z)"
            aria-label="Redo"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 7v6h-6" />
              <path d="M21 13a9 9 0 1 1-3-7.7L21 8" />
            </svg>
          </button>

          <button
            className={`board-btn ${editing ? 'board-btn-edit-on' : ''}`}
            onClick={() => setEditing((e) => !e)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            {editing ? 'Done editing' : 'Edit board'}
          </button>

          {editing && (
            <button
              className="board-btn"
              onClick={actions.tidy}
              title={
                actions.lastTidyDelta === null
                  ? 'Auto-arrange tiles'
                  : actions.lastTidyDelta === 0
                  ? 'Already tidy'
                  : `Saved ${actions.lastTidyDelta} row${actions.lastTidyDelta === 1 ? '' : 's'}`
              }
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
              </svg>
              Tidy
            </button>
          )}

          <button className="board-btn" onClick={() => setAddOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add tile
          </button>

          <button className="board-btn board-btn-primary" onClick={() => setImportOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Import
          </button>

          <button
            className="board-btn board-btn-icon"
            onClick={() => setShortcutsOpen((o) => !o)}
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>

          <button
            className="board-btn"
            onClick={() => setTweaksOpen((o) => !o)}
            style={tweaksOpen ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
            title="Tweaks (T)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5M4.5 12h9.75M4.5 12a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M14.25 12h5.25M4.5 18h9.75M4.5 18a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M14.25 18h5.25" />
            </svg>
            Tweaks
          </button>

          <button className="board-btn" onClick={enterPresent} title="Presentation mode">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            Present
          </button>
        </div>
      </div>
      )}

      {/* ── Tile grid ── */}
      {isLoading && board.length === 0 ? (
        <div
          className="tile-grid"
          style={{ gridTemplateColumns: `repeat(${COLS_FOR[breakpoint]},1fr)` }}
        >
          {[
            { col: 1, row: 2 }, { col: 1, row: 2 }, { col: 1, row: 2 }, { col: 1, row: 2 },
            { col: 2, row: 2 }, { col: 2, row: 2 },
            { col: 2, row: 3 },
            { col: 4, row: 2 },
            { col: 2, row: 2 },
          ].map((s, i) => (
            <div
              key={i}
              className="tile animate-pulse"
              style={{ gridColumn: `span ${s.col}`, gridRow: `span ${s.row}` }}
            />
          ))}
        </div>
      ) : (
        <TileGrid
          board={board}
          cols={COLS_FOR[breakpoint]}
          editing={editing}
          live={live}
          onUpdateTile={actions.updateTile}
          onRemoveTile={actions.removeTile}
          onCycleResize={actions.cycleResize}
          onToggleDataPoint={actions.toggleDataPoint}
          onSwapTiles={actions.swapTiles}
          onDuplicateTile={actions.duplicateTile}
          onRenameTile={actions.renameTile}
          onMoveTile={actions.moveTile}
          onResizeTile={actions.resizeTile}
          onConfigureTile={(id) => setConfigTileId(id)}
          onAddClick={() => setAddOpen(true)}
        />
      )}

      {/* ── Overlays ── */}
      <ImportSlideOver
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onAdd={handleAddImported}
      />

      <AddTilePopover
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={(type: TileType) => actions.addTile(type)}
        onOpenImport={() => { setAddOpen(false); setImportOpen(true); }}
        onApplyTemplate={(name, tiles) => boardSet.addBoard(name, tiles)}
        currentTiles={board}
      />

      <ShortcutsOverlay
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      <TweaksPanel
        open={tweaksOpen}
        onClose={() => setTweaksOpen(false)}
        tweaks={tweaks}
        setTweak={setTweak}
        setTweaks={setTweaks}
        board={board}
        setBoard={actions.setBoard}
        theme={theme}
        setTheme={setTheme}
      />

      <TileConfigDrawer
        tile={configTile}
        live={live}
        onClose={() => setConfigTileId(null)}
        onUpdate={actions.updateTile}
        onRemove={actions.removeTile}
        onDuplicate={actions.duplicateTile}
      />

      {present.present && <PresentControls />}
    </div>
  );
}
