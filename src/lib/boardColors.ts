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

// Okabe–Ito–inspired palette that stays distinguishable under the common forms
// of color-vision deficiency (operational reads blue rather than green, which
// is otherwise confusable with the red "down" state for deuteranopes).
export const STATUS_COLORS_COLORBLIND: Record<string, StatusColor> = {
  operational:  { dot: '#0072B2', text: '#5AA8DD', bg: 'rgba(0,114,178,0.16)',  label: 'Operational'  },
  degraded:     { dot: '#E69F00', text: '#F0B43C', bg: 'rgba(230,159,0,0.16)',  label: 'Degraded'     },
  major_outage: { dot: '#D55E00', text: '#F0823C', bg: 'rgba(213,94,0,0.18)',   label: 'Major Outage' },
  down:         { dot: '#D7263D', text: '#F2566A', bg: 'rgba(215,38,61,0.18)',  label: 'Down'         },
  unknown:      { dot: '#586E75', text: '#93A1A1', bg: 'rgba(88,110,117,0.18)', label: 'Unknown'      },
};

// Status colors are consumed both in inline styles and in places that cannot
// resolve CSS variables (a <canvas> in the dependency graph, SVG stroke
// attributes in sparklines), so the palette must stay as real hex values and
// switch in JS. A tiny external store lets components re-render when the mode
// changes without threading a prop through every call site.
let activeColorBlind = false;
let paletteVersion = 0;
const paletteListeners = new Set<() => void>();

export function setStatusColorBlind(v: boolean): void {
  if (v === activeColorBlind) return;
  activeColorBlind = v;
  paletteVersion += 1;
  paletteListeners.forEach((l) => l());
}

export function isStatusColorBlind(): boolean {
  return activeColorBlind;
}

export function getStatusPaletteVersion(): number {
  return paletteVersion;
}

export function subscribeStatusPalette(cb: () => void): () => void {
  paletteListeners.add(cb);
  return () => { paletteListeners.delete(cb); };
}

export function getStatusColor(status: ServiceStatus | string): StatusColor {
  const palette = activeColorBlind ? STATUS_COLORS_COLORBLIND : STATUS_COLORS;
  return palette[status] ?? palette.unknown;
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
