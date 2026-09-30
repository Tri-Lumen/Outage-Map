export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const cron = await import('node-cron');
    const { runPollCycle } = await import('./lib/poller');

    const { getPollIntervalMinutes } = await import('./lib/pollInterval');
    const raw = parseInt(process.env.POLL_INTERVAL_MINUTES || '3', 10);
    const intervalMinutes = getPollIntervalMinutes();
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

    // Hourly check for the scheduled status digest (no-op unless enabled).
    const { maybeSendDigest } = await import('./lib/digest');
    cron.default.schedule('0 * * * *', () => {
      maybeSendDigest().catch((err) => console.error('[cron] Digest check failed:', err));
    });
  }
}
