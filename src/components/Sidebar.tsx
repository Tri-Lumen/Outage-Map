'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useServiceStatus } from '@/hooks/useStatus';

interface NavItem {
  href: string;
  label: string;
  icon: JSX.Element;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'Overview',
    description: 'Live status of every service',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25A2.25 2.25 0 018.25 10.5H6A2.25 2.25 0 013.75 8.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 018.25 20.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6A2.25 2.25 0 0115.75 3.75H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    href: '/analytics',
    label: 'Analytics',
    description: 'Uptime, SLA & MTTR',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    href: '/map',
    label: 'Outage Map',
    description: 'Geographic report density',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m0-8.25l-3.388-1.694a.75.75 0 00-1.087.671v9.795a.75.75 0 00.415.671L9 18m0-11.25l6 3M9 18l6-3m0 0l3.388 1.694a.75.75 0 001.087-.671V6.228a.75.75 0 00-.415-.67L15 3.75M15 15V6.75" />
      </svg>
    ),
  },
  {
    href: '/alerts',
    label: 'Alerts',
    description: 'Subscriptions & rules',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Settings',
    description: 'Preferences & theme',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function getOverallHealth(statuses: string[]): { label: string; tone: string; dot: string } {
  if (statuses.includes('down')) return { label: 'Critical', tone: 'text-red-400', dot: 'bg-red-400' };
  if (statuses.includes('major_outage')) return { label: 'Major outages', tone: 'text-orange-400', dot: 'bg-orange-400' };
  if (statuses.includes('degraded')) return { label: 'Degraded', tone: 'text-yellow-400', dot: 'bg-yellow-400' };
  if (statuses.length === 0 || statuses.every((s) => s === 'unknown')) return { label: 'Checking…', tone: 'text-gray-400', dot: 'bg-gray-400' };
  return { label: 'All systems normal', tone: 'text-emerald-400', dot: 'bg-emerald-400' };
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { data } = useServiceStatus();
  const services = data?.services || [];
  const health = getOverallHealth(services.map((s) => s.overallStatus));
  const operational = services.filter((s) => s.overallStatus === 'operational').length;

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname?.startsWith(href);

  return (
    <aside
      className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 surface-card border-r border-subtle transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="px-4 pt-6 pb-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-10 h-10 rounded-xl gradient-border p-[1px] flex-shrink-0">
            <div className="w-full h-full rounded-xl bg-surface flex items-center justify-center">
              <svg className="w-5 h-5 text-accent-cyan" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.652a3.75 3.75 0 010-5.304m5.304 0a3.75 3.75 0 010 5.304m-7.425 2.121a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M12 12h.008v.008H12V12z" />
              </svg>
            </div>
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-semibold text-foreground leading-none">Outage Map</p>
              <p className="text-[11px] text-gray-500 mt-1">Enterprise · v2</p>
            </div>
          )}
        </Link>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="p-1.5 rounded-md text-gray-500 hover:text-foreground hover:bg-white/5 transition-colors"
          aria-label="Toggle sidebar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            {collapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            )}
          </svg>
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-1 mt-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                active
                  ? 'bg-accent-soft text-foreground'
                  : 'text-gray-400 hover:text-foreground hover:bg-white/5'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r bg-accent" />
              )}
              <span className={active ? 'text-accent-cyan' : ''}>{item.icon}</span>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium leading-none">{item.label}</div>
                  <div className="text-[11px] text-gray-500 mt-1 truncate">{item.description}</div>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="m-3 p-3 rounded-xl surface-elevated">
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2 h-2 rounded-full ${health.dot} ${health.label.includes('normal') ? '' : 'animate-pulse'}`} />
            <span className={`text-xs font-medium ${health.tone}`}>{health.label}</span>
          </div>
          <div className="text-[11px] text-gray-500">
            {operational}/{services.length || 7} services operational
          </div>
          <div className="mt-2 w-full h-1 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all"
              style={{
                width: services.length
                  ? `${(operational / services.length) * 100}%`
                  : '0%',
              }}
            />
          </div>
        </div>
      )}
    </aside>
  );
}
