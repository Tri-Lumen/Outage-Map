import { ServiceConfig, ConnectorKind } from './types';
import { CustomServiceRow, listEnabledCustomServices } from './db';
import { isConnectorKind } from './connectors/types';
import contributedFile from './services.contributed.json';

interface ContributedFile {
  schemaVersion: number;
  services: Array<Partial<ServiceConfig> & { fetcher?: string; kind?: string }>;
}

// Map any stored selector to a known ConnectorKind. Older rows used `fetcher`;
// `workday` was folded into `statuspage`. Unknown values fall back to
// `statuspage` (the safest generic JSON connector).
export function resolveKind(value: string | null | undefined): ConnectorKind {
  if (value === 'workday') return 'statuspage';
  if (value && isConnectorKind(value)) return value;
  return 'statuspage';
}

function normalizeContributed(
  entry: Partial<ServiceConfig> & { fetcher?: string; kind?: string },
): ServiceConfig | null {
  if (!entry.name || !entry.slug || !entry.statusUrl) return null;
  return {
    name: entry.name,
    slug: entry.slug,
    color: entry.color ?? '#268bd2',
    statusUrl: entry.statusUrl,
    kind: resolveKind(entry.kind ?? entry.fetcher),
    brandFont: entry.brandFont ?? 'var(--font-brand-inter), Inter, system-ui, sans-serif',
    category: entry.category,
  };
}

const CONTRIBUTED: ServiceConfig[] = ((contributedFile as ContributedFile).services ?? [])
  .map(normalizeContributed)
  .filter((s): s is ServiceConfig => s !== null);

/**
 * Static catalog of monitored services. Edits to this file are hand-written;
 * additions from the in-app "Contribute to catalog" flow land in
 * `services.contributed.json` instead and are merged below at module load.
 * Runtime code should call `getServices()` — that helper layers user-added
 * rows from the `custom_services` SQLite table on top of this merged list.
 */
