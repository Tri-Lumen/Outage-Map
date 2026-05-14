'use client';

import { useState } from 'react';
import useSWR from 'swr';
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

interface SourceRow {
  id: string;
  slug: string;
  name: string;
  color: string;
  statusUrl: string;
  downdetectorSlug: string | null;
  fetcher: string;
  kind: string;
  refreshSeconds: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SourcesResponse {
  sources: SourceRow[];
}

const SOURCES_API = '/api/sources';

const fetcher = async (url: string): Promise<SourcesResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

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

function rowToView(row: SourceRow): ImportedSource {
  return {
    id: row.id,
    type: row.kind,
    name: row.name,
    url: row.statusUrl,
    refresh: row.refreshSeconds,
    color: row.color,
    addedAt: row.createdAt,
  };
}

export default function SourcesView() {
  const { data, mutate } = useSWR<SourcesResponse>(SOURCES_API, fetcher, {
    revalidateOnFocus: false,
  });
  const sourceRows = data?.sources ?? [];
  const sources = sourceRows.map(rowToView);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [contributeOpen, setContributeOpen] = useState(false);
  const [contributing, setContributing] = useState(false);
  const [contributeMessage, setContributeMessage] = useState<{ ok: boolean; text: string; url?: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const openContribute = () => {
    setContributeMessage(null);
    setSelectedIds(new Set(sourceRows.filter((r) => r.enabled).map((r) => r.id)));
    setContributeOpen(true);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const submitContribute = async () => {
    setContributing(true);
    setContributeMessage(null);
    try {
      const res = await fetch(`${SOURCES_API}/contribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 503) {
        setContributeMessage({ ok: false, text: body.error || 'Catalog contribution is not configured on this deployment.' });
        return;
      }
      if (!res.ok) {
        setContributeMessage({ ok: false, text: body.error || `Request failed (HTTP ${res.status})` });
        return;
      }
      setContributeMessage({ ok: true, text: `Opened PR #${body.prNumber}`, url: body.prUrl });
    } catch (err) {
      setContributeMessage({ ok: false, text: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setContributing(false);
    }
  };

  const handleAdd = async (svc: { type: string; name: string; url: string; refresh: number; color: string }) => {
    setError(null);
    try {
      const res = await fetch(SOURCES_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(svc),
      });
      if (res.status === 503) {
        setError('Sources API is disabled on the server. Set ENABLE_RULES_API=true or configure CRON_SECRET.');
        return;
      }
      if (res.status === 401) {
        setError('Unauthorized. Set ENABLE_RULES_API=true on the server.');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Request failed (HTTP ${res.status})`);
        return;
      }
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    }
  };

  const handleRemove = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`${SOURCES_API}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 404) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Delete failed (HTTP ${res.status})`);
        return;
      }
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    }
  };

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
          <div style={{ display: 'flex', gap: 8 }}>
            {sourceRows.length > 0 && (
              <button
                className="board-btn"
                onClick={openContribute}
                title="Open a pull request adding selected sources to the shared catalog on main"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 3v12M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 9v6M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 3h3a3 3 0 0 1 3 3v3" />
                </svg>
                Contribute to catalog
              </button>
            )}
            <button className="board-btn board-btn-primary" onClick={() => setImportOpen(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add source
            </button>
          </div>
        }
      />

      {error && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            background: 'rgba(220,50,47,0.10)',
            border: '1px solid rgba(220,50,47,0.35)',
            color: '#dc322f',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

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

      {contributeOpen && (
        <>
          <div className="slideover-backdrop" onClick={() => setContributeOpen(false)} />
          <aside className="slideover" style={{ maxWidth: 520 }}>
            <div className="slideover-header">
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted-strong)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                  Contribute
                </div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--foreground)', letterSpacing: -0.2 }}>
                  Open a pull request
                </h2>
              </div>
              <button
                style={{ width: 30, height: 30, background: 'transparent', border: 0, color: 'var(--muted)', borderRadius: 8, cursor: 'pointer' }}
                onClick={() => setContributeOpen(false)}
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="slideover-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--muted-strong)', margin: 0 }}>
                Select the sources you want to add to the shared catalog. We&apos;ll
                open a pull request against <code>main</code> updating
                <code> src/lib/services.contributed.json</code>.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sourceRows.map((row) => {
                  const checked = selectedIds.has(row.id);
                  return (
                    <label
                      key={row.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 10,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelected(row.id)}
                      />
                      <div style={{ width: 12, height: 12, borderRadius: 4, background: row.color }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{row.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{row.slug}</div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted-strong)' }}>{row.kind}</div>
                    </label>
                  );
                })}
              </div>

              {contributeMessage && (
                <div
                  role={contributeMessage.ok ? 'status' : 'alert'}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: contributeMessage.ok ? 'rgba(133,153,0,0.10)' : 'rgba(220,50,47,0.10)',
                    border: `1px solid ${contributeMessage.ok ? 'rgba(133,153,0,0.35)' : 'rgba(220,50,47,0.35)'}`,
                    color: contributeMessage.ok ? '#859900' : '#dc322f',
                    fontSize: 13,
                  }}
                >
                  {contributeMessage.text}
                  {contributeMessage.ok && contributeMessage.url && (
                    <>
                      {' — '}
                      <a href={contributeMessage.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                        view PR
                      </a>
                    </>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="board-btn" onClick={() => setContributeOpen(false)}>
                  Close
                </button>
                <button
                  className="board-btn board-btn-primary"
                  disabled={contributing || selectedIds.size === 0}
                  onClick={submitContribute}
                >
                  {contributing ? 'Opening PR…' : `Open PR (${selectedIds.size})`}
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
