export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const cron = await import('node-cron');
    const { runPollCycle } = await import('./lib/poller');

    const intervalMinutes = parseInt(process.env.POLL_INTERVAL_MINUTES || '3', 10);

    console.log(`[cron] Scheduling poll cycle every ${intervalMinutes} minutes`);

    // Run initial poll after 5 seconds to let the app fully start
    setTimeout(() => {
      console.log('[cron] Running initial poll cycle...');
      runPollCycle().catch((err) => console.error('[cron] Initial poll failed:', err));
    }, 5000);

    // Schedule recurring polls
    cron.default.schedule(`*/${intervalMinutes} * * * *`, () => {
      console.log('[cron] Scheduled poll cycle triggered');
      runPollCycle().catch((err) => console.error('[cron] Scheduled poll failed:', err));
    });
  }
}
