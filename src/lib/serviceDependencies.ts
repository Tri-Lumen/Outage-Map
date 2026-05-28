// Illustrative service dependency adjacency list.
// Edges mean "from depends on to" — i.e., an outage in "to" may cascade into "from".
// This is hand-curated based on known infrastructure relationships.

export interface ServiceDependency {
  from: string;
  to: string;
  label?: string;
}

export const SERVICE_DEPENDENCIES: ServiceDependency[] = [
  // AWS is a base infrastructure provider
  { from: 'slack', to: 'aws', label: 'hosted on' },
  { from: 'github', to: 'aws', label: 'hosted on' },
  { from: 'zoom', to: 'aws', label: 'hosted on' },
  { from: 'atlassian', to: 'aws', label: 'hosted on' },
  { from: 'dropbox', to: 'aws', label: 'hosted on' },
  // Cloudflare provides CDN/edge for many services
  { from: 'github', to: 'cloudflare', label: 'CDN' },
  { from: 'atlassian', to: 'cloudflare', label: 'CDN' },
  // Microsoft 365 depends on Microsoft infrastructure
  { from: 'microsoft-365', to: 'okta', label: 'SSO' },
  { from: 'salesforce', to: 'okta', label: 'SSO' },
  { from: 'workday', to: 'okta', label: 'SSO' },
  { from: 'servicenow', to: 'okta', label: 'SSO' },
  // Adobe uses AWS
  { from: 'adobe', to: 'aws', label: 'hosted on' },
];

export function getDependentServices(slug: string): string[] {
  return SERVICE_DEPENDENCIES
    .filter((d) => d.to === slug)
    .map((d) => d.from);
}

export function getDependencyOf(slug: string): string[] {
  return SERVICE_DEPENDENCIES
    .filter((d) => d.from === slug)
    .map((d) => d.to);
}
