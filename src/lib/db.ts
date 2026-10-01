import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { runMigrations } from './migrations';
import { isWindowActiveAt as isScheduleActiveAt } from './maintenanceSchedule';

const DB_PATH = process.env.DATABASE_PATH || './data/outage.db';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  // Wait up to 5 seconds when SQLite reports BUSY (e.g. the poll-cycle
  // transaction overlapping VACUUM or a concurrent reader). Without this,
  // writes from the poller can fail outright during the daily VACUUM and
  // drop a poll cycle's worth of status updates.
  db.pragma('busy_timeout = 5000');

  runMigrations(db);
  return db;
}

// Generic key/value settings store for server-readable, persisted config
// (digest schedule, anomaly sensitivity). Client-only preferences stay in
// localStorage; these are values the poller / cron need to read.
export function getAppSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setAppSetting(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    )
    .run(key, value);
}

export function getJsonSetting<T>(key: string, fallback: T): T {
  const raw = getAppSetting(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setJsonSetting(key: string, value: unknown): void {
  setAppSetting(key, JSON.stringify(value));
}

export function upsertServiceStatus(
  serviceSlug: string,
  source: 'official',
  status: string,
  details: string | null,
  reportCount: number | null = null,
) {
  // The is_anomaly / report_count columns remain on the table for backward
  // compatibility but are no longer maintained (Downdetector/anomaly removed);
  // they fall back to their column defaults.
  const db = getDb();
  db.prepare(`
    INSERT INTO service_status (service_slug, source, status, details, report_count, checked_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(service_slug, source) DO UPDATE SET
      status = excluded.status,
      details = excluded.details,
      report_count = excluded.report_count,
      checked_at = excluded.checked_at
  `).run(serviceSlug, source, status, details, reportCount);
}

export function insertStatusHistory(
  serviceSlug: string,
  status: string,
  incidentCount: number = 0,
) {
  const db = getDb();
  db.prepare(`
    INSERT INTO status_history (service_slug, status, incident_count, recorded_at)
    VALUES (?, ?, ?, datetime('now'))
  `).run(serviceSlug, status, incidentCount);
}

export function upsertIncident(
  serviceSlug: string,
  incidentId: string,
  title: string,
  status: string,
  severity: string,
  startedAt: string | null,
  resolvedAt: string | null,
  description: string | null,
  sourceUrl: string | null
): { isNew: boolean } {
  const db = getDb();
  const existing = db.prepare(
    'SELECT id FROM incidents WHERE service_slug = ? AND incident_id = ?'
  ).get(serviceSlug, incidentId);

  if (existing) {
    db.prepare(`
      UPDATE incidents SET
        title = ?, status = ?, severity = ?, started_at = ?,
        resolved_at = ?, description = ?, source_url = ?,
        updated_at = datetime('now')
      WHERE service_slug = ? AND incident_id = ?
    `).run(title, status, severity, startedAt, resolvedAt, description, sourceUrl, serviceSlug, incidentId);
    return { isNew: false };
  }

  db.prepare(`
    INSERT INTO incidents (service_slug, incident_id, title, status, severity,
      started_at, resolved_at, description, source_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(serviceSlug, incidentId, title, status, severity, startedAt, resolvedAt, description, sourceUrl);
  return { isNew: true };
}

export function getServiceStatuses() {
  const db = getDb();
  return db.prepare('SELECT * FROM service_status ORDER BY service_slug, source').all() as Array<{
    service_slug: string;
    source: string;
    status: string;
    details: string | null;
    report_count: number | null;
    checked_at: string;
  }>;
}

export function getActiveIncidentCounts(): Record<string, number> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT service_slug, COUNT(*) as count
    FROM incidents
    WHERE resolved_at IS NULL
    GROUP BY service_slug
  `).all() as Array<{ service_slug: string; count: number }>;
  const out: Record<string, number> = {};
  for (const r of rows) out[r.service_slug] = r.count;
  return out;
}

export type IncidentRow = {
  id: number;
  service_slug: string;
  incident_id: string;
  title: string;
  status: string;
  severity: string;
  started_at: string | null;
  resolved_at: string | null;
  description: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
};

export function getRecentIncidents(days: number = 7) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM incidents
    WHERE created_at >= datetime('now', '-' || ? || ' days')
    ORDER BY started_at DESC, created_at DESC
  `).all(days) as IncidentRow[];
}

export function getPaginatedIncidents(opts: {
  days?: number;
  service?: string | null;
  limit?: number;
  offset?: number;
  since?: string | null;
  q?: string | null;
  severities?: string[] | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  cursor?: string | null;
}): { incidents: IncidentRow[]; total: number; nextCursor: string | null } {
  const db = getDb();
  const {
    days = 7,
    service = null,
    limit = 50,
    offset = 0,
    since = null,
    q = null,
    severities = null,
    dateFrom = null,
    dateTo = null,
    cursor = null,
  } = opts;

  const conditions: string[] = [];
  const params: Array<string | number> = [];

  // Date range: cursor-based scroll skips the days/date-range window entirely
  // (it walks the full matching set page by page instead).
  if (!cursor) {
    if (dateFrom || dateTo) {
      if (dateFrom) { conditions.push('i.created_at >= ?'); params.push(dateFrom); }
      if (dateTo) { conditions.push('i.created_at <= ?'); params.push(dateTo); }
    } else {
      conditions.push(`i.created_at >= datetime('now', '-' || ? || ' days')`);
      params.push(days);
    }
  }

  if (service) {
    conditions.push('i.service_slug = ?');
    params.push(service);
  }
  if (since) {
    conditions.push('i.updated_at > ?');
    params.push(since);
  }
  if (severities && severities.length > 0) {
    const placeholders = severities.map(() => '?').join(', ');
    conditions.push(`i.severity IN (${placeholders})`);
    params.push(...severities);
  }

  let fromClause = 'FROM incidents i';
  if (q && q.trim()) {
    fromClause = 'FROM incidents i JOIN incidents_fts fts ON i.id = fts.rowid';
    conditions.push('incidents_fts MATCH ?');
    params.push(q.trim() + '*');
  }

  // `total` reflects only the filters above (service/severities/q/date range),
  // not the cursor position, so it stays stable across pages of the same scroll.
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) as n ${fromClause} ${where}`).get(...params) as { n: number }).n;

  // The page query additionally filters by cursor, encoded as
  // "<started_at>|<created_at>|<id>" — the same tuple the ORDER BY sorts on —
  // so paging can't skip or duplicate rows the way a single updated_at cursor
  // could when updated_at doesn't track the sort key.
  const pageConditions = [...conditions];
  const pageParams = [...params];
  if (cursor) {
    const [cStarted, cCreated, cId] = cursor.split('|');
    pageConditions.push(`(COALESCE(i.started_at, ''), i.created_at, i.id) < (?, ?, ?)`);
    pageParams.push(cStarted ?? '', cCreated ?? '', Number(cId) || 0);
  }
  const pageWhere = pageConditions.length > 0 ? `WHERE ${pageConditions.join(' AND ')}` : '';

  const incidents = db.prepare(
    `SELECT i.* ${fromClause} ${pageWhere} ORDER BY i.started_at DESC, i.created_at DESC, i.id DESC LIMIT ? OFFSET ?`
  ).all(...pageParams, limit, offset) as IncidentRow[];

  const last = incidents[incidents.length - 1];
  const nextCursor = incidents.length === limit && last
    ? `${last.started_at ?? ''}|${last.created_at}|${last.id}`
    : null;

  return { incidents, total, nextCursor };
}

