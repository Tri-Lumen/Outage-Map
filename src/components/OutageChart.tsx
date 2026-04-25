'use client';

import { HistoryPoint } from '@/lib/types';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface OutageChartProps {
  serviceName: string;
  serviceColor: string;
  data: HistoryPoint[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function statusToColor(status: string): string {
  switch (status) {
    case 'operational': return '#22c55e';
    case 'degraded': return '#eab308';
    case 'major_outage': return '#f97316';
    case 'down': return '#ef4444';
    default: return '#6b7280';
  }
}

interface TooltipPayload {
  date: string;
  reports: number;
  incidents: number;
  outageMinutes: number;
  status: string;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ payload: TooltipPayload }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;

  return (
    <div className="surface-elevated rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-muted mb-1">{label}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: statusToColor(data.status) }}
          />
          <span className="text-xs text-foreground capitalize">
            {data.status.replace('_', ' ')}
          </span>
        </div>
        <p className="text-xs text-muted">
          Reports: <span className="text-foreground font-medium">{data.reports}</span>
        </p>
        {data.incidents > 0 && (
          <p className="text-xs text-muted">
            Incidents: <span className="text-foreground font-medium">{data.incidents}</span>
          </p>
        )}
        {data.outageMinutes > 0 && (
          <p className="text-xs text-muted">
            Outage: <span className="text-orange-400 font-medium">{data.outageMinutes}min</span>
          </p>
        )}
      </div>
    </div>
  );
}

export default function OutageChart({ serviceName, serviceColor, data }: OutageChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="surface-card rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">{serviceName}</h3>
        <div className="h-32 flex items-center justify-center text-muted text-xs text-center px-2">
          No history yet — first data point appears after the next poll cycle.
        </div>
      </div>
    );
  }

  const chartData = data.map((point) => ({
    ...point,
    date: formatDate(point.date),
    fillColor: statusToColor(point.status),
  }));

  const hasReports = chartData.some((p) => p.reports > 0);
  const hasIncidents = chartData.some((p) => (p.incidents || 0) > 0);
  const gradId = `grad-${serviceName.replace(/\s/g, '')}`;
  const incidentGradId = `grad-incidents-${serviceName.replace(/\s/g, '')}`;

  return (
    <div className="surface-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 tracking-tight">
          <span
            className="w-3 h-3 rounded"
            style={{ backgroundColor: serviceColor }}
          />
          {serviceName}
        </h3>
        <span className="text-xs text-muted">
          {data.length} days
        </span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={serviceColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={serviceColor} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={incidentGradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-strong)" />
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--muted)', fontSize: 10 }}
            axisLine={{ stroke: 'var(--border-strong)' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: 'var(--muted)', fontSize: 10 }}
            axisLine={{ stroke: 'var(--border-strong)' }}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* Always render the reports area, but draw the incidents area on top
              so Zoom-style services (flat DD reports but real Statuspage incidents)
              still show activity. */}
          <Area
            type="monotone"
            dataKey="reports"
            stroke={hasReports ? serviceColor : 'transparent'}
            strokeWidth={2}
            fill={`url(#${gradId})`}
          />
          {hasIncidents && (
            <Area
              type="monotone"
              dataKey="incidents"
              stroke="#f97316"
              strokeWidth={1.5}
              fill={`url(#${incidentGradId})`}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
