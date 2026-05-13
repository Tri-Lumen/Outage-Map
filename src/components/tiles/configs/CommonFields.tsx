'use client';

import RefreshSelect from '../RefreshSelect';

interface Props {
  tileType: string;
  label: string | undefined;
  refreshMs: number | undefined;
  onLabelChange: (v: string | null) => void;
  onRefreshChange: (ms: number | undefined) => void;
  /** If true, hide the refresh selector — tile doesn't poll live data. */
  hideRefresh?: boolean;
}

export default function CommonFields({ label, refreshMs, onLabelChange, onRefreshChange, hideRefresh }: Props) {
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

      {!hideRefresh && (
        <div className="twk-row">
          <div className="twk-lbl"><span>Refresh</span></div>
          <RefreshSelect value={refreshMs} onChange={onRefreshChange} />
        </div>
      )}
    </>
  );
}
