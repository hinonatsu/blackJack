import type { ReactNode } from 'react';

import { PlayingCard, type CardSize, type CasinoCard } from './PlayingCard';
import { cx } from './ui';

export type HandTone = 'neutral' | 'active' | 'win' | 'loss' | 'push' | 'surrender';

export interface HandProps {
  cards: CasinoCard[];
  label?: ReactNode;
  total?: number;
  isSoft?: boolean;
  status?: string;
  tone?: HandTone;
  active?: boolean;
  showTotal?: boolean;
  hideCardIndices?: number[];
  cardSize?: CardSize;
  dealt?: boolean;
  className?: string;
  emptyLabel?: string;
}

const TONE_CLASSES: Record<HandTone, string> = {
  neutral: 'border-white/12 bg-slate-950/15',
  active: 'border-amber-300/90 bg-amber-300/10 shadow-[0_0_0_2px_rgba(252,211,77,0.18)]',
  win: 'border-emerald-300/70 bg-emerald-300/10',
  loss: 'border-red-300/70 bg-red-400/10',
  push: 'border-sky-200/70 bg-sky-200/10',
  surrender: 'border-orange-200/70 bg-orange-300/10',
};

const TONE_BADGE_CLASSES: Record<HandTone, string> = {
  neutral: 'bg-slate-900/75 text-slate-100 ring-white/15',
  active: 'bg-amber-200 text-amber-950 ring-amber-100',
  win: 'bg-emerald-300 text-emerald-950 ring-emerald-100',
  loss: 'bg-red-300 text-red-950 ring-red-100',
  push: 'bg-sky-200 text-sky-950 ring-sky-100',
  surrender: 'bg-orange-200 text-orange-950 ring-orange-100',
};

/** A compact, overlapped card layout with an optional visible hand total. */
export function Hand({
  cards,
  label,
  total,
  isSoft = false,
  status,
  tone = 'neutral',
  active = false,
  showTotal = true,
  hideCardIndices = [],
  cardSize = 'md',
  dealt = false,
  className,
  emptyLabel = 'Waiting for deal',
}: HandProps) {
  const effectiveTone = active ? 'active' : tone;
  const hiddenCount = hideCardIndices.length;
  const shouldShowTotal = showTotal && total !== undefined && hiddenCount === 0;

  return (
    <section
      className={cx(
        'min-w-0 rounded-2xl border px-3 py-2.5 sm:px-4 sm:py-3',
        TONE_CLASSES[effectiveTone],
        className,
      )}
      aria-label={typeof label === 'string' ? label : 'Card hand'}
    >
      <div className="mb-2 flex min-h-5 items-center justify-between gap-2 text-[0.68rem] font-bold tracking-[0.14em] text-emerald-50/85">
        <span className="truncate uppercase">{label}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          {status && (
            <span className={cx('rounded-full px-2 py-0.5 text-[0.58rem] font-black tracking-[0.08em] ring-1', TONE_BADGE_CLASSES[effectiveTone])}>
              {status}
            </span>
          )}
          {shouldShowTotal && (
            <span className="rounded-full bg-slate-950/70 px-2 py-0.5 text-[0.66rem] font-black tracking-normal text-white ring-1 ring-white/15">
              {isSoft ? 'SOFT ' : ''}{total}
            </span>
          )}
        </div>
      </div>

      {cards.length > 0 ? (
        <div className="flex min-h-[6rem] items-center py-0.5 pl-0.5 sm:min-h-[7.25rem]">
          {cards.map((card, index) => (
            <PlayingCard
              key={card.id}
              card={card}
              faceDown={hideCardIndices.includes(index)}
              size={cardSize}
              dealt={dealt}
              className={index === 0 ? undefined : '-ml-5 sm:-ml-6'}
              style={{ zIndex: index + 1, animationDelay: dealt ? `${index * 55}ms` : undefined }}
            />
          ))}
        </div>
      ) : (
        <div className="grid min-h-[6rem] place-items-center rounded-xl border border-dashed border-white/20 bg-black/10 px-4 text-center text-xs font-medium text-emerald-50/60 sm:min-h-[7.25rem]">
          {emptyLabel}
        </div>
      )}
    </section>
  );
}
