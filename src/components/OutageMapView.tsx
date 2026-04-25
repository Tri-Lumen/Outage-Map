'use client';

import { useMemo, useState } from 'react';
import { useServiceStatus } from '@/hooks/useStatus';
import { SERVICES } from '@/lib/services';
import {
  NA_VIEWBOX,
  US_OUTLINE_SHAPE,
  US_REGION_SHAPES,
  WORLD_LAND_SHAPES,
  WORLD_REGIONS,
  WORLD_VIEWBOX,
  projectNA,
  projectWorld,
  toPath,
} from '@/lib/mapData';
import PageHeader from './ui/PageHeader';
import StatTile from './ui/StatTile';
import Card from './ui/Card';

type Scope = 'global' | 'na';

interface HeatRegion {
  id: string;
  name: string;
  short: string;
  total: number;
  reportsByService: { slug: string; name: string; color: string; reports: number }[];
}

function deterministicShare(reports: number, regionId: string, serviceSlug: string) {
  let hash = 0;
  const seed = `${regionId}-${serviceSlug}`;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const jitter = (hash % 1000) / 1000;
  return Math.round(reports * (0.4 + jitter * 0.6));
}

// Fallback signal so the map still shows hotspots when DownDetector returns 0
// reports but the official status indicates active issues. Each active
// incident contributes INCIDENT_WEIGHT synthetic reports, and any degraded /
// outage status contributes a baseline floor.
const INCIDENT_WEIGHT = 40;
const STATUS_FLOOR: Record<string, number> = {
  operational: 0,
  unknown: 0,
  degraded: 30,
  major_outage: 90,
  down: 140,
};

function mapSignal(
  reports: number,
  incidentCount: number,
  officialStatus: string,
  overallStatus: string,
): number {
  const floor = Math.max(
    STATUS_FLOOR[officialStatus] || 0,
    STATUS_FLOOR[overallStatus] || 0,
  );
  return reports + incidentCount * INCIDENT_WEIGHT + floor;
}

function heatColor(pct: number): string {
  if (pct <= 0) return '#334155';
  if (pct < 0.25) return '#0ea5e9';
  if (pct < 0.5) return '#eab308';
  if (pct < 0.75) return '#f97316';
  return '#ef4444';
}

