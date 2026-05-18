import TileChrome from './TileChrome';
import type { TileProps } from './types';
import { useFetcherHealth } from '@/hooks/useStatus';

function latencyColor(ms: number | null): string {
  if (ms === null) return 'var(--muted)';
  if (ms < 500)  return '#7CB342';
  if (ms < 2000) return '#FFD54F';
  return '#EF5350';
}

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function FetcherHealthTile({
  config, editing, onResize, onRemove, onDuplicate, onRename, onConfigure,
}: TileProps) {
  const { data, isLoading } = useFetcherHealth(30000);
  const fetchers = data?.fetchers ?? [];
  const failing = fetchers.filter((f) => f.consecutiveFailures > 0).length;

  return (
    <TileChrome
      title="Fetcher Health"
      icon={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      }
      badge={
        failing > 0 ? (
          <span className="count-pill" style={{ background: 'rgba(239,83,80,0.18)', color: '#EF5350' }}>
            {failing} failing
          </span>
        ) : (
          <span className="count-pill" style={{ background: 'rgba(124,179,66,0.18)', color: '#7CB342' }}>
            all ok
          </span>
        )
      }
      label={typeof config.label === 'string' ? config.label : null}
      iconText={typeof config.icon === 'string' ? config.icon : null}
      tag={typeof config.tag === 'string' ? config.tag : null}
      editing={editing}
      onResize={onResize}
      onRemove={onRemove}
      onDuplicate={onDuplicate}
      onRename={onRename}
      onConfigure={onConfigure}
    >
      <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1, gap: 0 }}>
        {isLoading && fetchers.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Loading…</div>
        ) : fetchers.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>No fetchers tracked yet.</div>
        ) : (
          fetchers.map((f) => {
            const ok = f.consecutiveFailures === 0;
            return (
              <div
                key={`${f.service}-${f.source}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 0',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: ok ? '#7CB342' : '#EF5350',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--foreground)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.service}
                </span>
                {f.consecutiveFailures > 0 ? (
                  <span
                    title={f.lastError ?? undefined}
                    style={{ fontSize: 10, color: '#EF5350', flexShrink: 0 }}
                  >
                    {f.consecutiveFailures}× fail
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>
                    ✓ {relTime(f.lastSuccessAt)}
                  </span>
                )}
                {f.lastLatencyMs !== null && (
                  <span style={{ fontSize: 10, color: latencyColor(f.lastLatencyMs), width: 36, textAlign: 'right', flexShrink: 0 }}>
                    {f.lastLatencyMs}ms
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </TileChrome>
  );
}
