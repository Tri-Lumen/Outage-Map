'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', label: 'Status' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/map', label: 'Map' },
  { href: '/alerts', label: 'Alerts' },
  { href: '/settings', label: 'Settings' },
];

export default function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="lg:hidden sticky top-0 z-40 surface-card border-b border-subtle">
      <div className="flex items-center gap-1 overflow-x-auto px-3 py-2">
        {ITEMS.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'bg-accent-soft text-foreground'
                  : 'text-gray-400 hover:text-foreground'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