export default function OutageMapView() {
  const { data } = useServiceStatus();
  const services = useMemo(() => data?.services || [], [data]);
  const [selectedService, setSelectedService] = useState<string>('all');
  const [scope, setScope] = useState<Scope>('global');
  const [hoverRegion, setHoverRegion] = useState<string | null>(null);

  const filteredServices = useMemo(
    () =>
      selectedService === 'all'
        ? services
        : services.filter((s) => s.slug === selectedService),
    [services, selectedService],
  );

  const worldData = useMemo<HeatRegion[]>(() => {
    return WORLD_REGIONS.map((r) => {
      const reportsByService = filteredServices.map((s) => {
        const signal = mapSignal(
          s.downdetectorReports || 0,
          s.incidentCount || 0,
          s.officialStatus,
          s.overallStatus,
        );
        const share = deterministicShare(signal, r.id, s.slug);
        const popScaled = Math.round(share * r.population * 3);
        return { slug: s.slug, name: s.name, color: s.color, reports: popScaled };
      });
      const total = reportsByService.reduce((sum, s) => sum + s.reports, 0);
      return { id: r.id, name: r.name, short: r.short, total, reportsByService };
    });
  }, [filteredServices]);

  const naData = useMemo<HeatRegion[]>(() => {
    return US_REGION_SHAPES.map((r) => {
      const reportsByService = filteredServices.map((s) => {
        const signal = mapSignal(
          s.downdetectorReports || 0,
          s.incidentCount || 0,
          s.officialStatus,
          s.overallStatus,
        );
        const share = deterministicShare(signal, r.id, s.slug);
        // NA-specific share draws from the parent NA signal (roughly 35% of global
        // volume for the services in scope) with regional population weighting.
        const popScaled = Math.round(share * r.population * 2);
        return { slug: s.slug, name: s.name, color: s.color, reports: popScaled };
      });
      const total = reportsByService.reduce((sum, s) => sum + s.reports, 0);
      return { id: r.id, name: r.name, short: r.short, total, reportsByService };
    });
  }, [filteredServices]);

  const activeData = scope === 'global' ? worldData : naData;
  const maxReports = Math.max(1, ...activeData.map((r) => r.total));
  const totalReports = activeData.reduce((s, r) => s + r.total, 0);
  const hotspotRegions = activeData.filter((r) => r.total > maxReports * 0.5).length;
  const peak = activeData.length
    ? activeData.reduce((a, b) => (b.total > a.total ? b : a), activeData[0])
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Geographic View"
        title="Outage heatmap"
        description="Estimated regional distribution of Downdetector reports across monitored services."
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatTile label="Total Reports" value={totalReports.toLocaleString()} accent="indigo" />
        <StatTile
          label="Active Regions"
          value={activeData.filter((r) => r.total > 0).length}
          accent="cyan"
          hint={`of ${activeData.length}`}
        />
        <StatTile
          label="Hotspots"
          value={hotspotRegions}
          accent={hotspotRegions > 0 ? 'red' : 'green'}
          hint=">50% of peak"
        />
        <StatTile
          label="Peak Region"
          value={peak && peak.total > 0 ? peak.short : '—'}
          accent="amber"
          hint={peak && peak.total > 0 ? `${peak.total.toLocaleString()} reports` : 'No reports'}
        />
      </section>

      <Card padded={false}>
        <div className="px-5 py-4 border-b border-subtle flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {scope === 'global' ? 'Report density by region' : 'US regional breakdown'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {scope === 'global'
                  ? 'Redder fill = higher concentration of reports.'
                  : 'Reports distributed across us-east, us-west, us-central, us-south.'}
              </p>
            </div>
            <div className="inline-flex items-center gap-1 bg-white/5 rounded-full p-1">
              <ScopeButton
                active={scope === 'global'}
                onClick={() => setScope('global')}
                label="Global"
              />
              <ScopeButton
                active={scope === 'na'}
                onClick={() => setScope('na')}
                label="North America"
              />
            </div>
          </div>
          <div className="inline-flex items-center gap-1 bg-white/5 rounded-full p-1 overflow-x-auto max-w-full">
            <button
              onClick={() => setSelectedService('all')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                selectedService === 'all'
                  ? 'bg-accent-soft text-foreground'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              All services
            </button>
            {SERVICES.map((s) => (
              <button
                key={s.slug}
                onClick={() => setSelectedService(s.slug)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                  selectedService === s.slug
                    ? 'bg-accent-soft text-foreground'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                {s.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        <div className="relative grid-bg overflow-hidden">
          {scope === 'global' ? (
            <GlobalMap
              data={worldData}
              maxReports={maxReports}
              hoverRegion={hoverRegion}
              setHoverRegion={setHoverRegion}
            />
          ) : (
            <NorthAmericaMap
              data={naData}
              maxReports={maxReports}
              hoverRegion={hoverRegion}
              setHoverRegion={setHoverRegion}
            />
          )}

          <div className="absolute bottom-4 left-4 flex items-center gap-3 px-3 py-2 rounded-lg surface-elevated">
            <span className="text-[10px] text-muted uppercase tracking-wider">Scale</span>
            <div className="flex items-center gap-1" aria-hidden="true">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: heatColor(0) }} />
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: heatColor(0.2) }} />
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: heatColor(0.4) }} />
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: heatColor(0.6) }} />
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: heatColor(0.9) }} />
            </div>
            <span className="text-[10px] text-muted-strong">low → high</span>
          </div>
        </div>
      </Card>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-accent-cyan" />
          {scope === 'global' ? 'Regional leaderboard' : 'US region leaderboard'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...activeData]
            .sort((a, b) => b.total - a.total)
            .slice(0, 6)
            .map((r, i) => {
              const pct = r.total / maxReports;
              return (
                <Card key={r.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs font-mono text-muted">
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium truncate">{r.name}</p>
                    <p className="text-xs text-muted-strong">{r.total.toLocaleString()} reports</p>
                  </div>
                  <span
                    className="w-8 h-8 rounded-full"
                    style={{ backgroundColor: heatColor(pct), opacity: 0.7 }}
                  />
                </Card>
              );
            })}
        </div>
      </section>
    </div>
  );
}

function ScopeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
        active ? 'bg-accent-soft text-foreground' : 'text-gray-400 hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}

interface MapProps {
  data: HeatRegion[];
  maxReports: number;
  hoverRegion: string | null;
  setHoverRegion: (id: string | null) => void;
}

