import TileChrome from './TileChrome';
import { getStatusColor } from '@/lib/boardColors';
import type { TileProps } from './types';

export default function ServiceGridTile({ config, editing, onResize, onRemove, onDuplicate, onRename, live }: TileProps) {
  const filterSlugs = config.services as string[] | undefined;
  const shown = filterSlugs?.length
    ? live.services.filter((s) => filterSlugs.includes(s.slug))
    : live.services;

  return (
    <TileChrome
      title="Service Grid"
      icon={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      }
      badge={
        <span className="count-pill">{shown.length}</span>
      }
      label={typeof config.label === 'string' ? config.label : null}
      editing={editing}
      onResize={onResize}
      onRemove={onRemove}
      onDuplicate={onDuplicate}
      onRename={onRename}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, overflowY: 'auto', flex: 1 }}>
        {shown.map((s) => {
          const c = getStatusColor(s.overallStatus);
          return (
            <div key={s.slug} className="mini-service">
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: s.color,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 9,
                  flexShrink: 0,
                }}
              >
                {s.name.substring(0, 2).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: c.dot, display: 'inline-block' }} />
                  <span style={{ fontSize: 10, color: c.text }}>{c.label}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </TileChrome>
  );
}
