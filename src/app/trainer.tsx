"use client";

import { useState } from "react";

import { Stats } from "@/components/Stats";
import { WeeklyProgress } from "@/components/WeeklyProgress";
import { formatCurrency } from "@/components/ui";
import { DEFAULT_RULES, mergeRules, type BlackjackRules, type DeckCount } from "@/types";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import type { TrainingMode } from "@/lib/training/types";

import { DeviationDrill, HiLoDrill, StrategyDrill, TrueCountDrill, WeaknessDrill } from "./training-panels";
import { FullTableSimulation } from "./full-table";

type Screen = "home" | TrainingMode | "deck-estimation";

const MODE_CARDS: Array<{
  id: Screen;
  statsMode: TrainingMode;
  kicker: string;
  title: string;
  description: string;
  accent: string;
}> = [
  { id: "basic", statsMode: "basic", kicker: "01", title: "Basic Strategy", description: "最適なActionを反射で選ぶ。", accent: "border-sky-300/45 hover:bg-sky-300/10" },
  { id: "speed", statsMode: "speed", kicker: "02", title: "Speed Strategy", description: "正確さと1.5 sec以内の判断を鍛える。", accent: "border-amber-300/55 hover:bg-amber-300/10" },
  { id: "hilo", statsMode: "hilo", kicker: "03", title: "Hi-Lo Counting", description: "Running Countをテーブル速度で保つ。", accent: "border-emerald-300/45 hover:bg-emerald-300/10" },
  { id: "true-count", statsMode: "true-count", kicker: "04", title: "True Count", description: "RCと残りShoeからTCを素早く出す。", accent: "border-violet-300/45 hover:bg-violet-300/10" },
  { id: "full-table", statsMode: "full-table", kicker: "05", title: "Full Table Simulation", description: "Bet・Action・Countを同時に実戦練習。", accent: "border-red-300/45 hover:bg-red-300/10" },
  { id: "deviations", statsMode: "deviations", kicker: "06", title: "Strategy Deviations", description: "Hi-Lo Index PlayをBasic Strategyに重ねる。", accent: "border-fuchsia-300/45 hover:bg-fuchsia-300/10" },
  { id: "weakness-review", statsMode: "weakness-review", kicker: "07", title: "Weakness Review", description: "間違いが多いSituationだけを集中出題。", accent: "border-orange-300/45 hover:bg-orange-300/10" },
];

const PRESETS = [
  ["Quick Practice", "20 hands", "basic"] as const,
  ["5 Minute Drill", "100 hands", "speed"] as const,
  ["Casino Simulation", "live shoe", "full-table"] as const,
  ["Count Practice", "Hi-Lo + TC", "hilo"] as const,
  ["Mistake Review", "targeted", "weakness-review"] as const,
];

function Header({ onHome, onSettings, screen }: { onHome: () => void; onSettings: () => void; screen: Screen }) {
  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
      <button type="button" onClick={onHome} className="focus-ring group text-left" aria-label="ホームへ戻る">
        <div className="font-serif text-lg font-black tracking-[0.13em] text-amber-100 sm:text-xl">VEGAS BLACKJACK</div>
        <div className="mt-0.5 text-[0.57rem] font-bold tracking-[0.2em] text-emerald-100/65">PRACTICE TABLE</div>
      </button>
      <div className="flex items-center gap-2">
        {screen !== "home" && <button type="button" onClick={onHome} className="focus-ring rounded-lg border border-white/20 bg-black/15 px-3 py-2 text-xs font-bold text-emerald-50 hover:bg-white/10">TRAINING MENU</button>}
        <button type="button" onClick={onSettings} className="focus-ring rounded-lg border border-amber-100/35 bg-amber-100/10 px-3 py-2 text-xs font-bold text-amber-50 hover:bg-amber-100/20">RULE SETTINGS</button>
      </div>
    </header>
  );
}

