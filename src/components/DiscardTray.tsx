import { cx } from './ui';

export interface DiscardTrayProps {
  discardedCards: number;
  totalCards: number;
  showDetails?: boolean;
  compact?: boolean;
  className?: string;
}

/** The companion discard tray for a persistent shoe; its stack grows as hands are dealt. */
export function DiscardTray({
  discardedCards,
  totalCards,
  showDetails = true,
  compact = false,
  className,
}: DiscardTrayProps) {
  const percentage = totalCards > 0 ? Math.min(100, Math.max(0, (discardedCards / totalCards) * 100)) : 0;
  const stackHeight = 9 + Math.round((percentage / 100) * 36);
  const label = `DISCARD TRAY: ${discardedCards} cards discarded`;

  return (
    <aside className={cx('w-[7.25rem] select-none sm:w-[8rem]', compact && 'w-[6rem]', className)} aria-label={label}>
      <div className="mb-1 text-center text-[0.56rem] font-black tracking-[0.12em] text-amber-100/90">DISCARD TRAY</div>
      <div className="relative flex h-16 items-end justify-center rounded-lg border border-amber-100/30 bg-slate-950/75 px-3 pb-2 shadow-[inset_0_0_0.8rem_rgba(0,0,0,.55),0_0.35rem_0.6rem_rgba(0,0,0,.28)] sm:h-[4.6rem]">
        <div className="absolute inset-x-2 bottom-1.5 h-2 rounded-b-md border border-amber-100/25 bg-amber-950/70" />
        <div
          className="relative w-[74%] rounded-sm border border-slate-300 bg-[repeating-linear-gradient(0deg,#fffef9_0px,#fffef9_2px,#cbd5e1_3px,#fffef9_4px)] shadow-[0_0.12rem_0.18rem_rgba(0,0,0,.55)] transition-[height] duration-300"
          style={{ height: `${stackHeight}%` }}
        >
          <span className="absolute right-1 top-1 text-[0.5rem] font-black text-red-700/80">♦</span>
        </div>
      </div>
      {showDetails && <div className="mt-1 text-center text-[0.58rem] font-semibold tabular-nums text-emerald-50/75">{discardedCards} cards</div>}
    </aside>
  );
}
