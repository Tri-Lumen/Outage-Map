import { Suspense } from 'react';
import MaintenanceView from '@/components/MaintenanceView';
import PageHeader from '@/components/ui/PageHeader';

export const metadata = { title: 'Maintenance Windows — Outage Map' };

export default function MaintenancePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Maintenance Windows"
        description="Schedule planned maintenance to suppress alerts during downtime."
      />
      <Suspense fallback={null}>
        <MaintenanceView />
      </Suspense>
    </div>
  );
}