export function getStatusHistory(
  serviceSlug: string | null,
  days: number = 30,
  from?: string | null,
  to?: string | null,
) {
  const db = getDb();
  type HistoryRow = {
    service_slug: string;
    status: string;
    report_count: number;
    incident_count: number;
    recorded_at: string;
  };

  if (from && to) {
    const clause = serviceSlug
      ? 'WHERE service_slug = ? AND recorded_at >= ? AND recorded_at <= ?'
      : 'WHERE recorded_at >= ? AND recorded_at <= ?';
    const params = serviceSlug ? [serviceSlug, from, to] : [from, to];
    return db.prepare(
      `SELECT service_slug, status, report_count, incident_count, recorded_at FROM status_history ${clause} ORDER BY recorded_at ASC`
    ).all(...params) as HistoryRow[];
  }

  if (serviceSlug) {
    return db.prepare(`
      SELECT service_slug, status, report_count, incident_count, recorded_at
      FROM status_history
      WHERE service_slug = ? AND recorded_at >= datetime('now', '-' || ? || ' days')
      ORDER BY recorded_at ASC
    `).all(serviceSlug, days) as HistoryRow[];
  }
  return db.prepare(`
    SELECT service_slug, status, report_count, incident_count, recorded_at
    FROM status_history
    WHERE recorded_at >= datetime('now', '-' || ? || ' days')
    ORDER BY recorded_at ASC
  `).all(days) as HistoryRow[];
}

