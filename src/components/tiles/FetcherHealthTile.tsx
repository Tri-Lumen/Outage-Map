import { useState } from 'react';
import TileChrome from './TileChrome';
import type { TileProps } from './types';
import { useFetcherHealth } from '@/hooks/useStatus';
import Sparkline from '../Sparkline';

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
  const { data, isLoading, mutate } = useFetcherHealth(30000);
  const fetchers = data?.fetchers ?? [];
  const failing = fetchers.filter((f) => f.consecutiveFailures > 0).length;
  const [resetting, setResetting] = useState<string | null>(null);

  const handleReset = async (service: string, source: string) => {
    const key = `${service}/${source}`;
    setResetting(key);
    try {
      await fetch(`/api/health/fetchers/${encodeURIComponent(service)}/${encodeURIComponent(source)}/reset`, {
        method: 'POST',
      });
      await mutate();
    } finally {
      setResetting(null);
    }
  };

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
            const resetKey = `${f.service}/${f.source}`;
            const isResetting = resetting === resetKey;
            const sparkData = f.latency24h ?? [];
            const normalizedSpark = sparkData.map((v) => Math.min(1, v / 3000));
            const errorRate = f.errorRate24h ?? null;

            return (
              <div
                key={resetKey}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: '5px 0',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: ok ? '#7CB342' : '#EF5350',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--foreground)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.service}
                    <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 4 }}>{f.source}</span>
                  </span>

                  {errorRate !== null && errorRate > 0 && (
                    <span style={{ fontSize: 9, color: '#EF5350', flexShrink: 0, background: 'rgba(239,83,80,0.12)', padding: '1px 4px', borderRadius: 4 }}>
                      {(errorRate * 100).toFixed(0)}% err
                    </span>
                  )}

                  {f.circuitState === 'open' && (
                    <span title="Circuit breaker is open — calls are paused until cooldown" style={{ fontSize: 9, color: '#EF5350', flexShrink: 0, background: 'rgba(239,83,80,0.12)', padding: '1px 4px', borderRadius: 4 }}>
                      open
                    </span>
                  )}
                  {f.circuitState === 'half-open' && (
                    <span title="Circuit breaker is probing recovery" style={{ fontSize: 9, color: '#FFD54F', flexShrink: 0, background: 'rgba(255,213,79,0.12)', padding: '1px 4px', borderRadius: 4 }}>
                      probing
                    </span>
                  )}

                  {f.consecutiveFailures > 0 ? (
                    <>
                      <span title={f.lastError ?? undefined} style={{ fontSize: 10, color: '#EF5350', flexShrink: 0 }}>
                        {f.consecutiveFailures}× fail
                      </span>
                      <button
                        onClick={() => handleReset(f.service, f.source)}
                        disabled={isResetting}
                        title="Reset circuit breaker"
                        style={{
                          fontSize: 9, color: 'var(--muted)', cursor: 'pointer',
                          background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)',
                          borderRadius: 4, padding: '1px 5px', flexShrink: 0,
                          opacity: isResetting ? 0.5 : 1,
                        }}
                      >
                        {isResetting ? '…' : 'Reset'}
                      </button>
                    </>
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

                {normalizedSpark.length >= 4 && (
                  <div style={{ paddingLeft: 14, height: 16 }}>
                    <Sparkline
                      data={normalizedSpark}
                      color={ok ? '#7CB342' : '#EF5350'}
                      height={16}
                    />
                  </div>
                )}

                {f.lastParseError && (
                  <div style={{ paddingLeft: 14, fontSize: 9, color: '#FFB74D' }} title={f.lastParseError}>
                    schema drift: {f.lastParseError.length > 60 ? `${f.lastParseError.slice(0, 60)}…` : f.lastParseError}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </TileChrome>
  );
}
