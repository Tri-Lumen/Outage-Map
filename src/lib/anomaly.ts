import { getHistoricalDDReports, getJsonSetting } from './db';

const ENV_Z_THRESHOLD = parseFloat(process.env.ANOMALY_Z_THRESHOLD ?? '2.5');
const DEFAULT_MIN_POINTS = 24;

export const ANOMALY_SETTINGS_KEY = 'anomaly';

export interface AnomalyConfig {
  /** z-score above which a spike is flagged as an anomaly. */
  threshold: number;
  /** minimum history points required before scoring. */
  minPoints: number;
}

/**
 * Effective anomaly-detection config: persisted overrides (set from Settings)
 * layered over env/defaults. Read server-side by the poller.
 */
export function getAnomalyConfig(): AnomalyConfig {
  const cfg = getJsonSetting<Partial<AnomalyConfig>>(ANOMALY_SETTINGS_KEY, {});
  return {
    threshold: typeof cfg.threshold === 'number' && cfg.threshold > 0 ? cfg.threshold : ENV_Z_THRESHOLD,
    minPoints: typeof cfg.minPoints === 'number' && cfg.minPoints >= 3 ? cfg.minPoints : DEFAULT_MIN_POINTS,
  };
}

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
  threshold?: number,
): { isAnomaly: boolean; zScore: number } {
  const cfg = getAnomalyConfig();
  const effectiveThreshold = threshold ?? cfg.threshold;
  const history = getHistoricalDDReports(slug, 7);

  if (history.length < cfg.minPoints) {
    return { isAnomaly: false, zScore: 0 };
  }

  const mu = mean(history);
  const sigma = stddev(history, mu);

  if (sigma < 1) {
    // Nearly constant signal — avoid false positives on silent services
    return { isAnomaly: false, zScore: 0 };
  }

  const z = (currentReports - mu) / sigma;
  return { isAnomaly: z > effectiveThreshold, zScore: parseFloat(z.toFixed(2)) };
}
