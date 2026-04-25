import nodemailer from 'nodemailer';
import { hasRecentAlert, logAlert } from './db';
import { getServiceBySlug } from './services';
import { IncidentResult, ServiceStatus } from './types';
import { statusHex, statusLabel } from './statusColors';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : null;
}

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n\t]+/g, ' ').slice(0, 200);
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const rejectUnauthorized = process.env.SMTP_REJECT_UNAUTHORIZED !== 'false';

  if (!host || !user || !pass) {
    return null;
  }

  const isImplicitTls = port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure: isImplicitTls,
    requireTLS: !isImplicitTls,
    auth: { user, pass },
    tls: { rejectUnauthorized },
  });
}

function getEnvRecipients(): string[] {
  const emails = process.env.ALERT_EMAILS || '';
  return emails.split(',').map((e) => e.trim()).filter(Boolean);
}

function dedupe(emails: string[]): string[] {
  return Array.from(new Set(emails.filter(Boolean)));
}

function statusColor(status: ServiceStatus): string {
  return statusHex(status);
}

export async function sendIncidentAlert(
  incident: IncidentResult,
  recipientsOverride?: string[],
): Promise<boolean> {
  if (hasRecentAlert(incident.serviceSlug, incident.incidentId, 'new_incident')) {
    return false;
  }

  const transporter = getTransporter();
  const recipients = dedupe(recipientsOverride && recipientsOverride.length > 0
    ? recipientsOverride
    : getEnvRecipients());
  if (!transporter || recipients.length === 0) {
    if (process.env.DEBUG === 'true') {
      console.log('[email] SMTP not configured or no recipients - skipping alert');
    }
    return false;
  }

  const service = getServiceBySlug(incident.serviceSlug);
  const serviceName = service?.name || incident.serviceSlug;
  const safeSourceUrl = safeHref(incident.sourceUrl);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1e293b; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">Outage Dashboard Alert</h2>
      </div>
      <div style="border: 1px solid #e2e8f0; padding: 20px; border-radius: 0 0 8px 8px;">
        <div style="display: inline-block; background: ${statusColor(incident.severity === 'critical' ? 'down' : 'major_outage')}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 14px; font-weight: 600; margin-bottom: 16px;">
          ${escapeHtml(incident.severity.toUpperCase())} INCIDENT
        </div>
        <h3 style="margin: 0 0 8px 0; color: #1e293b;">${escapeHtml(serviceName)}</h3>
        <p style="font-size: 18px; margin: 0 0 16px 0; color: #334155;">${escapeHtml(incident.title)}</p>
        ${incident.description ? `<p style="color: #64748b; margin: 0 0 16px 0;">${escapeHtml(incident.description)}</p>` : ''}
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #64748b;">Status</td><td style="padding: 8px 0; font-weight: 600;">${escapeHtml(incident.status)}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Severity</td><td style="padding: 8px 0; font-weight: 600;">${escapeHtml(incident.severity)}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Started</td><td style="padding: 8px 0;">${escapeHtml(incident.startedAt || 'Unknown')}</td></tr>
          ${safeSourceUrl ? `<tr><td style="padding: 8px 0; color: #64748b;">Source</td><td style="padding: 8px 0;"><a href="${escapeHtml(safeSourceUrl)}">${escapeHtml(safeSourceUrl)}</a></td></tr>` : ''}
        </table>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;">
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">
          Sent by Enterprise Outage Dashboard at ${new Date().toISOString()}
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.ALERT_FROM || process.env.SMTP_USER,
      to: recipients.join(', '),
      subject: sanitizeHeader(`[${incident.severity.toUpperCase()}] ${serviceName}: ${incident.title}`),
      html,
    });

    logAlert(incident.serviceSlug, incident.incidentId, 'new_incident');
    console.log(`[email] Alert sent for ${serviceName}: ${incident.title}`);
    return true;
  } catch (err) {
    console.error('[email] Failed to send alert:', err);
    return false;
  }
}

export interface TestAlertResult {
  ok: boolean;
  reason?: 'smtp_not_configured' | 'invalid_email' | 'send_failed';
  detail?: string;
}

export async function sendTestAlert(email: string): Promise<TestAlertResult> {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, reason: 'invalid_email' };
  }

  const transporter = getTransporter();
  if (!transporter) {
    return { ok: false, reason: 'smtp_not_configured' };
  }

  const sentAt = new Date().toISOString();
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1e293b; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">Test notification</h2>
      </div>
      <div style="border: 1px solid #e2e8f0; padding: 20px; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 12px 0; color: #1e293b;">
          This is a test alert from the Outage Dashboard. If you're seeing it,
          your email channel is wired up correctly.
        </p>
        <p style="margin: 0; color: #64748b; font-size: 13px;">
          No service is currently affected — this message was triggered manually.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;">
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">
          Sent at ${escapeHtml(sentAt)}
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.ALERT_FROM || process.env.SMTP_USER,
      to: email,
      subject: sanitizeHeader('[TEST] Outage Dashboard notification'),
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error('[email] Test alert send failed:', err);
    return {
      ok: false,
      reason: 'send_failed',
      detail: err instanceof Error ? err.message : undefined,
    };
  }
}

export async function sendStatusChangeAlert(
  serviceSlug: string,
  oldStatus: ServiceStatus,
  newStatus: ServiceStatus
): Promise<boolean> {
  if (newStatus !== 'major_outage' && newStatus !== 'down') {
    return false;
  }

  if (hasRecentAlert(serviceSlug, null, 'status_change')) {
    return false;
  }

  const transporter = getTransporter();
  const recipients = dedupe(getEnvRecipients());
  if (!transporter || recipients.length === 0) return false;

  const service = getServiceBySlug(serviceSlug);
  const serviceName = service?.name || serviceSlug;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1e293b; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">Status Change Alert</h2>
      </div>
      <div style="border: 1px solid #e2e8f0; padding: 20px; border-radius: 0 0 8px 8px;">
        <h3 style="margin: 0 0 16px 0; color: #1e293b;">${escapeHtml(serviceName)}</h3>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <span style="background: ${statusColor(oldStatus)}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 14px;">${escapeHtml(statusLabel(oldStatus))}</span>
          <span style="font-size: 20px;">&rarr;</span>
          <span style="background: ${statusColor(newStatus)}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 14px; font-weight: 600;">${escapeHtml(statusLabel(newStatus))}</span>
        </div>
        <p style="color: #64748b;">The service status has changed. Please monitor the situation.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;">
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">
          Sent by Enterprise Outage Dashboard at ${new Date().toISOString()}
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.ALERT_FROM || process.env.SMTP_USER,
      to: recipients.join(', '),
      subject: sanitizeHeader(`[STATUS CHANGE] ${serviceName}: ${statusLabel(newStatus)}`),
      html,
    });

    logAlert(serviceSlug, null, 'status_change');
    return true;
  } catch (err) {
    console.error('[email] Failed to send status change alert:', err);
    return false;
  }
}
