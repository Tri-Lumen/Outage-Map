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

/** Curated fallback list when the runtime can't enumerate all IANA zones. */
export const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
];

/** All IANA time zones the runtime knows about, or a curated subset. */
export function listTimeZones(): string[] {
  try {
    const intlAny = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
    if (typeof intlAny.supportedValuesOf === 'function') {
      return intlAny.supportedValuesOf('timeZone');
    }
  } catch {
    /* ignore */
  }
  return COMMON_TIMEZONES;
}

/**
 * Format an absolute timestamp in a specific IANA time zone. Pass an empty /
 * undefined `tz` to use the browser's local zone. Centralizes timestamp
 * rendering so a user time-zone preference can be honored consistently.
 */
export function formatInTimeZone(
  ts: string | null | undefined,
  tz?: string,
  opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
  fallback = 'N/A',
): string {
  if (!ts) return fallback;
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return fallback;
  try {
    return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: tz || undefined }).format(date);
  } catch {
    return date.toLocaleString();
  }
}
