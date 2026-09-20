import { cx } from './ui';

export interface ShoeProps {
  totalCards: number;
  remainingCards: number;
  deckCount?: number;
  showDetails?: boolean;
  compact?: boolean;
  className?: string;
}

function boundedPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.min(100, Math.max(0, (numerator / denominator) * 100));
}

/** A visual card shoe whose filled stack directly represents cards left to deal. */
export function Shoe({
  totalCards,
  remainingCards,
  deckCount,
  showDetails = true,
  compact = false,
  className,
}: ShoeProps) {
  const percentage = boundedPercent(remainingCards, totalCards);
  const remainingDecks = remainingCards / 52;
  const label = `SHOE: ${remainingCards} of ${totalCards} cards remaining`;

  return (
    <aside className={cx('w-[8.5rem] select-none sm:w-[10rem]', compact && 'w-[6.75rem] sm:w-[7.5rem]', className)} aria-label={label}>
      <div className="mb-1 flex items-center justify-between gap-2 text-[0.56rem] font-black tracking-[0.15em] text-amber-100/90">
        <span>SHOE</span>
        {deckCount && <span className="tracking-normal text-emerald-50/75">{deckCount} DECK</span>}
      </div>
      <div className="relative h-16 rounded-lg border border-amber-100/30 bg-slate-950/80 p-1.5 shadow-[inset_0_0_0.8rem_rgba(0,0,0,.55),0_0.35rem_0.6rem_rgba(0,0,0,.28)] sm:h-[4.6rem]">
        <div className="absolute inset-y-2 left-2 w-1 rounded-full bg-amber-200/40" />
        <div className="absolute inset-y-2 right-2 w-1 rounded-full bg-amber-200/20" />
        <div className="absolute inset-x-3 bottom-2 top-2 overflow-hidden rounded border border-white/35 bg-[#f9f5e8] shadow-[0_0.18rem_0.2rem_rgba(0,0,0,.45)]">
          <div
            className="absolute bottom-0 left-0 top-0 min-w-[0.1rem] border-r border-slate-300/80 bg-[repeating-linear-gradient(0deg,#fffef9_0px,#fffef9_2px,#cbd5e1_3px,#fffef9_4px)] transition-[width] duration-300"
            style={{ width: `${percentage}%` }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,transparent_88%,rgba(15,23,42,.28)_100%)]" />
        </div>
        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 rounded bg-slate-950/80 px-1.5 py-px text-[0.52rem] font-black tracking-wide text-white">
          {Math.round(percentage)}%
        </span>
      </div>
      {showDetails && (
        <div className="mt-1 text-center text-[0.58rem] font-semibold tabular-nums text-emerald-50/75">
          {remainingCards} cards · {remainingDecks.toFixed(1)} decks
        </div>
      )}
    </aside>
  );
}
