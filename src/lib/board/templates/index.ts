import type { TileConfig } from '@/hooks/useBoard';
import { DEFAULT_BOARD } from '@/hooks/useBoard';

export interface Template {
  id: string;
  name: string;
  description: string;
  tiles: TileConfig[];
}

const WATCH_POINTS = ['sparkline', 'uptime', 'official', 'downdetector'];

const M365_TILES: TileConfig[] = [
  { id: 'tpl-m365-1', type: 'stat',          x: 0, y: 0, w: 2, h: 2, config: { metric: 'uptime' },               dataPoints: [] },
  { id: 'tpl-m365-2', type: 'stat',          x: 2, y: 0, w: 2, h: 2, config: { metric: 'incidents' },            dataPoints: [] },
  { id: 'tpl-m365-3', type: 'incident-feed', x: 4, y: 0, w: 2, h: 4, config: {},                                 dataPoints: [] },
  { id: 'tpl-m365-4', type: 'service-watch', x: 0, y: 2, w: 2, h: 2, config: { service: 'microsoft-365' },       dataPoints: WATCH_POINTS },
  { id: 'tpl-m365-5', type: 'service-watch', x: 2, y: 2, w: 2, h: 2, config: { service: 'google-workspace' },    dataPoints: WATCH_POINTS },
  { id: 'tpl-m365-6', type: 'uptime-chart',  x: 0, y: 4, w: 3, h: 2, config: { service: 'microsoft-365' },       dataPoints: [] },
  { id: 'tpl-m365-7', type: 'uptime-chart',  x: 3, y: 4, w: 3, h: 2, config: { service: 'google-workspace' },    dataPoints: [] },
];

const IDENTITY_TILES: TileConfig[] = [
  { id: 'tpl-id-1', type: 'service-watch', x: 0, y: 0, w: 3, h: 3, config: { service: 'okta' },          dataPoints: WATCH_POINTS },
  { id: 'tpl-id-2', type: 'service-watch', x: 3, y: 0, w: 3, h: 3, config: { service: 'microsoft-365' }, dataPoints: WATCH_POINTS },
  { id: 'tpl-id-3', type: 'incident-feed', x: 0, y: 3, w: 4, h: 3, config: {},                           dataPoints: [] },
  { id: 'tpl-id-4', type: 'stat',          x: 4, y: 3, w: 2, h: 2, config: { metric: 'mttr' },           dataPoints: [] },
  { id: 'tpl-id-5', type: 'stat',          x: 4, y: 5, w: 2, h: 1, config: { metric: 'dd' },             dataPoints: [] },
];

const CLOUD_TILES: TileConfig[] = [
  { id: 'tpl-cl-1', type: 'service-watch', x: 0, y: 0, w: 2, h: 2, config: { service: 'aws' },        dataPoints: WATCH_POINTS },
  { id: 'tpl-cl-2', type: 'service-watch', x: 2, y: 0, w: 2, h: 2, config: { service: 'cloudflare' }, dataPoints: WATCH_POINTS },
  { id: 'tpl-cl-3', type: 'service-watch', x: 4, y: 0, w: 2, h: 2, config: { service: 'github' },     dataPoints: WATCH_POINTS },
  { id: 'tpl-cl-4', type: 'status-map',    x: 0, y: 2, w: 4, h: 3, config: {},                         dataPoints: [] },
  { id: 'tpl-cl-5', type: 'incident-feed', x: 4, y: 2, w: 2, h: 3, config: {},                         dataPoints: [] },
  { id: 'tpl-cl-6', type: 'service-grid',  x: 0, y: 5, w: 6, h: 2, config: {},                         dataPoints: [] },
];

const DEV_TILES: TileConfig[] = [
  { id: 'tpl-dv-1', type: 'service-watch', x: 0, y: 0, w: 2, h: 2, config: { service: 'github' },     dataPoints: WATCH_POINTS },
  { id: 'tpl-dv-2', type: 'service-watch', x: 2, y: 0, w: 2, h: 2, config: { service: 'atlassian' },  dataPoints: WATCH_POINTS },
  { id: 'tpl-dv-3', type: 'service-watch', x: 4, y: 0, w: 2, h: 2, config: { service: 'cloudflare' }, dataPoints: WATCH_POINTS },
  { id: 'tpl-dv-4', type: 'rss',           x: 0, y: 2, w: 3, h: 3, config: { feed: 'aws-blog' },       dataPoints: [] },
  { id: 'tpl-dv-5', type: 'rss',           x: 3, y: 2, w: 3, h: 3, config: { feed: 'gh-blog' },        dataPoints: [] },
  { id: 'tpl-dv-6', type: 'incident-feed', x: 0, y: 5, w: 6, h: 2, config: {},                         dataPoints: [] },
];