const HARDCODED: ServiceConfig[] = [
  {
    name: 'Microsoft 365',
    slug: 'microsoft-365',
    category: 'Productivity',
    color: '#0078D4',
    statusUrl: 'https://status.office365.com',
    kind: 'microsoft',
    brandFont: 'var(--font-brand-inter), Inter, system-ui, sans-serif',
  },
  {
    name: 'Adobe Creative Cloud',
    slug: 'adobe-cc',
    category: 'Productivity',
    color: '#FF0000',
    statusUrl: 'https://status.adobe.com',
    kind: 'statuspage',
    brandFont: 'var(--font-brand-source-sans), "Source Sans 3", system-ui, sans-serif',
  },
  {
    name: 'ServiceNow',
    slug: 'servicenow',
    category: 'Business',
    color: '#81B532',
    statusUrl: 'https://status.servicenow.com',
    kind: 'statuspage',
    brandFont: 'var(--font-brand-inter), Inter, system-ui, sans-serif',
  },
  {
    name: 'Salesforce',
    slug: 'salesforce',
    category: 'Business',
    color: '#00A1E0',
    // The user-facing Trust dashboard. api.status.salesforce.com returns
    // JSON-only and renders as a blank page when opened in a browser.
    statusUrl: 'https://status.salesforce.com',
    kind: 'salesforce',
    brandFont: 'var(--font-brand-inter), Inter, system-ui, sans-serif',
  },
  {
    name: 'Workday',
    slug: 'workday',
    category: 'Business',
    color: '#F68D2E',
    // status.workday.com is a Statuspage.io instance — use the generic connector.
    statusUrl: 'https://status.workday.com',
    kind: 'statuspage',
    brandFont: 'var(--font-brand-lato), Lato, system-ui, sans-serif',
  },
  {
    name: 'Zoom',
    slug: 'zoom',
    category: 'Communication',
    color: '#2D8CFF',
    statusUrl: 'https://status.zoom.us',
    kind: 'statuspage',
    brandFont: 'var(--font-brand-inter), Inter, system-ui, sans-serif',
  },
  {
    name: 'Google Workspace',
    slug: 'google-workspace',
    category: 'Productivity',
    color: '#4285F4',
    statusUrl: 'https://www.google.com/appsstatus/dashboard/',
    kind: 'google',
    brandFont: 'var(--font-brand-roboto), Roboto, system-ui, sans-serif',
  },
  {
    name: 'Slack',
    slug: 'slack',
    category: 'Communication',
    color: '#4A154B',
    statusUrl: 'https://status.slack.com',
    kind: 'statuspage',
    brandFont: 'var(--font-brand-inter), Inter, system-ui, sans-serif',
  },
  {
    name: 'GitHub',
    slug: 'github',
    category: 'Developer',
    color: '#181717',
    statusUrl: 'https://www.githubstatus.com',
    kind: 'statuspage',
    brandFont: 'var(--font-brand-inter), Inter, system-ui, sans-serif',
  },
  {
    name: 'Atlassian',
    slug: 'atlassian',
    category: 'Developer',
    color: '#0052CC',
    statusUrl: 'https://status.atlassian.com',
    kind: 'statuspage',
    brandFont: 'var(--font-brand-inter), Inter, system-ui, sans-serif',
  },
  {
    name: 'Okta',
    slug: 'okta',
    category: 'Identity',
    color: '#007DC1',
    statusUrl: 'https://status.okta.com',
    kind: 'statuspage',
    brandFont: 'var(--font-brand-inter), Inter, system-ui, sans-serif',
  },
  {
    name: 'Cloudflare',
    slug: 'cloudflare',
    category: 'Infrastructure',
    color: '#F38020',
    statusUrl: 'https://www.cloudflarestatus.com',
    kind: 'statuspage',
    brandFont: 'var(--font-brand-inter), Inter, system-ui, sans-serif',
  },
  {
    name: 'Dropbox',
    slug: 'dropbox',
    category: 'Storage',
    color: '#0061FF',
    statusUrl: 'https://status.dropbox.com',
    kind: 'statuspage',
    brandFont: 'var(--font-brand-inter), Inter, system-ui, sans-serif',
  },
  {
    name: 'Amazon Web Services',
    slug: 'aws',
    category: 'Infrastructure',
    color: '#FF9900',
    statusUrl: 'https://health.aws.amazon.com/health/status',
    kind: 'aws',
    brandFont: 'var(--font-brand-inter), Inter, system-ui, sans-serif',
  },
];

// Static catalog exported for backwards-compat callers. Combines hand-edited
// HARDCODED entries with machine-edited contributed entries; the contributed
// file is the target of the one-click "Contribute to catalog" PR flow so its
// shape never needs to be parsed from TypeScript.
export const SERVICES: ServiceConfig[] = (() => {
  const seen = new Set(HARDCODED.map((s) => s.slug));
  const merged = [...HARDCODED];
  for (const c of CONTRIBUTED) {
    if (!seen.has(c.slug)) {
      merged.push(c);
      seen.add(c.slug);
    }
  }
  return merged;
})();

function rowToServiceConfig(row: CustomServiceRow): ServiceConfig {
  return {
    name: row.name,
    slug: row.slug,
    color: row.color,
    statusUrl: row.status_url,
    kind: resolveKind(row.kind ?? row.fetcher),
    brandFont: row.brand_font,
  };
}

/**
 * Returns the static SERVICES list merged with enabled rows from the
 * `custom_services` table. Call this from any server-side code that
 * needs to iterate the live catalog (poller, /api/status, alert rules).
 * Client code should derive the list from /api/status instead — this
 * helper opens a SQLite connection.
 */
export function getServices(): ServiceConfig[] {
  const hardcoded = SERVICES;
  const seen = new Set(hardcoded.map((s) => s.slug));
  const custom = listEnabledCustomServices()
    .map(rowToServiceConfig)
    .filter((s) => !seen.has(s.slug));
  return [...hardcoded, ...custom];
}

export function getServiceBySlug(slug: string): ServiceConfig | undefined {
  return getServices().find((s) => s.slug === slug);
}
