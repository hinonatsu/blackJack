import { cx, formatResponseTime } from './ui';

export interface FeedbackBannerProps {
  correct: boolean;
  correctAction?: string;
  message?: string;
  responseMs?: number | null;
  className?: string;
  compact?: boolean;
}

/** Short feedback designed to be scanned before a Fast Mode auto-advance. */
export function FeedbackBanner({
  correct,
  correctAction,
  message,
  responseMs,
  className,
  compact = false,
}: FeedbackBannerProps) {
  return (
    <section
      className={cx(
        'rounded-xl border px-3 py-2.5 shadow-lg',
        correct ? 'border-emerald-300/65 bg-emerald-400/15 text-emerald-50' : 'border-red-300/65 bg-red-400/15 text-red-50',
        compact && 'px-2.5 py-2',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <strong className="text-sm font-black tracking-[0.12em]">{correct ? 'CORRECT' : 'INCORRECT'}</strong>
        {responseMs !== undefined && responseMs !== null && <span className="text-xs font-black tabular-nums">{formatResponseTime(responseMs)}</span>}
      </div>
      {(correctAction || message) && (
        <div className="mt-1.5 text-xs leading-snug text-inherit/90">
          {correctAction && <span className="font-bold">Correct action: {correctAction}</span>}
          {correctAction && message && <span className="px-1.5 opacity-55">•</span>}
          {message && <span>{message}</span>}
        </div>
      )}
    </section>
  );
}
