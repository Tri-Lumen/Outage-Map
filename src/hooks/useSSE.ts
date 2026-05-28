'use client';

import { useEffect, useRef, useState } from 'react';
import { mutate } from 'swr';

export function useSSE() {
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    let es: EventSource;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      es = new EventSource('/api/stream');
      esRef.current = es;

      es.addEventListener('open', () => setConnected(true));

      es.addEventListener('message', (evt) => {
        try {
          const data = JSON.parse(evt.data) as { type: string };
          if (data.type === 'poll_complete') {
            void mutate('/api/status');
            void mutate((key: string) => typeof key === 'string' && key.startsWith('/api/incidents'));
          }
        } catch { /* ignore malformed events */ }
      });

      es.addEventListener('error', () => {
        setConnected(false);
        es.close();
        // Reconnect after 5 seconds
        retryTimeout = setTimeout(connect, 5000);
      });
    }

    connect();

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      esRef.current?.close();
      esRef.current = null;
    };
  }, []);

  return { connected };
}
