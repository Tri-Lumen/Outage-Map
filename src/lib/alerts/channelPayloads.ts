import type { IncidentResult } from '../types';

function escapeMarkdown(text: string): string {
  return text.replace(/[*_~`]/g, (c) => `\\${c}`);
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  major: '#f59e0b',
  minor: '#6366f1',
};

// Slack Block Kit payload
export function buildSlackPayload(incident: IncidentResult, serviceName: string) {
  const color = SEVERITY_COLORS[incident.severity] ?? '#6b7280';
  return {
    text: `[${incident.severity.toUpperCase()}] ${escapeMarkdown(serviceName)}: ${escapeMarkdown(incident.title)}`,
    attachments: [
      {
        color,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${escapeMarkdown(serviceName)}*\n${escapeMarkdown(incident.title)}`,
            },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Severity*\n${incident.severity}` },
              { type: 'mrkdwn', text: `*Status*\n${incident.status}` },
              { type: 'mrkdwn', text: `*Started*\n${incident.startedAt ?? 'Unknown'}` },
              ...(incident.sourceUrl
                ? [{ type: 'mrkdwn', text: `*Source*\n<${incident.sourceUrl}|View>` }]
                : []),
            ],
          },
        ],
      },
    ],
  };
}

// Microsoft Teams MessageCard payload
export function buildTeamsPayload(incident: IncidentResult, serviceName: string) {
  const color = incident.severity === 'critical' ? 'attention' : incident.severity === 'major' ? 'warning' : 'accent';
  return {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    themeColor: SEVERITY_COLORS[incident.severity] ?? '#6b7280',
    summary: `[${incident.severity.toUpperCase()}] ${serviceName}: ${incident.title}`,
    sections: [
      {
        activityTitle: `**${serviceName}**`,
        activitySubtitle: incident.title,
        facts: [
          { name: 'Severity', value: incident.severity },
          { name: 'Status', value: incident.status },
          { name: 'Started', value: incident.startedAt ?? 'Unknown' },
          ...(incident.sourceUrl ? [{ name: 'Source', value: incident.sourceUrl }] : []),
        ],
      },
    ],
    potentialAction: incident.sourceUrl
      ? [{ '@type': 'OpenUri', name: 'View Incident', targets: [{ os: 'default', uri: incident.sourceUrl }] }]
      : [],
    color,
  };
}

// Discord embed payload
export function buildDiscordPayload(incident: IncidentResult, serviceName: string) {
  const colorHex = SEVERITY_COLORS[incident.severity] ?? '#6b7280';
  const colorInt = parseInt(colorHex.replace('#', ''), 16);
  return {
    content: `**[${incident.severity.toUpperCase()}]** ${serviceName}: ${incident.title}`,
    embeds: [
      {
        title: `${serviceName} — ${incident.title}`,
        color: colorInt,
        fields: [
          { name: 'Severity', value: incident.severity, inline: true },
          { name: 'Status', value: incident.status, inline: true },
          { name: 'Started', value: incident.startedAt ?? 'Unknown', inline: true },
          ...(incident.sourceUrl ? [{ name: 'Source', value: incident.sourceUrl, inline: false }] : []),
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

// Generic/legacy Slack-compatible payload
export function buildGenericPayload(incident: IncidentResult, serviceName: string) {
  const color = SEVERITY_COLORS[incident.severity] ?? '#6b7280';
  return {
    text: `[${incident.severity.toUpperCase()}] ${serviceName}: ${incident.title}`,
    attachments: [
      {
        color,
        title: `${serviceName} — ${incident.title}`,
        fields: [
          { title: 'Severity', value: incident.severity, short: true },
          { title: 'Status', value: incident.status, short: true },
          { title: 'Started', value: incident.startedAt || 'Unknown', short: true },
          ...(incident.sourceUrl ? [{ title: 'Source', value: incident.sourceUrl, short: false }] : []),
        ],
      },
    ],
    incident: {
      service: incident.serviceSlug,
      title: incident.title,
      severity: incident.severity,
      status: incident.status,
      startedAt: incident.startedAt,
      sourceUrl: incident.sourceUrl,
    },
  };
}

export function buildChannelPayload(
  channelType: string,
  incident: IncidentResult,
  serviceName: string,
): object {
  switch (channelType) {
    case 'slack': return buildSlackPayload(incident, serviceName);
    case 'teams': return buildTeamsPayload(incident, serviceName);
    case 'discord': return buildDiscordPayload(incident, serviceName);
    default: return buildGenericPayload(incident, serviceName);
  }
}
