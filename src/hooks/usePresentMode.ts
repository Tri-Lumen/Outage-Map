'use client';

import { useEffect, useState } from 'react';

export interface PresentMode {
  present: boolean;
  rotateMs: number | null;
}

function readSearchParams(): PresentMode {
  if (typeof window === 'undefined') return { present: false, rotateMs: null };
  const params = new URLSearchParams(window.location.search);
  const present = params.get('present') === '1';
  if (!present) return { present: false, rotateMs: null };
  const rotate = Number(params.get('rotate'));
  const rotateMs = Number.isFinite(rotate) && rotate > 0 ? rotate * 1000 : null;
  return { present: true, rotateMs };
}

export function usePresentMode(): PresentMode {
  const [mode, setMode] = useState<PresentMode>({ present: false, rotateMs: null });

  useEffect(() => {
    setMode(readSearchParams());
    const onPop = () => setMode(readSearchParams());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return mode;
}

export function enterPresent() {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  params.set('present', '1');
  window.history.pushState({}, '', `${window.location.pathname}?${params}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function exitPresent() {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  params.delete('present');
  params.delete('rotate');
  const qs = params.toString();
  window.history.pushState({}, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
