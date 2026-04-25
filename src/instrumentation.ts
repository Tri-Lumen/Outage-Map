export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const cron = await import('node-cron');
    const { runPollCycle } = await import('./lib/poller');

    const raw = parseInt(process.env.POLL_INTERVAL_MINUTES || '3', 10);
    // Only minute values that divide 60 produce an even `*/n` cron cadence
    // — anything else introduces a catch-up gap each hour (e.g. */7 fires at
    // :00,:07,…,:56 then :00, leaving a 4-minute hole). Clamp to the valid
    // divisors and fall back to 3 for out-of-range input.
    const VALID = [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30, 60];
    const intervalMinutes = VALID.includes(raw) ? raw : 3;
    if (raw !== intervalMinutes) {
      console.warn(
        `[cron] POLL_INTERVAL_MINUTES=${process.env.POLL_INTERVAL_MINUTES} is not a divisor of 60; using ${intervalMinutes} instead`,
      );
    }

    const expression = intervalMinutes === 60 ? '0 * * * *' : `*/${intervalMinutes} * * * *`;
    console.log(`[cron] Scheduling poll cycle every ${intervalMinutes} minutes (${expression})`);

    setTimeout(() => {
      console.log('[cron] Running initial poll cycle...');
      runPollCycle().catch((err) => console.error('[cron] Initial poll failed:', err));
    }, 5000);

    cron.default.schedule(expression, () => {
      if (process.env.DEBUG === 'true') {
        console.log('[cron] Scheduled poll cycle triggered');
      }
      runPollCycle().catch((err) => console.error('[cron] Scheduled poll failed:', err));
    });
  }
}
