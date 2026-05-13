'use client';

import { useEffect, useRef, useState } from 'react';
import type { UseBoardSet } from '@/hooks/useBoardSet';

interface Props {
  boardSet: UseBoardSet;
}

export default function BoardTabs({ boardSet }: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (renamingId) inputRef.current?.select();
  }, [renamingId]);

  useEffect(() => {
    if (!menuId) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menuId]);

  const commit = (id: string, value: string) => {
    const trimmed = value.trim();
    if (trimmed !== '') boardSet.renameBoard(id, trimmed);
    setRenamingId(null);
  };

  return (
    <div className="board-tabs">
      {boardSet.boards.map((b) => {
        const isActive = b.id === boardSet.activeId;
        const isRenaming = renamingId === b.id;
        return (
          <div key={b.id} className={`board-tab ${isActive ? 'board-tab-on' : ''}`}>
            {isRenaming ? (
              <input
                ref={inputRef}
                className="board-tab-input"
                defaultValue={b.name}
                aria-label="Rename board"
                onBlur={(e) => commit(b.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit(b.id, (e.target as HTMLInputElement).value);
                  else if (e.key === 'Escape') setRenamingId(null);
                }}
              />
            ) : (
              <button
                type="button"
                className="board-tab-label"
                onClick={() => boardSet.setActive(b.id)}
                onDoubleClick={() => setRenamingId(b.id)}
                title={b.starred ? `${b.name} (default)` : b.name}
              >
                {b.starred && <span className="board-tab-star" aria-hidden="true">★</span>}
                {b.name}
              </button>
            )}
            <button
              type="button"
              className="board-tab-more"
              aria-label="Board options"
              onClick={(e) => { e.stopPropagation(); setMenuId(menuId === b.id ? null : b.id); }}
            >
              ⋯
            </button>
            {menuId === b.id && (
              <div className="board-tab-menu" ref={menuRef}>
                <button onClick={() => { setRenamingId(b.id); setMenuId(null); }}>Rename</button>
                <button onClick={() => { boardSet.duplicateBoard(b.id); setMenuId(null); }}>Duplicate</button>
                <button onClick={() => { boardSet.starBoard(b.id); setMenuId(null); }}>
                  {b.starred ? 'Default ✓' : 'Set as default'}
                </button>
                {boardSet.boards.length > 1 && (
                  <button
                    className="board-tab-menu-danger"
                    onClick={() => { boardSet.deleteBoard(b.id); setMenuId(null); }}
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      <button
        type="button"
        className="board-tab-add"
        aria-label="Add board"
        onClick={() => boardSet.addBoard('Untitled', [])}
        title="Add board"
      >
        +
      </button>
    </div>
  );
}
