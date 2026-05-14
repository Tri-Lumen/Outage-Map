# Enterprise Outage Dashboard

A live US enterprise application outage monitoring dashboard that tracks 14 major services with real-time status aggregation, 30-day outage history charts, and email alerting.

## Monitored Services

- **Microsoft 365** - Exchange, Teams, SharePoint, OneDrive
- **Adobe Creative Cloud** - Photoshop, Illustrator, Premiere Pro
- **ServiceNow** - IT Service Management platform
- **Salesforce** - CRM and cloud platform
- **Workday** - HR and finance platform
- **Zoom** - Video conferencing
- **Google Workspace** - Gmail, Drive, Meet, Calendar
- **Slack** - Team messaging and collaboration
- **GitHub** - Source control and CI/CD
- **Atlassian** - Jira, Confluence, Bitbucket
- **Okta** - Identity and single sign-on
- **Cloudflare** - CDN, DNS, and edge services
- **Dropbox** - File storage and sharing
- **Amazon Web Services** - Cloud infrastructure

## Features

- **Real-time status dashboard** with color-coded service cards
- **Dual data sources**: Official status page APIs + Downdetector scraping
- **30-day outage history charts** per service (Recharts)
- **Incident feed** with severity filtering and expandable details
- **Email alerts** for new major incidents and status changes
- **Auto-refresh** every 30 seconds via SWR
- **Automated polling** every 3 minutes via node-cron
- **SQLite storage** for historical data (zero-config)
- **Responsive design** for desktop and mobile

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Database | SQLite (better-sqlite3) |
| Scraping | Cheerio |
| Email | Nodemailer |
| Polling | node-cron |
| Client refresh | SWR |

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
git clone <repo-url>
cd Outage-Map
npm install
```

### Configuration

Copy the environment template and configure:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Required for email alerts (optional - dashboard works without it)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
ALERT_EMAILS=admin@company.com

# Optional tuning
POLL_INTERVAL_MINUTES=3
CRON_SECRET=your-secret-token
```

### Run

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

