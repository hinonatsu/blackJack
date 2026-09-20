import type { ReactNode } from 'react';

import type { CasinoCard } from './PlayingCard';
import { Hand, type HandTone } from './Hand';
import { cx } from './ui';

export interface DealerAreaProps {
  cards: CasinoCard[];
  total?: number;
  isSoft?: boolean;
  /** Index of the face-down hole card during the player turn. */
  holeCardIndex?: number;
  hideHoleCard?: boolean;
  status?: string;
  tone?: HandTone;
  dealerRule?: 'S17' | 'H17';
  phaseLabel?: ReactNode;
  dealt?: boolean;
  className?: string;
}

/** The top-of-table dealer station, designed to leave the player area open below. */
export function DealerArea({
  cards,
  total,
  isSoft,
  holeCardIndex = 0,
  hideHoleCard = false,
  status,
  tone,
  dealerRule,
  phaseLabel,
  dealt = false,
  className,
}: DealerAreaProps) {
  const hiddenIndices = hideHoleCard && cards[holeCardIndex] ? [holeCardIndex] : [];

  return (
    <section className={cx('relative mx-auto w-full max-w-2xl pt-2 text-center sm:pt-4', className)} aria-label="Dealer area">
      <div className="pointer-events-none absolute inset-x-[9%] top-0 h-20 rounded-b-[100%] border-b border-amber-100/30 sm:h-24" />
      <div className="relative mb-2 flex items-center justify-center gap-2">
        <span className="h-px w-7 bg-amber-100/45 sm:w-12" />
        <h2 className="font-serif text-sm font-black tracking-[0.28em] text-amber-100 sm:text-base">DEALER</h2>
        <span className="h-px w-7 bg-amber-100/45 sm:w-12" />
      </div>
      <div className="relative mx-auto max-w-md">
        <Hand
          cards={cards}
          label={phaseLabel ?? (dealerRule ? `DEALER • ${dealerRule}` : 'DEALER')}
          total={total}
          isSoft={isSoft}
          status={status}
          tone={tone}
          hideCardIndices={hiddenIndices}
          dealt={dealt}
          cardSize="md"
          emptyLabel="Waiting for deal"
          className="text-left"
        />
      </div>
    </section>
  );
}