// Dense, glanceable wall view — every signal on one screen.
const NOC_TILES: TileConfig[] = [
  { id: 'tpl-noc-1', type: 'stat',          x: 0, y: 0, w: 1, h: 2, config: { metric: 'uptime' },    dataPoints: [] },
  { id: 'tpl-noc-2', type: 'stat',          x: 1, y: 0, w: 1, h: 2, config: { metric: 'incidents' }, dataPoints: [] },
  { id: 'tpl-noc-3', type: 'stat',          x: 2, y: 0, w: 1, h: 2, config: { metric: 'mttr' },      dataPoints: [] },
  { id: 'tpl-noc-4', type: 'stat',          x: 3, y: 0, w: 1, h: 2, config: { metric: 'dd' },        dataPoints: [] },
  { id: 'tpl-noc-5', type: 'anomaly-alert', x: 4, y: 0, w: 2, h: 2, config: {},                      dataPoints: [] },
  { id: 'tpl-noc-6', type: 'service-grid',  x: 0, y: 2, w: 4, h: 3, config: {},                      dataPoints: [] },
  { id: 'tpl-noc-7', type: 'incident-feed', x: 4, y: 2, w: 2, h: 3, config: {},                      dataPoints: [] },
  { id: 'tpl-noc-8', type: 'status-map',    x: 0, y: 5, w: 4, h: 2, config: {},                      dataPoints: [] },
  { id: 'tpl-noc-9', type: 'fetcher-health',x: 4, y: 5, w: 2, h: 2, config: {},                      dataPoints: [] },
];

// High-level KPIs for a leadership audience.
const EXEC_TILES: TileConfig[] = [
  { id: 'tpl-exec-1', type: 'stat',             x: 0, y: 0, w: 2, h: 2, config: { metric: 'sla' },             dataPoints: [] },
  { id: 'tpl-exec-2', type: 'stat',             x: 2, y: 0, w: 2, h: 2, config: { metric: 'uptime' },          dataPoints: [] },
  { id: 'tpl-exec-3', type: 'stat',             x: 4, y: 0, w: 2, h: 2, config: { metric: 'incidents' },       dataPoints: [] },
  { id: 'tpl-exec-4', type: 'uptime-chart',     x: 0, y: 2, w: 3, h: 2, config: { service: 'microsoft-365' }, dataPoints: [] },
  { id: 'tpl-exec-5', type: 'uptime-chart',     x: 3, y: 2, w: 3, h: 2, config: { service: 'aws' },           dataPoints: [] },
  { id: 'tpl-exec-6', type: 'incident-metrics', x: 0, y: 4, w: 3, h: 2, config: { days: 30 },                 dataPoints: [] },
  { id: 'tpl-exec-7', type: 'service-grid',     x: 3, y: 4, w: 3, h: 2, config: {},                           dataPoints: [] },
];

// Active-incident focus for on-call.
const WARROOM_TILES: TileConfig[] = [
  { id: 'tpl-war-1', type: 'incident-feed',    x: 0, y: 0, w: 3, h: 4, config: { filters: { severity: ['major', 'critical'] } }, dataPoints: [] },
  { id: 'tpl-war-2', type: 'incident-metrics', x: 3, y: 0, w: 3, h: 2, config: { days: 7 },                                      dataPoints: [] },
  { id: 'tpl-war-3', type: 'anomaly-alert',    x: 3, y: 2, w: 3, h: 2, config: {},                                               dataPoints: [] },
  { id: 'tpl-war-4', type: 'service-grid',     x: 0, y: 4, w: 4, h: 2, config: { filters: { hideOperational: true } },          dataPoints: [] },
  { id: 'tpl-war-5', type: 'alert-audit',      x: 4, y: 4, w: 2, h: 2, config: {},                                               dataPoints: [] },
];

// SLA / reliability reporting view.
const SLA_TILES: TileConfig[] = [
  { id: 'tpl-sla-1', type: 'stat',         x: 0, y: 0, w: 2, h: 2, config: { metric: 'sla' },           dataPoints: [] },
  { id: 'tpl-sla-2', type: 'stat',         x: 2, y: 0, w: 2, h: 2, config: { metric: 'mttr' },          dataPoints: [] },
  { id: 'tpl-sla-3', type: 'stat',         x: 4, y: 0, w: 2, h: 2, config: { metric: 'uptime' },        dataPoints: [] },
  { id: 'tpl-sla-4', type: 'uptime-chart', x: 0, y: 2, w: 3, h: 2, config: { service: 'github' },       dataPoints: [] },
  { id: 'tpl-sla-5', type: 'uptime-chart', x: 3, y: 2, w: 3, h: 2, config: { service: 'okta' },         dataPoints: [] },
  { id: 'tpl-sla-6', type: 'uptime-chart', x: 0, y: 4, w: 3, h: 2, config: { service: 'aws' },          dataPoints: [] },
  { id: 'tpl-sla-7', type: 'uptime-chart', x: 3, y: 4, w: 3, h: 2, config: { service: 'cloudflare' },   dataPoints: [] },
];

