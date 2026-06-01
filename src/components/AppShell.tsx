'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import MobileTabBar from './MobileTabBar';
import CommandPalette from './CommandPalette';
import PaletteSync from './PaletteSync';
import StatusChangeWatcher from './StatusChangeWatcher';
import { ToastProvider } from './ui/Toast';
import { SidebarProvider, useSidebar } from './SidebarContext';
import { usePresentMode } from '@/hooks/usePresentMode';

function ShellInner({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();
  const { present } = usePresentMode();
  const pathname = usePathname();

  // Public, chrome-less routes render without the app sidebar/nav.
  if (pathname?.startsWith('/status') || pathname?.startsWith('/embed')) {
    return <div className="min-h-screen bg-background text-foreground">{children}</div>;
  }

  if (present) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="px-4 py-4">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />
      <div
        className={`flex-1 transition-[margin] duration-300 min-w-0 ${
          collapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        <MobileNav />
        <main className="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 pb-20 lg:pb-8 max-w-[1500px] mx-auto">
          {children}
        </main>
      </div>
      <CommandPalette />
      <MobileTabBar />
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <ToastProvider>
        <PaletteSync />
        <StatusChangeWatcher />
        <ShellInner>{children}</ShellInner>
      </ToastProvider>
    </SidebarProvider>
  );
}
