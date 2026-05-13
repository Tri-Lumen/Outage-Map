import TileChrome from './TileChrome';
import { getStatusColor } from '@/lib/boardColors';
import type { TileProps } from './types';

interface Component {
  name: string;
  status: string;
}

const DEFAULT_COMPONENTS: Component[] = [
  { name: 'API',       status: 'operational' },
  { name: 'Dashboard', status: 'operational' },
  { name: 'Webhooks',  status: 'degraded'    },
  { name: 'Search',    status: 'operational' },
];

export default function StatusPageTile({ config, editing, onResize, onRemove, onDuplicate, onRename }: TileProps) {
  const components = (config.components as Component[]) ?? DEFAULT_COMPONENTS;
  const name = (config.name as string) || 'Imported Status Page';
  const color = (config.color as string) || '#635BFF';

  return (
    <TileChrome
      title={name}
      icon={
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            background: color,
            flexShrink: 0,
          }}
        />
      }
      badge={
        <span
          className="count-pill"
          style={{ background: 'rgba(42,161,152,0.15)', color: '#2aa198' }}
        >
          Statuspage
        </span>
      }
      label={typeof config.label === 'string' ? config.label : null}
      editing={editing}
      onResize={onResize}
      onRemove={onRemove}
      onDuplicate={onDuplicate}
      onRename={onRename}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', flex: 1 }}>
        {components.map((c, i) => {
          const sc = getStatusColor(c.status);
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: i < components.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--foreground)' }}>{c.name}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: sc.text }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: sc.dot, display: 'inline-block' }} />
                {sc.label}
              </span>
            </div>
          );
        })}
      </div>
    </TileChrome>
  );
}
