'use client';

import { useEffect, useState } from 'react';
import type { TileType, TileConfig } from '@/hooks/useBoard';
import {
  BUILTIN_TEMPLATES,
  readUserTemplates,
  saveUserTemplate,
  deleteUserTemplate,
  type Template,
} from '@/lib/board/templates';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (type: TileType) => void;
  onOpenImport: () => void;
  onApplyTemplate?: (name: string, tiles: TileConfig[]) => void;
  currentTiles?: TileConfig[];
}

const TILES: { type: TileType; name: string; desc: string }[] = [
  { type: 'stat',             name: 'Stat',             desc: 'Single metric: uptime, MTTR, incidents…' },
  { type: 'service-watch',    name: 'Service Watch',    desc: 'Single service with sparkline + datapoints' },
  { type: 'service-grid',     name: 'Service Grid',     desc: 'Status of many services at a glance' },
  { type: 'incident-feed',    name: 'Incident Feed',    desc: 'Recent + active incidents timeline' },
  { type: 'uptime-chart',     name: 'Uptime Chart',     desc: '30-day uptime history for one service' },
  { type: 'status-map',       name: 'Heat Map',         desc: 'Geographic outage report density' },
  { type: 'rss',              name: 'RSS Feed',         desc: 'Engineering blogs, release notes' },
  { type: 'incident-metrics', name: 'Incident Metrics', desc: 'MTTR by severity & resolution rate' },
  { type: 'fetcher-health',   name: 'Fetcher Health',   desc: 'Source latency & consecutive failures' },
  { type: 'alert-audit',      name: 'Alert History',    desc: 'Last 50 alert delivery events' },
];

type Tab = 'tiles' | 'templates';

export default function AddTilePopover({ open, onClose, onAdd, onOpenImport, onApplyTemplate, currentTiles }: Props) {
  const [tab, setTab] = useState<Tab>('tiles');
  const [userTemplates, setUserTemplates] = useState<Template[]>([]);
  const [saveName, setSaveName] = useState('');

  useEffect(() => {
    if (open) setUserTemplates(readUserTemplates());
  }, [open]);

  if (!open) return null;

  const applyTemplate = (tpl: Template) => {
    if (!onApplyTemplate) return;
    onApplyTemplate(tpl.name, JSON.parse(JSON.stringify(tpl.tiles)));
    onClose();
  };

  const handleSave = () => {
    if (!saveName.trim() || !currentTiles) return;
    saveUserTemplate(saveName.trim(), currentTiles);
    setUserTemplates(readUserTemplates());
    setSaveName('');
  };

  return (
    <>
      <div className="slideover-backdrop" onClick={onClose} />
      <div className="add-popover">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>Add a tile</h3>
          <button
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, background: 'transparent', border: 0, color: 'var(--muted)', borderRadius: 7, cursor: 'pointer' }}
            onClick={onClose}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="add-popover-tabs">
          <button data-on={tab === 'tiles'}     onClick={() => setTab('tiles')}>Tiles</button>
          <button data-on={tab === 'templates'} onClick={() => setTab('templates')}>Templates</button>
        </div>

        {tab === 'tiles' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {TILES.map((t) => (
                <button
                  key={t.type}
                  className="add-tile-card"
                  onClick={() => { onAdd(t.type); onClose(); }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{t.desc}</div>
                </button>
              ))}
            </div>

            <button className="import-cta" onClick={() => { onClose(); onOpenImport(); }}>
              <span style={{ fontSize: 18 }}>＋</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Import a custom service</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>Paste an RSS feed, Statuspage, or HTTP endpoint</div>
              </div>
            </button>
          </>
        )}

        {tab === 'templates' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--muted-strong)', textTransform: 'uppercase', letterSpacing: 1 }}>Built-in</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {BUILTIN_TEMPLATES.map((t) => (
                <button key={t.id} className="add-tile-card" onClick={() => applyTemplate(t)}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{t.description}</div>
                </button>
              ))}
            </div>

            {userTemplates.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: 'var(--muted-strong)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>
                  Saved
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {userTemplates.map((t) => (
                    <div key={t.id} className="add-tile-card" style={{ position: 'relative' }}>
                      <button
                        style={{ position: 'absolute', top: 4, right: 4, background: 'transparent', border: 0, color: 'var(--muted)', cursor: 'pointer', fontSize: 11 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteUserTemplate(t.id);
                          setUserTemplates(readUserTemplates());
                        }}
                        aria-label="Delete template"
                        title="Delete"
                      >✕</button>
                      <button
                        style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}
                        onClick={() => applyTemplate(t)}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{t.description}</div>
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {currentTiles && currentTiles.length > 0 && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                <input
                  type="text"
                  placeholder="Save current as template…"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="twk-field"
                  style={{ flex: 1, fontSize: 12 }}
                />
                <button
                  type="button"
                  className="board-btn board-btn-primary"
                  onClick={handleSave}
                  disabled={!saveName.trim()}
                >
                  Save
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
