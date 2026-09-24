'use client';

import { cx } from './ui';

export const BLACKJACK_ACTIONS = ['HIT', 'STAND', 'DOUBLE', 'SPLIT', 'SURRENDER'] as const;
export type BlackjackAction = (typeof BLACKJACK_ACTIONS)[number];

const ACTION_DETAILS: Record<BlackjackAction, { shortcut: string; colors: string }> = {
  HIT: { shortcut: 'H', colors: 'border-sky-300/65 bg-sky-500/20 text-sky-50 hover:bg-sky-400/35' },
  STAND: { shortcut: 'S', colors: 'border-emerald-300/65 bg-emerald-500/20 text-emerald-50 hover:bg-emerald-400/35' },
  DOUBLE: { shortcut: 'D', colors: 'border-amber-300/75 bg-amber-400/20 text-amber-50 hover:bg-amber-300/35' },
  SPLIT: { shortcut: 'P', colors: 'border-violet-300/65 bg-violet-500/20 text-violet-50 hover:bg-violet-400/35' },
  SURRENDER: { shortcut: 'R', colors: 'border-orange-300/65 bg-orange-500/20 text-orange-50 hover:bg-orange-400/35' },
};

export interface ActionButtonsProps {
  onAction: (action: BlackjackAction) => void;
  availableActions?: readonly BlackjackAction[];
  disabledActions?: readonly BlackjackAction[];
  disabled?: boolean;
  /** The main app owns keyboard handling; this toggles the visible casino-key hints. */
  showShortcuts?: boolean;
  compact?: boolean;
  className?: string;
}

/** Large, thumb-safe action controls for live hands and speed drills. */
export function ActionButtons({
  onAction,
  availableActions = BLACKJACK_ACTIONS,
  disabledActions = [],
  disabled = false,
  showShortcuts = true,
  compact = false,
  className,
}: ActionButtonsProps) {
  const permitted = new Set(availableActions);
  const unavailable = new Set(disabledActions);

  return (
    <nav className={cx('grid gap-2', compact ? 'grid-cols-5' : 'grid-cols-6 sm:grid-cols-5', className)} aria-label="Blackjack actions">
      {BLACKJACK_ACTIONS.map((action) => {
        const details = ACTION_DETAILS[action];
        const isDisabled = disabled || unavailable.has(action) || !permitted.has(action);
        const isPrimary = action === 'HIT' || action === 'STAND';
        return (
          <button
            key={action}
            type="button"
            onClick={() => onAction(action)}
            disabled={isDisabled}
            aria-keyshortcuts={details.shortcut}
            aria-label={`${action}, keyboard ${details.shortcut}`}
            className={cx(
              'group relative isolate overflow-hidden rounded-xl border px-2 py-2 font-black tracking-[0.08em] shadow-[0_0.2rem_0.45rem_rgba(0,0,0,0.25)] transition active:translate-y-px',
              'focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-200',
              compact ? 'min-h-14 text-xs' : isPrimary ? 'col-span-3 min-h-20 text-base sm:col-span-1 sm:min-h-16 sm:text-sm' : 'col-span-2 min-h-16 text-xs sm:col-span-1 sm:text-sm',
              details.colors,
              isDisabled && 'cursor-not-allowed border-white/10 bg-slate-900/45 text-slate-400 opacity-55 grayscale',
            )}
          >
            <span className="relative z-10">{action}</span>
            {showShortcuts && (
              <kbd className="absolute bottom-1.5 right-1.5 z-10 rounded border border-current/30 bg-black/20 px-1 text-[0.6rem] font-bold tracking-normal opacity-80">
                {details.shortcut}
              </kbd>
            )}
          </button>
        );
      })}
    </nav>
  );
}
