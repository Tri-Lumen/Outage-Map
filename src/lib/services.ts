import { ServiceConfig, FetcherType } from './types';
import { CustomServiceRow, listEnabledCustomServices } from './db';
import contributedFile from './services.contributed.json';

interface ContributedFile {
  schemaVersion: number;
  services: ServiceConfig[];
}

const CONTRIBUTED: ServiceConfig[] = (contributedFile as ContributedFile).services ?? [];

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
    color: '#0078D4',
    statusUrl: 'https://status.office365.com',
    downdetectorSlug: 'office-365',
    fetcher: 'microsoft',
    brandFont: 'var(--font-brand-inter), Inter, system-ui, sans-serif',
  },
  {
    name: 'Adobe Creative Cloud',
    slug: 'adobe-cc',
    color: '#FF0000',
    statusUrl: 'https://status.adobe.com',
    downdetectorSlug: 'adobe-creative-cloud',
    fetcher: 'statuspage',
    brandFont: 'var(--font-brand-source-sans), "Source Sans 3", system-ui, sans-serif',
  },
  {
    name: 'ServiceNow',
    slug: 'servicenow',
    color: '#81B532',
    statusUrl: 'https://status.servicenow.com',
    downdetectorSlug: 'service-now',
    fetcher: 'statuspage',
    brandFont: 'var(--font-brand-inter), Inter, system-ui, sans-serif',
  },
  {
    name: 'Salesforce',
    slug: 'salesforce',
    color: '#00A1E0',
    // The user-facing Trust dashboard. api.status.salesforce.com returns
    // JSON-only and renders as a blank page when opened in a browser.
    statusUrl: 'https://status.salesforce.com',
    downdetectorSlug: 'salesforce',
    fetcher: 'salesforce',
    brandFont: 'var(--font-brand-inter), Inter, system-ui, sans-serif',
  },
  {
    name: 'Workday',
    slug: 'workday',
    color: '#F68D2E',
    statusUrl: 'https://status.workday.com',
    downdetectorSlug: 'workday',
    fetcher: 'workday',
    brandFont: 'var(--font-brand-lato), Lato, system-ui, sans-serif',
  },
  {
    name: 'Zoom',
    slug: 'zoom',
    color: '#2D8CFF',
    statusUrl: 'https://status.zoom.us',
    downdetectorSlug: 'zoom',
    fetcher: 'statuspage',
    brandFont: 'var(--font-brand-inter), Inter, system-ui, sans-serif',
  },
  {
    name: 'Google Workspace',
    slug: 'google-workspace',
    color: '#4285F4',
    statusUrl: 'https://www.google.com/appsstatus/dashboard/',
    downdetectorSlug: 'google',
    fetcher: 'google',
    brandFont: 'var(--font-brand-roboto), Roboto, system-ui, sans-serif',
  },
  {
    name: 'Slack',
    slug: 'slack',
    color: '#4A154B',
    statusUrl: 'https://status.slack.com',
    downdetectorSlug: 'slack',
    fetcher: 'statuspage',
    brandFont: 'var(--font-brand-inter), Inter, system-ui, sans-serif',
  },
  {
    name: 'GitHub',
    slug: 'github',
    color: '#181717',
    statusUrl: 'https://www.githubstatus.com',
    downdetectorSlug: 'github',
    fetcher: 'statuspage',
    brandFont: 'var(--font-brand-inter), Inter, system-ui, sans-serif',
  },
  {
    name: 'Atlassian',
    slug: 'atlassian',
    color: '#0052CC',
    statusUrl: 'https://status.atlassian.com',
    downdetectorSlug: 'atlassian',
    fetcher: 'statuspage',
    brandFont: 'var(--font-brand-inter), Inter, system-ui, sans-serif',
  },
  {
    name: 'Okta',
    slug: 'okta',
    color: '#007DC1',
    statusUrl: 'https://status.okta.com',
    downdetectorSlug: 'okta',
    fetcher: 'statuspage',
    brandFont: 'var(--font-brand-inter), Inter, system-ui, sans-serif',
  },
  {
    name: 'Cloudflare',
    slug: 'cloudflare',
    color: '#F38020',
    statusUrl: 'https://www.cloudflarestatus.com',
    downdetectorSlug: 'cloudflare',
    fetcher: 'statuspage',
    brandFont: 'var(--font-brand-inter), Inter, system-ui, sans-serif',
  },
  {
    name: 'Dropbox',
    slug: 'dropbox',
    color: '#0061FF',
    statusUrl: 'https://status.dropbox.com',
    downdetectorSlug: 'dropbox',
    fetcher: 'statuspage',
    brandFont: 'var(--font-brand-inter), Inter, system-ui, sans-serif',
  },
  {
    name: 'Amazon Web Services',
    slug: 'aws',
    color: '#FF9900',
    statusUrl: 'https://health.aws.amazon.com/health/status',
    downdetectorSlug: 'amazon-web-services',
    fetcher: 'aws',
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
    downdetectorSlug: row.downdetector_slug,
    fetcher: row.fetcher as FetcherType,
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
