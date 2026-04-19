'use client';

import { useMemo, useState } from 'react';
import { useServiceStatus } from '@/hooks/useStatus';
import { SERVICES } from '@/lib/services';
import PageHeader from './ui/PageHeader';
import StatTile from './ui/StatTile';
import Card from './ui/Card';

interface Region {
  id: string;
  name: string;
  x: number;
  y: number;
  population: number;
}

const REGIONS: Region[] = [
  { id: 'na-w', name: 'North America · West', x: 140, y: 150, population: 0.18 },
  { id: 'na-e', name: 'North America · East', x: 250, y: 155, population: 0.22 },
  { id: 'sa', name: 'South America', x: 290, y: 310, population: 0.08 },
  { id: 'eu-w', name: 'Europe · West', x: 470, y: 140, population: 0.17 },
  { id: 'eu-e', name: 'Europe · East', x: 530, y: 145, population: 0.07 },
  { id: 'af', name: 'Africa', x: 510, y: 270, population: 0.06 },
  { id: 'me', name: 'Middle East', x: 575, y: 195, population: 0.05 },
  { id: 'as-s', name: 'South Asia', x: 650, y: 215, population: 0.08 },
  { id: 'as-se', name: 'Southeast Asia', x: 720, y: 260, population: 0.05 },
  { id: 'as-e', name: 'East Asia', x: 760, y: 175, population: 0.12 },
  { id: 'oc', name: 'Oceania', x: 820, y: 345, population: 0.03 },
];

function deterministicShare(reports: number, regionId: string, serviceSlug: string) {
  let hash = 0;
  const seed = `${regionId}-${serviceSlug}`;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const jitter = (hash % 1000) / 1000;
  return Math.round(reports * (0.4 + jitter * 0.6));
}

