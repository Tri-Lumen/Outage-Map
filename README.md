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

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Current status for all 7 services |
| `/api/incidents?days=7` | GET | Recent incidents feed |
| `/api/history?days=30` | GET | 30-day outage history for charts |
| `/api/cron` | POST/GET | Manually trigger a poll cycle |

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
