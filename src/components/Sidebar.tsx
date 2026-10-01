'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useServiceStatus, useSummary } from '@/hooks/useStatus';
import { useSession } from '@/hooks/useSession';
import { useTranslation } from '@/lib/i18n';
import { useSidebar } from './SidebarContext';

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
    description: 'Your modular board',
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
    label: 'Heat Map',
    description: 'Geographic density',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m0-8.25l-3.388-1.694a.75.75 0 00-1.087.671v9.795a.75.75 0 00.415.671L9 18m0-11.25l6 3M9 18l6-3m0 0l3.388 1.694a.75.75 0 001.087-.671V6.228a.75.75 0 00-.415-.67L15 3.75M15 15V6.75" />
      </svg>
    ),
  },
  {
    href: '/alerts',
    label: 'Alerts',
    description: 'Rules & subscriptions',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
    ),
  },
  {
    href: '/incidents',
    label: 'Incidents',
    description: 'Search all incidents',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
      </svg>
    ),
  },
  {
    href: '/sources',
    label: 'Sources',
    description: 'Imported services',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 11a9 9 0 019 9M4 4a16 16 0 0116 16M5 19a1 1 0 11-2 0 1 1 0 012 0z" />
      </svg>
    ),
  },
  {
    href: '/maintenance',
    label: 'Maintenance',
    description: 'Planned downtime windows',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    href: '/dependencies',
    label: 'Dependencies',
    description: 'Service dependency graph',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
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
  if (statuses.length === 0 || statuses.every((s) => s === 'unknown')) return { label: 'Checking…', tone: 'text-muted', dot: 'bg-muted' };
  return { label: 'All systems normal', tone: 'text-emerald-400', dot: 'bg-emerald-400' };
}

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { user, mutate: mutateSession } = useSession();
  const { collapsed, setCollapsed } = useSidebar();
  const { data } = useServiceStatus();
  const { data: summary } = useSummary(60000);
  const services = data?.services || [];
  const health = getOverallHealth(services.map((s) => s.overallStatus));
  const operational = summary?.operational ?? services.filter((s) => s.overallStatus === 'operational').length;
  const total = summary?.totalServices ?? services.length;
  const activeIncidents = summary?.activeIncidents ?? 0;
  const uptimePct = summary?.uptimePct;

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
              <p className="text-[11px] text-muted-strong mt-1">Enterprise · v3</p>
            </div>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
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

      <div className="px-3 mt-1 mb-2">
        <button
          onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
          title={collapsed ? 'Search (⌘K)' : undefined}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg surface-elevated border border-subtle text-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Open command palette"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          {!collapsed && (
            <>
              <span className="text-xs flex-1 text-left">Search…</span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-subtle text-muted-strong">⌘K</kbd>
            </>
          )}
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? t(item.label) : undefined}
              aria-current={active ? 'page' : undefined}
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                active
                  ? 'bg-surface-elevated text-foreground shadow-sm'
                  : 'text-muted hover:text-foreground hover:bg-white/5'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r bg-accent" />
              )}
              <span className={active ? 'text-accent-cyan' : ''}>{item.icon}</span>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium leading-none">{t(item.label)}</div>
                  <div className={`text-[11px] mt-1 truncate ${active ? 'text-muted' : 'text-muted-strong'}`}>{t(item.description)}</div>
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
          <div className="text-[11px] text-muted">
            {operational}/{total || '—'} services operational
          </div>
          {activeIncidents > 0 && (
            <div className="text-[11px] text-amber-400 mt-1">
              {activeIncidents} active incident{activeIncidents !== 1 ? 's' : ''}
            </div>
          )}
          {uptimePct !== undefined && (
            <div className="text-[11px] text-muted mt-1">
              {uptimePct.toFixed(1)}% uptime
            </div>
          )}
          <div className="mt-2 w-full h-1 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all"
              style={{
                width: total ? `${(operational / total) * 100}%` : '0%',
              }}
            />
          </div>
        </div>
      )}

      {!collapsed && (
        <div className="mx-3 mb-3 px-3 py-2 rounded-xl surface-elevated flex items-center justify-between gap-2">
          {user ? (
            <>
              <div className="min-w-0">
                <div className="text-xs font-medium text-foreground truncate">{user.email}</div>
                <div className="text-[10px] text-muted capitalize">{user.role}</div>
              </div>
              <button
                onClick={async () => {
                  await fetch('/api/auth/logout', { method: 'POST' });
                  await mutateSession();
                }}
                className="text-[11px] text-muted hover:text-foreground transition-colors flex-shrink-0"
              >
                Log out
              </button>
            </>
          ) : (
            <Link href="/login" className="text-xs text-muted hover:text-foreground transition-colors">
              Log in
            </Link>
          )}
        </div>
      )}
    </aside>
  );
}
