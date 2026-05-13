'use client';

import type { ReactNode } from 'react';
import type { TileConfig, TileType } from '@/hooks/useBoard';
import type { LiveData } from '../types';
import CommonFields from './CommonFields';

export interface ConfigFormProps {
  tile: TileConfig;
  live: LiveData;
  onUpdate: (patch: Partial<TileConfig>) => void;
}

type ConfigForm = (props: ConfigFormProps) => ReactNode;

function update(tile: TileConfig, onUpdate: ConfigFormProps['onUpdate'], patch: Record<string, unknown>) {
  onUpdate({ config: patch });
}

function common(tile: TileConfig, onUpdate: ConfigFormProps['onUpdate'], opts: { hideRefresh?: boolean } = {}) {
  const cfg = tile.config as Record<string, unknown>;
  return (
    <CommonFields
      tileType={tile.type}
      label={typeof cfg.label === 'string' ? cfg.label : undefined}
      refreshMs={typeof cfg.refreshMs === 'number' ? cfg.refreshMs : undefined}
      hideRefresh={opts.hideRefresh}
      onLabelChange={(v) => update(tile, onUpdate, { label: v ?? undefined })}
      onRefreshChange={(ms) => update(tile, onUpdate, { refreshMs: ms })}
    />
  );
}

const StatForm: ConfigForm = ({ tile, onUpdate }) => {
  const metric = (tile.config.metric as string) || 'uptime';
  return (
    <>
      {common(tile, onUpdate, { hideRefresh: true })}
      <div className="twk-row">
        <div className="twk-lbl"><span>Metric</span></div>
        <select
          className="twk-field"
          value={metric}
          onChange={(e) => update(tile, onUpdate, { metric: e.target.value })}
        >
          <option value="uptime">Fleet uptime</option>
          <option value="incidents">Active incidents</option>
          <option value="dd">DD reports</option>
          <option value="mttr">MTTR (30d)</option>
        </select>
      </div>
    </>
  );
};

const DATA_POINTS: { key: string; label: string }[] = [
  { key: 'sparkline',    label: '30d chart' },
  { key: 'uptime',       label: 'Uptime %' },
  { key: 'official',     label: 'Official' },
  { key: 'downdetector', label: 'DD reports' },
];

const ServiceWatchForm: ConfigForm = ({ tile, live, onUpdate }) => {
  const service = (tile.config.service as string) || '';
  const dataPoints = tile.dataPoints ?? [];
  const toggleDataPoint = (key: string) => {
    const next = dataPoints.includes(key)
      ? dataPoints.filter((k) => k !== key)
      : [...dataPoints, key];
    onUpdate({ dataPoints: next });
  };
  return (
    <>
      {common(tile, onUpdate)}
      <div className="twk-row">
        <div className="twk-lbl"><span>Service</span></div>
        <select
          className="twk-field"
          value={service}
          onChange={(e) => update(tile, onUpdate, { service: e.target.value })}
        >
          {live.services.map((s) => (
            <option key={s.slug} value={s.slug}>{s.name}</option>
          ))}
        </select>
      </div>
      <div className="twk-row">
        <div className="twk-lbl"><span>Data points</span></div>
        <div className="twk-chips">
          {DATA_POINTS.map((dp) => (
            <button
              key={dp.key}
              className={`chip ${dataPoints.includes(dp.key) ? 'chip-on' : ''}`}
              onClick={() => toggleDataPoint(dp.key)}
            >
              {dataPoints.includes(dp.key) ? '●' : '○'} {dp.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

const SEVERITIES = ['critical', 'major', 'minor'] as const;
const STATUSES = ['investigating', 'identified', 'monitoring', 'resolved'] as const;

const IncidentFeedForm: ConfigForm = ({ tile, onUpdate }) => {
  const filters = (tile.config.filters ?? {}) as { severity?: string[]; statuses?: string[] };
  const toggle = (key: 'severity' | 'statuses', value: string) => {
    const current = filters[key] ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    update(tile, onUpdate, { filters: { ...filters, [key]: next.length ? next : undefined } });
  };
  return (
    <>
      {common(tile, onUpdate)}
      <div className="twk-row">
        <div className="twk-lbl"><span>Severity</span></div>
        <div className="twk-chips">
          {SEVERITIES.map((s) => (
            <button
              key={s}
              className={`chip ${filters.severity?.includes(s) ? 'chip-on' : ''}`}
              onClick={() => toggle('severity', s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="twk-row">
        <div className="twk-lbl"><span>Status</span></div>
        <div className="twk-chips">
          {STATUSES.map((s) => (
            <button
              key={s}
              className={`chip ${filters.statuses?.includes(s) ? 'chip-on' : ''}`}
              onClick={() => toggle('statuses', s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

const ServiceGridForm: ConfigForm = ({ tile, onUpdate }) => {
  const filters = (tile.config.filters ?? {}) as { hideOperational?: boolean };
  return (
    <>
      {common(tile, onUpdate, { hideRefresh: true })}
      <div className="twk-row twk-row-h">
        <div className="twk-lbl"><span>Hide healthy</span></div>
        <button
          type="button"
          className="twk-toggle"
          data-on={!!filters.hideOperational}
          role="switch"
          aria-checked={!!filters.hideOperational}
          onClick={() => update(tile, onUpdate, { filters: { ...filters, hideOperational: !filters.hideOperational } })}
        >
          <i />
        </button>
      </div>
    </>
  );
};

const UptimeChartForm: ConfigForm = ({ tile, live, onUpdate }) => {
  const service = (tile.config.service as string) || '';
  const filters = (tile.config.filters ?? {}) as { rangeDays?: number };
  const rangeDays = filters.rangeDays ?? 30;
  return (
    <>
      {common(tile, onUpdate, { hideRefresh: true })}
      <div className="twk-row">
        <div className="twk-lbl"><span>Service</span></div>
        <select
          className="twk-field"
          value={service}
          onChange={(e) => update(tile, onUpdate, { service: e.target.value })}
        >
          {live.services.map((s) => (
            <option key={s.slug} value={s.slug}>{s.name}</option>
          ))}
        </select>
      </div>
      <div className="twk-row">
        <div className="twk-lbl"><span>Range</span></div>
        <div className="twk-seg">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              data-on={rangeDays === d}
              onClick={() => update(tile, onUpdate, { filters: { ...filters, rangeDays: d } })}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

const RssForm: ConfigForm = ({ tile, onUpdate }) => {
  const feed = (tile.config.feed as string) || 'aws-blog';
  return (
    <>
      {common(tile, onUpdate, { hideRefresh: true })}
      <div className="twk-row">
        <div className="twk-lbl"><span>Feed</span></div>
        <select
          className="twk-field"
          value={feed}
          onChange={(e) => update(tile, onUpdate, { feed: e.target.value })}
        >
          <option value="aws-blog">AWS What&apos;s New</option>
          <option value="gh-blog">GitHub Engineering</option>
        </select>
      </div>
    </>
  );
};

const StatusMapForm: ConfigForm = ({ tile, onUpdate }) => common(tile, onUpdate, { hideRefresh: true });
const StatusPageForm: ConfigForm = ({ tile, onUpdate }) => common(tile, onUpdate, { hideRefresh: true });

export const TILE_CONFIG_FORMS: Record<TileType, ConfigForm> = {
  'stat':          StatForm,
  'service-watch': ServiceWatchForm,
  'service-grid':  ServiceGridForm,
  'incident-feed': IncidentFeedForm,
  'rss':           RssForm,
  'uptime-chart':  UptimeChartForm,
  'status-map':    StatusMapForm,
  'statuspage':    StatusPageForm,
};
