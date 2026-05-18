import TileChrome from './TileChrome';
import type { TileProps } from './types';

const REGION_SPECS = [
  { x: 18, y: 38, r: 14, weight: 0.25, label: 'us-west' },
  { x: 38, y: 32, r: 10, weight: 0.15, label: 'us-central' },
  { x: 72, y: 28, r: 16, weight: 0.30, label: 'us-east' },
  { x: 88, y: 48, r: 8,  weight: 0.20, label: 'eu-west' },
  { x: 50, y: 58, r: 9,  weight: 0.10, label: 'sa-east' },
];

const INCIDENT_WEIGHT = 40;
const STATUS_FLOOR: Record<string, number> = {
  operational: 0, unknown: 0, degraded: 30, major_outage: 90, down: 140,
};

function regionColor(hot: number): string {
  if (hot > 0.6) return '#EF5350';
  if (hot > 0.2) return '#FFD54F';
  return '#7CB342';
}

export default function StatusMapTile({ config, editing, onResize, onRemove, onDuplicate, onRename, onConfigure, live }: TileProps) {
  const totalSignal = live.services.reduce((sum, s) => {
    const floor = Math.max(STATUS_FLOOR[s.officialStatus] || 0, STATUS_FLOOR[s.overallStatus] || 0);
    return sum + (s.downdetectorReports || 0) + (s.incidentCount || 0) * INCIDENT_WEIGHT + floor;
  }, 0);

  const regions = REGION_SPECS.map((r) => ({
    ...r,
    hot: Math.min(1, (totalSignal * r.weight) / Math.max(1, 200)),
  }));

  return (
    <TileChrome
      title="Outage Heat Map"
      icon={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="10" r="3" />
          <path d="M12 2a8 8 0 018 8c0 6-8 12-8 12s-8-6-8-12a8 8 0 018-8z" />
        </svg>
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
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          minHeight: 140,
          borderRadius: 8,
          background: 'radial-gradient(ellipse at center, rgba(38,139,210,0.06), transparent 60%)',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          flex: 1,
        }}
      >
        <div className="map-grid" />
        <svg
          viewBox="0 0 100 80"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          {regions.map((r, i) => {
            const col = regionColor(Math.min(1, r.hot));
            return (
              <g key={i}>
                <circle cx={r.x} cy={r.y} r={r.r} fill={col} opacity={0.18} />
                <circle cx={r.x} cy={r.y} r={r.r * 0.4} fill={col} opacity={0.6} />
              </g>
            );
          })}
        </svg>
        {regions.map((r, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${r.x}%`,
              top: `${r.y}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: 9,
              color: 'var(--muted)',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
            }}
          >
            {r.label}
          </span>
        ))}
      </div>
    </TileChrome>
  );
}
