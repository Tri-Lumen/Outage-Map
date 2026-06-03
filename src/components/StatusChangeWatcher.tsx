'use client';

import { useEffect, useRef } from 'react';
import { useServiceStatus } from '@/hooks/useStatus';
import { usePreferences } from '@/hooks/usePreferences';
import { getStatusColor } from '@/lib/boardColors';
import { useToast } from './ui/Toast';

/**
 * Watches service status and raises a toast when a watched service changes
 * overall status. Watches pinned services when any are pinned, otherwise all
 * services. Skips the initial snapshot so it only reports genuine transitions.
 */
export default function StatusChangeWatcher() {
  const { data } = useServiceStatus();
  const prefs = usePreferences();
  const { push } = useToast();
  const prev = useRef<Record<string, string> | null>(null);

  useEffect(() => {
    const services = data?.services ?? [];
    if (services.length === 0) return;

    const watched = prefs.pinnedServices.length ? new Set(prefs.pinnedServices) : null; // null = all
    const current: Record<string, string> = {};
    for (const s of services) current[s.slug] = s.overallStatus;

    if (prev.current) {
      for (const s of services) {
        if (watched && !watched.has(s.slug)) continue;
        const before = prev.current[s.slug];
        if (before && before !== s.overallStatus) {
          const label = getStatusColor(s.overallStatus).label;
          const tone =
            s.overallStatus === 'operational'
              ? 'success'
              : s.overallStatus === 'down' || s.overallStatus === 'major_outage'
                ? 'error'
                : 'warning';
          push(`${s.name} is now ${label}`, tone);
        }
      }
    }
    prev.current = current;
  }, [data, prefs.pinnedServices, push]);

  return null;
}
