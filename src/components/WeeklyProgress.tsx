import type { WeeklyProgress as WeeklyProgressData } from "@/lib/training/types";

import { formatResponseTime } from "./ui";

function percentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function changeLabel(value: number | null, suffix: string, invertGood = false): string {
  if (value === null) return "データを蓄積中";
  if (value === 0) return "変化なし";
  const sign = value > 0 ? "+" : "";
  const favorable = invertGood ? value < 0 : value > 0;
  return `${sign}${Math.round(value)}${suffix}${favorable ? " 改善" : ""}`;
}

function weekday(date: string): string {
  return new Intl.DateTimeFormat("ja-JP", { weekday: "short" }).format(
    new Date(`${date}T12:00:00`),
  );
}

export function WeeklyProgress({ progress }: { progress: WeeklyProgressData }) {
  const hasAttempts = progress.attempts > 0;

  return (
    <section className="rounded-2xl border border-sky-200/20 bg-sky-950/20 p-4 shadow-lg sm:p-5" aria-label="7日間の成長データ">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-black tracking-wide text-sky-100">7-DAY GROWTH</h2>
          <p className="mt-1 text-xs text-emerald-50/65">回答ごとに記録。直近7日間の全Training Modeを集計します。</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-right">
          <div className="text-[0.6rem] font-black tracking-[0.13em] text-emerald-50/55">THIS WEEK</div>
          <div className="mt-0.5 text-sm font-black text-white">{progress.attempts} hands</div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Metric label="Accuracy" value={hasAttempts ? percentage(progress.accuracy) : "—"} detail={changeLabel(progress.accuracyChange, " pt")} />
        <Metric label="Average response" value={formatResponseTime(progress.averageResponseMs)} detail={changeLabel(progress.responseTimeChangeMs, " ms", true)} />
        <Metric label="Practice days" value={`${progress.activeDays} / 7`} detail={hasAttempts ? `${progress.correct} correct` : "最初の回答から記録"} />
      </div>

      <div className="mt-5 grid grid-cols-7 gap-2" aria-label="日別正答率">
        {progress.days.map((day) => {
          const height = day.attempts === 0 ? 4 : Math.max(10, Math.round(day.accuracy * 64));
          return (
            <div key={day.date} className="min-w-0 text-center" title={`${day.date}: ${day.attempts} hands, ${percentage(day.accuracy)}`}>
              <div className="flex h-16 items-end justify-center rounded-md border border-white/10 bg-black/15 px-1">
                <div className="w-full max-w-7 rounded-sm bg-gradient-to-t from-sky-500 to-emerald-300" style={{ height }} />
              </div>
              <div className="mt-1 text-[0.62rem] font-bold text-emerald-50/70">{weekday(day.date)}</div>
              <div className="text-[0.58rem] text-amber-100/80">{day.attempts === 0 ? "—" : percentage(day.accuracy)}</div>
            </div>
          );
        })}
      </div>
      {!hasAttempts && <p className="mt-3 text-xs text-emerald-50/65">今日の1 hand目から、正答率と回答時間の変化が表示されます。</p>}
    </section>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/15 p-3">
      <div className="text-[0.62rem] font-black tracking-[0.12em] text-emerald-50/55">{label.toUpperCase()}</div>
      <div className="mt-1 text-lg font-black text-white">{value}</div>
      <div className="mt-1 text-[0.68rem] text-amber-100/80">{detail}</div>
    </div>
  );
}
