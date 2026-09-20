'use client';

import type { MouseEventHandler } from 'react';

import { cx, formatCurrency } from './ui';

const CHIP_COLOURS = {
  500: 'from-red-700 via-red-500 to-red-800 border-red-100/75 text-white',
  1000: 'from-sky-700 via-sky-500 to-sky-800 border-sky-100/75 text-white',
  1500: 'from-orange-700 via-orange-500 to-orange-800 border-orange-100/75 text-white',
  2500: 'from-emerald-700 via-emerald-500 to-emerald-800 border-emerald-100/75 text-white',
  5000: 'from-slate-800 via-slate-600 to-slate-900 border-slate-100/75 text-white',
  10000: 'from-violet-800 via-violet-600 to-violet-900 border-violet-100/75 text-white',
} as const;

const SIZE_CLASSES = {
  sm: 'h-10 w-10 text-[0.55rem]',
  md: 'h-14 w-14 text-[0.68rem] sm:h-16 sm:w-16',
  lg: 'h-[4.6rem] w-[4.6rem] text-xs sm:h-[5.2rem] sm:w-[5.2rem]',
} as const;

export interface ChipProps {
  valueCents: number;
  size?: keyof typeof SIZE_CLASSES;
  selected?: boolean;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  label?: string;
}

/** A tactile, readable casino-chip button; the denomination is written on it as well as colour-coded. */
export function Chip({
  valueCents,
  size = 'md',
  selected = false,
  disabled = false,
  onClick,
  className,
  label,
}: ChipProps) {
  const colour = CHIP_COLOURS[valueCents as keyof typeof CHIP_COLOURS] ?? CHIP_COLOURS[1000];
  const chipClasses = cx(
    'relative grid shrink-0 place-items-center rounded-full border-[3px] bg-gradient-to-br shadow-[0_0.25rem_0.45rem_rgba(0,0,0,0.38)]',
    'before:absolute before:inset-[0.22rem] before:rounded-full before:border-2 before:border-dashed before:border-white/70',
    'after:absolute after:inset-[0.43rem] after:rounded-full after:border after:border-black/25',
    'transition duration-150',
    colour,
    SIZE_CLASSES[size],
    selected && 'scale-110 ring-4 ring-amber-300/85 ring-offset-2 ring-offset-emerald-950',
    disabled && 'cursor-not-allowed opacity-45 grayscale',
    onClick && !disabled && 'cursor-pointer hover:-translate-y-1 hover:brightness-110 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-amber-200',
    className,
  );
  const content = (
    <span className="relative z-10 rounded-full border border-white/70 bg-white/12 px-1 font-black tracking-[-0.04em] drop-shadow-sm">
      {label ?? formatCurrency(valueCents)}
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={chipClasses}
        onClick={onClick}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={`Bet ${formatCurrency(valueCents)}`}
      >
        {content}
      </button>
    );
  }

  return <span aria-label={`${formatCurrency(valueCents)} chip`} className={chipClasses} role="img">{content}</span>;
}
