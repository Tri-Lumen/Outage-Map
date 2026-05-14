'use client';

import RefreshSelect from '../RefreshSelect';

interface Props {
  tileType: string;
  label: string | undefined;
  refreshMs: number | undefined;
  accent: string | undefined;
  icon: string | undefined;
  tag: string | undefined;
  onLabelChange: (v: string | null) => void;
  onRefreshChange: (ms: number | undefined) => void;
  onAccentChange: (v: string | null) => void;
  onIconChange: (v: string | null) => void;
  onTagChange: (v: string | null) => void;
  /** If true, hide the refresh selector — tile doesn't poll live data. */
  hideRefresh?: boolean;
}

export default function CommonFields({
  label,
  refreshMs,
  accent,
  icon,
  tag,
  onLabelChange,
  onRefreshChange,
  onAccentChange,
  onIconChange,
  onTagChange,
  hideRefresh,
}: Props) {
  return (
    <>
      <div className="twk-row">
        <div className="twk-lbl"><span>Title</span></div>
        <input
          type="text"
          className="twk-field"
          placeholder="(default)"
          value={label ?? ''}
          onChange={(e) => onLabelChange(e.target.value === '' ? null : e.target.value)}
        />
      </div>

      <div className="twk-row">
        <div className="twk-lbl"><span>Icon / emoji</span></div>
        <input
          type="text"
          className="twk-field"
          placeholder="(default icon)"
          maxLength={4}
          value={icon ?? ''}
          onChange={(e) => onIconChange(e.target.value === '' ? null : e.target.value)}
        />
      </div>

      <div className="twk-row">
        <div className="twk-lbl"><span>Tag</span></div>
        <input
          type="text"
          className="twk-field"
          placeholder="(none)"
          maxLength={12}
          value={tag ?? ''}
          onChange={(e) => onTagChange(e.target.value === '' ? null : e.target.value)}
        />
      </div>

      <div className="twk-row twk-row-h">
        <div className="twk-lbl"><span>Accent</span></div>
        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <input
            type="color"
            className="twk-color"
            value={accent ?? '#268bd2'}
            onChange={(e) => onAccentChange(e.target.value)}
            aria-label="Tile accent"
          />
          {accent && (
            <button
              type="button"
              className="board-btn board-btn-icon"
              onClick={() => onAccentChange(null)}
              title="Use global accent"
              aria-label="Clear accent"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {!hideRefresh && (
        <div className="twk-row">
          <div className="twk-lbl"><span>Refresh</span></div>
          <RefreshSelect value={refreshMs} onChange={onRefreshChange} />
        </div>
      )}
    </>
  );
}
