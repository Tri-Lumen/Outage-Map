'use client';

import { useState } from 'react';
import { useServiceStatus, useIncidents, useHistory } from '@/hooks/useStatus';
import { SERVICES } from '@/lib/services';
import Header from './Header';
import ServiceCard from './ServiceCard';
import IncidentFeed from './IncidentFeed';
import OutageChart from './OutageChart';
import ServiceDetailModal from './ServiceDetailModal';

export default function Dashboard() {
  const { data: statusData, error: statusError, isLoading: statusLoading } = useServiceStatus();
  const { data: incidentData } = useIncidents(7);
  const { data: historyData } = useHistory(30);
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const services = statusData?.services || [];
  const incidents = incidentData?.incidents || [];
  const history = historyData?.history || {};

  if (statusLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading dashboard...</p>
          <p className="text-gray-600 text-xs mt-1">Fetching service statuses</p>
        </div>
      </div>
    );
  }

  if (statusError) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Unable to Load Dashboard</h2>
          <p className="text-gray-400 text-sm mb-4">
            Could not fetch service statuses. The polling service may not have run yet.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const selected = services.find((s) => s.slug === selectedService);

  return (
    <div className="min-h-screen bg-gray-950">
      <Header services={services} lastUpdated={statusData?.lastUpdated || null} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Service Status Cards */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            Service Status
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {services.map((service) => (
              <ServiceCard
                key={service.slug}
                service={service}
                onClick={() => setSelectedService(service.slug)}
              />
            ))}
          </div>
        </section>

        {/* Incident Feed */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            Recent Incidents
          </h2>
          <IncidentFeed incidents={incidents} />
        </section>

        {/* 30-Day Outage History Charts */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            30-Day Outage History
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {SERVICES.map((service) => (
              <OutageChart
                key={service.slug}
                serviceName={service.name}
                serviceColor={service.color}
                data={history[service.slug] || []}
              />
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <p className="text-xs text-gray-600">
            Enterprise Outage Dashboard &middot; Data from official status pages &amp; Downdetector
          </p>
          <p className="text-xs text-gray-600">
            Auto-refreshes every 30 seconds
          </p>
        </div>
      </footer>

      {/* Service Detail Modal */}
      {selected && (
        <ServiceDetailModal
          service={selected}
          history={history[selected.slug] || []}
          incidents={incidents}
          onClose={() => setSelectedService(null)}
        />
      )}
    </div>
  );
}
