'use client';

import { ServiceStatus } from '@/lib/types';

const STATUS_CONFIG: Record<ServiceStatus, { label: string; bg: string; text: string; dot: string }> = {
  operational: {
    label: 'Operational',
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    dot: 'bg-green-400',
  },
  degraded: {
    label: 'Degraded',
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    dot: 'bg-yellow-400',
  },
  major_outage: {
    label: 'Major Outage',
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    dot: 'bg-orange-400',
  },
  down: {
    label: 'Down',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    dot: 'bg-red-400',
  },
  unknown: {
    label: 'Unknown',
    bg: 'bg-[color:var(--surface-elevated)]',
    text: 'text-muted',
    dot: 'bg-muted',
  },
};

interface StatusBadgeProps {
  status: ServiceStatus;
  size?: 'sm' | 'md' | 'lg';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  return (
    <span
      role="status"
      aria-label={`Status: ${config.label}`}
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.bg} ${config.text} ${sizeClasses[size]}`}
    >
      <span
        aria-hidden="true"
        className={`${dotSizes[size]} rounded-full ${config.dot} ${
          status !== 'operational' && status !== 'unknown' ? 'animate-pulse' : ''
        }`}
      />
      {config.label}
    </span>
  );
}
