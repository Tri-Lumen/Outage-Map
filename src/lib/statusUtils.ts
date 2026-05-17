import { ServiceStatus } from './types';

export function deriveOverallStatus(
  official: ServiceStatus,
  downdetector: ServiceStatus,
  officialIncidentCount: number,
): ServiceStatus {
  if (official === 'down' || official === 'major_outage') return official;
  if ((downdetector === 'down' || downdetector === 'major_outage') && officialIncidentCount > 0) {
    return 'major_outage';
  }
  if (official === 'degraded' || downdetector === 'degraded') return 'degraded';
  if (official === 'operational') return 'operational';
  if (official === 'unknown' && downdetector !== 'unknown') return downdetector;
  return official;
}
