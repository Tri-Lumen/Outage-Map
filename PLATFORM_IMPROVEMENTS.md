# Platform Improvements

Operability, reliability, and integration upgrades for Outage-Map. Scope is
intentionally distinct from the other two plans:

- `ROADMAP.md` covers product features (alerting, SLA reports, anomaly,
  postmortem, auth, dependency graph).
- `DASHBOARD_CUSTOMIZATION_PLAN.md` covers board / tile / theme UX.
- This doc covers everything else — how the tool behaves when something goes
  wrong, how it talks to the outside world, and how an operator runs it day
  to day.

Each item lists the files it would touch so work can start without another
discovery pass.

## Gaps Identified

- No internal metrics — when a fetcher silently breaks (Downdetector DOM
  drift, Statuspage incident schema change), the only signal is "0 reports
  for every service this cycle" buried in stdout (`poller.ts:188`).
- A flaky upstream is retried on every 3-minute cycle with no circuit
  breaker, no exponential backoff, and a hard 15 s timeout per request.
- `/api/health` is liveness-only; there's no readiness probe and no
  per-fetcher health surface.
- Client refresh is 30 s SWR polling. New incidents wait up to 30 s on the
  client even after the poller has stored them.
- Schema changes are hand-rolled `ALTER TABLE` calls in `db.ts:99-102`. No
  forward/backward versioning, no rollback story.
- No backup story for the SQLite volume. A corrupted file silently loses
  35 days of history.
- Downdetector parsing uses CSS-class heuristics with no schema check —
  when the page changes, we get `unknown` for every service and no alert
  fires.
