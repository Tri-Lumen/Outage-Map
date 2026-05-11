'use client';

import type { TileType } from '@/hooks/useBoard';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (type: TileType) => void;
  onOpenImport: () => void;
}

const TILES: { type: TileType; name: string; desc: string }[] = [
  { type: 'stat',          name: 'Stat',          desc: 'Single metric: uptime, MTTR, incidents…' },
  { type: 'service-watch', name: 'Service Watch',  desc: 'Single service with sparkline + datapoints' },
  { type: 'service-grid',  name: 'Service Grid',   desc: 'Status of many services at a glance' },
  { type: 'incident-feed', name: 'Incident Feed',  desc: 'Recent + active incidents timeline' },
  { type: 'uptime-chart',  name: 'Uptime Chart',   desc: '30-day uptime history for one service' },
  { type: 'status-map',    name: 'Heat Map',       desc: 'Geographic outage report density' },
  { type: 'rss',           name: 'RSS Feed',       desc: 'Engineering blogs, release notes' },
];

export default function AddTilePopover({ open, onClose, onAdd, onOpenImport }: Props) {
  if (!open) return null;

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

        <button
          className="import-cta"
          onClick={() => { onClose(); onOpenImport(); }}
        >
          <span style={{ fontSize: 18 }}>＋</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Import a custom service</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>Paste an RSS feed, Statuspage, or HTTP endpoint</div>
          </div>
        </button>
      </div>
    </>
  );
}
