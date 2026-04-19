'use client';

import Link from 'next/link';
import { ServiceStatusResponse } from '@/lib/types';
import StatusBadge from './StatusBadge';

interface ServiceCardProps {
  service: ServiceStatusResponse;
  onClick?: () => void;
  href?: string;
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
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

function getStatusAccent(status: string): string {
  switch (status) {
    case 'operational':
      return 'before:bg-emerald-400/60';
    case 'degraded':
      return 'before:bg-yellow-400/60';
    case 'major_outage':
      return 'before:bg-orange-400/70';
    case 'down':
      return 'before:bg-red-400/70';
    default:
      return 'before:bg-gray-500/40';
  }
}

export default function ServiceCard({ service, onClick, href }: ServiceCardProps) {
  const icon = SERVICE_ICONS[service.slug] || '?';
  const accent = getStatusAccent(service.overallStatus);

  const content = (
    <div
      onClick={onClick}
      className={`group relative surface-card rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:border-strong hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] before:absolute before:left-0 before:top-4 before:bottom-4 before:w-0.5 before:rounded-r ${accent}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg"
            style={{ backgroundColor: service.color }}
          >
            {icon}
          </div>
          <div>
            <h3 className="text-foreground font-semibold text-sm leading-tight">{service.name}</h3>
            <p className="text-gray-500 text-[11px] mt-0.5">
              {formatTimestamp(service.lastChecked)}
            </p>
          </div>
        </div>
        <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>

      <div className="mb-3">
        <StatusBadge status={service.overallStatus} size="md" />
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="text-gray-400">
          <span className="text-gray-500">Official:</span>{' '}
          <span className={
            service.officialStatus === 'operational' ? 'text-emerald-400' :
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
          <span className="text-gray-500">DD:</span>{' '}
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
        <p className="text-xs text-gray-400 mt-2 truncate border-t border-subtle pt-2">
          {service.details}
        </p>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