// --- Alert dedup & escalation (I1) ---

export interface AlertEscalationState {
  shouldAlert: boolean;
  nextLevel: number;
}

export function getAlertEscalationState(
  serviceSlug: string,
  incidentId: string | null,
  alertType: string,
  escalationIntervals: number[] = [60],
): AlertEscalationState {
  const db = getDb();
  const row = db.prepare(`
    SELECT escalation_level, sent_at FROM alert_log
    WHERE service_slug = ? AND (incident_id = ? OR (incident_id IS NULL AND ? IS NULL))
      AND alert_type = ?
    ORDER BY sent_at DESC LIMIT 1
  `).get(serviceSlug, incidentId, incidentId, alertType) as { escalation_level: number; sent_at: string } | undefined;

  if (!row) return { shouldAlert: true, nextLevel: 1 };

  const level = row.escalation_level;
  const intervalMinutes = escalationIntervals[level - 1] ?? escalationIntervals[escalationIntervals.length - 1];
  const elapsedMs = Date.now() - new Date(row.sent_at).getTime();
  const intervalMs = intervalMinutes * 60 * 1000;

  if (elapsedMs >= intervalMs) {
    return { shouldAlert: true, nextLevel: level + 1 };
  }
  return { shouldAlert: false, nextLevel: level };
}

export function hasRecentAlert(serviceSlug: string, incidentId: string | null, alertType: string): boolean {
  return !getAlertEscalationState(serviceSlug, incidentId, alertType, [60]).shouldAlert;
}

export function logAlert(
  serviceSlug: string,
  incidentId: string | null,
  alertType: string,
  escalationLevel: number = 1,
) {
  const db = getDb();
  db.prepare(`
    INSERT INTO alert_log (service_slug, incident_id, alert_type, escalation_level)
    VALUES (?, ?, ?, ?)
  `).run(serviceSlug, incidentId, alertType, escalationLevel);
}

export function getRecentAlertLog(limit = 100) {
  const db = getDb();
  return db.prepare(`
    SELECT id, service_slug, incident_id, alert_type, escalation_level, sent_at
    FROM alert_log ORDER BY sent_at DESC LIMIT ?
  `).all(limit) as Array<{
    id: number;
    service_slug: string;
    incident_id: string | null;
    alert_type: string;
    escalation_level: number;
    sent_at: string;
  }>;
}

export function cleanupOldHistory(days: number = 35) {
  const db = getDb();
  db.prepare(`
    DELETE FROM status_history WHERE recorded_at < datetime('now', '-' || ? || ' days')
  `).run(days);
  db.prepare(`
    DELETE FROM fetcher_latency WHERE recorded_at < datetime('now', '-2 days')
  `).run();
}

export function cleanupOldIncidents(days: number = 90) {
  const db = getDb();
  // Only prune resolved incidents past the retention window — unresolved ones
  // must stay visible regardless of age.
  const result = db.prepare(`
    DELETE FROM incidents
    WHERE resolved_at IS NOT NULL
      AND created_at < datetime('now', '-' || ? || ' days')
  `).run(days);
  return result.changes;
}

export function vacuumDb() {
  const db = getDb();
  db.exec('VACUUM;');
}

// --- Alert Rules ---

export interface AlertRuleRow {
  id: string;
  email: string;
  services: string;
  min_severity: string;
  email_enabled: number;
  webhook_url: string | null;
  webhook_enabled: number;
  channel_type: string;
  escalation_enabled: number;
  escalation_intervals: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

const RULE_COLS = [
  'id', 'email', 'services', 'min_severity', 'email_enabled',
  'webhook_url', 'webhook_enabled', 'channel_type',
  'escalation_enabled', 'escalation_intervals',
  'enabled', 'created_at', 'updated_at',
].join(', ');

export function listAlertRules(): AlertRuleRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT ${RULE_COLS} FROM alert_rules ORDER BY created_at DESC
  `).all() as AlertRuleRow[];
}

export function listEnabledAlertRules(): AlertRuleRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT ${RULE_COLS} FROM alert_rules WHERE enabled = 1
  `).all() as AlertRuleRow[];
}

