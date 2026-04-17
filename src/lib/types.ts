export type ServiceStatus = 'operational' | 'degraded' | 'major_outage' | 'down' | 'unknown';
export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved';
export type IncidentSeverity = 'minor' | 'major' | 'critical';
export type AlertType = 'new_incident' | 'status_change' | 'resolved';
export type FetcherType = 'statuspage' | 'microsoft' | 'salesforce' | 'google' | 'workday';

export interface ServiceConfig {
  name: string;
  slug: string;
  color: string;
  statusUrl: string;
  downdetectorSlug: string;
  fetcher: FetcherType;
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
  overallStatus: ServiceStatus;
  details: string | null;
  lastChecked: string | null;
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
  outageMinutes: number;
}

export interface HistoryResponse {
  history: Record<string, HistoryPoint[]>;
}