- Webhooks (once #2 in `ROADMAP.md` lands) will be unsigned — any receiver
  has to trust the source IP.
- PagerDuty / Opsgenie / VictorOps users today have to glue the generic
  webhook to their incident schema by hand.
- No i18n; all strings are inline English. No timezone selection — server
  TZ leaks into every timestamp.
- Public consumers (status badges, calendar feeds) have no surface to
  embed Outage-Map data outside the dashboard.

---

## Wave 1 — Make failure visible

### 1. Prometheus `/metrics` endpoint
Counts and histograms that let an operator see whether the tool itself is
healthy, separate from whether the *monitored* services are healthy.
- New route `src/app/api/metrics/route.ts` exposing text-format metrics
  (no extra dep needed — emit by hand, the surface is small).
- Counters: `outage_poll_cycles_total{result}`,
  `outage_fetcher_failures_total{service,source}`,
  `outage_alerts_sent_total{channel,severity}`.
- Histograms: `outage_fetcher_latency_seconds{service,source}`,
  `outage_poll_cycle_duration_seconds`.
- Gauges: `outage_service_status{service,source}` (0=operational,
  1=degraded, 2=major, 3=unknown), `outage_last_poll_age_seconds`.
- Wire in `src/lib/metrics.ts` (a thin in-memory registry). Increment from
  `poller.ts`, each `fetchers/*.ts`, and the notifier paths.

### 2. Per-fetcher health surface + readiness probe
Today a single broken fetcher is hidden by the success of the other 13.
- Track last success / last error / last latency per `(service, source)`
  in `service_health` (in-memory; rebuilt each restart). Persist via a
  new table only if history matters (defer).
- `/api/health` becomes `?probe=live|ready` — `live` keeps current
  behavior, `ready` returns 503 if any source has been failing > N
  cycles (configurable via `READY_FAILURE_THRESHOLD`, default 5).
- New `/api/health/fetchers` returns the same data as JSON for
  dashboards.
- Surface in `src/components/SourcesView.tsx`: per-source status pill,
  last error message, click for full stack.
- Touches: `poller.ts`, new `src/lib/health.ts`, `health/route.ts`,
  `SourcesView.tsx`.

### 3. Structured logging with levels
`console.log` / `console.error` + a `DEBUG=true` env flag is the current
log strategy. Hard to filter, hard to ship anywhere.
- Add `pino` (small, fast, JSON by default). New
  `src/lib/logger.ts` exporting `logger` and child loggers per module.
- Levels: `trace` (per-request), `debug` (current `DEBUG=true` output),
  `info`, `warn`, `error`. Default `info`, configurable via
  `LOG_LEVEL`.
- Replace every `console.*` in `src/lib/` (15-ish call sites). Pretty
  print only when `NODE_ENV !== production`.
- Adds `pino-pretty` to devDependencies.

### 4. Schema validation per fetcher
A silent DOM / JSON change in an upstream breaks us with no diagnostic.
- Add `zod` parses inside each `src/lib/fetchers/*.ts`. Statuspage and
  Salesforce return JSON — easy. Downdetector / Workday parse HTML —
  validate the *extracted* shape (`{ reportCount: number, status:
  ServiceStatus }`) before returning.
- On parse failure: bump `outage_fetcher_failures_total{reason=schema}`,
  log at `warn` with a truncated payload sample, return `unknown`.
- Touches: every `fetchers/*.ts`, `package.json` (`zod`).

---

## Wave 2 — Reliability under upstream pressure

### 5. Circuit breaker + exponential backoff per fetcher
Right now a service returning HTTP 500 is retried at every 3 min poll,
forever. That's both noisy in logs and rude to the upstream.
- New `src/lib/fetchers/circuit.ts` — per-(service, source) state
  machine `closed → open → half-open` with cooldown 5 / 10 / 20 / 40
  minutes capped at the poll interval × 16.
- When `open`, `fetchOfficialStatus` short-circuits to `unknown` with
  `details: 'circuit open until …'`. One probe call when the cooldown
  expires.
- Counter: `outage_fetcher_circuit_state{service,source,state}` from
  #1.
- Touches: `poller.ts`, all `fetchers/*.ts`, `services` query path.

### 6. Configurable per-fetcher timeout + retry with jitter
15 s is hard-coded in `downdetector.ts:51`; nothing in the other
fetchers. Slow upstream blocks the cycle.
- New helper `src/lib/fetchers/httpFetch.ts` wrapping `fetch` with
  `AbortSignal.timeout`, exponential backoff (200ms × 2^n with full
  jitter), max 3 attempts, retry only on 5xx / network errors / 429.
- Env: `FETCH_TIMEOUT_MS` (default 12000), `FETCH_MAX_RETRIES`
  (default 2).
- Replace bare `fetch` calls in every fetcher. Avoids one slow upstream
  starving the cycle (today `Promise.allSettled` waits for the
  slowest).

### 7. SQLite write throttling + busy-timeout
WAL mode is on (`db.ts:18`) but a long-running read during VACUUM can
still produce `SQLITE_BUSY` for incident inserts.
- `db.pragma('busy_timeout = 5000')` on connect.
- Defer VACUUM to a background tick that pauses when the poll is
  running.
- Touches: `db.ts`, `poller.ts`.

---

## Wave 3 — Real-time client updates

### 8. Server-sent events for status + incidents
30 s polling on the client is wasted bandwidth and adds 0–30 s of stale
data. Switch to push.
- New route `src/app/api/stream/route.ts` — `text/event-stream`.
  Server pushes a JSON event whenever `runPollCycle` finishes
  (`status:update`) or `upsertIncident` flips `isNew=true`
  (`incident:new`).
- Use a tiny pub/sub in `src/lib/events.ts` (Node `EventEmitter`).
  `poller.ts` emits; the SSE handler subscribes and writes.
- Client: replace SWR polling in `src/hooks/useStatus.ts` with an
  `EventSource` that falls back to a single SWR fetch on connect / on
  reconnect.
- Heartbeat every 25 s (proxy-friendly).
- Touches: `src/lib/events.ts`, `poller.ts`, `useStatus.ts`,
  `useIncidents.ts`.

### 9. ETag + If-None-Match on GET endpoints
For clients that can't or won't use SSE (curl, embeds, third-party
dashboards), make polling cheap.
- Hash the response body of `/api/status`, `/api/history`,
  `/api/incidents`; return `ETag: "<sha>"` and `Cache-Control:
  no-cache, must-revalidate`.
- `304 Not Modified` when `If-None-Match` matches.
- Most useful for the public status page in `ROADMAP.md` #13.
- Touches: each route handler under `src/app/api/`.

---

## Wave 4 — Data lifecycle

### 10. Versioned migration framework
`db.ts:99-102` already shows the strain: a one-off ALTER guarded by a
PRAGMA introspection. The next column will repeat the pattern.
- New `src/lib/migrations/` with numbered files
  (`0001_init.ts`, `0002_alert_rules.ts`, …). Each exports
  `up(db: Database)`.
- `schema_migrations(version INTEGER PRIMARY KEY, applied_at)` table
  picks the next unapplied step on boot.
- Rolling back is out of scope for v1; we keep migrations
  forward-only.
- Touches: `db.ts` (delete inline `initTables`), new directory.

### 11. Time-series rollups for older history
`status_history` rows are inserted every 3 minutes for every service
(14 × 20 × 24 = 6720 / day) and pruned at 35 days. Charting > 7 days
is unnecessarily heavy.
- Hourly rollup table `status_history_hourly` (service_slug, hour_ts,
  status_distribution JSON, avg_report_count, max_report_count,
  total_incidents).
- Background job inside `runPollCycle` rolls up any hour that's older
  than 1 h and not yet aggregated. Keep raw rows for 7 days (env
  configurable), aggregates for 365.
- `getStatusHistory(days)` reads raw for ≤ 7 d, aggregates for
  longer, and stitches.
- Pairs naturally with `ROADMAP.md` #4 (SLA reports) and #12
  (comparison view).
- Touches: `db.ts`, `poller.ts`, `api/history/route.ts`.

### 12. Backup + restore CLI
Today the only way to back up is to copy `data/outage.db` while hoping
no write is in flight.
- New `scripts/backup.ts` using SQLite's online backup API (exposed by
  `better-sqlite3.prototype.backup`). Atomic, doesn't block writers.
