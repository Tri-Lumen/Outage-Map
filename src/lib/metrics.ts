// In-memory Prometheus-style metrics registry. Intentionally dependency-free
// to avoid adding 1.5MB of prom-client to the bundle for what is, in practice,
// ~10 series. Exposition follows the text format documented at
// https://prometheus.io/docs/instrumenting/exposition_formats/#text-based-format
//
// State is per-process. The poller pins to a single node-cron instance, so
// scrape results are coherent without cross-process aggregation.
import { ServiceStatus } from './types';

type Labels = Record<string, string>;

function labelKey(labels: Labels): string {
  const keys = Object.keys(labels).sort();
  return keys.map((k) => `${k}=${labels[k]}`).join(',');
}

function formatLabels(labels: Labels): string {
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) return '';
  const parts = keys.map((k) => `${k}="${escapeLabelValue(labels[k])}"`);
  return `{${parts.join(',')}}`;
}

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

interface CounterSeries {
  labels: Labels;
  value: number;
}

class Counter {
  private series = new Map<string, CounterSeries>();

  constructor(readonly name: string, readonly help: string) {}

  inc(labels: Labels = {}, delta: number = 1) {
    const key = labelKey(labels);
    const existing = this.series.get(key);
    if (existing) {
      existing.value += delta;
    } else {
      this.series.set(key, { labels: { ...labels }, value: delta });
    }
  }

  expose(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    this.series.forEach((series) => {
      lines.push(`${this.name}${formatLabels(series.labels)} ${series.value}`);
    });
    return lines.join('\n');
  }
}

interface GaugeSeries {
  labels: Labels;
  value: number;
}

class Gauge {
  private series = new Map<string, GaugeSeries>();

  constructor(readonly name: string, readonly help: string) {}

  set(labels: Labels, value: number) {
    const key = labelKey(labels);
    this.series.set(key, { labels: { ...labels }, value });
  }

