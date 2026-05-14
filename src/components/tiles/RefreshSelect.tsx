'use client';

const OPTIONS: { label: string; value: number | undefined }[] = [
  { label: 'Inherit', value: undefined },
  { label: '5s',      value:  5000 },
  { label: '15s',     value: 15000 },
  { label: '30s',     value: 30000 },
  { label: '1m',      value: 60000 },
  { label: '5m',      value: 300000 },
];

interface Props {
  value: number | undefined;
  onChange: (ms: number | undefined) => void;
}

export default function RefreshSelect({ value, onChange }: Props) {
  return (
    <div className="tile-refresh-row">
      <span className="tile-refresh-label">Refresh</span>
      <select
        className="tile-refresh-select"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      >
        {OPTIONS.map((o) => (
          <option key={o.label} value={o.value ?? ''}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
