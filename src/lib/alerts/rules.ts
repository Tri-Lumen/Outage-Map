import { listEnabledAlertRules, type AlertRuleRow } from '../db';
import type { AlertRule, IncidentResult, IncidentSeverity } from '../types';
import { asIncidentSeverity } from '../types';

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

export function rowToRule(row: AlertRuleRow): AlertRule {
  return {
    id: row.id,
    email: row.email,
    services: parseServices(row.services),
    minSeverity: asIncidentSeverity(row.min_severity),
    emailEnabled: row.email_enabled === 1,
    webhookUrl: row.webhook_url ?? null,
    webhookEnabled: row.webhook_enabled === 1,
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
 * Returns deduplicated webhook URLs whose enabled rules match the incident.
 */
export function evaluateRulesForWebhook(incident: IncidentResult): string[] {
  const rules = listEnabledAlertRules().map(rowToRule);
  const matched = new Set<string>();
  for (const rule of rules) {
    if (!rule.webhookEnabled || !rule.webhookUrl) continue;
    if (!ruleMatchesIncident(rule, incident)) continue;
    matched.add(rule.webhookUrl);
  }
  return Array.from(matched);
}
