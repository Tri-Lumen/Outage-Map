# Enterprise Outage Dashboard

A live US enterprise application outage monitoring dashboard that tracks 7 major services with real-time status aggregation, 30-day outage history charts, and email alerting.

## Monitored Services

- **Microsoft 365** - Exchange, Teams, SharePoint, OneDrive
- **Adobe Creative Cloud** - Photoshop, Illustrator, Premiere Pro
- **ServiceNow** - IT Service Management platform
- **Salesforce** - CRM and cloud platform
- **Workday** - HR and finance platform
- **Zoom** - Video conferencing
- **Google Workspace** - Gmail, Drive, Meet, Calendar

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

Build and run with the bundled `Dockerfile` and `docker-compose.yml`:

```bash
docker compose up -d --build
```

The SQLite database is persisted in the named volume `outage-map-data`
(mounted at `/app/data` inside the container). Configure the container by
creating a `.env` file next to `docker-compose.yml` (the compose file reads
the same variables as `.env.example`).

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

Portainer will clone the repo, build the image via the Dockerfile, and
start the container. The `outage-map-data` volume will keep the SQLite
database across redeploys.

### Option 2 — Web editor

1. In Portainer, go to **Stacks → Add stack**.
2. Choose **Build method: Web editor**.
3. Paste the contents of `docker-compose.yml` into the editor.
4. Because Portainer's web editor cannot build from a local Dockerfile, you
   will need to point `image:` at a prebuilt image (for example a GHCR or
   Docker Hub tag you've pushed) and remove the `build:` block.
5. Add the same environment variables as in Option 1 and deploy.

### Updating

From the stack page, click **Update the stack** (repository-based
deployment) and enable **Re-pull image and redeploy** to rebuild with the
latest code. The compose file sets `pull_policy: build`, so Portainer
will build the image from the bundled `Dockerfile` rather than trying to
pull a prebuilt image from a registry — this avoids "image not found"
errors during re-pull. The SQLite volume is preserved automatically.

If you host your own prebuilt image in a registry (e.g. GHCR, Docker
Hub), change the `image:` tag in `docker-compose.yml` to point at it and
remove `pull_policy: build` (and optionally the `build:` block).

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Current status for all 7 services |
| `/api/incidents?days=7` | GET | Recent incidents feed |
| `/api/history?days=30` | GET | 30-day outage history for charts |
| `/api/cron` | POST | Manually trigger a poll cycle (requires `Bearer $CRON_SECRET` when set) |

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
