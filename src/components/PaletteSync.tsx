'use client';

import { useEffect } from 'react';
import { usePreferences } from '@/hooks/usePreferences';
import { setStatusColorBlind } from '@/lib/boardColors';

/**
 * Keeps the active status palette in sync with the user's color-blind
 * preference. Mounted once near the app root; renders nothing.
 */
export default function PaletteSync() {
  const prefs = usePreferences();
  useEffect(() => {
    setStatusColorBlind(!!prefs.colorBlind);
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.palette = prefs.colorBlind ? 'colorblind' : '';
    }
  }, [prefs.colorBlind]);
  return null;
}