  expose(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} gauge`];
    this.series.forEach((series) => {
      lines.push(`${this.name}${formatLabels(series.labels)} ${series.value}`);
    });
    return lines.join('\n');
  }
}

interface HistogramSeries {
  labels: Labels;
  buckets: number[];
  sum: number;
  count: number;
}

class Histogram {
  private series = new Map<string, HistogramSeries>();

  constructor(
    readonly name: string,
    readonly help: string,
    readonly bucketBounds: number[],
  ) {}

  observe(labels: Labels, value: number) {
    const key = labelKey(labels);
    let series = this.series.get(key);
    if (!series) {
      series = {
        labels: { ...labels },
        buckets: new Array(this.bucketBounds.length).fill(0),
        sum: 0,
        count: 0,
      };
      this.series.set(key, series);
    }
    series.sum += value;
    series.count += 1;
    for (let i = 0; i < this.bucketBounds.length; i++) {
      if (value <= this.bucketBounds[i]) series.buckets[i] += 1;
    }
  }

  expose(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    this.series.forEach((series) => {
      for (let i = 0; i < this.bucketBounds.length; i++) {
        const le = this.bucketBounds[i];
        const bucketLabels = { ...series.labels, le: String(le) };
        lines.push(`${this.name}_bucket${formatLabels(bucketLabels)} ${series.buckets[i]}`);
      }
      const infLabels = { ...series.labels, le: '+Inf' };
      lines.push(`${this.name}_bucket${formatLabels(infLabels)} ${series.count}`);
      lines.push(`${this.name}_sum${formatLabels(series.labels)} ${series.sum}`);
      lines.push(`${this.name}_count${formatLabels(series.labels)} ${series.count}`);
    });
    return lines.join('\n');
  }
}

const STATUS_CODE: Record<ServiceStatus, number> = {
  operational: 0,
  degraded: 1,
  major_outage: 2,
  down: 3,
  unknown: 4,
};

// Next.js' standalone build can split this module across multiple chunks —
// one bundled into the instrumentation/poller graph, another bundled into the
// /api/metrics route — which gives each its own copy of module-level state.
// Attach the registry to globalThis so every chunk in the same Node process
// observes the same series. The symbol-keyed slot avoids colliding with any
// other library that might pin globals.
const GLOBAL_KEY = Symbol.for('outage-map.metrics-registry');

interface Registry {
  pollCycles: Counter;
  fetcherFailures: Counter;
  alertsSent: Counter;
  fetcherLatency: Histogram;
  pollCycleDuration: Histogram;
  serviceStatus: Gauge;
  lastPollTimestamp: Gauge;
  lastPollAge: Gauge;
  lastPollAt: number | null;
}

type GlobalWithRegistry = typeof globalThis & { [GLOBAL_KEY]?: Registry };

function getRegistry(): Registry {
  const g = globalThis as GlobalWithRegistry;
  let r = g[GLOBAL_KEY];
  if (!r) {
    r = {
      pollCycles: new Counter(
        'outage_poll_cycles_total',
        'Number of poll cycles run, by result',
      ),
      fetcherFailures: new Counter(
        'outage_fetcher_failures_total',
        'Number of fetcher failures, by service and source',
      ),
      alertsSent: new Counter(
        'outage_alerts_sent_total',
        'Number of alerts dispatched, by channel and severity',
      ),
      fetcherLatency: new Histogram(
        'outage_fetcher_latency_seconds',
        'Fetcher request latency in seconds',
        [0.1, 0.5, 1, 2, 5, 10, 15, 30],
      ),
      pollCycleDuration: new Histogram(
        'outage_poll_cycle_duration_seconds',
        'Total duration of a poll cycle in seconds',
        [1, 5, 10, 30, 60, 120],
      ),
      serviceStatus: new Gauge(
        'outage_service_status',
        'Current service status (0=operational, 1=degraded, 2=major_outage, 3=down, 4=unknown)',
      ),
      lastPollTimestamp: new Gauge(
        'outage_last_poll_timestamp_seconds',
        'Unix timestamp of the last completed poll cycle',
      ),
      lastPollAge: new Gauge(
        'outage_last_poll_age_seconds',
        'Seconds since the last completed poll cycle',
      ),
      lastPollAt: null,
    };
    g[GLOBAL_KEY] = r;
  }
  return r;
}

export const metrics = {
  recordPollCycle(result: 'success' | 'skipped' | 'failure', durationSec: number) {
    const r = getRegistry();
    r.pollCycles.inc({ result });
    r.pollCycleDuration.observe({}, durationSec);
    if (result !== 'skipped') {
      r.lastPollAt = Date.now();
      r.lastPollTimestamp.set({}, Math.floor(r.lastPollAt / 1000));
    }
  },
  recordFetcherLatency(service: string, source: string, seconds: number) {
    getRegistry().fetcherLatency.observe({ service, source }, seconds);
  },
  recordFetcherFailure(service: string, source: string, reason: string = 'error') {
    getRegistry().fetcherFailures.inc({ service, source, reason });
  },
  recordAlertSent(channel: string, severity: string) {
    getRegistry().alertsSent.inc({ channel, severity });
  },
  setServiceStatus(service: string, source: string, status: ServiceStatus) {
    getRegistry().serviceStatus.set({ service, source }, STATUS_CODE[status]);
  },
  expose(): string {
    const r = getRegistry();
    if (r.lastPollAt !== null) {
      r.lastPollAge.set({}, Math.round((Date.now() - r.lastPollAt) / 1000));
    }
    return [
      r.pollCycles.expose(),
      r.fetcherFailures.expose(),
      r.alertsSent.expose(),
      r.fetcherLatency.expose(),
      r.pollCycleDuration.expose(),
      r.serviceStatus.expose(),
      r.lastPollTimestamp.expose(),
      r.lastPollAge.expose(),
      '',
    ].join('\n');
  },
};
