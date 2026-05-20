'use client';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface ShortcutRow {
  keys: string[];
  desc: string;
}

const GLOBAL: ShortcutRow[] = [
  { keys: ['⌘', 'K'],  desc: 'Command palette' },
  { keys: ['E'],       desc: 'Toggle edit mode' },
  { keys: ['A'],       desc: 'Add tile' },
  { keys: ['I'],       desc: 'Import' },
  { keys: ['T'],       desc: 'Tweaks' },
  { keys: ['?'],       desc: 'This cheat-sheet' },
  { keys: ['Esc'],     desc: 'Close overlays' },
];

const HISTORY: ShortcutRow[] = [
  { keys: ['Ctrl', 'Z'],        desc: 'Undo' },
  { keys: ['Ctrl', 'Shift', 'Z'], desc: 'Redo' },
];

const EDIT: ShortcutRow[] = [
  { keys: ['←', '↑', '→', '↓'], desc: 'Move focused tile' },
  { keys: ['Backspace'],        desc: 'Remove focused tile' },
  { keys: ['Ctrl', 'D'],        desc: 'Duplicate focused tile' },
  { keys: ['Shift', 'Drag'],    desc: 'Swap (instead of reflow)' },
];

function Section({ title, rows }: { title: string; rows: ShortcutRow[] }) {
  return (
    <div className="sc-section">
      <div className="sc-section-title">{title}</div>
      <div className="sc-rows">
        {rows.map((r, i) => (
          <div className="sc-row" key={i}>
            <div className="sc-keys">
              {r.keys.map((k, j) => (
                <kbd key={j} className="sc-kbd">{k}</kbd>
              ))}
            </div>
            <div className="sc-desc">{r.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ShortcutsOverlay({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <>
      <div className="slideover-backdrop" onClick={onClose} />
      <div className="sc-overlay" role="dialog" aria-label="Keyboard shortcuts">
        <div className="sc-head">
          <b>Keyboard shortcuts</b>
          <button className="twk-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="sc-body">
          <Section title="Global" rows={GLOBAL} />
          <Section title="History" rows={HISTORY} />
          <Section title="Edit mode" rows={EDIT} />
        </div>
      </div>
    </>
  );
}
