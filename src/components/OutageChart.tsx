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
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: statusToColor(data.status) }}
          />
          <span className="text-xs text-white capitalize">
            {data.status.replace('_', ' ')}
          </span>
        </div>
        <p className="text-xs text-gray-300">
          Reports: <span className="text-white font-medium">{data.reports}</span>
        </p>
        {data.outageMinutes > 0 && (
          <p className="text-xs text-gray-300">
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
      <div className="bg-gray-800/30 rounded-xl border border-gray-700/50 p-4">
        <h3 className="text-sm font-semibold text-white mb-3">{serviceName}</h3>
        <div className="h-32 flex items-center justify-center text-gray-500 text-xs">
          No history data yet. Data will populate as the dashboard polls services.
        </div>
      </div>
    );
  }

  const chartData = data.map((point) => ({
    ...point,
    date: formatDate(point.date),
    fillColor: statusToColor(point.status),
  }));

  return (
    <div className="bg-gray-800/30 rounded-xl border border-gray-700/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <span
            className="w-3 h-3 rounded"
            style={{ backgroundColor: serviceColor }}
          />
          {serviceName}
        </h3>
        <span className="text-xs text-gray-500">
          {data.length} days
        </span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id={`grad-${serviceName.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={serviceColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={serviceColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={{ stroke: '#374151' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={{ stroke: '#374151' }}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="reports"
            stroke={serviceColor}
            strokeWidth={2}
            fill={`url(#grad-${serviceName.replace(/\s/g, '')})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