export default function OutageMapView() {
  const { data } = useServiceStatus();
  const services = useMemo(() => data?.services || [], [data]);
  const [selectedService, setSelectedService] = useState<string>('all');
  const [hoverRegion, setHoverRegion] = useState<string | null>(null);

  const regionData = useMemo(() => {
    const filtered = selectedService === 'all'
      ? services
      : services.filter((s) => s.slug === selectedService);

    return REGIONS.map((r) => {
      const reportsByService = filtered.map((s) => {
        const share = deterministicShare(
          s.downdetectorReports || 0,
          r.id,
          s.slug,
        );
        const popScaled = Math.round(share * r.population * 3);
        return { slug: s.slug, name: s.name, color: s.color, reports: popScaled };
      });
      const total = reportsByService.reduce((sum, s) => sum + s.reports, 0);
      return { ...r, total, reportsByService };
    });
  }, [services, selectedService]);

  const maxReports = Math.max(1, ...regionData.map((r) => r.total));
  const totalReports = regionData.reduce((s, r) => s + r.total, 0);
  const hotspotRegions = regionData.filter((r) => r.total > maxReports * 0.5).length;

  const getColor = (total: number) => {
    const pct = total / maxReports;
    if (pct === 0) return '#334155';
    if (pct < 0.25) return '#0ea5e9';
    if (pct < 0.5) return '#eab308';
    if (pct < 0.75) return '#f97316';
    return '#ef4444';
  };

  const getRadius = (total: number) => {
    const pct = total / maxReports;
    return 8 + pct * 26;
  };

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
          value={regionData.filter((r) => r.total > 0).length}
          accent="cyan"
          hint={`of ${REGIONS.length}`}
        />
        <StatTile
          label="Hotspots"
          value={hotspotRegions}
          accent={hotspotRegions > 0 ? 'red' : 'green'}
          hint=">50% of peak"
        />
        {(() => {
          const peak = regionData.reduce(
            (a, b) => (b.total > a.total ? b : a),
            regionData[0],
          );
          const hasReports = peak && peak.total > 0;
          return (
            <StatTile
              label="Peak Region"
              value={hasReports ? peak.name.split(' · ')[0] : '—'}
              accent="amber"
              hint={hasReports ? `${peak.total.toLocaleString()} reports` : 'No reports'}
            />
          );
        })()}
      </section>

      <Card padded={false}>
        <div className="px-5 py-4 border-b border-subtle flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Report density by region</h2>
            <p className="text-xs text-gray-500 mt-0.5">Larger dots · redder tint = more reports</p>
          </div>
          <div className="flex items-center gap-1 bg-white/5 rounded-md p-0.5 overflow-x-auto">
            <button
              onClick={() => setSelectedService('all')}
              className={`px-3 py-1 text-xs rounded whitespace-nowrap ${
                selectedService === 'all'
                  ? 'bg-accent-soft text-foreground'
                  : 'text-gray-400 hover:text-foreground'
              }`}
            >
              All services
            </button>
            {SERVICES.map((s) => (
              <button
                key={s.slug}
                onClick={() => setSelectedService(s.slug)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded whitespace-nowrap ${
                  selectedService === s.slug
                    ? 'bg-accent-soft text-foreground'
                    : 'text-gray-400 hover:text-foreground'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                {s.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        <div className="relative grid-bg overflow-hidden">
          <svg viewBox="0 0 960 480" className="w-full h-auto">
            <defs>
              <radialGradient id="glow">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
            </defs>

            <g opacity="0.35" fill="none" stroke="rgba(148,163,184,0.35)" strokeWidth="1">
              {/* Simplified continent paths */}
              <path d="M80 130 Q120 90 180 100 Q240 90 280 130 L300 180 Q260 220 200 230 Q150 230 100 200 Z" />
              <path d="M240 250 Q280 250 310 290 Q320 350 290 390 Q260 410 240 370 Q220 320 240 250 Z" />
              <path d="M430 110 Q490 90 550 110 Q580 140 570 170 Q530 180 480 175 Q440 165 430 110 Z" />
              <path d="M460 210 Q520 220 555 260 Q560 320 530 350 Q490 360 470 320 Q450 270 460 210 Z" />
              <path d="M590 150 Q660 130 740 150 Q800 170 810 210 Q770 240 700 235 Q620 230 590 180 Z" />
              <path d="M690 260 Q740 270 760 300 Q740 330 700 320 Q670 300 690 260 Z" />
              <path d="M780 310 Q840 320 870 360 Q850 390 810 385 Q770 370 780 310 Z" />
            </g>

            {regionData.map((r) => {
              const isHover = hoverRegion === r.id;
              const color = getColor(r.total);
              const radius = getRadius(r.total);
              return (
                <g
                  key={r.id}
                  onMouseEnter={() => setHoverRegion(r.id)}
                  onMouseLeave={() => setHoverRegion(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {r.total > 0 && (
                    <circle
                      cx={r.x}
                      cy={r.y}
                      r={radius + 8}
                      fill={color}
                      opacity={isHover ? 0.3 : 0.15}
                      className="transition-opacity"
                    >
                      <animate
                        attributeName="r"
                        values={`${radius};${radius + 10};${radius}`}
                        dur="3s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}
                  <circle
                    cx={r.x}
                    cy={r.y}
                    r={radius}
                    fill={color}
                    opacity={isHover ? 1 : 0.8}
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth={isHover ? 2 : 1}
                    className="transition-all"
                  />
                  {isHover && (
                    <g>
                      <rect
                        x={r.x + radius + 8}
                        y={r.y - 28}
                        width={170}
                        height={56}
                        rx={6}
                        fill="#0f1320"
                        stroke="rgba(148,163,184,0.3)"
                      />
                      <text x={r.x + radius + 18} y={r.y - 12} fill="#f9fafb" fontSize="11" fontWeight="600">
                        {r.name}
                      </text>
                      <text x={r.x + radius + 18} y={r.y + 4} fill="#94a3b8" fontSize="10">
                        {r.total.toLocaleString()} reports
                      </text>
                      <text x={r.x + radius + 18} y={r.y + 18} fill="#64748b" fontSize="9">
                        {r.reportsByService.length} services tracked
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          <div className="absolute bottom-4 left-4 flex items-center gap-3 px-3 py-2 rounded-lg bg-black/40 backdrop-blur-sm border border-subtle">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Scale</span>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-slate-600" />
              <span className="w-3 h-3 rounded-full bg-sky-500" />
              <span className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="w-3 h-3 rounded-full bg-red-500" />
            </div>
            <span className="text-[10px] text-gray-500">low → high</span>
          </div>
        </div>
      </Card>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-accent-cyan" />
          Regional leaderboard
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...regionData]
            .sort((a, b) => b.total - a.total)
            .slice(0, 6)
            .map((r, i) => (
              <Card key={r.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs font-mono text-gray-400">
                  #{i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground font-medium truncate">{r.name}</p>
                  <p className="text-xs text-gray-500">{r.total.toLocaleString()} reports</p>
                </div>
                <span
                  className="w-8 h-8 rounded-full"
                  style={{
                    backgroundColor: getColor(r.total),
                    opacity: 0.7,
                  }}
                />
              </Card>
            ))}
        </div>
      </section>
    </div>
  );
}
