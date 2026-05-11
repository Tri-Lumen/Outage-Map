import type { ServiceStatus } from './types';

export interface StatusColor {
  dot: string;
  text: string;
  bg: string;
  label: string;
}

export const STATUS_COLORS: Record<string, StatusColor> = {
  operational:  { dot: '#7CB342', text: '#9CCC65', bg: 'rgba(124,179,66,0.12)',  label: 'Operational'  },
  degraded:     { dot: '#F0C419', text: '#FFD54F', bg: 'rgba(240,196,25,0.12)',  label: 'Degraded'     },
  major_outage: { dot: '#D08720', text: '#FFB74D', bg: 'rgba(208,135,32,0.14)', label: 'Major Outage' },
  down:         { dot: '#DC322F', text: '#EF5350', bg: 'rgba(220,50,47,0.14)',  label: 'Down'         },
  unknown:      { dot: '#586E75', text: '#93A1A1', bg: 'rgba(88,110,117,0.18)', label: 'Unknown'      },
};

export function getStatusColor(status: ServiceStatus | string): StatusColor {
  return STATUS_COLORS[status] ?? STATUS_COLORS.unknown;
}

export function relTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

/** Convert HistoryPoint array to 0-1 uptime values for sparklines */
export function historyToSparkline(points: { status: ServiceStatus; outageMinutes: number }[]): number[] {
  return points.map((p) => {
    if (p.status === 'operational') return 1;
    if (p.status === 'degraded') return 0.75;
    if (p.status === 'major_outage') return 0.4;
    if (p.status === 'down') return 0.1;
    return 0.9;
  });
}
