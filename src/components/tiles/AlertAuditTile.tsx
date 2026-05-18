import TileChrome from './TileChrome';
import type { TileProps } from './types';
import { useAlertLog } from '@/hooks/useStatus';

function relTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TYPE_COLOR: Record<string, string> = {
  email:   '#268bd2',
  webhook: '#6c71c4',
  desktop: '#2aa198',
};

export default function AlertAuditTile({
  config, editing, onResize, onRemove, onDuplicate, onRename, onConfigure,
}: TileProps) {
  const { data, isLoading } = useAlertLog(true, 60000);
  const entries = data?.log ?? [];

  return (
    <TileChrome
      title="Alert History"
      icon={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
      }
      badge={<span className="count-pill">{entries.length}</span>}
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
      <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1 }}>
        {isLoading && entries.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Loading…</div>
        ) : entries.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>No alerts have been sent yet.</div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
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
                  background: TYPE_COLOR[entry.alert_type] ?? 'var(--muted)',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--foreground)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.service_slug}
              </span>
              <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>
                {entry.alert_type}
              </span>
              <span style={{ fontSize: 10, color: 'var(--muted-strong)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {relTime(entry.sent_at)}
              </span>
            </div>
          ))
        )}
      </div>
    </TileChrome>
  );
}
