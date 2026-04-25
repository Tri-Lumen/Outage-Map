/**
 * Convert a timestamp to a short relative string ("12m ago", "3h ago", or
 * a fallback locale date). Used everywhere we render a "last checked" /
 * "started at" hint without seconds-level precision.
 */
export function formatRelativeTime(
  ts: string | null | undefined,
  fallback: string = 'never',
): string {
  if (!ts) return fallback;
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return fallback;
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return date.toLocaleDateString();
}
