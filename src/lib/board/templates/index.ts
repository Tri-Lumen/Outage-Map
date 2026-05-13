import type { TileConfig } from '@/hooks/useBoard';
import { DEFAULT_BOARD } from '@/hooks/useBoard';

export interface Template {
  id: string;
  name: string;
  description: string;
  tiles: TileConfig[];
}

const M365_TILES: TileConfig[] = [
  { id: 'tpl-m365-1', type: 'stat',          x: 0, y: 0, w: 2, h: 2, config: { metric: 'uptime' },     dataPoints: [] },
  { id: 'tpl-m365-2', type: 'stat',          x: 2, y: 0, w: 2, h: 2, config: { metric: 'incidents' },  dataPoints: [] },
  { id: 'tpl-m365-3', type: 'incident-feed', x: 4, y: 0, w: 2, h: 4, config: {},                       dataPoints: [] },
  { id: 'tpl-m365-4', type: 'service-watch', x: 0, y: 2, w: 2, h: 2, config: { service: 'office365' },  dataPoints: ['sparkline', 'uptime', 'official', 'downdetector'] },
  { id: 'tpl-m365-5', type: 'service-watch', x: 2, y: 2, w: 2, h: 2, config: { service: 'azure' },      dataPoints: ['sparkline', 'uptime', 'official', 'downdetector'] },
  { id: 'tpl-m365-6', type: 'uptime-chart',  x: 0, y: 4, w: 3, h: 2, config: { service: 'office365' }, dataPoints: [] },
  { id: 'tpl-m365-7', type: 'uptime-chart',  x: 3, y: 4, w: 3, h: 2, config: { service: 'azure' },     dataPoints: [] },
];

const IDENTITY_TILES: TileConfig[] = [
  { id: 'tpl-id-1', type: 'service-watch', x: 0, y: 0, w: 3, h: 3, config: { service: 'okta' },     dataPoints: ['sparkline', 'uptime', 'official', 'downdetector'] },
  { id: 'tpl-id-2', type: 'service-watch', x: 3, y: 0, w: 3, h: 3, config: { service: 'auth0' },    dataPoints: ['sparkline', 'uptime', 'official', 'downdetector'] },
  { id: 'tpl-id-3', type: 'incident-feed', x: 0, y: 3, w: 4, h: 3, config: {},                      dataPoints: [] },
  { id: 'tpl-id-4', type: 'stat',          x: 4, y: 3, w: 2, h: 2, config: { metric: 'mttr' },      dataPoints: [] },
  { id: 'tpl-id-5', type: 'stat',          x: 4, y: 5, w: 2, h: 1, config: { metric: 'dd' },        dataPoints: [] },
];

const CLOUD_TILES: TileConfig[] = [
  { id: 'tpl-cl-1', type: 'service-watch', x: 0, y: 0, w: 2, h: 2, config: { service: 'aws' },   dataPoints: ['sparkline', 'uptime', 'official', 'downdetector'] },
  { id: 'tpl-cl-2', type: 'service-watch', x: 2, y: 0, w: 2, h: 2, config: { service: 'gcp' },   dataPoints: ['sparkline', 'uptime', 'official', 'downdetector'] },
  { id: 'tpl-cl-3', type: 'service-watch', x: 4, y: 0, w: 2, h: 2, config: { service: 'azure' }, dataPoints: ['sparkline', 'uptime', 'official', 'downdetector'] },
  { id: 'tpl-cl-4', type: 'status-map',    x: 0, y: 2, w: 4, h: 3, config: {},                   dataPoints: [] },
  { id: 'tpl-cl-5', type: 'incident-feed', x: 4, y: 2, w: 2, h: 3, config: {},                   dataPoints: [] },
  { id: 'tpl-cl-6', type: 'service-grid',  x: 0, y: 5, w: 6, h: 2, config: {},                   dataPoints: [] },
];

const DEV_TILES: TileConfig[] = [
  { id: 'tpl-dv-1', type: 'service-watch', x: 0, y: 0, w: 2, h: 2, config: { service: 'github' },  dataPoints: ['sparkline', 'uptime', 'official', 'downdetector'] },
  { id: 'tpl-dv-2', type: 'service-watch', x: 2, y: 0, w: 2, h: 2, config: { service: 'npm' },     dataPoints: ['sparkline', 'uptime', 'official', 'downdetector'] },
  { id: 'tpl-dv-3', type: 'service-watch', x: 4, y: 0, w: 2, h: 2, config: { service: 'docker' },  dataPoints: ['sparkline', 'uptime', 'official', 'downdetector'] },
  { id: 'tpl-dv-4', type: 'rss',           x: 0, y: 2, w: 3, h: 3, config: { feed: 'aws-blog' },   dataPoints: [] },
  { id: 'tpl-dv-5', type: 'rss',           x: 3, y: 2, w: 3, h: 3, config: { feed: 'gh-blog' },    dataPoints: [] },
  { id: 'tpl-dv-6', type: 'incident-feed', x: 0, y: 5, w: 6, h: 2, config: {},                     dataPoints: [] },
];

export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Mix of stats, two service watches, incident feed, and a heat map.',
    tiles: DEFAULT_BOARD,
  },
  {
    id: 'm365',
    name: 'Microsoft 365 focus',
    description: 'Office 365 + Azure side-by-side with uptime charts.',
    tiles: M365_TILES,
  },
  {
    id: 'identity',
    name: 'Identity & SSO',
    description: 'Okta and Auth0 watches with incident feed.',
    tiles: IDENTITY_TILES,
  },
  {
    id: 'cloud',
    name: 'Cloud infra',
    description: 'AWS, GCP, Azure + heat map and service grid.',
    tiles: CLOUD_TILES,
  },
  {
    id: 'dev-tools',
    name: 'Developer tooling',
    description: 'GitHub, npm, Docker plus engineering RSS feeds.',
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