function SettingsPanel({ rules, onChange, onClose }: { rules: BlackjackRules; onChange: (rules: BlackjackRules) => void; onClose: () => void }) {
  const change = <K extends keyof BlackjackRules>(key: K, value: BlackjackRules[K]) => onChange(mergeRules({ ...rules, [key]: value }));
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/65 p-3 backdrop-blur-sm sm:place-items-center" role="dialog" aria-modal="true" aria-label="Rule Settings">
      <section className="w-full max-w-2xl rounded-2xl border border-amber-100/30 bg-[#09291b] p-5 shadow-2xl sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div><h2 className="font-serif text-xl font-black tracking-wide text-amber-100">RULE SETTINGS</h2><p className="mt-1 text-sm text-emerald-50/70">Vegas 6-Deck presetを基準に、StrategyとGame Engineへ即時反映します。</p></div>
          <button type="button" onClick={onClose} className="focus-ring rounded-lg border border-white/20 px-3 py-2 text-xs font-bold">CLOSE</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SettingSelect label="Number of decks" value={String(rules.deckCount)} onChange={(value) => change("deckCount", Number(value) as DeckCount)} options={[["1", "1 deck"], ["2", "2 decks"], ["6", "6 decks"], ["8", "8 decks"]]} />
          <SettingSelect label="Blackjack payout" value={rules.blackjackPayout} onChange={(value) => change("blackjackPayout", value as BlackjackRules["blackjackPayout"])} options={[["3:2", "3:2"], ["6:5", "6:5"]]} />
          <SettingSelect label="Dealer" value={rules.dealerSoft17} onChange={(value) => change("dealerSoft17", value as BlackjackRules["dealerSoft17"])} options={[["H17", "H17 — Hit Soft 17"], ["S17", "S17 — Stand Soft 17"]]} />
          <SettingSelect label="Penetration" value={String(rules.penetration)} onChange={(value) => change("penetration", Number(value))} options={[["0.6", "60%"], ["0.7", "70%"], ["0.75", "75%"], ["0.8", "80%"]]} />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <RuleToggle label="Double After Split (DAS)" checked={rules.doubleAfterSplit} onChange={(checked) => change("doubleAfterSplit", checked)} />
          <RuleToggle label="Late Surrender" checked={rules.lateSurrender} onChange={(checked) => change("lateSurrender", checked)} />
          <RuleToggle label="Re-split Aces" checked={rules.resplitAces} onChange={(checked) => change("resplitAces", checked)} />
          <RuleToggle label="Insurance" checked={rules.insuranceAllowed} onChange={(checked) => change("insuranceAllowed", checked)} />
        </div>
        <p className="mt-4 rounded-lg border border-white/10 bg-black/15 p-3 text-xs leading-5 text-emerald-50/65">初期値: 6 decks / 3:2 / H17 / DAS / Late Surrender ON。実際のテーブルでは必ずTable Rulesを確認してください。</p>
      </section>
    </div>
  );
}

function SettingSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <label className="block rounded-xl border border-white/12 bg-black/15 p-3 text-xs font-bold text-emerald-50/80"><span className="mb-2 block tracking-wide">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-white/15 bg-emerald-950 px-3 py-2 text-sm font-bold text-white focus:outline-none">{options.map(([optionValue, name]) => <option key={optionValue} value={optionValue}>{name}</option>)}</select></label>;
}

function RuleToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/12 bg-black/15 p-3 text-xs font-bold text-emerald-50/85"><span>{label}</span><input type="checkbox" className="h-5 w-5 accent-amber-300" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>;
}

export default function BlackjackTrainer() {
  const [screen, setScreen] = useState<Screen>("home");
  const [rules, setRules] = useState<BlackjackRules>(() => ({ ...DEFAULT_RULES }));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const training = useTrainingSession();

  const open = (next: Screen) => setScreen(next);
  const home = () => setScreen("home");

  let content: React.ReactNode;
  if (screen === "basic" || screen === "speed") content = <StrategyDrill mode={screen} rules={rules} onBack={home} onRecord={training.recordAttempt} />;
  else if (screen === "hilo") content = <HiLoDrill onBack={home} onRecord={training.recordAttempt} />;
  else if (screen === "true-count" || screen === "deck-estimation") content = <TrueCountDrill initialPanel={screen === "deck-estimation" ? "deck" : "true"} onBack={home} onRecord={training.recordAttempt} />;
  else if (screen === "deviations") content = <DeviationDrill rules={rules} onBack={home} onRecord={training.recordAttempt} />;
  else if (screen === "weakness-review") content = <WeaknessDrill rules={rules} weaknesses={training.weaknessReview} onBack={home} onRecord={training.recordAttempt} />;
  else if (screen === "full-table") content = <FullTableSimulation rules={rules} onBack={home} onRecord={training.recordAttempt} />;
  else content = <HomeDashboard open={open} training={training} />;

  return <main className="felt-texture min-h-screen overflow-x-hidden"><Header onHome={home} onSettings={() => setSettingsOpen(true)} screen={screen} />{content}{settingsOpen && <SettingsPanel rules={rules} onChange={setRules} onClose={() => setSettingsOpen(false)} />}</main>;
}

