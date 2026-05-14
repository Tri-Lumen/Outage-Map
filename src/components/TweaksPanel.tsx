'use client';

import { useRef, useState } from 'react';
import type { Tweaks } from '@/hooks/useTweaks';
import type { TileConfig } from '@/hooks/useBoard';
import { serializeBoard, parseBoardFile } from '@/lib/board/io';
import { THEMES, type Theme, type CustomTheme } from './ThemeProvider';

interface Props {
  open: boolean;
  onClose: () => void;
  tweaks: Tweaks;
  setTweak: (key: keyof Tweaks, value: unknown) => void;
  setTweaks: (next: Tweaks) => void;
  board: TileConfig[];
  setBoard: (next: TileConfig[]) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  customTheme: CustomTheme;
  setCustomTheme: (patch: Partial<CustomTheme>) => void;
}

const CUSTOM_FIELDS: { key: keyof CustomTheme; label: string }[] = [
  { key: 'background',      label: 'Background' },
  { key: 'surface',         label: 'Surface' },
  { key: 'surfaceElevated', label: 'Surface (elevated)' },
  { key: 'foreground',      label: 'Foreground' },
  { key: 'muted',           label: 'Muted' },
];

const ACCENT_OPTIONS = ['#268bd2', '#2aa198', '#b58900', '#d33682', '#859900', '#3b82f6'];

export default function TweaksPanel({ open, onClose, tweaks, setTweak, setTweaks, board, setBoard, theme, setTheme, customTheme, setCustomTheme }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 16, y: 16 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pasting, setPasting] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

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

  const handleExport = () => {
    const json = serializeBoard({ board, tweaks });
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'outage-board.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const applyImport = (raw: string) => {
    const parsed = parseBoardFile(raw);
    if (!parsed) {
      setImportError('That doesn’t look like an outage-board export.');
      return false;
    }
    setBoard(parsed.board);
    if (parsed.tweaks) setTweaks(parsed.tweaks);
    setImportError(null);
    setPasting(false);
    setPasteValue('');
    onClose();
    return true;
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    applyImport(text);
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

        {theme === 'custom' && (
          <>
            {CUSTOM_FIELDS.map((f) => (
              <div className="twk-row twk-row-h" key={f.key}>
                <div className="twk-lbl"><span>{f.label}</span></div>
                <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="color"
                    className="twk-color"
                    value={customTheme[f.key]}
                    onChange={(e) => setCustomTheme({ [f.key]: e.target.value })}
                    aria-label={`Pick ${f.label}`}
                  />
                  <input
                    type="text"
                    className="twk-field"
                    style={{ width: 90, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }}
                    value={customTheme[f.key]}
                    onChange={(e) => setCustomTheme({ [f.key]: e.target.value })}
                    spellCheck={false}
                  />
                </div>
              </div>
            ))}
          </>
        )}

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

        <div className="twk-row twk-row-h">
          <div className="twk-lbl"><span>Custom hex</span></div>
          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <input
              type="color"
              value={tweaks.accent}
              onChange={(e) => setTweak('accent', e.target.value)}
              className="twk-color"
              aria-label="Pick accent color"
            />
            <input
              type="text"
              className="twk-field"
              style={{ width: 90, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }}
              value={tweaks.accent}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (/^#[0-9a-f]{6}$/i.test(v)) setTweak('accent', v);
                else if (v.startsWith('#')) setTweak('accent', v);
              }}
              placeholder="#268bd2"
              spellCheck={false}
            />
            {typeof window !== 'undefined' && 'EyeDropper' in window && (
              <button
                type="button"
                className="board-btn board-btn-icon"
                title="Eye-dropper"
                onClick={async () => {
                  try {
                    const Picker = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
                    const result = await new Picker().open();
                    if (result?.sRGBHex) setTweak('accent', result.sRGBHex);
                  } catch { /* user cancelled */ }
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 22l3-1 11-11-2-2L3 19l-1 3z" />
                  <path d="M14 8l4-4a2.83 2.83 0 014 4l-4 4" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {tweaks.accentRecents && tweaks.accentRecents.length > 0 && (
          <div className="twk-row">
            <div className="twk-lbl"><span>Recents</span></div>
            <div className="twk-chips">
              {tweaks.accentRecents.map((color) => (
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
        )}

        {/* Backup section */}
        <div className="twk-sect">Backup</div>

        <div className="twk-row twk-row-h">
          <div className="twk-lbl"><span>Export &amp; import</span></div>
          <div className="twk-seg">
            <button onClick={handleExport} title="Download outage-board.json">Export</button>
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Import from a file"
            >
              Import
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />

        <div className="twk-row" style={{ marginTop: -4 }}>
          <button
            type="button"
            onClick={() => { setPasting((p) => !p); setImportError(null); }}
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--muted)',
              fontSize: 11,
              textDecoration: 'underline',
              cursor: 'pointer',
              padding: 0,
              alignSelf: 'flex-start',
              fontFamily: 'inherit',
            }}
          >
            {pasting ? 'Cancel paste' : 'Or paste JSON…'}
          </button>
        </div>

        {pasting && (
          <div className="twk-row">
            <textarea
              className="twk-field"
              rows={4}
              placeholder="Paste exported JSON here"
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }}
            />
            <button
              type="button"
              className="board-btn board-btn-primary"
              style={{ marginTop: 6 }}
              onClick={() => applyImport(pasteValue)}
            >
              Apply
            </button>
          </div>
        )}

        {importError && (
          <div className="twk-row" role="alert" style={{ fontSize: 11, color: 'var(--accent-rose, #f87171)' }}>
            {importError}
          </div>
        )}
      </div>
    </div>
  );
}
