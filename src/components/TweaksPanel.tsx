'use client';

import { useRef } from 'react';
import type { Tweaks } from '@/hooks/useTweaks';
import { THEMES, type Theme } from './ThemeProvider';

interface Props {
  open: boolean;
  onClose: () => void;
  tweaks: Tweaks;
  setTweak: (key: keyof Tweaks, value: unknown) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ACCENT_OPTIONS = ['#268bd2', '#2aa198', '#b58900', '#d33682', '#859900', '#3b82f6'];

export default function TweaksPanel({ open, onClose, tweaks, setTweak, theme, setTheme }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 16, y: 16 });

  const onDragStart = (e: React.MouseEvent) => {
    const panel = panelRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;

    const move = (ev: MouseEvent) => {
      offsetRef.current = {
        x: Math.max(8, startRight - (ev.clientX - sx)),
        y: Math.max(8, startBottom - (ev.clientY - sy)),
      };
      if (panel) {
        panel.style.right = offsetRef.current.x + 'px';
        panel.style.bottom = offsetRef.current.y + 'px';
      }
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  if (!open) return null;

  return (
    <div ref={panelRef} className="twk-panel">
      {/* Header */}
      <div className="twk-hd" onMouseDown={onDragStart}>
        <b>Tweaks</b>
        <button className="twk-x" onClick={onClose} aria-label="Close tweaks">✕</button>
      </div>

      <div className="twk-body">
        {/* Layout section */}
        <div className="twk-sect">Layout</div>

        {/* Density */}
        <div className="twk-row">
          <div className="twk-lbl"><span>Density</span></div>
          <div className="twk-seg">
            {(['compact', 'comfortable'] as const).map((v) => (
              <button
                key={v}
                data-on={tweaks.density === v}
                onClick={() => setTweak('density', v)}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Grid lines */}
        <div className="twk-row twk-row-h">
          <div className="twk-lbl"><span>Grid lines</span></div>
          <button
            type="button"
            className="twk-toggle"
            data-on={tweaks.showGridLines}
            role="switch"
            aria-checked={tweaks.showGridLines}
            onClick={() => setTweak('showGridLines', !tweaks.showGridLines)}
          >
            <i />
          </button>
        </div>

        {/* Tile radius */}
        <div className="twk-row">
          <div className="twk-lbl">
            <span>Tile radius</span>
            <span className="twk-val">{tweaks.tileRadius}px</span>
          </div>
          <input
            type="range"
            className="twk-slider"
            min={0}
            max={24}
            step={2}
            value={tweaks.tileRadius}
            onChange={(e) => setTweak('tileRadius', Number(e.target.value))}
          />
        </div>

        {/* Theme section */}
        <div className="twk-sect">Theme</div>

        {/* Theme select */}
        <div className="twk-row">
          <div className="twk-lbl"><span>Theme</span></div>
          <select
            className="twk-field"
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
          >
            {THEMES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Accent */}
        <div className="twk-row">
          <div className="twk-lbl"><span>Accent color</span></div>
          <div className="twk-chips">
            {ACCENT_OPTIONS.map((color) => (
              <button
                key={color}
                className="twk-chip"
                data-on={tweaks.accent === color}
                style={{ background: color }}
                onClick={() => setTweak('accent', color)}
                title={color}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
