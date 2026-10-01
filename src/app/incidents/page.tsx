import { Suspense } from 'react';
import IncidentFeed from '@/components/IncidentFeed';
import PageHeader from '@/components/ui/PageHeader';

export const metadata = { title: 'Incidents — Outage Map' };

export default function IncidentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Incidents"
        description="Search and filter every incident across all monitored services."
      />
      <Suspense fallback={null}>
        <IncidentFeed />
      </Suspense>
    </div>
  );
}
