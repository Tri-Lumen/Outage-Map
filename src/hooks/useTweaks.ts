'use client';

import { useCallback, useEffect, useState } from 'react';

export interface Tweaks {
  accent: string;
  density: 'compact' | 'comfortable';
  showGridLines: boolean;
  tileRadius: number;
  /** Most-recent first, capped at 8. Front-padding/dedupe handled by setTweak. */
  accentRecents?: string[];
}

const RECENTS_LIMIT = 8;

const TWEAKS_STORAGE_KEY = 'outage-board-tweaks';

const DEFAULT_TWEAKS: Tweaks = {
  accent: '#268bd2',
  density: 'comfortable',
  showGridLines: true,
  tileRadius: 14,
};

function readTweaks(): Tweaks {
  if (typeof window === 'undefined') return DEFAULT_TWEAKS;
  try {
    const raw = localStorage.getItem(TWEAKS_STORAGE_KEY);
    if (raw) return { ...DEFAULT_TWEAKS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_TWEAKS;
}

function applyTweaks(t: Tweaks) {
  const root = document.documentElement;
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--tile-radius', `${t.tileRadius}px`);
  root.dataset.density = t.density;
  root.dataset.gridLines = t.showGridLines ? 'on' : 'off';
}

export interface TweaksApi {
  setTweak: (key: keyof Tweaks, value: unknown) => void;
  setTweaks: (next: Tweaks) => void;
}

export function useTweaks(): [Tweaks, TweaksApi] {
  const [tweaks, setTweaksState] = useState<Tweaks>(DEFAULT_TWEAKS);

  useEffect(() => {
    const stored = readTweaks();
    setTweaksState(stored);
    applyTweaks(stored);
  }, []);

  useEffect(() => {
    applyTweaks(tweaks);
    try {
      localStorage.setItem(TWEAKS_STORAGE_KEY, JSON.stringify(tweaks));
    } catch {
      // ignore
    }
  }, [tweaks]);

  const setTweak = useCallback((key: keyof Tweaks, value: unknown) => {
    setTweaksState((prev) => {
      if (key === 'accent' && typeof value === 'string') {
        const recents = [value, ...(prev.accentRecents ?? []).filter((c) => c !== value)]
          .slice(0, RECENTS_LIMIT);
        return { ...prev, accent: value, accentRecents: recents };
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const setTweaks = useCallback((next: Tweaks) => {
    setTweaksState({ ...DEFAULT_TWEAKS, ...next });
  }, []);

  return [tweaks, { setTweak, setTweaks }];
}
