import type { ReactNode } from 'react';

import { cx, formatResponseTime } from './ui';

export interface PerformanceStats {
  /** Fraction (0–1); percentage values are also accepted for display convenience. */
  accuracy: number;
  averageResponseMs?: number | null;
  bestStreak: number;
  attempts?: number;
  currentStreak?: number;
}

export interface StatsProps {
  /** Prefer the direct values below for a mode card; this object is convenient for session data. */
  stats?: PerformanceStats;
  title?: string;
  accuracy?: number;
  /** Alias kept concise for card/list call sites. */
  avgResponseMs?: number | null;
  averageResponseMs?: number | null;
  bestStreak?: number;
  attempts?: number;
  currentStreak?: number;
  details?: ReactNode;
  compact?: boolean;
  showAttempts?: boolean;
  className?: string;
}

function percentage(accuracy: number): number {
  const normalized = accuracy > 1 ? accuracy / 100 : accuracy;
  return Math.round(Math.min(1, Math.max(0, normalized)) * 100);
}

/** A compact performance card for the mode picker and drill headers. */
export function Stats({
  stats,
  title = 'PERFORMANCE',
  accuracy: explicitAccuracy,
  avgResponseMs,
  averageResponseMs,
  bestStreak: explicitBestStreak,
  attempts: explicitAttempts,
  currentStreak: explicitCurrentStreak,
  details,
  compact = false,
  showAttempts = true,
  className,
}: StatsProps) {
  const resolved = {
    accuracy: explicitAccuracy ?? stats?.accuracy ?? 0,
    averageResponseMs: avgResponseMs ?? averageResponseMs ?? stats?.averageResponseMs,
    bestStreak: explicitBestStreak ?? stats?.bestStreak ?? 0,
    attempts: explicitAttempts ?? stats?.attempts,
    currentStreak: explicitCurrentStreak ?? stats?.currentStreak,
  };
  const accuracy = percentage(resolved.accuracy);
  const atGoal = accuracy >= 98 && (resolved.averageResponseMs ?? Infinity) <= 1500;
  const ringStyle = { background: `conic-gradient(#fcd34d ${accuracy * 3.6}deg, rgba(255,255,255,.13) 0deg)` };

  return (
    <section
      className={cx('rounded-xl border border-white/12 bg-slate-950/35 p-3 text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]', compact && 'p-2.5', className)}
      aria-label={`${title} statistics`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[0.62rem] font-black tracking-[0.15em] text-amber-100/90">{title}</h3>
        {atGoal && <span className="rounded-full bg-emerald-300 px-2 py-0.5 text-[0.55rem] font-black tracking-[0.08em] text-emerald-950">ON TARGET</span>}
      </div>
      <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2.5 sm:gap-3">
        <div className="relative grid h-12 w-12 place-items-center rounded-full p-1 sm:h-14 sm:w-14" style={ringStyle} aria-label={`Accuracy ${accuracy}%`}>
          <span className="grid h-full w-full place-items-center rounded-full bg-emerald-950 text-[0.66rem] font-black tabular-nums text-white">{accuracy}%</span>
        </div>
        <div className="min-w-0 border-l border-white/10 pl-2.5">
          <dt className="text-[0.54rem] font-bold tracking-[0.1em] text-emerald-50/60">平均応答</dt>
          <dd className="mt-0.5 truncate text-xs font-black tabular-nums text-white sm:text-sm">{formatResponseTime(resolved.averageResponseMs)}</dd>
        </div>
        <div className="min-w-0 border-l border-white/10 pl-2.5">
          <dt className="text-[0.54rem] font-bold tracking-[0.1em] text-emerald-50/60">BEST STREAK</dt>
          <dd className="mt-0.5 text-xs font-black tabular-nums text-white sm:text-sm">{resolved.bestStreak}</dd>
        </div>
      </div>
      {(showAttempts || resolved.currentStreak !== undefined || details) && (
        <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-[0.58rem] font-semibold tabular-nums text-emerald-50/65">
          {showAttempts ? <span>{resolved.attempts ?? 0} hands</span> : <span />}
          {details ?? (resolved.currentStreak !== undefined && <span>CURRENT {resolved.currentStreak}</span>)}
        </div>
      )}
    </section>
  );
}
