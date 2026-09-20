import type { ReactNode } from 'react';

import { Chip } from './Chip';
import { Hand, type HandTone } from './Hand';
import type { CasinoCard } from './PlayingCard';
import { cx, formatCurrency } from './ui';

export interface PlayerDisplayHand {
  id: string;
  cards: CasinoCard[];
  total?: number;
  isSoft?: boolean;
  status?: string;
  wagerCents?: number;
  /** Lets the table make split hands obvious at a glance. */
  isSplitHand?: boolean;
  doubled?: boolean;
  tone?: HandTone;
}

export interface PlayerAreaProps {
  hands: PlayerDisplayHand[];
  activeHandId?: string | null;
  bankrollCents?: number;
  tableMinimumCents?: number;
  title?: string;
  className?: string;
  dealt?: boolean;
  children?: ReactNode;
}

function handTone(hand: PlayerDisplayHand): HandTone {
  if (hand.tone) return hand.tone;
  switch (hand.status) {
    case 'WIN':
    case 'BLACKJACK':
      return 'win';
    case 'LOSS':
    case 'BUST':
      return 'loss';
    case 'PUSH':
      return 'push';
    case 'SURRENDER':
    case 'SURRENDERED':
      return 'surrender';
    default:
      return 'neutral';
  }
}

/** Bottom-of-table player station. It supports a single hand as well as a clear split layout. */
export function PlayerArea({
  hands,
  activeHandId,
  bankrollCents,
  tableMinimumCents,
  title = 'PLAYER',
  className,
  dealt = false,
  children,
}: PlayerAreaProps) {
  return (
    <section className={cx('relative mx-auto w-full max-w-5xl pb-2', className)} aria-label="Player area">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1 text-xs font-bold tracking-[0.12em] text-emerald-50/80">
        <h2 className="font-serif text-sm font-black tracking-[0.28em] text-amber-100 sm:text-base">{title}</h2>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[0.65rem]">
          {bankrollCents !== undefined && <span>BANKROLL <strong className="ml-1 text-sm tracking-normal text-white">{formatCurrency(bankrollCents)}</strong></span>}
          {tableMinimumCents !== undefined && <span>TABLE MIN <strong className="ml-1 text-sm tracking-normal text-white">{formatCurrency(tableMinimumCents)}</strong></span>}
        </div>
      </div>

      <div className={cx('grid gap-3', hands.length > 1 ? 'md:grid-cols-2' : 'mx-auto max-w-md')}>
        {hands.map((hand, index) => {
          const active = activeHandId === hand.id;
          const label = hands.length > 1
            ? `HAND ${index + 1}${hand.isSplitHand ? ' • SPLIT' : ''}${hand.doubled ? ' • DOUBLE' : ''}`
            : hand.doubled ? 'PLAYER • DOUBLE' : 'PLAYER';

          return (
            <div key={hand.id} className="relative">
              {hand.wagerCents !== undefined && hand.wagerCents > 0 && (
                <div className="absolute -right-1 -top-3 z-20 flex items-center gap-1.5 rounded-full bg-emerald-950/90 pr-2 shadow-lg ring-1 ring-white/20">
                  <Chip valueCents={hand.wagerCents} size="sm" />
                  <span className="text-[0.62rem] font-black tracking-wide text-amber-100">BET</span>
                </div>
              )}
              <Hand
                cards={hand.cards}
                label={label}
                total={hand.total}
                isSoft={hand.isSoft}
                status={hand.status}
                tone={handTone(hand)}
                active={active}
                dealt={dealt}
                cardSize={hands.length > 1 ? 'sm' : 'lg'}
                emptyLabel="Place a bet to deal"
              />
            </div>
          );
        })}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </section>
  );
}
