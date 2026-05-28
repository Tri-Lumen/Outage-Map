import TileChrome from './TileChrome';
import type { TileProps } from './types';
import { useServiceStatus } from '@/hooks/useStatus';
import type { ServiceStatusResponse } from '@/lib/types';
import Sparkline from '../Sparkline';
import { historyToSparkline } from '@/lib/boardColors';
import { useHistory } from '@/hooks/useStatus';

function ZScoreBadge({ z }: { z: number }) {
  const color = z >= 4 ? '#EF5350' : z >= 3 ? '#FF8A65' : '#FFD54F';
  return (
    <span
      title={`Z-score: ${z.toFixed(2)}`}
      style={{
        fontSize: 9,
        fontWeight: 700,
        padding: '1px 5px',
        borderRadius: 8,
        background: `${color}22`,
        color,
        letterSpacing: 0.3,
        flexShrink: 0,
      }}
    >
      z={z.toFixed(1)}
    </span>
  );
}

export default function AnomalyAlertTile({
  config, editing, onResize, onRemove, onDuplicate, onRename, onConfigure,
}: TileProps) {
  const { data: statusData } = useServiceStatus();
  const { data: historyData } = useHistory(7);
  const history = historyData?.history ?? {};
  const services: ServiceStatusResponse[] = statusData?.services ?? [];

  const anomalies = services.filter((s) => s.isAnomaly);

  return (
    <TileChrome
      title="Anomaly Alerts"
      icon={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
        </svg>
      }
      badge={
        anomalies.length > 0 ? (
          <span className="count-pill" style={{ background: 'rgba(255,183,77,0.18)', color: '#FFB74D' }}>
            {anomalies.length} spike{anomalies.length !== 1 ? 's' : ''}
          </span>
        ) : (
          <span className="count-pill" style={{ background: 'rgba(124,179,66,0.18)', color: '#7CB342' }}>
            normal
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
        {anomalies.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--muted)', padding: '8px 0' }}>
            No Downdetector anomalies detected.
          </div>
        ) : (
          anomalies.map((svc) => {
            const points = history[svc.slug] ?? [];
            const sparkData = historyToSparkline(points);
            const z = svc.anomalyZScore ?? 0;
            return (
              <div
                key={svc.slug}
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
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#FFB74D', flexShrink: 0,
                    animation: 'pulse-ring 2s ease-in-out infinite',
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--foreground)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {svc.name}
                </span>
                {sparkData.length >= 2 && (
                  <div style={{ width: 40, height: 20, flexShrink: 0 }}>
                    <Sparkline data={sparkData} color="#FFB74D" height={20} />
                  </div>
                )}
                <ZScoreBadge z={z} />
              </div>
            );
          })
        )}
      </div>
    </TileChrome>
  );
}
