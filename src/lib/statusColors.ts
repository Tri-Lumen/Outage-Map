import type { ServiceStatus } from './types';

/**
 * Hex codes used by the email templates and chart fills. The dashboard UI
 * uses Tailwind utility classes (see StatusBadge.tsx) so these are kept
 * separate to avoid coupling Tailwind to the email pipeline.
 */
export function statusHex(status: ServiceStatus | string): string {
  switch (status) {
    case 'operational': return '#22c55e';
    case 'degraded': return '#eab308';
    case 'major_outage': return '#f97316';
    case 'down': return '#ef4444';
    default: return '#6b7280';
  }
}

export function statusLabel(status: ServiceStatus | string): string {
  switch (status) {
    case 'operational': return 'Operational';
    case 'degraded': return 'Degraded Performance';
    case 'major_outage': return 'Major Outage';
    case 'down': return 'Service Down';
    default: return 'Unknown';
  }
}
