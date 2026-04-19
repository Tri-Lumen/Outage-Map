'use client';

import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 lg:ml-64 transition-[margin] duration-300 min-w-0">
        <MobileNav />
        <main className="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-[1500px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
