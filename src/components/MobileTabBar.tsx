'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const TABS = [
  {
    href: '/',
    label: 'Overview',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25A2.25 2.25 0 018.25 10.5H6A2.25 2.25 0 013.75 8.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 018.25 20.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6A2.25 2.25 0 0115.75 3.75H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    href: '/map',
    label: 'Map',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m0-8.25l-3.388-1.694a.75.75 0 00-1.087.671v9.795a.75.75 0 00.415.671L9 18m0-11.25l6 3M9 18l6-3m0 0l3.388 1.694a.75.75 0 001.087-.671V6.228a.75.75 0 00-.415-.67L15 3.75M15 15V6.75" />
      </svg>
    ),
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    href: '/alerts',
    label: 'Alerts',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
    ),
  },
];

const MORE_LINKS = [
  { href: '/sources', label: 'Sources' },
  { href: '/settings', label: 'Settings' },
  { href: '/maintenance', label: 'Maintenance' },
  { href: '/dependencies', label: 'Dependencies' },
];

export default function MobileTabBar() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname?.startsWith(href);

  return (
    <>
      {showMore && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          onClick={() => setShowMore(false)}
        >
          <div className="absolute bottom-16 left-0 right-0 mx-4 surface-elevated rounded-xl border border-subtle shadow-xl overflow-hidden">
            {MORE_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setShowMore(false)}
                className="block px-5 py-3 text-sm text-foreground hover:bg-white/5 border-b border-subtle last:border-0 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 surface-card border-t border-subtle flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-xl transition-colors min-w-0 flex-1 ${
                active ? 'text-accent-cyan' : 'text-muted hover:text-foreground'
              }`}
            >
              {tab.icon}
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}

        <button
          onClick={() => setShowMore((v) => !v)}
          className="flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-xl text-muted hover:text-foreground transition-colors flex-1"
          aria-label="More navigation options"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
          </svg>
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>
    </>
  );
}
