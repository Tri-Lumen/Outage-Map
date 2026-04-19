import { ReactNode } from 'react';

interface StatTileProps {
  label: string;
  value: string | number;
  hint?: string;
  trend?: 'up' | 'down' | 'flat';
  trendLabel?: string;
  icon?: ReactNode;
  accent?: 'green' | 'cyan' | 'amber' | 'red' | 'indigo';
}

const ACCENT_BG: Record<string, string> = {
  green: 'from-emerald-500/15 to-emerald-500/0 text-emerald-300',
  cyan: 'from-cyan-500/15 to-cyan-500/0 text-cyan-300',
  amber: 'from-amber-500/15 to-amber-500/0 text-amber-300',
  red: 'from-red-500/15 to-red-500/0 text-red-300',
  indigo: 'from-indigo-500/15 to-indigo-500/0 text-indigo-300',
};

export default function StatTile({
  label,
  value,
  hint,
  trend,
  trendLabel,
  icon,
  accent = 'indigo',
}: StatTileProps) {
  const accentClasses = ACCENT_BG[accent];
  const trendColor =
    trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-gray-500';

  return (
    <div className="relative rounded-2xl surface-card p-5 overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${accentClasses} pointer-events-none`} />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
            <p className="text-3xl font-semibold tracking-tight mt-2 text-foreground tabular-nums">{value}</p>
          </div>
          {icon && (
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
              {icon}
            </div>
          )}
        </div>
        {(hint || trendLabel) && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            {trend && (
              <span className={`inline-flex items-center gap-1 ${trendColor}`}>
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendLabel}
              </span>
            )}
            {hint && <span className="text-gray-500">{hint}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
