// One-off demo seeder: populates the local SQLite with plausible status and
// incident rows so the dev server has something to render when external
// fetchers are blocked. Safe to re-run — upserts by (service_slug, source)
// and (service_slug, incident_id).

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || './data/outage.db';
const db = new Database(DB_PATH);

const now = () => new Date().toISOString().replace('T', ' ').replace('Z', '').split('.')[0];

const services = [
  { slug: 'microsoft-365',   official: 'degraded',     dd: 'degraded',     reports: 820,  incidents: 1 },
  { slug: 'adobe-cc',        official: 'operational',  dd: 'operational',  reports: 42,   incidents: 0 },
  { slug: 'servicenow',      official: 'operational',  dd: 'operational',  reports: 15,   incidents: 0 },
  { slug: 'salesforce',      official: 'degraded',     dd: 'degraded',     reports: 310,  incidents: 1 },
  { slug: 'workday',         official: 'operational',  dd: 'operational',  reports: 8,    incidents: 0 },
  { slug: 'zoom',            official: 'operational',  dd: 'operational',  reports: 120,  incidents: 0 },
  { slug: 'google-workspace',official: 'operational',  dd: 'operational',  reports: 65,   incidents: 0 },
  { slug: 'slack',           official: 'major_outage', dd: 'major_outage', reports: 2140, incidents: 2 },
  { slug: 'github',          official: 'operational',  dd: 'operational',  reports: 95,   incidents: 0 },
  { slug: 'atlassian',       official: 'degraded',     dd: 'operational',  reports: 180,  incidents: 1 },
  { slug: 'okta',            official: 'operational',  dd: 'operational',  reports: 22,   incidents: 0 },
  { slug: 'cloudflare',      official: 'operational',  dd: 'operational',  reports: 410,  incidents: 0 },
  { slug: 'dropbox',         official: 'operational',  dd: 'operational',  reports: 30,   incidents: 0 },
  { slug: 'aws',             official: 'degraded',     dd: 'operational',  reports: 260,  incidents: 3 },
];

const upsertStatus = db.prepare(`
  INSERT INTO service_status (service_slug, source, status, details, report_count, checked_at)
  VALUES (?, ?, ?, ?, ?, datetime('now'))
  ON CONFLICT(service_slug, source) DO UPDATE SET
    status = excluded.status,
    details = excluded.details,
    report_count = excluded.report_count,
    checked_at = excluded.checked_at
`);

const upsertIncident = db.prepare(`
  INSERT INTO incidents (service_slug, incident_id, title, status, severity, started_at, resolved_at, description, source_url)
  VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
  ON CONFLICT(service_slug, incident_id) DO UPDATE SET
    status = excluded.status,
    severity = excluded.severity,
    started_at = excluded.started_at,
    resolved_at = NULL,
    description = excluded.description,
    updated_at = datetime('now')
`);

const incidentTemplates = {
  'microsoft-365': [
    { title: 'Exchange Online — mail flow delays in EU-West', severity: 'major', desc: 'Users may experience delays sending or receiving email.' },
  ],
  'salesforce': [
    { title: 'Lightning Experience slowness on NA14', severity: 'major', desc: 'Elevated latency observed on NA14 pod.' },
  ],
  'slack': [
    { title: 'Messages failing to send across multiple workspaces', severity: 'critical', desc: 'Engineers investigating elevated error rate.' },
    { title: 'Huddles dropping intermittently', severity: 'major', desc: 'Some users report huddle disconnects.' },
  ],
  'atlassian': [
    { title: 'Jira Cloud — increased API latency', severity: 'major', desc: 'Monitoring elevated API response times.' },
  ],
  'aws': [
    { title: 'EC2 API error rates elevated in us-east-1', severity: 'major', desc: 'Engineers have identified the root cause.' },
    { title: 'S3 increased latency in eu-west-2', severity: 'minor', desc: 'Investigating.' },
    { title: 'CloudFront edge cache miss rate elevated', severity: 'minor', desc: 'Investigating.' },
  ],
};

db.transaction(() => {
  for (const s of services) {
    upsertStatus.run(s.slug, 'official', s.official, `Synthetic demo data (${s.official})`, null);
    upsertStatus.run(s.slug, 'downdetector', s.dd, `Synthetic demo data (${s.dd})`, s.reports);

    const tpl = incidentTemplates[s.slug] || [];
    for (let i = 0; i < s.incidents; i++) {
      const t = tpl[i] || { title: `${s.slug} ongoing issue #${i + 1}`, severity: 'major', desc: 'Synthetic demo incident.' };
      const started = new Date(Date.now() - (i + 1) * 45 * 60 * 1000).toISOString();
      upsertIncident.run(
        s.slug,
        `demo-${s.slug}-${i + 1}`,
        t.title,
        'investigating',
        t.severity,
        started,
        t.desc,
        'https://example.com/demo',
      );
    }
  }
})();

console.log(`Seeded ${services.length} services with demo status and incidents.`);
