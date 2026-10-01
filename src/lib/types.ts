export type ServiceStatus = 'operational' | 'degraded' | 'major_outage' | 'down' | 'unknown';
export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved';
export type IncidentSeverity = 'minor' | 'major' | 'critical';
export type AlertType = 'new_incident' | 'status_change' | 'resolved';
// Connector selector. Workday folded into 'statuspage' (status.workday.com is a
// Statuspage instance); Downdetector removed. See src/lib/connectors/.
export type ConnectorKind = 'statuspage' | 'google' | 'microsoft' | 'salesforce' | 'aws';
export type ChannelType = 'slack' | 'teams' | 'discord' | 'generic' | 'pagerduty' | 'opsgenie';

export interface ServiceConfig {
  name: string;
  slug: string;
  color: string;
  statusUrl: string;
  kind: ConnectorKind;
  brandFont: string;
  /** Optional grouping category surfaced in the service grid (e.g. "Identity"). */
  category?: string;
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

export interface ServiceStatusResponse {
  slug: string;
  name: string;
  color: string;
  officialStatus: ServiceStatus;
  incidentCount: number;
  overallStatus: ServiceStatus;
  details: string | null;
  lastChecked: string | null;
  /** True when the last successful official check is older than the freshness window. */
  stale: boolean;
  statusUrl: string;
  brandFont: string;
  category: string | null;
  inMaintenance: boolean;
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
  hasPostmortem?: boolean;
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
  webhookUrl: string | null;
  webhookEnabled: boolean;
  channelType: ChannelType;
  escalationEnabled: boolean;
  escalationIntervals: number[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SummaryResponse {
  totalServices: number;
  operational: number;
  degraded: number;
  majorOutage: number;
  down: number;
  unknown: number;
  activeIncidents: number;
  uptimePct: number;
  lastUpdated: string;
}

export interface MaintenanceWindow {
  id: string;
  serviceSlugs: string[];
  startTime: string;
  endTime: string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  recurrence: 'none' | 'weekly';
  recurrenceUntil: string | null;
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

const CHANNEL_TYPES: ReadonlyArray<ChannelType> = ['slack', 'teams', 'discord', 'generic', 'pagerduty', 'opsgenie'];

export function isChannelType(value: unknown): value is ChannelType {
  return typeof value === 'string' && (CHANNEL_TYPES as ReadonlyArray<string>).includes(value);
}

export function asChannelType(value: unknown): ChannelType {
  return isChannelType(value) ? value : 'generic';
}
