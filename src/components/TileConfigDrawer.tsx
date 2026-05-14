'use client';

import type { TileConfig } from '@/hooks/useBoard';
import type { LiveData } from './tiles/types';
import { TILE_CONFIG_FORMS } from './tiles/configs';

interface Props {
  tile: TileConfig | null;
  live: LiveData;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<TileConfig>) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export default function TileConfigDrawer({ tile, live, onClose, onUpdate, onRemove, onDuplicate }: Props) {
  if (!tile) return null;
  const Form = TILE_CONFIG_FORMS[tile.type];
  const title =
    (typeof tile.config.label === 'string' && tile.config.label) || tile.type.replace(/-/g, ' ');

  return (
    <>
      <div className="slideover-backdrop" onClick={onClose} />
      <div className="tile-config-drawer" role="dialog" aria-label={`Configure ${title}`}>
        <div className="twk-hd">
          <b style={{ textTransform: 'capitalize' }}>{title}</b>
          <button className="twk-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="twk-body">
          {Form ? <Form tile={tile} live={live} onUpdate={(patch) => onUpdate(tile.id, patch)} /> : null}

          <div className="twk-sect">Actions</div>
          <div className="twk-row twk-row-h">
            <div className="twk-lbl"><span>Duplicate</span></div>
            <button className="board-btn" onClick={() => onDuplicate(tile.id)}>Duplicate</button>
          </div>
          <div className="twk-row twk-row-h">
            <div className="twk-lbl"><span>Remove</span></div>
            <button
              className="board-btn"
              style={{ color: '#ef5350', borderColor: '#ef5350' }}
              onClick={() => { onRemove(tile.id); onClose(); }}
            >
              Remove tile
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