export function insertAlertRule(row: {
  id: string;
  email: string;
  services: string;
  minSeverity: string;
  emailEnabled: boolean;
  webhookUrl?: string | null;
  webhookEnabled?: boolean;
  channelType?: string;
  escalationEnabled?: boolean;
  escalationIntervals?: number[];
  enabled: boolean;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO alert_rules (
      id, email, services, min_severity, email_enabled,
      webhook_url, webhook_enabled, channel_type,
      escalation_enabled, escalation_intervals, enabled
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.id,
    row.email,
    row.services,
    row.minSeverity,
    row.emailEnabled ? 1 : 0,
    row.webhookUrl ?? null,
    row.webhookEnabled ? 1 : 0,
    row.channelType ?? 'generic',
    row.escalationEnabled ? 1 : 0,
    JSON.stringify(row.escalationIntervals ?? [240, 1440]),
    row.enabled ? 1 : 0,
  );
}

export function updateAlertRule(
  id: string,
  patch: Partial<{
    email: string;
    services: string;
    minSeverity: string;
    emailEnabled: boolean;
    webhookUrl: string | null;
    webhookEnabled: boolean;
    channelType: string;
    escalationEnabled: boolean;
    escalationIntervals: number[];
    enabled: boolean;
  }>,
): boolean {
  const db = getDb();
  const fields: string[] = [];
  const values: Array<string | number | null> = [];
  if (patch.email !== undefined) { fields.push('email = ?'); values.push(patch.email); }
  if (patch.services !== undefined) { fields.push('services = ?'); values.push(patch.services); }
  if (patch.minSeverity !== undefined) { fields.push('min_severity = ?'); values.push(patch.minSeverity); }
  if (patch.emailEnabled !== undefined) { fields.push('email_enabled = ?'); values.push(patch.emailEnabled ? 1 : 0); }
  if (patch.webhookUrl !== undefined) { fields.push('webhook_url = ?'); values.push(patch.webhookUrl); }
  if (patch.webhookEnabled !== undefined) { fields.push('webhook_enabled = ?'); values.push(patch.webhookEnabled ? 1 : 0); }
  if (patch.channelType !== undefined) { fields.push('channel_type = ?'); values.push(patch.channelType); }
  if (patch.escalationEnabled !== undefined) { fields.push('escalation_enabled = ?'); values.push(patch.escalationEnabled ? 1 : 0); }
  if (patch.escalationIntervals !== undefined) { fields.push('escalation_intervals = ?'); values.push(JSON.stringify(patch.escalationIntervals)); }
  if (patch.enabled !== undefined) { fields.push('enabled = ?'); values.push(patch.enabled ? 1 : 0); }
  if (fields.length === 0) return false;
  fields.push(`updated_at = datetime('now')`);
  values.push(id);
  const result = db.prepare(`UPDATE alert_rules SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return result.changes > 0;
}

export function deleteAlertRule(id: string): boolean {
  const db = getDb();
  return db.prepare('DELETE FROM alert_rules WHERE id = ?').run(id).changes > 0;
}

// --- Custom Services ---

export interface CustomServiceRow {
  id: string;
  slug: string;
  name: string;
  color: string;
  status_url: string;
  downdetector_slug: string | null;
  fetcher: string;
  brand_font: string;
  refresh_seconds: number;
  kind: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export function listCustomServices(): CustomServiceRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT id, slug, name, color, status_url, downdetector_slug, fetcher,
      brand_font, refresh_seconds, kind, enabled, created_at, updated_at
    FROM custom_services
    ORDER BY created_at DESC
  `).all() as CustomServiceRow[];
}

export function listEnabledCustomServices(): CustomServiceRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT id, slug, name, color, status_url, downdetector_slug, fetcher,
      brand_font, refresh_seconds, kind, enabled, created_at, updated_at
    FROM custom_services
    WHERE enabled = 1
    ORDER BY created_at DESC
  `).all() as CustomServiceRow[];
}

export function getCustomServiceById(id: string): CustomServiceRow | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, slug, name, color, status_url, downdetector_slug, fetcher,
      brand_font, refresh_seconds, kind, enabled, created_at, updated_at
    FROM custom_services WHERE id = ?
  `).get(id) as CustomServiceRow | undefined;
  return row ?? null;
}

