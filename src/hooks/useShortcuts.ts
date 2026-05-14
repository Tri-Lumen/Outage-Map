'use client';

import { useEffect } from 'react';

export type ShortcutMap = Record<string, (e: KeyboardEvent) => void>;

interface Options {
  enabled?: boolean;
}

function normalize(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push('mod');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  let key = e.key;
  if (key.length === 1) key = key.toLowerCase();
  parts.push(key);
  return parts.join('+');
}

function inEditable(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return true;
  return target.isContentEditable;
}

export function useShortcuts(map: ShortcutMap, { enabled = true }: Options = {}) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const combo = normalize(e);
      // Always allow Escape, even inside inputs.
      if (combo !== 'Escape' && inEditable(e.target)) return;
      const fn = map[combo];
      if (fn) {
        e.preventDefault();
        fn(e);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [map, enabled]);
}