function HomeDashboard({ open, training }: { open: (screen: Screen) => void; training: ReturnType<typeof useTrainingSession> }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6">
      <section className="relative overflow-hidden rounded-3xl border border-amber-100/25 bg-gradient-to-br from-emerald-950/75 via-emerald-900/45 to-black/30 px-5 py-7 shadow-2xl sm:px-8 sm:py-10">
        <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full border border-amber-200/10 bg-amber-200/5" />
        <div className="relative max-w-3xl"><p className="mb-2 text-xs font-black tracking-[0.22em] text-amber-200">LAS VEGAS PREP</p><h1 className="font-serif text-3xl font-black tracking-tight text-white sm:text-5xl">カードを見た瞬間に、<br /><span className="text-amber-200">正しいAction</span>を選ぶ。</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-emerald-50/75 sm:text-base">Basic Strategy、Hi-Lo、True Count、Index Playを、カジノのテーブルに近いテンポで反復します。短期の結果はVarianceに左右されます。</p></div>
      </section>
      <div className="mt-6"><WeeklyProgress progress={training.weeklyProgress} /></div>
      <section className="mt-6"><div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="font-serif text-xl font-black tracking-wide text-amber-100">TRAINING MODES</h2><p className="mt-1 text-xs text-emerald-50/65">Accuracy / Average response time / Best streak はこのSession内で保持されます。</p></div><button type="button" onClick={() => open("deck-estimation")} className="focus-ring rounded-lg border border-white/20 bg-black/15 px-3 py-2 text-xs font-bold text-emerald-50 hover:bg-white/10">DECK ESTIMATION</button></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{MODE_CARDS.map((mode) => <button key={mode.id} type="button" onClick={() => open(mode.id)} className={`focus-ring group rounded-2xl border bg-black/20 p-4 text-left transition duration-150 hover:-translate-y-0.5 ${mode.accent}`}><div className="mb-3 flex items-center justify-between"><span className="font-serif text-2xl font-black text-amber-100/85">{mode.kicker}</span><span className="rounded-full border border-white/15 px-2 py-1 text-[0.55rem] font-black tracking-[0.13em] text-emerald-50/70">START →</span></div><h3 className="text-lg font-black text-white">{mode.title}</h3><p className="mt-1 min-h-10 text-xs leading-5 text-emerald-50/70">{mode.description}</p><div className="mt-3"><Stats stats={training.modePerformance[mode.statsMode]} title="SESSION" compact /></div></button>)}</div>
      </section>
      <section className="mt-6 rounded-2xl border border-white/12 bg-black/20 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-serif text-lg font-black tracking-wide text-amber-100">SESSION PRESETS</h2><p className="mt-1 text-xs text-emerald-50/65">旅行直前の短時間練習にも使える入口です。</p></div><div className="text-right text-xs text-emerald-50/65">Bankroll preset<br /><strong className="text-base text-white">{formatCurrency(30000)}</strong></div></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{PRESETS.map(([name, detail, target]) => <button key={name} type="button" onClick={() => open(target)} className="focus-ring rounded-xl border border-white/15 bg-emerald-950/35 p-3 text-left hover:bg-emerald-900/55"><strong className="block text-sm text-white">{name}</strong><span className="mt-1 block text-xs text-amber-100/75">{detail}</span></button>)}</div></section>
    </div>
  );
}
