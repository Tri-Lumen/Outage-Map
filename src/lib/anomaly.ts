import { getHistoricalDDReports } from './db';

const MIN_POINTS = 24;
const DEFAULT_Z_THRESHOLD = parseFloat(process.env.ANOMALY_Z_THRESHOLD ?? '2.5');

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stddev(values: number[], mu: number): number {
  const variance = values.reduce((s, v) => s + (v - mu) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function computeZScore(
  slug: string,
  currentReports: number,
  threshold: number = DEFAULT_Z_THRESHOLD,
): { isAnomaly: boolean; zScore: number } {
  const history = getHistoricalDDReports(slug, 7);

  if (history.length < MIN_POINTS) {
    return { isAnomaly: false, zScore: 0 };
  }

  const mu = mean(history);
  const sigma = stddev(history, mu);

  if (sigma < 1) {
    // Nearly constant signal — avoid false positives on silent services
    return { isAnomaly: false, zScore: 0 };
  }

  const z = (currentReports - mu) / sigma;
  return { isAnomaly: z > threshold, zScore: parseFloat(z.toFixed(2)) };
}