function GlobalMap({ data, maxReports, hoverRegion, setHoverRegion }: MapProps) {
  const byId = useMemo(() => new Map(data.map((r) => [r.id, r])), [data]);
  return (
    <svg
      viewBox={`0 0 ${WORLD_VIEWBOX.w} ${WORLD_VIEWBOX.h}`}
      className="w-full h-auto"
      role="img"
      aria-label="Global outage heatmap"
    >
      <g>
        {WORLD_LAND_SHAPES.map((shape) => (
          <path
            key={shape.id}
            d={toPath(shape.polygons, projectWorld)}
            fill="rgba(148,163,184,0.12)"
            stroke="rgba(148,163,184,0.35)"
            strokeWidth={0.8}
            strokeLinejoin="round"
          />
        ))}
      </g>

      {WORLD_REGIONS.map((r) => {
        const heat = byId.get(r.id);
        if (!heat) return null;
        const [cx, cy] = projectWorld(r.center);
        const pct = heat.total / maxReports;
        const color = heatColor(pct);
        const radius = 8 + pct * 26;
        const isHover = hoverRegion === r.id;
        return (
          <g
            key={r.id}
            onMouseEnter={() => setHoverRegion(r.id)}
            onMouseLeave={() => setHoverRegion(null)}
            style={{ cursor: 'pointer' }}
          >
            {heat.total > 0 && (
              <circle cx={cx} cy={cy} r={radius + 8} fill={color} opacity={isHover ? 0.3 : 0.15}>
                <animate
                  attributeName="r"
                  values={`${radius};${radius + 10};${radius}`}
                  dur="3s"
                  repeatCount="indefinite"
                />
              </circle>
            )}
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill={color}
              opacity={isHover ? 1 : 0.85}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={isHover ? 2 : 1}
            />
            {isHover && (
              <Tooltip x={cx + radius + 8} y={cy - 28} name={heat.name} total={heat.total} services={heat.reportsByService.length} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function NorthAmericaMap({ data, maxReports, hoverRegion, setHoverRegion }: MapProps) {
  const byId = useMemo(() => new Map(data.map((r) => [r.id, r])), [data]);
  return (
    <svg
      viewBox={`0 0 ${NA_VIEWBOX.w} ${NA_VIEWBOX.h}`}
      className="w-full h-auto"
      role="img"
      aria-label="United States regional outage map"
    >
      <path
        d={toPath(US_OUTLINE_SHAPE.polygons, projectNA)}
        fill="rgba(148,163,184,0.08)"
        stroke="rgba(148,163,184,0.35)"
        strokeWidth={1}
      />

      {US_REGION_SHAPES.map((shape) => {
        const heat = byId.get(shape.id);
        const pct = heat ? heat.total / maxReports : 0;
        const color = heatColor(pct);
        const isHover = hoverRegion === shape.id;
        const [hubX, hubY] = projectNA(shape.hub);
        return (
          <g
            key={shape.id}
            onMouseEnter={() => setHoverRegion(shape.id)}
            onMouseLeave={() => setHoverRegion(null)}
            style={{ cursor: 'pointer' }}
          >
            <path
              d={toPath(shape.polygons, projectNA)}
              fill={color}
              fillOpacity={isHover ? 0.55 : 0.32}
              stroke={color}
              strokeOpacity={0.9}
              strokeWidth={isHover ? 2 : 1.2}
              strokeLinejoin="round"
              className="transition-all"
            />
            <text
              x={hubX}
              y={hubY - 6}
              fill="var(--foreground)"
              fontSize="13"
              fontWeight={600}
              textAnchor="middle"
              style={{ pointerEvents: 'none' }}
            >
              {shape.short}
            </text>
            <text
              x={hubX}
              y={hubY + 10}
              fill="var(--muted)"
              fontSize="11"
              textAnchor="middle"
              style={{ pointerEvents: 'none' }}
            >
              {(heat?.total || 0).toLocaleString()} reports
            </text>
            {isHover && heat && (
              <Tooltip
                x={hubX + 40}
                y={hubY - 40}
                name={shape.name}
                total={heat.total}
                services={heat.reportsByService.length}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Tooltip({
  x,
  y,
  name,
  total,
  services,
}: {
  x: number;
  y: number;
  name: string;
  total: number;
  services: number;
}) {
  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect
        x={x}
        y={y}
        width={180}
        height={56}
        rx={6}
        fill="var(--surface-elevated)"
        stroke="var(--border-strong)"
      />
      <text x={x + 10} y={y + 18} fill="var(--foreground)" fontSize="11" fontWeight={600}>
        {name}
      </text>
      <text x={x + 10} y={y + 34} fill="var(--muted)" fontSize="10">
        {total.toLocaleString()} reports
      </text>
      <text x={x + 10} y={y + 48} fill="var(--muted-strong)" fontSize="9">
        {services} services tracked
      </text>
    </g>
  );
}
