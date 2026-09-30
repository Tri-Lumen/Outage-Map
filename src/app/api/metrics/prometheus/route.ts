// Alias of /api/metrics, kept for scrapers already pointed at this path.
// Both exposed the same Prometheus text format via separate, drifting
// implementations (this one was missing the Cache-Control header the other
// had); re-export the single implementation instead of maintaining two.
export { GET, dynamic, revalidate } from '../route';
