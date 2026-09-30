import { listEnabledAlertRules, type AlertRuleRow, getAlertEscalationState, type IncidentRow } from '../db';
import type { AlertRule, IncidentResult, IncidentSeverity } from '../types';
import { asIncidentSeverity, asChannelType } from '../types';

const SEVERITY_RANK: Record<IncidentSeverity, number> = {
  minor: 1,
  major: 2,
  critical: 3,
};

function parseServices(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function parseIntervals(json: string): number[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [240, 1440];
  } catch {
    return [240, 1440];
  }
}

export function rowToRule(row: AlertRuleRow): AlertRule {
  return {
    id: row.id,
    email: row.email,
    services: parseServices(row.services),
    minSeverity: asIncidentSeverity(row.min_severity),
    emailEnabled: row.email_enabled === 1,
    webhookUrl: row.webhook_url ?? null,
    webhookEnabled: row.webhook_enabled === 1,
    channelType: asChannelType(row.channel_type),
    escalationEnabled: row.escalation_enabled === 1,
    escalationIntervals: parseIntervals(row.escalation_intervals),
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function ruleMatchesIncident(rule: AlertRule, incident: IncidentResult): boolean {
  if (SEVERITY_RANK[incident.severity] < SEVERITY_RANK[rule.minSeverity]) return false;
  if (rule.services.length > 0 && !rule.services.includes(incident.serviceSlug)) return false;
  return true;
}

/**
 * Returns deduplicated email recipients whose enabled rules match the incident.
 * Empty `services` on a rule means "all services".
 */
export function evaluateRulesForIncident(incident: IncidentResult): string[] {
  const rules = listEnabledAlertRules().map(rowToRule);
  const matched = new Set<string>();
  for (const rule of rules) {
    if (!rule.emailEnabled) continue;
    if (!ruleMatchesIncident(rule, incident)) continue;
    if (rule.email) matched.add(rule.email);
  }
  return Array.from(matched);
}

/**
 * Returns deduplicated webhook {url, channelType} pairs whose enabled rules match the incident.
 */
export function evaluateRulesForWebhook(incident: IncidentResult): { url: string; channelType: string }[] {
  const rules = listEnabledAlertRules().map(rowToRule);
  const matched = new Map<string, string>();
  for (const rule of rules) {
    if (!rule.webhookEnabled || !rule.webhookUrl) continue;
    if (!ruleMatchesIncident(rule, incident)) continue;
    if (!matched.has(rule.webhookUrl)) {
      matched.set(rule.webhookUrl, rule.channelType);
    }
  }
  return Array.from(matched.entries()).map(([url, channelType]) => ({ url, channelType }));
}

/**
 * Returns email recipients that should receive escalation alerts for a long-running incident.
 * Only used for incidents that are unresolved and older than escalationIntervals[0] minutes.
 */
export function evaluateRulesForEscalation(
  incident: IncidentRow,
): { email: string; level: number; escalationIntervals: number[] }[] {
  const rules = listEnabledAlertRules().map(rowToRule);
  const out: { email: string; level: number; escalationIntervals: number[] }[] = [];

  for (const rule of rules) {
    if (!rule.emailEnabled || !rule.escalationEnabled) continue;
    if (rule.services.length > 0 && !rule.services.includes(incident.service_slug)) continue;
    if (SEVERITY_RANK[asIncidentSeverity(incident.severity)] < SEVERITY_RANK[rule.minSeverity]) continue;

    const state = getAlertEscalationState(
      incident.service_slug,
      incident.incident_id,
      'new_incident',
      rule.escalationIntervals,
    );
    if (state.shouldAlert && rule.email) {
      out.push({ email: rule.email, level: state.nextLevel, escalationIntervals: rule.escalationIntervals });
    }
  }
  return out;
}
