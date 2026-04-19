# Outage-Map Roadmap

Proposed feature backlog for Outage-Map, ranked roughly by impact vs. effort.
Each item references the existing files it would touch so work can start
quickly without another round of discovery.

## Gaps Identified

- `SettingsView.tsx` references an `outage-map-alert-rules` key, but no UI or
  evaluator backs it.
- Email is the only alert channel — no Slack, Teams, or webhook support.
- No tests, no CI, no auth.
- No exportable reports (PDF/CSV).
- Heat-map regional data is simulated, not real per-region Downdetector data.
- No dependency graph, SLA tracking, or postmortem artifacts.

---

## Wave 1 — Foundations

### 1. Custom Alert Rules Engine
Lets users tune noise instead of getting every incident.
- New `alert_rules` SQLite table (service_id nullable=all, severity threshold,
  quiet hours, cooldown minutes, channel refs).
- `src/lib/alerts/rules.ts` evaluator called from `src/lib/poller.ts` before
  dispatch.
- UI in `src/components/SettingsView.tsx` — list/add/edit/delete rules.
- Reuses existing `db.ts` helpers and `email.ts` dispatch path.

### 2. Slack, Microsoft Teams, and Generic Webhooks
Enterprise teams live in chat, not email.
- `src/lib/notifiers/{slack,teams,webhook}.ts` with a common `Notifier`
  interface.
- Refactor `poller.ts` to fan out across configured notifiers.
- New env keys: `SLACK_WEBHOOK_URL`, `TEAMS_WEBHOOK_URL`, `WEBHOOK_URLS`.
- Settings UI to test-send per channel.

### 3. CI/CD and Test Harness
Zero tests today; every change is risky.
- Vitest + React Testing Library.
- Unit tests for `fetchers/*` (mocked HTTP), `db.ts`, future `anomaly.ts`.
- GitHub Actions workflow: lint, typecheck, test, docker build on PR.

---

## Wave 2 — High User Value

### 4. SLA Tracking and Monthly PDF/CSV Reports
Business stakeholders need exportable uptime evidence.
- New `/api/reports?month=YYYY-MM&format=pdf|csv` route.
- Compute from `status_history` (uptime %, MTTR, incident count, breach
  events).
- PDF via `@react-pdf/renderer`; CSV via a simple writer.
- New `sla_targets` table (per-service target %).
- Reuses analytics math already in `AnalyticsView.tsx`.

### 5. Anomaly Detection / Early Warning
Alerts today only fire after official status flips; Downdetector spikes are a
leading indicator.
- Rolling z-score on Downdetector `reports` stored in `status_history`.
- New severity `early-warning` when z > configurable threshold.
- `src/lib/anomaly.ts` invoked inside the poll cycle.

### 6. Maintenance Window Scheduling
Prevents alert storms during planned work and keeps SLA math honest.
- New `maintenance_windows` table (service_id, start_at, end_at, note).
- Poller suppresses alerts during an active window.
- Analytics excludes the window from MTTR / uptime calcs (configurable).
- Settings UI to schedule and cancel windows.

### 7. Push Notifications and PWA
SMTP is slow; ops teams want a phone ping.
- Register a service worker, add `manifest.json`, make the app installable.
- `web-push` library + `push_subscriptions` table.
- Push notifier adapter reuses the `Notifier` interface from #2.

---

## Wave 3 — Stretch

### 8. Service Dependency Graph
Cascading failures (e.g. Okta → Salesforce) are invisible today.
- New `dependencies` table (service_id, depends_on_service_id).
- New page `src/app/dependencies/page.tsx` with a `react-flow` graph.
- Highlight downstream risk when an upstream service degrades.

### 9. Downtime Cost Calculator
Converts engineering events into dollars leadership cares about.
- Per-service `cost_per_minute` and optional `affected_user_count` in
  settings.
- Analytics widget showing realtime + 30-day cost attributable to outages.
- Rolled into the SLA report (#4).

### 10. Incident Postmortem Generator
Post-incident writeups are toil; the data is already captured.
- `/api/postmortem/[incidentId]` returns a markdown doc (timeline, affected
  services, duration, Downdetector trend, correlated incidents).
- "Export Postmortem" button on `ServiceDetailView.tsx`.
- v1 is deterministic templating; optional LLM hook later.

### 11. Multi-User Auth and RBAC
Anyone with the URL currently sees everything; no per-user preferences.
- NextAuth.js with credentials + optional OIDC.
- `users`, `sessions`, `user_preferences` tables.
- Roles: `viewer`, `operator`, `admin`. Only `admin` edits rules and
  dependencies.
- Move per-user settings (pins, theme, refresh cadence) server-side.

### 12. Status History Comparison and Benchmarking
"Is Salesforce worse this month than last?" has no answer today.
- Analytics view: month-over-month and service-vs-service comparison charts.
- Toggle between absolute minutes down and % uptime delta.

### 13. Public Status Page and Embed
Share a curated view with customers or partners without exposing admin UI.
- `/status` route, no auth, configurable services to expose.
- `<iframe>`-embeddable widget at `/embed/[serviceId]`.
- ETag caching on the API responses.

### 14. Custom Service Registration
Only 7 services are hardcoded. Enterprises also care about GitHub, Okta, AWS,
Cloudflare, Datadog, Atlassian, and Slack itself.
- Extend `src/lib/fetchers/` with a generic Statuspage.io adapter (covers
  most providers).
- User-defined service form in Settings: name, status URL, parser type,
  optional Downdetector slug.
- New `custom_services` table merged with the static registry at runtime.

---

## Critical Files (touched by most features)

- `src/lib/db.ts` — schema migrations for new tables
- `src/lib/poller.ts` — alert rule evaluation, anomaly hook, notifier fanout,
  maintenance gating
- `src/lib/email.ts` → generalize into `src/lib/notifiers/`
- `src/lib/services.ts` — extend for custom services
- `src/components/SettingsView.tsx` — UI for rules, notifiers, SLA targets,
  maintenance, custom services
- `src/components/AnalyticsView.tsx` — SLA, cost, and comparison widgets
- `src/app/api/` — new routes: `reports`, `postmortem`, `push`,
  `dependencies`, `rules`
- `package.json` — new deps: `@react-pdf/renderer`, `web-push`, `reactflow`,
  `next-auth`, `vitest`

## Verification Checklist (per feature)

1. `npm run build` and `npm run lint` pass.
2. `docker compose up -d --build` starts without error; `/api/status` still
   returns all services.
3. Feature-specific smoke test (e.g. insert a fake outage → alert rule fires
   → Slack webhook receives payload).
4. Once #3 lands, `npm test` green in CI on every PR.