Open [http://localhost:3100](http://localhost:3100) to view the dashboard.

## Docker

The default `docker-compose.yml` pulls a prebuilt image from GitHub Container
Registry (`ghcr.io/tri-lumen/outage-map:latest`). Every push to `main`
publishes a new image via the `Build and publish Docker image` workflow.

```bash
docker compose up -d
```

The SQLite database is persisted in the named volume `outage-map-data`
(mounted at `/app/data` inside the container). Configure the container by
creating a `.env` file next to `docker-compose.yml` (the compose file reads
the same variables as `.env.example`).

To pin a specific build instead of `:latest`, set `OUTAGE_MAP_IMAGE`:

```bash
OUTAGE_MAP_IMAGE=ghcr.io/tri-lumen/outage-map:sha-1a2b3c4 docker compose up -d
```

### Building locally (offline / development)

If GHCR is unreachable or you want to test an unpushed change, layer in the
`docker-compose.build.yml` overlay to switch back to building from the bundled
`Dockerfile`:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

### Changing the host port

The container listens on port `3100` internally and is published on the
host via `${APP_PORT:-3100}:3100`. If you see an error like:

```
Bind for 0.0.0.0:3100 failed: port is already allocated
```

another process (or another container) is already bound to host port
`3100`. Pick a free port and set `APP_PORT` before redeploying:

```bash
# .env (next to docker-compose.yml)
APP_PORT=3200
```

Then `docker compose up -d` again, or in Portainer set `APP_PORT=3200`
under the stack's environment variables and redeploy. The dashboard will
be reachable at `http://<host>:3200`. To find what's holding port 3100,
run `docker ps --filter "publish=3100"` or `sudo lsof -i :3100`.

## Deploying with Portainer

The stack can be deployed as a Portainer Stack in one of two ways:

### Option 1 — Repository (recommended)

1. In Portainer, go to **Stacks → Add stack**.
2. Give the stack a name (e.g. `outage-map`).
3. Choose **Build method: Repository**.
4. Set the repository URL to this project and the **Compose path** to
   `docker-compose.yml`.
5. Under **Environment variables**, add the values you want to override
   (see `.env.example`). At minimum, set:
   - `APP_PORT` — host port to expose (defaults to `3100`)
   - `POLL_INTERVAL_MINUTES`
   - `SMTP_*` and `ALERT_*` if you want email alerts
6. Click **Deploy the stack**.

Portainer will clone the repo, pull the prebuilt image from GHCR, and
start the container. The `outage-map-data` volume will keep the SQLite
database across redeploys.

> **Note**: the published GHCR package must be public for Portainer to
> pull it without credentials. After the first run of the
> `Build and publish Docker image` workflow, open
> `https://github.com/orgs/Tri-Lumen/packages/container/outage-map/settings`
> and set the package visibility to **Public**. If you'd rather keep it
> private, add a GHCR registry under **Registries** in Portainer with a
> PAT that has `read:packages`.

### Option 2 — Web editor

1. In Portainer, go to **Stacks → Add stack**.
2. Choose **Build method: Web editor**.
3. Paste the contents of `docker-compose.yml` into the editor.
4. Add the same environment variables as in Option 1 and deploy.

The compose file references the prebuilt GHCR image directly, so the web
editor flow works without any further changes — Portainer just pulls and
runs.

### Option 3 — Local build (offline / air-gapped)

If your Portainer host can't reach GHCR, point the **Compose path** at
both files, comma-separated:

```
docker-compose.yml,docker-compose.build.yml
```

The overlay swaps the image source from GHCR back to a local Dockerfile
build. Note: this is significantly slower than the prebuilt path (often
3–7 minutes vs. seconds) and can exceed Portainer's HTTP proxy timeouts,
leaving the "Saving..." spinner hanging even though the build is still
running in the background.

### Updating

From the stack page, click **Update the stack** (repository-based
deployment) and enable **Re-pull image and redeploy** to pull the latest
GHCR image and recreate the container. The SQLite volume is preserved
automatically.

The compose file sets `pull_policy: missing`, so a redeploy will use the
locally cached image when one exists. This keeps redeploys fast and
resilient: if GHCR is slow or briefly unreachable, the stack still comes
back up on the cached image instead of failing with a registry timeout
like:

```
Get "https://ghcr.io/v2/": ... net/http: request canceled
(Client.Timeout exceeded while awaiting headers)
```

To force a refresh to the latest published build, either tick
**Re-pull image and redeploy** in Portainer or run
`docker compose pull && docker compose up -d` from a shell.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_PATH` | `./data/outage.db` | SQLite file location. Mounted as a volume in Docker. |
| `POLL_INTERVAL_MINUTES` | `3` | Poll cadence. Must divide 60 (`1,2,3,4,5,6,10,12,15,20,30,60`); other values are clamped to 3. |
| `CRON_SECRET` | _required_ | Bearer token guarding `POST /api/cron` and — unless `ENABLE_RULES_API=true` — writes on `/api/alerts/rules`. Endpoint returns `503` if unset. |
| `ENABLE_RULES_API` | `false` | When `true`, allows the dashboard UI to write to `/api/alerts/rules` without a token. Use only on trusted networks. |
| `DOWNDETECTOR_ENABLED` | `true` | Set to `false` to skip Downdetector scraping entirely. |
| `DD_REPORT_THRESHOLD_DEGRADED` | `100` | DD reports at or above this number flip the service to `degraded`. |
| `DD_REPORT_THRESHOLD_MAJOR` | `500` | DD reports at or above this number flip the service to `major_outage` (only when an official incident is also active). |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | _unset_ | SMTP transport. Email alerts are skipped if any of these are missing. |
| `SMTP_REJECT_UNAUTHORIZED` | `true` | Enforce TLS certificate validation. Set to `false` only for self-signed dev servers. |
| `ALERT_FROM` | `SMTP_USER` | `From:` address on outgoing alert emails. |
| `ALERT_EMAILS` | _empty_ | Comma-separated fallback recipients used when no alert rule matches an incident. |
| `DEBUG` | `false` | Set to `true` for verbose poller logs (per-service status lines). |
| `APP_PORT` | `3100` | Host port published by `docker-compose.yml`. |
| `GITHUB_TOKEN` | _unset_ | PAT or fine-grained token with `Contents: Read & Write` and `Pull requests: Read & Write` on the target repo. Required for the in-app "Contribute to catalog" flow; the endpoint returns 503 if unset. |
| `GITHUB_REPO` | `Tri-Lumen/Outage-Map` | `owner/name` of the upstream catalog repository that contribute-PRs land in. |
| `GITHUB_BASE_BRANCH` | `main` | Branch the contribute flow PRs against. |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Current status for all 14 services |
| `/api/incidents?days=7&service=slack` | GET | Recent incidents feed. `days` clamped to 1–90; unknown service slugs return empty. |
| `/api/history?days=30` | GET | 30-day outage history for charts |
| `/api/cron` | POST | Manually trigger a poll cycle. Requires `Bearer $CRON_SECRET`; rate-limited to 1 request / 30s per IP. |
| `/api/alerts/rules` | GET / POST | List / create alert rules. Writes need Bearer auth (or `ENABLE_RULES_API=true`). |
| `/api/alerts/rules/:id` | PATCH / DELETE | Update or remove a rule. Same auth as POST. |
| `/api/alerts/test` | POST | Send a test email to verify SMTP wiring. |
| `/api/sources` | GET / POST | List / create custom data sources merged into the runtime catalog. Writes require Bearer auth (or `ENABLE_RULES_API=true`). |
| `/api/sources/:id` | PATCH / DELETE | Update or remove a custom source. Same auth as POST. DELETE also cleans up the source's status, history, and incident rows. |
| `/api/sources/contribute` | POST | Open a PR against `main` adding selected custom sources to `src/lib/services.contributed.json`. Requires `GITHUB_TOKEN` plus Bearer auth. |

## Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # REST API routes
│   └── page.tsx            # Dashboard page
├── components/             # React components
│   ├── Dashboard.tsx       # Main layout
│   ├── ServiceCard.tsx     # Status cards
│   ├── OutageChart.tsx     # Recharts history
│   └── IncidentFeed.tsx    # Incident timeline
├── lib/
│   ├── db.ts               # SQLite database
│   ├── poller.ts           # Poll orchestrator
│   ├── email.ts            # Alert system
│   └── fetchers/           # Per-service data fetchers
└── hooks/
    └── useStatus.ts        # SWR auto-refresh hooks
```

## How It Works

1. **Polling**: Every 3 minutes, `node-cron` triggers a poll cycle that fetches status from all services in parallel
2. **Data Sources**: Each service is checked via its official status page API and Downdetector
3. **Storage**: Results are stored in SQLite with upsert semantics; history is kept for 35 days
4. **Alerting**: New major/critical incidents trigger HTML email alerts via SMTP
5. **Frontend**: SWR fetches `/api/status` every 30 seconds, rendering status cards, charts, and incident feed
