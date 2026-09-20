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
  clubs: { glyph: '♣', name: 'Clubs', color: 'text-[#141414]' },
  diamonds: { glyph: '♦', name: 'Diamonds', color: 'text-[#e21b23]' },
  hearts: { glyph: '♥', name: 'Hearts', color: 'text-[#e21b23]' },
  spades: { glyph: '♠', name: 'Spades', color: 'text-[#141414]' },
} as const;

type PipPosition = { x: number; y: number; inverted?: boolean };

/** Traditional French-suited pip positions, expressed as card-face percentages. */
const PIP_LAYOUTS: Partial<Record<CasinoRank, readonly PipPosition[]>> = {
  '2': [{ x: 50, y: 23 }, { x: 50, y: 77, inverted: true }],
  '3': [{ x: 50, y: 20 }, { x: 50, y: 50 }, { x: 50, y: 80, inverted: true }],
  '4': [{ x: 25, y: 22 }, { x: 75, y: 22 }, { x: 25, y: 78, inverted: true }, { x: 75, y: 78, inverted: true }],
  '5': [{ x: 25, y: 21 }, { x: 75, y: 21 }, { x: 50, y: 50 }, { x: 25, y: 79, inverted: true }, { x: 75, y: 79, inverted: true }],
  '6': [{ x: 25, y: 19 }, { x: 75, y: 19 }, { x: 25, y: 50 }, { x: 75, y: 50 }, { x: 25, y: 81, inverted: true }, { x: 75, y: 81, inverted: true }],
  '7': [{ x: 25, y: 17 }, { x: 75, y: 17 }, { x: 50, y: 35 }, { x: 25, y: 53 }, { x: 75, y: 53 }, { x: 25, y: 83, inverted: true }, { x: 75, y: 83, inverted: true }],
  '8': [{ x: 25, y: 16 }, { x: 75, y: 16 }, { x: 50, y: 34 }, { x: 25, y: 50 }, { x: 75, y: 50 }, { x: 50, y: 66, inverted: true }, { x: 25, y: 84, inverted: true }, { x: 75, y: 84, inverted: true }],
  '9': [{ x: 25, y: 15 }, { x: 75, y: 15 }, { x: 25, y: 36 }, { x: 75, y: 36 }, { x: 50, y: 50 }, { x: 25, y: 64, inverted: true }, { x: 75, y: 64, inverted: true }, { x: 25, y: 85, inverted: true }, { x: 75, y: 85, inverted: true }],
  '10': [{ x: 25, y: 14 }, { x: 75, y: 14 }, { x: 50, y: 31 }, { x: 25, y: 46 }, { x: 75, y: 46 }, { x: 25, y: 54, inverted: true }, { x: 75, y: 54, inverted: true }, { x: 50, y: 69, inverted: true }, { x: 25, y: 86, inverted: true }, { x: 75, y: 86, inverted: true }],
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
        'absolute z-10 flex flex-col items-center font-sans font-black leading-[0.73] tracking-[-0.08em]',
        'text-[0.63rem] sm:text-[0.76rem]',
        inverted ? 'bottom-1 right-1 rotate-180 sm:bottom-1.5 sm:right-1.5' : 'left-1 top-1 sm:left-1.5 sm:top-1.5',
      )}
    >
      <span>{rank}</span>
      <span className="mt-0.5 text-[0.68rem] sm:text-[0.82rem]">{glyph}</span>
    </span>
  );
}

function CourtArt({ rank, glyph }: { rank: 'J' | 'Q' | 'K'; glyph: string }) {
  const crown = rank === 'K' ? '♛' : rank === 'Q' ? '♕' : '◆';

  return (
    <span aria-hidden="true" className="absolute inset-x-[14%] inset-y-[10%] overflow-hidden border border-[#1f1f1f] bg-[#f8f5df] shadow-[inset_0_0_0_1px_#f6d928]">
      <span className="absolute -left-[18%] top-[6%] h-[47%] w-[136%] -rotate-[28deg] bg-[#df1c24]" />
      <span className="absolute -left-[16%] bottom-[6%] h-[47%] w-[136%] -rotate-[28deg] bg-[#151515]" />
      <span className="absolute left-[8%] top-[13%] h-[74%] w-[84%] rotate-45 border-[0.18rem] border-[#f0d226]" />
      <span className="absolute left-1/2 top-[12%] grid h-[27%] w-[45%] -translate-x-1/2 place-items-center rounded-t-[50%] border-2 border-[#191919] bg-[#e4c6a1] text-[0.68rem] text-[#141414] sm:text-[0.9rem]">
        <span className="-mt-1 text-[0.6rem] leading-none sm:text-[0.82rem]">{crown}</span>
        <span className="-mt-2 text-[0.55rem] font-black sm:text-[0.75rem]">•‿•</span>
      </span>
      <span className="absolute left-1/2 top-[36%] grid h-[29%] w-[69%] -translate-x-1/2 place-items-center border border-[#161616] bg-[#f2d42a] text-[1.15rem] font-black leading-none text-[#161616] sm:text-[1.65rem]">{rank}</span>
      <span className="absolute bottom-[9%] left-1/2 text-[1rem] leading-none sm:text-[1.35rem]">{glyph}</span>
      <span className="absolute right-[7%] top-[6%] text-[0.54rem] font-black text-[#161616] sm:text-[0.72rem]">{rank}</span>
    </span>
  );
}

function PipField({ rank, glyph }: { rank: CasinoCard['rank']; glyph: string }) {
  if (rank === 'A') {
    return <span aria-hidden="true" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[2.45rem] leading-none sm:text-[3.35rem]">{glyph}</span>;
  }

  if (rank === 'J' || rank === 'Q' || rank === 'K') {
    return <CourtArt rank={rank} glyph={glyph} />;
  }

  const positions = PIP_LAYOUTS[rank] ?? [];
  return (
    <span aria-hidden="true" className="absolute inset-[7%]">
      {positions.map((position, index) => (
        <span
          key={index}
          className={cx('absolute -translate-x-1/2 -translate-y-1/2 text-[1rem] leading-none sm:text-[1.32rem]', position.inverted && 'rotate-180')}
          style={{ left: `${position.x}%`, top: `${position.y}%` }}
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
    'relative aspect-[5/7] shrink-0 overflow-hidden rounded-[0.42rem] border border-[#cfd4d5]',
    'bg-white shadow-[0_0.2rem_0.36rem_rgba(0,0,0,0.34)]',
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
