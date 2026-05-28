import { Suspense } from 'react';
import DependencyGraph from '@/components/DependencyGraph';
import PageHeader from '@/components/ui/PageHeader';

export const metadata = { title: 'Service Dependencies — Outage Map' };

export default function DependenciesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Service Dependencies"
        description="Directed graph of known service relationships. Cascading failures are highlighted in red."
      />
      <Suspense fallback={<div className="text-muted text-sm">Loading graph…</div>}>
        <DependencyGraph />
      </Suspense>
    </div>
  );
}