export function getCustomServiceBySlug(slug: string): CustomServiceRow | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, slug, name, color, status_url, downdetector_slug, fetcher,
      brand_font, refresh_seconds, kind, enabled, created_at, updated_at
    FROM custom_services WHERE slug = ?
  `).get(slug) as CustomServiceRow | undefined;
  return row ?? null;
}

export function insertCustomService(row: {
  id: string;
  slug: string;
  name: string;
  color: string;
  statusUrl: string;
  downdetectorSlug: string | null;
  fetcher: string;
  brandFont: string;
  refreshSeconds: number;
  kind: string;
  enabled: boolean;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO custom_services (id, slug, name, color, status_url,
      downdetector_slug, fetcher, brand_font, refresh_seconds, kind, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.id,
    row.slug,
    row.name,
    row.color,
    row.statusUrl,
    row.downdetectorSlug,
    row.fetcher,
    row.brandFont,
    row.refreshSeconds,
    row.kind,
    row.enabled ? 1 : 0,
  );
}

export function updateCustomService(
  id: string,
  patch: Partial<{
    name: string;
    color: string;
    statusUrl: string;
    downdetectorSlug: string | null;
    refreshSeconds: number;
    enabled: boolean;
  }>,
): boolean {
  const db = getDb();
  const fields: string[] = [];
  const values: Array<string | number | null> = [];
  if (patch.name !== undefined) { fields.push('name = ?'); values.push(patch.name); }
  if (patch.color !== undefined) { fields.push('color = ?'); values.push(patch.color); }
  if (patch.statusUrl !== undefined) { fields.push('status_url = ?'); values.push(patch.statusUrl); }
  if (patch.downdetectorSlug !== undefined) { fields.push('downdetector_slug = ?'); values.push(patch.downdetectorSlug); }
  if (patch.refreshSeconds !== undefined) { fields.push('refresh_seconds = ?'); values.push(patch.refreshSeconds); }
  if (patch.enabled !== undefined) { fields.push('enabled = ?'); values.push(patch.enabled ? 1 : 0); }
  if (fields.length === 0) return false;
  fields.push(`updated_at = datetime('now')`);
  values.push(id);
  const result = db.prepare(`UPDATE custom_services SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return result.changes > 0;
}

export function deleteCustomService(id: string): boolean {
  const db = getDb();
  return db.prepare('DELETE FROM custom_services WHERE id = ?').run(id).changes > 0;
}

// Drop status, history, and incident rows for a service slug. Called when a
// custom service is removed so a future slug re-use doesn't inherit the
// previous service's history. Wrapped in a transaction so partial failure
// leaves no half-deleted state.
export function cleanupServiceData(slug: string): void {
  const db = getDb();
  const tx = db.transaction((s: string) => {
    db.prepare('DELETE FROM service_status WHERE service_slug = ?').run(s);
    db.prepare('DELETE FROM status_history WHERE service_slug = ?').run(s);
    db.prepare('DELETE FROM incidents WHERE service_slug = ?').run(s);
  });
  tx(slug);
}

// --- Maintenance Windows (F3) ---

export interface MaintenanceWindowRow {
  id: string;
  service_slugs: string;
  start_time: string;
  end_time: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
  recurrence: string;
  recurrence_until: string | null;
}

const MAINT_COLS = 'id, service_slugs, start_time, end_time, note, created_by, created_at, recurrence, recurrence_until';

export function isWindowActiveAt(row: MaintenanceWindowRow, at: Date): boolean {
  return isScheduleActiveAt(
    { startTime: row.start_time, endTime: row.end_time, recurrence: row.recurrence, recurrenceUntil: row.recurrence_until },
    at,
  );
}

export function listMaintenanceWindows(): MaintenanceWindowRow[] {
  const db = getDb();
  return db.prepare(
    `SELECT ${MAINT_COLS} FROM maintenance_windows ORDER BY start_time ASC`
  ).all() as MaintenanceWindowRow[];
}

