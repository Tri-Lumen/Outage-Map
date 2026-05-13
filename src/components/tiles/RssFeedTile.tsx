import TileChrome from './TileChrome';
import type { TileProps } from './types';

const FEEDS = [
  {
    id: 'aws-blog',
    name: "AWS What's New",
    items: [
      { title: 'Amazon RDS announces Multi-AZ deployments with two readable standbys', time: '2h ago' },
      { title: 'AWS Lambda now supports SnapStart for Python and .NET functions', time: '4h ago' },
      { title: 'Amazon EKS now supports Kubernetes version 1.30', time: '7h ago' },
    ],
  },
  {
    id: 'gh-blog',
    name: 'GitHub Engineering',
    items: [
      { title: 'Inside the migration to Kubernetes for GitHub.com', time: '1d ago' },
      { title: 'How we reduced p99 latency on the issues API by 60%', time: '2d ago' },
    ],
  },
];

export default function RssFeedTile({ config, editing, onResize, onRemove, onDuplicate, onRename, onConfigure }: TileProps) {
  const feedId = (config.feed as string) || 'aws-blog';
  const feed = FEEDS.find((f) => f.id === feedId) ?? FEEDS[0];

  return (
    <TileChrome
      title={feed.name}
      icon={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 11a9 9 0 019 9M4 4a16 16 0 0116 16" />
          <circle cx="5" cy="19" r="1" />
        </svg>
      }
      badge={<span className="count-pill">RSS</span>}
      label={typeof config.label === 'string' ? config.label : null}
      editing={editing}
      onResize={onResize}
      onRemove={onRemove}
      onDuplicate={onDuplicate}
      onRename={onRename}
      onConfigure={onConfigure}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 }}>
        {feed.items.map((item, i) => (
          <a key={i} className="rss-row" href="#" onClick={(e) => e.preventDefault()}>
            <div style={{ fontSize: 12, color: 'var(--foreground)', lineHeight: 1.4 }}>{item.title}</div>
            <div style={{ fontSize: 10, color: 'var(--muted-strong)', marginTop: 2 }}>{item.time}</div>
          </a>
        ))}
      </div>
    </TileChrome>
  );
}
