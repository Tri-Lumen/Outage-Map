'use client';

import { useState } from 'react';
import PageHeader from './ui/PageHeader';
import ImportSlideOver from './ImportSlideOver';

interface ImportedSource {
  id: string;
  type: string;
  name: string;
  url: string;
  refresh: number;
  color: string;
  addedAt: string;
}

const PRESET_SOURCES: ImportedSource[] = [
  { id: 'p1', type: 'statuspage', name: 'Atlassian Statuspage', url: 'https://status.atlassian.com',  color: '#0052CC', refresh: 60,  addedAt: '2026-05-01T10:00:00Z' },
  { id: 'p2', type: 'statuspage', name: 'OpenAI',               url: 'https://status.openai.com',     color: '#10A37F', refresh: 60,  addedAt: '2026-05-03T14:22:00Z' },
  { id: 'p3', type: 'rss',        name: "AWS What's New",       url: 'https://aws.amazon.com/new/feed/', color: '#FF9900', refresh: 300, addedAt: '2026-05-05T09:00:00Z' },
];

const KIND_COLOR: Record<string, string> = {
  statuspage: 'rgba(38,139,210,0.15)',
  rss:        'rgba(42,161,152,0.15)',
  http:       'rgba(208,135,32,0.15)',
  github:     'rgba(36,41,47,0.25)',
  aws:        'rgba(255,153,0,0.15)',
};

const KIND_TEXT: Record<string, string> = {
  statuspage: '#268bd2',
  rss:        '#2aa198',
  http:       '#D08720',
  github:     '#839496',
  aws:        '#FF9900',
};

function relTime(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

export default function SourcesView() {
  const [sources, setSources] = useState<ImportedSource[]>(PRESET_SOURCES);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState('');

  const handleAdd = (svc: { type: string; name: string; url: string; refresh: number; color: string }) => {
    setSources((prev) => [
      ...prev,
      { id: 't' + Date.now(), ...svc, addedAt: new Date().toISOString() },
    ]);
  };

  const handleRemove = (id: string) => setSources((prev) => prev.filter((s) => s.id !== id));

  const filtered = sources.filter(
    (s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.url.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Data Sources"
        title="Imported services"
        description="Manage RSS feeds, Statuspage integrations, and HTTP endpoints that power your board tiles."
        actions={
          <button className="board-btn board-btn-primary" onClick={() => setImportOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add source
          </button>
        }
      />

      {/* Search + count */}
      <div className="flex items-center gap-3">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 12px',
            borderRadius: 10,
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--muted-strong)',
            flex: 1,
            maxWidth: 380,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            style={{ flex: 1, background: 'transparent', border: 0, outline: 0, color: 'var(--foreground)', fontSize: 13, fontFamily: 'inherit' }}
            placeholder="Search sources…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span style={{ fontSize: 12, color: 'var(--muted-strong)' }}>
          {filtered.length} source{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Source list */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            border: '2px dashed var(--border-strong)',
            borderRadius: 14,
            color: 'var(--muted)',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>📡</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', marginBottom: 6 }}>No sources yet</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Import a Statuspage, RSS feed, or HTTP endpoint to get started.</div>
          <button className="board-btn board-btn-primary" onClick={() => setImportOpen(true)}>
            + Add your first source
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((src) => (
            <div
              key={src.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 16px',
                background: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                transition: 'border-color 140ms ease',
              }}
            >
              {/* Logo */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: src.color,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                {src.name.charAt(0)}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{src.name}</span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '2px 7px',
                      borderRadius: 999,
                      background: KIND_COLOR[src.type] ?? 'rgba(255,255,255,0.06)',
                      color: KIND_TEXT[src.type] ?? 'var(--muted)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                    }}
                  >
                    {src.type}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {src.url}
                </div>
              </div>

              {/* Meta */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0, fontSize: 11, color: 'var(--muted-strong)' }}>
                <span>Refresh every {src.refresh < 60 ? `${src.refresh}s` : `${src.refresh / 60}m`}</span>
                <span>Added {relTime(src.addedAt)}</span>
              </div>

              {/* Remove */}
              <button
                onClick={() => handleRemove(src.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 30,
                  height: 30,
                  background: 'transparent',
                  border: 0,
                  color: 'var(--muted-strong)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                title="Remove source"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <ImportSlideOver open={importOpen} onClose={() => setImportOpen(false)} onAdd={handleAdd} />
    </div>
  );
}