export function listActiveMaintenanceWindows(): MaintenanceWindowRow[] {
  const db = getDb();
  // Narrows out one-off windows that can never be active again; every
  // weekly row still needs the JS check above since its original
  // start/end only describe its first occurrence.
  const candidates = db.prepare(`
    SELECT ${MAINT_COLS} FROM maintenance_windows
    WHERE recurrence = 'weekly' OR (start_time <= datetime('now') AND end_time >= datetime('now'))
  `).all() as MaintenanceWindowRow[];
  const now = new Date();
  return candidates.filter((w) => isWindowActiveAt(w, now));
}

export function isServiceInMaintenance(serviceSlug: string): boolean {
  return listActiveMaintenanceWindows().some(
    (w) => w.service_slugs === '[]' || w.service_slugs.includes(`"${serviceSlug}"`),
  );
}

export function insertMaintenanceWindow(row: {
  id: string;
  serviceSlugs: string[];
  startTime: string;
  endTime: string;
  note?: string | null;
  createdBy?: string | null;
  recurrence?: 'none' | 'weekly';
  recurrenceUntil?: string | null;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO maintenance_windows
      (id, service_slugs, start_time, end_time, note, created_by, recurrence, recurrence_until)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.id,
    JSON.stringify(row.serviceSlugs),
    row.startTime,
    row.endTime,
    row.note ?? null,
    row.createdBy ?? null,
    row.recurrence ?? 'none',
    row.recurrenceUntil ?? null,
  );
}

export function updateMaintenanceWindow(
  id: string,
  patch: Partial<{
    serviceSlugs: string[];
    startTime: string;
    endTime: string;
    note: string | null;
    recurrence: 'none' | 'weekly';
    recurrenceUntil: string | null;
  }>,
): boolean {
  const db = getDb();
  const fields: string[] = [];
  const values: Array<string | null> = [];
  if (patch.serviceSlugs !== undefined) { fields.push('service_slugs = ?'); values.push(JSON.stringify(patch.serviceSlugs)); }
  if (patch.startTime !== undefined) { fields.push('start_time = ?'); values.push(patch.startTime); }
  if (patch.endTime !== undefined) { fields.push('end_time = ?'); values.push(patch.endTime); }
  if (patch.note !== undefined) { fields.push('note = ?'); values.push(patch.note); }
  if (patch.recurrence !== undefined) { fields.push('recurrence = ?'); values.push(patch.recurrence); }
  if (patch.recurrenceUntil !== undefined) { fields.push('recurrence_until = ?'); values.push(patch.recurrenceUntil); }
  if (fields.length === 0) return false;
  values.push(id);
  return db.prepare(`UPDATE maintenance_windows SET ${fields.join(', ')} WHERE id = ?`).run(...values).changes > 0;
}

export function deleteMaintenanceWindow(id: string): boolean {
  const db = getDb();
  return db.prepare('DELETE FROM maintenance_windows WHERE id = ?').run(id).changes > 0;
}

// --- Fetcher Latency (I9) ---

