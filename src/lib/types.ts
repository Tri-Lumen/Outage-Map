export type ServiceStatus = 'operational' | 'degraded' | 'major_outage' | 'down' | 'unknown';
export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved';
export type IncidentSeverity = 'minor' | 'major' | 'critical';
export type AlertType = 'new_incident' | 'status_change' | 'resolved';
export type FetcherType = 'statuspage' | 'microsoft' | 'salesforce' | 'google' | 'workday' | 'aws';

export interface ServiceConfig {
  name: string;
  slug: string;
  color: string;
  statusUrl: string;
  downdetectorSlug: string;
  fetcher: FetcherType;
  brandFont: string;
}

export interface StatusResult {
  serviceSlug: string;
  source: 'official' | 'downdetector';
  status: ServiceStatus;
  details: string | null;
  reportCount: number | null;
}

export interface IncidentResult {
  serviceSlug: string;
  incidentId: string;
  title: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  startedAt: string | null;
  resolvedAt: string | null;
  description: string | null;
  sourceUrl: string | null;
}

export interface FetchResult {
  status: StatusResult;
  incidents: IncidentResult[];
}

export interface ServiceStatusResponse {
  slug: string;
  name: string;
  color: string;
  officialStatus: ServiceStatus;
  downdetectorStatus: ServiceStatus;
  downdetectorReports: number;
  incidentCount: number;
  overallStatus: ServiceStatus;
  details: string | null;
  lastChecked: string | null;
  statusUrl: string;
  downdetectorUrl: string;
  brandFont: string;
}

export interface IncidentResponse {
  id: number;
  service: string;
  serviceName: string;
  title: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  startedAt: string | null;
  resolvedAt: string | null;
  description: string | null;
  sourceUrl: string | null;
  updatedAt: string;
}

export interface HistoryPoint {
  date: string;
  status: ServiceStatus;
  reports: number;
  incidents: number;
  outageMinutes: number;
}

export interface HistoryResponse {
  history: Record<string, HistoryPoint[]>;
}

export interface AlertRule {
  id: string;
  email: string;
  services: string[];
  minSeverity: IncidentSeverity;
  emailEnabled: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const INCIDENT_STATUSES: ReadonlyArray<IncidentStatus> = [
  'investigating', 'identified', 'monitoring', 'resolved',
];
const INCIDENT_SEVERITIES: ReadonlyArray<IncidentSeverity> = ['minor', 'major', 'critical'];

export function isIncidentStatus(value: unknown): value is IncidentStatus {
  return typeof value === 'string' && (INCIDENT_STATUSES as ReadonlyArray<string>).includes(value);
}

export function isIncidentSeverity(value: unknown): value is IncidentSeverity {
  return typeof value === 'string' && (INCIDENT_SEVERITIES as ReadonlyArray<string>).includes(value);
}

export function asIncidentStatus(value: unknown): IncidentStatus {
  return isIncidentStatus(value) ? value : 'investigating';
}

export function asIncidentSeverity(value: unknown): IncidentSeverity {
  return isIncidentSeverity(value) ? value : 'minor';
}
