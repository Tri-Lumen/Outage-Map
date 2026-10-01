// Only minute values that divide 60 produce an even `*/n` cron cadence —
// anything else introduces a catch-up gap each hour. Shared by the cron
// scheduler (instrumentation.ts) and anything that needs to know the actual
// poll cadence to interpret stored data (e.g. the SLA report's downtime math).
const VALID_INTERVALS = [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30, 60];
const DEFAULT_INTERVAL_MINUTES = 3;

export function getPollIntervalMinutes(): number {
  const raw = parseInt(process.env.POLL_INTERVAL_MINUTES || String(DEFAULT_INTERVAL_MINUTES), 10);
  return VALID_INTERVALS.includes(raw) ? raw : DEFAULT_INTERVAL_MINUTES;
}