- New `scripts/restore.ts` that swaps the live DB after stopping the
  poller cleanly.
- Document a cron example and a Docker volume snapshot example in
  `README.md`.
- Optional: Litestream sidecar in `docker-compose.yml` for continuous
  replication to S3 — left as an opt-in compose overlay
  (`docker-compose.litestream.yml`).

---

## Wave 5 — Integrations and public surfaces

### 13. First-class PagerDuty / Opsgenie / VictorOps notifiers
The generic webhook from `ROADMAP.md` #2 works for these but forces
users to glue payloads themselves.
- `src/lib/notifiers/pagerduty.ts` posts to Events API v2 with
  `dedup_key = incident.serviceSlug + ':' + incident.incidentId`,
  auto-resolves when `resolvedAt` populates.
- `src/lib/notifiers/opsgenie.ts` posts to the Alerts API, mapped
  severity → priority.
- Each surfaces in Settings under "Integrations" with a test-send
  button. Routing key / integration key stored in `alert_rules.channel_config`
  (JSON), keyed by channel name.
- Touches: notifiers, `alerts/rules.ts`, `SettingsView.tsx`,
  `email.ts` → `notifiers/index.ts`.

### 14. Signed outbound webhook payloads
Anyone receiving an outbound webhook from the generic notifier today
must trust the source IP.
- HMAC-SHA256 over body using a per-rule secret stored in
  `alert_rules.channel_secret`. Send as
  `X-OutageMap-Signature: t=<ts>,v1=<hex>` (Stripe-style).
- "Reveal secret" + "Rotate secret" in the rule editor.
- Document verification in `README.md` with a 10-line Node and Python
  example.
