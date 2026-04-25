'use client';

import Link from 'next/link';
import { ServiceStatusResponse } from '@/lib/types';
import StatusBadge from './StatusBadge';
import { formatRelativeTime } from '@/lib/format';

interface ServiceCardProps {
  service: ServiceStatusResponse;
  onClick?: () => void;
  href?: string;
  compact?: boolean;
  showDowndetector?: boolean;
}

const SERVICE_ICONS: Record<string, string> = {
  'microsoft-365': 'M',
  'adobe-cc': 'Ai',
  'servicenow': 'SN',
  'salesforce': 'SF',
  'workday': 'W',
  'zoom': 'Z',
  'google-workspace': 'G',
  'slack': 'S',
  'github': 'GH',
  'atlassian': 'A',
  'okta': 'Ok',
  'cloudflare': 'CF',
  'dropbox': 'Db',
  'aws': 'AWS',
};

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

export default function ServiceCard({
  service,
  onClick,
  href,
  compact = false,
  showDowndetector = true,
}: ServiceCardProps) {
  const icon = SERVICE_ICONS[service.slug] || service.name.charAt(0);
  const accent = getStatusAccent(service.overallStatus);

  const content = (
    <div
      onClick={onClick}
      className={`group relative surface-card rounded-2xl cursor-pointer transition-all duration-200 hover:border-strong hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] before:absolute before:left-0 before:top-4 before:bottom-4 before:w-0.5 before:rounded-r ${accent} ${compact ? 'p-3' : 'p-5'}`}
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
            <h3
              className="text-foreground font-semibold text-sm leading-tight tracking-tight"
              style={{ fontFamily: service.brandFont }}
            >
              {service.name}
            </h3>
            <p className="text-muted-strong text-[11px] mt-0.5">
              {formatRelativeTime(service.lastChecked, 'Never checked')}
            </p>
          </div>
        </div>
        <svg className="w-4 h-4 text-muted-strong group-hover:text-foreground transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>

      <div className="mb-3">
        <StatusBadge status={service.overallStatus} size="md" />
      </div>

      {!compact && (
        <div className="flex items-center justify-between text-xs">
          <div className="text-muted">
            <span className="text-muted-strong">Official:</span>{' '}
            <span className={
              service.officialStatus === 'operational' ? 'text-emerald-400' :
              service.officialStatus === 'degraded' ? 'text-yellow-400' :
              service.officialStatus === 'major_outage' ? 'text-orange-400' :
              service.officialStatus === 'down' ? 'text-red-400' :
              'text-muted'
            }>
              {service.officialStatus === 'operational' ? 'OK' :
               service.officialStatus === 'unknown' ? '--' :
               service.officialStatus.replace('_', ' ')}
            </span>
          </div>
          {showDowndetector && (
            <div className="text-muted">
              <span className="text-muted-strong">DD:</span>{' '}
              <span className={
                service.downdetectorReports >= 500 ? 'text-red-400 font-semibold' :
                service.downdetectorReports >= 100 ? 'text-yellow-400' :
                service.downdetectorStatus === 'unknown' ? 'text-muted-strong italic' :
                'text-foreground'
              }>
                {service.downdetectorStatus === 'unknown'
                  ? 'no data'
                  : service.downdetectorReports > 0
                    ? service.downdetectorReports.toLocaleString()
                    : '--'}
              </span>
            </div>
          )}
        </div>
      )}

      {!compact && service.details && service.overallStatus !== 'operational' && (
        <p className="text-xs text-muted mt-2 truncate border-t border-subtle pt-2">
          {service.details}
        </p>
      )}

      {!compact && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-3 pt-2 border-t border-subtle flex items-center gap-3 text-[10px]"
        >
          <a
            href={service.statusUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-cyan hover:underline"
          >
            Official ↗
          </a>
          {showDowndetector && (
            <>
              <span className="text-muted-strong">·</span>
              <a
                href={service.downdetectorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-cyan hover:underline"
              >
                {service.downdetectorStatus === 'unknown' ? 'Open Downdetector ↗' : 'Downdetector ↗'}
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
