'use client';

import { useEffect } from 'react';

/** Registers the service worker that powers PWA install + web push. */
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* registration is best-effort */
      });
    }
  }, []);
  return null;
}
