'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';

interface TileChromeProps {
  title: string;
  label?: string | null;
  icon?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  editing?: boolean;
  onResize?: () => void;
  onRemove?: () => void;
  onConfigure?: () => void;
  onDuplicate?: () => void;
  onRename?: (label: string | null) => void;
}

export default function TileChrome({
  title,
  label,
  icon,
  badge,
  children,
  editing,
  onResize,
  onRemove,
  onConfigure,
  onDuplicate,
  onRename,
}: TileChromeProps) {
  const [renaming, setRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayed = label && label.trim() !== '' ? label : title;

  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  // Cancel rename if edit mode flips off.
  useEffect(() => {
    if (!editing && renaming) setRenaming(false);
  }, [editing, renaming]);

  const commit = (value: string) => {
    if (!onRename) { setRenaming(false); return; }
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === title) onRename(null);
    else onRename(trimmed);
    setRenaming(false);
  };

  return (
    <div className="tile-inner">
      <div className="tile-header">
        <div className="tile-title">
          {icon}
          {renaming ? (
            <input
              ref={inputRef}
              type="text"
              defaultValue={displayed}
              aria-label="Rename tile"
              className="tile-title-input"
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
                else if (e.key === 'Escape') setRenaming(false);
              }}
              onBlur={(e) => commit(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              onDoubleClick={() => editing && onRename && setRenaming(true)}
              title={editing && onRename ? 'Double-click to rename' : undefined}
            >
              {displayed}
            </span>
          )}
          {badge}
        </div>
        <div className="tile-actions">
          {editing && (
            <>
              <button className="tile-btn" onClick={onConfigure} title="Configure">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
              </button>
              {onDuplicate && (
                <button className="tile-btn" onClick={onDuplicate} title="Duplicate">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="11" height="11" rx="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                </button>
              )}
              <button className="tile-btn" onClick={onResize} title="Resize">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
              </button>
              <button className="tile-btn tile-btn-danger" onClick={onRemove} title="Remove">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
      <div className="tile-body">{children}</div>
    </div>
  );
}
