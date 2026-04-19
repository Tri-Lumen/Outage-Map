'use client';

import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import { SidebarProvider, useSidebar } from './SidebarContext';

function ShellInner({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />
      <div
        className={`flex-1 transition-[margin] duration-300 min-w-0 ${
          collapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        <MobileNav />
        <main className="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-[1500px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <ShellInner>{children}</ShellInner>
    </SidebarProvider>
  );
}