export function insertFetcherLatency(serviceSlug: string, source: string, latencyMs: number): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO fetcher_latency (service_slug, source, latency_ms)
    VALUES (?, ?, ?)
  `).run(serviceSlug, source, latencyMs);
}

export function getFetcherLatency24h(serviceSlug: string, source: string): Array<{ latency_ms: number; recorded_at: string }> {
  const db = getDb();
  return db.prepare(`
    SELECT latency_ms, recorded_at FROM fetcher_latency
    WHERE service_slug = ? AND source = ? AND recorded_at >= datetime('now', '-24 hours')
    ORDER BY recorded_at ASC
  `).all(serviceSlug, source) as Array<{ latency_ms: number; recorded_at: string }>;
}

// --- Server-side Board Sync (I4) ---

export interface BoardRow {
  id: string;
  device_token: string;
  board_id: string;
  name: string;
  starred: number;
  tiles: string;
  theme: string | null;
  updated_at: string;
}

export function getBoardsByDevice(deviceToken: string): BoardRow[] {
  const db = getDb();
  return db.prepare(
    `SELECT id, device_token, board_id, name, starred, tiles, theme, updated_at
     FROM boards WHERE device_token = ? ORDER BY updated_at DESC`
  ).all(deviceToken) as BoardRow[];
}

export function upsertBoard(row: {
  deviceToken: string;
  boardId: string;
  name: string;
  starred: boolean;
  tiles: string;
  theme?: string | null;
}): void {
  const db = getDb();
  const id = `${row.deviceToken}:${row.boardId}`;
  db.prepare(`
    INSERT INTO boards (id, device_token, board_id, name, starred, tiles, theme, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(device_token, board_id) DO UPDATE SET
      name = excluded.name,
      starred = excluded.starred,
      tiles = excluded.tiles,
      theme = excluded.theme,
      updated_at = excluded.updated_at
  `).run(id, row.deviceToken, row.boardId, row.name, row.starred ? 1 : 0, row.tiles, row.theme ?? null);
}

export function deleteBoard(deviceToken: string, boardId: string): boolean {
  const db = getDb();
  return db.prepare('DELETE FROM boards WHERE device_token = ? AND board_id = ?')
    .run(deviceToken, boardId).changes > 0;
}

// Replaces a device's full board set in one transaction: deletes rows not
// present in `boards`, then upserts each one. A partial failure (bad data,
// a constraint violation) rolls back the whole sync instead of leaving the
// device with some boards deleted and others not yet upserted.
export function syncBoardsForDevice(
  deviceToken: string,
  boards: Array<{ boardId: string; name: string; starred: boolean; tiles: string; theme?: string | null }>,
): void {
  const db = getDb();
  const tx = db.transaction(() => {
    const existing = db.prepare('SELECT board_id FROM boards WHERE device_token = ?')
      .all(deviceToken) as Array<{ board_id: string }>;
    const newIds = new Set(boards.map((b) => b.boardId));
    for (const row of existing) {
      if (!newIds.has(row.board_id)) {
        db.prepare('DELETE FROM boards WHERE device_token = ? AND board_id = ?').run(deviceToken, row.board_id);
      }
    }
    for (const b of boards) {
      upsertBoard({ deviceToken, ...b });
    }
  });
  tx();
}

// --- Push Subscriptions (F6) ---

export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
}

export function listPushSubscriptions(): PushSubscriptionRow[] {
  const db = getDb();
  return db.prepare('SELECT id, endpoint, p256dh, auth, user_agent, created_at FROM push_subscriptions').all() as PushSubscriptionRow[];
}

export function upsertPushSubscription(row: {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, user_agent)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent = excluded.user_agent
  `).run(row.id, row.endpoint, row.p256dh, row.auth, row.userAgent ?? null);
}

export function deletePushSubscription(endpoint: string): boolean {
  const db = getDb();
  return db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint).changes > 0;
}

// --- Postmortems (F7) ---

export interface PostmortemRow {
  id: string;
  incident_db_id: number;
  content: string;
  generated_at: string;
  last_edited_at: string | null;
  exported_at: string | null;
}

export function getPostmortemByIncidentId(incidentDbId: number): PostmortemRow | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT id, incident_db_id, content, generated_at, last_edited_at, exported_at FROM postmortems WHERE incident_db_id = ?'
  ).get(incidentDbId) as PostmortemRow | undefined;
  return row ?? null;
}

export function insertPostmortem(row: { id: string; incidentDbId: number; content: string }): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO postmortems (id, incident_db_id, content)
    VALUES (?, ?, ?)
  `).run(row.id, row.incidentDbId, row.content);
}

export function updatePostmortem(id: string, content: string): boolean {
  const db = getDb();
  return db.prepare(
    `UPDATE postmortems SET content = ?, last_edited_at = datetime('now') WHERE id = ?`
  ).run(content, id).changes > 0;
}

export function markPostmortemExported(id: string): void {
  const db = getDb();
  db.prepare(`UPDATE postmortems SET exported_at = datetime('now') WHERE id = ?`).run(id);
}

export function getIncidentById(id: number): IncidentRow | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as IncidentRow | undefined;
  return row ?? null;
}

export function getActiveUnresolvedIncidents(olderThanHours: number = 4): IncidentRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM incidents
    WHERE resolved_at IS NULL
      AND created_at <= datetime('now', '-' || ? || ' hours')
    ORDER BY created_at ASC
  `).all(olderThanHours) as IncidentRow[];
}
