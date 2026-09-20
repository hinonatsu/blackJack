import type { CSSProperties, MouseEventHandler } from 'react';

import { cx } from './ui';

/** Structural on purpose: cards from a shoe, a drill, or a demo can render alike. */
export type CasinoSuit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
export type CasinoRank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export interface CasinoCard {
  id: string;
  rank: CasinoRank;
  suit: CasinoSuit;
}

const SUIT_DETAILS = {
  clubs: { glyph: '♣', name: 'Clubs', color: 'text-slate-950' },
  diamonds: { glyph: '♦', name: 'Diamonds', color: 'text-red-700' },
  hearts: { glyph: '♥', name: 'Hearts', color: 'text-red-700' },
  spades: { glyph: '♠', name: 'Spades', color: 'text-slate-950' },
} as const;

const NUMBER_OF_PIPS: Partial<Record<CasinoCard['rank'], number>> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
};

const SIZE_CLASSES = {
  xs: 'w-9 sm:w-10',
  sm: 'w-12 sm:w-14',
  md: 'w-[4.3rem] sm:w-[5.15rem] lg:w-[5.75rem]',
  lg: 'w-[5.1rem] sm:w-[6.1rem] lg:w-[7rem]',
} as const;

export type CardSize = keyof typeof SIZE_CLASSES;

export interface PlayingCardProps {
  /** Omit the card when rendering an unknown facedown card. */
  card?: CasinoCard;
  faceDown?: boolean;
  size?: CardSize;
  dealt?: boolean;
  dimmed?: boolean;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

function Corner({
  rank,
  glyph,
  inverted = false,
}: {
  rank: CasinoCard['rank'];
  glyph: string;
  inverted?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'absolute flex flex-col items-center font-black leading-[0.75] tracking-[-0.08em]',
        'text-[0.68rem] sm:text-[0.8rem]',
        inverted ? 'bottom-1 right-1 rotate-180 sm:bottom-1.5 sm:right-1.5' : 'left-1 top-1 sm:left-1.5 sm:top-1.5',
      )}
    >
      <span>{rank}</span>
      <span className="mt-0.5 text-[0.72rem] sm:text-[0.86rem]">{glyph}</span>
    </span>
  );
}

function PipField({ rank, glyph }: { rank: CasinoCard['rank']; glyph: string }) {
  const pipCount = NUMBER_OF_PIPS[rank];

  if (rank === 'A') {
    return <span aria-hidden="true" className="text-[2.6rem] leading-none sm:text-[3.45rem]">{glyph}</span>;
  }

  if (!pipCount) {
    return (
      <span
        aria-hidden="true"
        className="flex flex-col items-center font-black leading-none tracking-[-0.08em]"
      >
        <span className="text-[2.15rem] sm:text-[3rem]">{rank}</span>
        <span className="mt-0.5 text-[1.35rem] sm:text-[1.8rem]">{glyph}</span>
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cx(
        'grid w-[62%] grid-cols-2 place-items-center gap-y-0.5 leading-none sm:gap-y-1',
        pipCount % 2 === 1 && 'grid-cols-3',
      )}
    >
      {Array.from({ length: pipCount }, (_, index) => (
        <span
          key={index}
          className={cx(
            'text-[1rem] sm:text-[1.28rem]',
            pipCount % 2 === 1 && index === Math.floor(pipCount / 2) && 'col-span-3',
            index >= Math.ceil(pipCount / 2) && 'rotate-180',
          )}
        >
          {glyph}
        </span>
      ))}
    </span>
  );
}

function CardFace({ card, faceDown }: Pick<PlayingCardProps, 'card' | 'faceDown'>) {
  if (faceDown || !card) {
    return (
      <>
        <span className="absolute inset-[0.2rem] rounded-[0.5rem] border border-amber-200/60 bg-gradient-to-br from-red-950 via-red-800 to-red-950" />
        <span className="absolute inset-[0.4rem] rounded-[0.38rem] border border-amber-100/70 bg-[radial-gradient(circle_at_center,_rgba(251,191,36,.5)_1px,_transparent_1.2px)] [background-size:7px_7px]" />
        <span className="absolute inset-0 grid place-items-center text-xl text-amber-100/85 sm:text-2xl">♠</span>
      </>
    );
  }

  const details = SUIT_DETAILS[card.suit];
  return (
    <>
      <Corner rank={card.rank} glyph={details.glyph} />
      <span className={cx('absolute inset-0 grid place-items-center', details.color)}>
        <PipField rank={card.rank} glyph={details.glyph} />
      </span>
      <Corner rank={card.rank} glyph={details.glyph} inverted />
    </>
  );
}

/**
 * A high-contrast CSS playing card. The suit glyph is always present so cards
 * do not rely on colour alone for recognition.
 */
export function PlayingCard({
  card,
  faceDown = false,
  size = 'md',
  dealt = false,
  dimmed = false,
  className,
  style,
  ariaLabel,
  onClick,
}: PlayingCardProps) {
  const label = ariaLabel ?? (faceDown || !card
    ? 'Face-down card'
    : `${card.rank} of ${SUIT_DETAILS[card.suit].name}`);
  const shellClasses = cx(
    'relative aspect-[5/7] shrink-0 overflow-hidden rounded-[0.52rem] border border-slate-300',
    'bg-[#fffef8] shadow-[0_0.22rem_0.38rem_rgba(0,0,0,0.38)]',
    'select-none transition-transform duration-150 ease-out',
    SIZE_CLASSES[size],
    dealt && 'animate-[deal-card_220ms_ease-out_both]',
    dimmed && 'opacity-45 grayscale',
    onClick && 'cursor-pointer focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-300 hover:-translate-y-1',
    className,
  );

  if (onClick) {
    return (
      <button
        type="button"
        aria-label={label}
        className={shellClasses}
        style={style}
        onClick={onClick}
      >
        <CardFace card={card} faceDown={faceDown} />
      </button>
    );
  }

  return (
    <div aria-label={label} className={shellClasses} role="img" style={style}>
      <CardFace card={card} faceDown={faceDown} />
    </div>
  );
}

export function suitGlyph(card: Pick<CasinoCard, 'suit'>): string {
  return SUIT_DETAILS[card.suit].glyph;
}
