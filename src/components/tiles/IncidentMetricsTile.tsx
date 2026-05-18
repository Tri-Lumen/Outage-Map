import { useState } from 'react';
import TileChrome from './TileChrome';
import type { TileProps } from './types';
import { useIncidentMetrics } from '@/hooks/useStatus';

function mttrLabel(minutes: number | undefined): string {
  if (minutes === undefined) return '—';
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h ${minutes % 60}m`;
}

export default function IncidentMetricsTile({
  config, editing, onResize, onRemove, onDuplicate, onRename, onConfigure,
}: TileProps) {
  const days = typeof config.days === 'number' ? config.days : 30;
  const { data, isLoading } = useIncidentMetrics(days);

  const [rangeDays, setRangeDays] = useState(days);
  const { data: rangeData } = useIncidentMetrics(rangeDays);
  const metrics = rangeData ?? data;

  const critical = metrics?.mttrBySeverity?.critical;
  const major = metrics?.mttrBySeverity?.major;
  const minor = metrics?.mttrBySeverity?.minor;
  const resRate = metrics?.resolutionRate ?? 0;
  const maxMttr = Math.max(critical ?? 0, major ?? 0, minor ?? 0, 1);

  return (
    <TileChrome
      title="Incident Metrics"
      icon={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      }
      badge={
        <span className="count-pill">{metrics?.totalIncidents ?? 0} total</span>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setRangeDays(d)}
              style={{
                padding: '2px 8px',
                borderRadius: 999,
                fontSize: 10,
                border: 'none',
                cursor: 'pointer',
                background: rangeDays === d ? 'var(--accent)' : 'var(--surface)',
                color: rangeDays === d ? '#fff' : 'var(--muted)',
              }}
            >
              {d}d
            </button>
          ))}
        </div>

        {isLoading && !metrics ? (
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Loading…</div>
        ) : (
          <>
            <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>
              MTTR by severity
            </div>
            {[
              { label: 'Critical', value: critical, color: '#EF5350' },
              { label: 'Major',    value: major,    color: '#FF8A65' },
              { label: 'Minor',    value: minor,    color: '#FFD54F' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--muted)', width: 40, flexShrink: 0 }}>{label}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--surface)', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      borderRadius: 3,
                      background: color,
                      width: value !== undefined ? `${(value / maxMttr) * 100}%` : '0%',
                      transition: 'width 400ms ease',
                    }}
                  />
                </div>
                <span style={{ fontSize: 10, color: 'var(--muted-strong)', width: 36, textAlign: 'right', flexShrink: 0 }}>
                  {mttrLabel(value)}
                </span>
              </div>
            ))}

            <div style={{ marginTop: 4, paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>Resolution rate</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: resRate >= 90 ? '#7CB342' : resRate >= 70 ? '#FFD54F' : '#EF5350' }}>
                  {resRate.toFixed(0)}%
                </span>
              </div>
              <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: 'var(--surface)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    borderRadius: 2,
                    background: resRate >= 90 ? '#7CB342' : resRate >= 70 ? '#FFD54F' : '#EF5350',
                    width: `${resRate}%`,
                    transition: 'width 400ms ease',
                  }}
                />
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>
                {metrics?.resolvedIncidents ?? 0}/{metrics?.totalIncidents ?? 0} resolved in {rangeDays}d
              </div>
            </div>
          </>
        )}
      </div>
    </TileChrome>
  );
}