- Touches: `src/lib/notifiers/webhook.ts`, `alert_rules` schema
  (migration #10), Settings UI.

### 15. Status badges + iCal feed
Useful side-doors for users who don't want a whole dashboard.
- `GET /api/badge/[slug].svg` — Shields.io-style SVG that says
  `slack: operational` / `degraded` / `major outage`. ETag from #9
  applies.
- `GET /api/incidents.ics` — RFC 5545 calendar feed of incidents,
  filterable by `?service=`. Each `VEVENT` spans `startedAt` →
  `resolvedAt` (or DTSTART only for unresolved).
- Public, no auth, rate-limited per IP (already a pattern in
  `cron/route.ts`).

### 16. Inbound webhook ingestion
Some users want to push outages *into* Outage-Map from internal tools
(e.g. a Nagios bridge, a custom synthetic check).
- `POST /api/ingest` with Bearer `INGEST_SECRET` and a body matching
  the `IncidentInput` shape. Idempotent on
  `(serviceSlug, incidentId)`.
- Triggers the same alert evaluation path as the poller.
- Enables custom-service users (`ROADMAP.md` #14) to feed sources
  Outage-Map can't scrape (internal apps, on-prem stacks).

---

## Wave 6 — Quality of life for operators and end-users

### 17. CLI for ops tasks
A subset of the API as a local CLI for the operator running
`docker exec`.
- `npm run cli -- poll` triggers a poll cycle.
- `npm run cli -- rules list|add|delete` mirrors the rules API.
- `npm run cli -- test-alert <slug>` writes a fake incident and runs
  the dispatch path end-to-end.
- New `scripts/cli.ts`, registered in `package.json`.

### 18. Type-checked env loading
Env parsing is scattered: `parseInt` in `downdetector.ts:15-16`,
`process.env.DEBUG === 'true'` strings throughout `poller.ts`,
defaults restated in `README.md`. Drift is inevitable.
- New `src/lib/env.ts` using `zod` to validate and coerce. Export a
  typed `env` object. Throw at boot if required vars are missing in
  production.
- Generates `.env.example` from the schema (script).
- Touches: every site that reads `process.env`.

### 19. Content Security Policy + security headers
The app currently ships with default Next.js headers.
- `next.config.mjs` `headers()` adds CSP (script-src 'self', no
  inline except a small hashed nonce for ThemeProvider hydration),
  `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` denying camera/mic/geo.
- Will surface any inline `<style>` / `<script>` left from the chart
  library — fix as found.

### 20. Internationalization + per-user timezone
All copy is inline English and timestamps render in server TZ.
- Adopt `next-intl`. Extract strings from `src/components/` into
  `messages/en.json`. Ship `en` only; structure makes contributors'
  PRs cheap.
- Timezone selector in `TweaksPanel.tsx`, persisted alongside
  `useTweaks`. All `format.ts` helpers take TZ as a param; default to
  `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- Touches: every component with literal copy, `format.ts`,
  `next.config.mjs`.

### 21. Accessibility audit pass
Status is conveyed primarily by color today (`statusColors.ts`).
- Add textual + iconographic redundancy on every status pill
  (`StatusBadge.tsx`) — colorblind users get a shape, screen-reader
  users get `aria-label`.
- `prefers-reduced-motion` honored in sparkline transitions.
- `aria-live="polite"` region in `Dashboard.tsx` announces new
  incidents.
- Run `@axe-core/playwright` once tests land (`ROADMAP.md` #3).

---

## Cross-cutting concerns

- **Order**: Wave 1 first — observability has to come before reliability
  work, otherwise we can't tell if a circuit breaker actually helped.
- **Tests**: every item in Wave 2 (`#5–#7`) and Wave 4 (`#10–#11`) is
  blocked on `ROADMAP.md` #3 (Vitest harness). Don't ship them without
  unit coverage.
- **Backwards compatibility**: Wave 4 #10 (migrations) is a one-time
  cutover. After landing, every schema change goes through a numbered
  migration — including the new tables introduced by `ROADMAP.md`
  features.
- **Docs**: every new env var lands in `README.md` *and* the env
  schema (#18) in the same PR.

## Verification checklist (per feature)

1. `npm run build` and `npm run lint` pass.
2. `docker compose up -d --build` starts without error; `/api/status`
   still returns all services; `/api/metrics` (after #1) shows the
   poller has run.
3. Feature smoke test:
   - #1: `curl localhost:3100/api/metrics | grep outage_poll_cycles_total`.
   - #5: kill an upstream (rewrite `services.ts` URL to garbage); after
     N cycles the circuit opens and stops retrying.
   - #8: connect with `curl -N localhost:3100/api/stream`, force a poll
     via `/api/cron`, see an event.
4. No regression in existing endpoints — record their bodies before the
   change and diff after.
