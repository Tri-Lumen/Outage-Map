'use client';

import { ServiceStatusResponse } from '@/lib/types';

interface HeaderProps {
  services: ServiceStatusResponse[];
  lastUpdated: string | null;
}

function getOverallHealth(services: ServiceStatusResponse[]): {
  label: string;
  color: string;
  bgColor: string;
} {
  const statuses = services.map((s) => s.overallStatus);

  if (statuses.includes('down')) {
    return { label: 'Critical Issues Detected', color: 'text-red-400', bgColor: 'bg-red-500/10' };
  }
  if (statuses.includes('major_outage')) {
    return { label: 'Major Outages Detected', color: 'text-orange-400', bgColor: 'bg-orange-500/10' };
  }
  if (statuses.includes('degraded')) {
    return { label: 'Some Services Degraded', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' };
  }
  if (statuses.every((s) => s === 'unknown')) {
    return { label: 'Checking Services...', color: 'text-gray-400', bgColor: 'bg-gray-500/10' };
  }
  return { label: 'All Systems Operational', color: 'text-green-400', bgColor: 'bg-green-500/10' };
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return 'Never';
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

export default function Header({ services, lastUpdated }: HeaderProps) {
  const health = getOverallHealth(services);
  const operational = services.filter((s) => s.overallStatus === 'operational').length;

  return (
    <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.652a3.75 3.75 0 010-5.304m5.304 0a3.75 3.75 0 010 5.304m-7.425 2.121a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.807-3.808-9.98 0-13.788m13.788 0c3.808 3.807 3.808 9.98 0 13.788M12 12h.008v.008H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              Enterprise Outage Dashboard
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Monitoring {services.length} enterprise services in real-time
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${health.bgColor}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${
                health.color === 'text-green-400' ? 'bg-green-400' :
                health.color === 'text-yellow-400' ? 'bg-yellow-400 animate-pulse' :
                health.color === 'text-orange-400' ? 'bg-orange-400 animate-pulse' :
                health.color === 'text-red-400' ? 'bg-red-400 animate-pulse' :
                'bg-gray-400'
              }`} />
              <span className={`text-sm font-semibold ${health.color}`}>
                {health.label}
              </span>
            </div>

            <div className="text-right hidden sm:block">
              <div className="text-xs text-gray-500">
                {operational}/{services.length} services operational
              </div>
              <div className="text-xs text-gray-500">
                Updated {formatTimestamp(lastUpdated)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
