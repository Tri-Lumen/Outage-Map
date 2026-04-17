'use client';

import { ServiceStatusResponse } from '@/lib/types';
import StatusBadge from './StatusBadge';

interface ServiceCardProps {
  service: ServiceStatusResponse;
  onClick?: () => void;
}

const SERVICE_ICONS: Record<string, string> = {
  'microsoft-365': 'M',
  'adobe-cc': 'Ai',
  'servicenow': 'SN',
  'salesforce': 'SF',
  'workday': 'W',
  'zoom': 'Z',
  'google-workspace': 'G',
};

function formatTimestamp(ts: string | null): string {
  if (!ts) return 'Never checked';
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

function getStatusBorderColor(status: string): string {
  switch (status) {
    case 'operational': return 'border-green-500/20 hover:border-green-500/40';
    case 'degraded': return 'border-yellow-500/30 hover:border-yellow-500/50';
    case 'major_outage': return 'border-orange-500/30 hover:border-orange-500/50';
    case 'down': return 'border-red-500/30 hover:border-red-500/50';
    default: return 'border-gray-700 hover:border-gray-600';
  }
}

export default function ServiceCard({ service, onClick }: ServiceCardProps) {
  const icon = SERVICE_ICONS[service.slug] || '?';

  return (
    <div
      onClick={onClick}
      className={`bg-gray-800/50 rounded-xl border ${getStatusBorderColor(service.overallStatus)} p-5 cursor-pointer transition-all duration-200 hover:bg-gray-800/80 hover:shadow-lg`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: service.color }}
          >
            {icon}
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">{service.name}</h3>
            <p className="text-gray-500 text-xs">
              {formatTimestamp(service.lastChecked)}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-3">
        <StatusBadge status={service.overallStatus} size="md" />
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="text-gray-400">
          <span className="text-gray-500">Official:</span>{' '}
          <span className={
            service.officialStatus === 'operational' ? 'text-green-400' :
            service.officialStatus === 'degraded' ? 'text-yellow-400' :
            service.officialStatus === 'major_outage' ? 'text-orange-400' :
            service.officialStatus === 'down' ? 'text-red-400' :
            'text-gray-400'
          }>
            {service.officialStatus === 'operational' ? 'OK' :
             service.officialStatus === 'unknown' ? '--' :
             service.officialStatus.replace('_', ' ')}
          </span>
        </div>
        <div className="text-gray-400">
          <span className="text-gray-500">DD Reports:</span>{' '}
          <span className={
            service.downdetectorReports >= 500 ? 'text-red-400 font-semibold' :
            service.downdetectorReports >= 100 ? 'text-yellow-400' :
            'text-gray-300'
          }>
            {service.downdetectorReports > 0 ? service.downdetectorReports.toLocaleString() : '--'}
          </span>
        </div>
      </div>

      {service.details && service.overallStatus !== 'operational' && (
        <p className="text-xs text-gray-400 mt-2 truncate">
          {service.details}
        </p>
      )}
    </div>
  );
}
