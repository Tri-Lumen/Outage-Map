import TileChrome from './TileChrome';
import type { TileProps } from './types';

const REGIONS = [
  { x: 18, y: 38, r: 14, hot: 0.9, label: 'us-west' },
  { x: 38, y: 32, r: 10, hot: 0.3, label: 'us-central' },
  { x: 72, y: 28, r: 16, hot: 0.7, label: 'us-east' },
  { x: 88, y: 48, r: 8,  hot: 0.2, label: 'eu-west' },
  { x: 50, y: 58, r: 9,  hot: 0.4, label: 'sa-east' },
];

function regionColor(hot: number): string {
  if (hot > 0.6) return '#EF5350';
  if (hot > 0.4) return '#FFD54F';
  return '#7CB342';
}

export default function StatusMapTile({ config, editing, onResize, onRemove, onDuplicate, onRename, onConfigure, live }: TileProps) {
  // Compute a rough "heat" per region based on active incidents
  const activeIncidents = live.incidents.filter((i) => i.status !== 'resolved').length;
  const totalServices = live.services.length || 1;
  const issueServices = live.services.filter((s) => s.overallStatus !== 'operational').length;
  const baseHeat = issueServices / totalServices;

  const regions = REGIONS.map((r) => ({
    ...r,
    hot: Math.min(1, r.hot * (1 + baseHeat) * (activeIncidents > 0 ? 1.2 : 1)),
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
