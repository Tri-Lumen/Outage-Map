'use client';

import { useSyncExternalStore } from 'react';
import { subscribeStatusPalette, getStatusPaletteVersion } from '@/lib/boardColors';

/**
 * Subscribe a component to status-palette changes (e.g. the color-blind
 * toggle). Returns a version number that changes whenever the active palette
 * switches, so it can be dropped into effect dependency arrays (the dependency
 * graph re-paints its canvas on change). Calling it is enough to make a
 * component re-render with the new palette.
 */
export function useStatusPalette(): number {
  return useSyncExternalStore(
    subscribeStatusPalette,
    getStatusPaletteVersion,
    () => 0,
  );
}