// Collaboration / communication tooling.
const COLLAB_SLUGS = ['slack', 'zoom', 'google-workspace', 'microsoft-365'];
const COLLAB_TILES: TileConfig[] = [
  { id: 'tpl-collab-1', type: 'service-watch', x: 0, y: 0, w: 2, h: 2, config: { service: 'slack' },            dataPoints: WATCH_POINTS },
  { id: 'tpl-collab-2', type: 'service-watch', x: 2, y: 0, w: 2, h: 2, config: { service: 'zoom' },             dataPoints: WATCH_POINTS },
  { id: 'tpl-collab-3', type: 'service-watch', x: 4, y: 0, w: 2, h: 2, config: { service: 'google-workspace' }, dataPoints: WATCH_POINTS },
  { id: 'tpl-collab-4', type: 'service-watch', x: 0, y: 2, w: 2, h: 2, config: { service: 'microsoft-365' },    dataPoints: WATCH_POINTS },
  { id: 'tpl-collab-5', type: 'incident-feed', x: 2, y: 2, w: 4, h: 3, config: { filters: { services: COLLAB_SLUGS } }, dataPoints: [] },
  { id: 'tpl-collab-6', type: 'service-grid',  x: 0, y: 4, w: 2, h: 2, config: { services: COLLAB_SLUGS },      dataPoints: [] },
];

// Everything about a single service (defaults to GitHub).
const DEEPDIVE_TILES: TileConfig[] = [
  { id: 'tpl-dd-1', type: 'service-watch',    x: 0, y: 0, w: 2, h: 3, config: { service: 'github' },                       dataPoints: WATCH_POINTS },
  { id: 'tpl-dd-2', type: 'uptime-chart',     x: 2, y: 0, w: 4, h: 3, config: { service: 'github' },                       dataPoints: [] },
  { id: 'tpl-dd-3', type: 'incident-feed',    x: 0, y: 3, w: 3, h: 3, config: { filters: { services: ['github'] } },       dataPoints: [] },
  { id: 'tpl-dd-4', type: 'incident-metrics', x: 3, y: 3, w: 3, h: 3, config: { days: 30 },                                dataPoints: [] },
];

export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Mix of stats, two service watches, incident feed, and a heat map.',
    tiles: DEFAULT_BOARD,
  },
  {
    id: 'noc',
    name: 'NOC video wall',
    description: 'Dense, glanceable wall: fleet stats, anomaly watch, full service grid, incidents, heat map, and fetcher health.',
    tiles: NOC_TILES,
  },
  {
    id: 'exec',
    name: 'Executive summary',
    description: 'High-level KPIs — SLA, uptime, and incidents — with trend charts and a fleet grid.',
    tiles: EXEC_TILES,
  },
  {
    id: 'warroom',
    name: 'Incident war room',
    description: 'Active-incident focus: major/critical feed, metrics, anomalies, problem services, and alert audit.',
    tiles: WARROOM_TILES,
  },
  {
    id: 'sla',
    name: 'Reliability & SLA',
    description: 'SLA, MTTR, and uptime stats with per-service 30-day uptime charts.',
    tiles: SLA_TILES,
  },
  {
    id: 'collab',
    name: 'Collaboration suite',
    description: 'Slack, Zoom, Google Workspace, and Microsoft 365 watches with a scoped incident feed.',
    tiles: COLLAB_TILES,
  },
  {
    id: 'deep-dive',
    name: 'Single-service deep dive',
    description: 'Everything about one service: watch, uptime chart, scoped incidents, and metrics.',
    tiles: DEEPDIVE_TILES,
  },
  {
    id: 'm365',
    name: 'Microsoft 365 focus',
    description: 'Microsoft 365 and Google Workspace side-by-side with uptime charts.',
    tiles: M365_TILES,
  },
  {
    id: 'identity',
    name: 'Identity & SSO',
    description: 'Okta and Microsoft 365 (Entra) watches with an incident feed.',
    tiles: IDENTITY_TILES,
  },
  {
    id: 'cloud',
    name: 'Cloud infra',
    description: 'AWS, Cloudflare, GitHub + heat map and service grid.',
    tiles: CLOUD_TILES,
  },
  {
    id: 'dev-tools',
    name: 'Developer tooling',
    description: 'GitHub, Atlassian, Cloudflare plus engineering RSS feeds.',
    tiles: DEV_TILES,
  },
];

const USER_TEMPLATES_KEY = 'outage-board-user-templates';

export function readUserTemplates(): Template[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(USER_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Template[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => typeof t.id === 'string' && Array.isArray(t.tiles));
  } catch {
    return [];
  }
}

export function writeUserTemplates(templates: Template[]) {
  try { localStorage.setItem(USER_TEMPLATES_KEY, JSON.stringify(templates)); } catch { /* ignore */ }
}

export function saveUserTemplate(name: string, tiles: TileConfig[]): Template {
  const tpl: Template = {
    id: 'user-' + Date.now(),
    name,
    description: 'Saved from your current board',
    tiles: JSON.parse(JSON.stringify(tiles)),
  };
  const all = [...readUserTemplates(), tpl];
  writeUserTemplates(all);
  return tpl;
}

export function deleteUserTemplate(id: string) {
  writeUserTemplates(readUserTemplates().filter((t) => t.id !== id));
}
