import { ServiceConfig } from './types';

export const SERVICES: ServiceConfig[] = [
  {
    name: 'Microsoft 365',
    slug: 'microsoft-365',
    color: '#0078D4',
    statusUrl: 'https://status.office365.com',
    downdetectorSlug: 'office-365',
    fetcher: 'microsoft',
  },
  {
    name: 'Adobe Creative Cloud',
    slug: 'adobe-cc',
    color: '#FF0000',
    statusUrl: 'https://status.adobe.com',
    downdetectorSlug: 'creative-cloud',
    fetcher: 'statuspage',
  },
  {
    name: 'ServiceNow',
    slug: 'servicenow',
    color: '#81B532',
    statusUrl: 'https://status.servicenow.com',
    downdetectorSlug: 'servicenow',
    fetcher: 'statuspage',
  },
  {
    name: 'Salesforce',
    slug: 'salesforce',
    color: '#00A1E0',
    statusUrl: 'https://api.status.salesforce.com',
    downdetectorSlug: 'salesforce',
    fetcher: 'salesforce',
  },
  {
    name: 'Workday',
    slug: 'workday',
    color: '#F68D2E',
    statusUrl: 'https://status.workday.com',
    downdetectorSlug: 'workday',
    fetcher: 'workday',
  },
  {
    name: 'Zoom',
    slug: 'zoom',
    color: '#2D8CFF',
    statusUrl: 'https://status.zoom.us',
    downdetectorSlug: 'zoom',
    fetcher: 'statuspage',
  },
  {
    name: 'Google Workspace',
    slug: 'google-workspace',
    color: '#4285F4',
    statusUrl: 'https://www.google.com/appsstatus/dashboard/',
    downdetectorSlug: 'google',
    fetcher: 'google',
  },
];

export function getServiceBySlug(slug: string): ServiceConfig | undefined {
  return SERVICES.find((s) => s.slug === slug);
}
