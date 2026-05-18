import TileChrome from './TileChrome';
import type { TileProps } from './types';
import { useRssFeed } from '@/hooks/useStatus';

const FEED_NAMES: Record<string, string> = {
  'aws-blog': "AWS What's New",
  'gh-blog': 'GitHub Engineering',
  'custom': 'Custom Feed',
};

function formatDate(pubDate: string | null): string {
  if (!pubDate) return '';
  const d = new Date(pubDate);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return 'just now';
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

export default function RssFeedTile({ config, editing, onResize, onRemove, onDuplicate, onRename, onConfigure }: TileProps) {
  const feedId = (config.feed as string) || 'aws-blog';
  const customUrl = (config.customFeedUrl as string) || '';
  const feedName = FEED_NAMES[feedId] || feedId;

  const { data, isLoading, error } = useRssFeed(feedId, customUrl);

  const displayName = data?.title || feedName;

  return (
    <TileChrome
      title={displayName}
      icon={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 11a9 9 0 019 9M4 4a16 16 0 0116 16" />
          <circle cx="5" cy="19" r="1" />
        </svg>
      }
      badge={<span className="count-pill">RSS</span>}
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 }}>
        {isLoading && (
          <div style={{ color: 'var(--muted-strong)', fontSize: 12 }}>Loading feed…</div>
        )}
        {error && !isLoading && (
          <div style={{ color: 'var(--muted-strong)', fontSize: 12 }}>Feed unavailable</div>
        )}
        {data?.items.map((item, i) => (
          <a
            key={i}
            className="rss-row"
            href={item.url || '#'}
            target={item.url ? '_blank' : undefined}
            rel="noopener noreferrer"
            onClick={!item.url ? (e) => e.preventDefault() : undefined}
          >
            <div style={{ fontSize: 12, color: 'var(--foreground)', lineHeight: 1.4 }}>{item.title}</div>
            {item.publishedAt && (
              <div style={{ fontSize: 10, color: 'var(--muted-strong)', marginTop: 2 }}>
                {formatDate(item.publishedAt)}
              </div>
            )}
          </a>
        ))}
      </div>
    </TileChrome>
  );
}
