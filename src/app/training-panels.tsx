"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ActionButtons, DiscardTray, FeedbackBanner, Hand, PlayingCard, Shoe } from "@/components";
import { getBasicStrategyDecision } from "@/lib/basicStrategy";
import { getDeviationsForRules, getDeviationAction, type DeviationAction, type HiLoDeviation } from "@/lib/deviations";
import { hiLoValue } from "@/lib/hiloCount";
import {
  generateCountSequenceQuestion,
  generateDeckEstimationQuestion,
  generateStrategyQuestion,
  generateTableCountQuestion,
  generateTrueCountQuestion,
  isDeckEstimateCorrect,
  isTrueCountCorrect,
} from "@/lib/training/questions";
import { countingWeaknessContext, deviationWeaknessContext, strategyWeaknessContexts, trueCountWeaknessContext } from "@/lib/training/session";
import type { StrategyQuestion, StrategySituation, TrainingAttempt, TrainingMode, WeaknessReview } from "@/lib/training/types";
import type { Card, BlackjackRules, PlayerAction, Rank } from "@/types";
import { useActionHotkeys, useAutoAdvance, useSpaceAdvance } from "@/hooks/useTrainingSession";

type Feedback = { correct: boolean; correctAction?: string; message?: string; responseMs?: number };

const CARD_SUITS: Card["suit"][] = ["spades", "hearts", "clubs", "diamonds"];
const SPEEDS: Record<string, number> = { Beginner: 1500, Normal: 1050, Casino: 800, Fast: 480 };

function drillCard(rank: Rank, id: string, index: number): Card {
  return { id: `${id}-${index}`, rank, suit: CARD_SUITS[index % CARD_SUITS.length]!, deckIndex: 0 };
}

function DrillShell({ title, subtitle, onBack, children }: { title: string; subtitle: string; onBack: () => void; children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl px-4 pb-10 sm:px-6"><div className="mb-3"><p className="text-[0.62rem] font-black tracking-[0.18em] text-amber-200">TRAINING TABLE</p><h1 className="font-serif text-2xl font-black tracking-wide text-white sm:text-3xl">{title}</h1><p className="mt-1 text-sm text-emerald-50/70">{subtitle}</p></div>{children}<button type="button" onClick={onBack} className="focus-ring mt-5 rounded-lg border border-white/20 bg-black/15 px-4 py-2 text-xs font-bold text-emerald-50 hover:bg-white/10">← TRAINING MENU</button></div>;
}

function sign(number: number): string { return number > 0 ? `+${number}` : String(number); }

export function StrategyDrill({ mode, rules, onBack, onRecord, initialSituation, recordMode }: { mode: "basic" | "speed"; rules: BlackjackRules; onBack: () => void; onRecord: (attempt: TrainingAttempt) => void; initialSituation?: StrategySituation; recordMode?: TrainingMode }) {
  const makeQuestion = useCallback((situation?: StrategySituation) => generateStrategyQuestion({ rules, situation, resolveAction: (cards, dealer, activeRules) => getBasicStrategyDecision(cards, dealer, activeRules) }), [rules]);
  const [question, setQuestion] = useState<StrategyQuestion>(() => makeQuestion(initialSituation));
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [fastMode, setFastMode] = useState(mode === "speed");
  const startedAt = useRef(Date.now());

  const next = useCallback(() => { setQuestion(makeQuestion(initialSituation)); setFeedback(null); startedAt.current = Date.now(); }, [initialSituation, makeQuestion]);
  useEffect(() => { next(); }, [rules, next]);
  useAutoAdvance(next, Boolean(feedback && fastMode), 680);
  useSpaceAdvance(next, Boolean(feedback));

  const submit = useCallback((action: PlayerAction) => {
    if (feedback) return;
    const responseMs = Date.now() - startedAt.current;
    const correct = action === question.expectedAction;
    setFeedback({ correct, correctAction: question.expectedAction, message: question.reason, responseMs });
    onRecord({ id: question.id, mode: recordMode ?? mode, correct, responseMs, weaknesses: strategyWeaknessContexts(question.situation) });
  }, [feedback, mode, onRecord, question, recordMode]);
  useActionHotkeys(submit, !feedback);

  const playerCards = question.playerCards;
  const dealerCard = question.dealerUpcard;
  const speedBand = feedback?.responseMs === undefined ? null : feedback.responseMs < 1000 ? "< 1.0 sec" : feedback.responseMs < 1500 ? "1.0–1.5 sec" : feedback.responseMs <= 2000 ? "1.5–2.0 sec" : "> 2.0 sec";

  return <DrillShell title={mode === "speed" ? "SPEED STRATEGY" : "BASIC STRATEGY"} subtitle={mode === "speed" ? "目標: Accuracy 98%以上 / Average 1.5 sec以下" : "カードを見て、最適なActionを一手で選ぶ。"} onBack={onBack}>
    <section className="rounded-3xl border border-amber-100/25 bg-emerald-950/40 p-4 shadow-2xl sm:p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="text-xs font-bold tracking-[0.15em] text-amber-100">DEALER UPCARD</div><label className="flex items-center gap-2 text-xs font-bold text-emerald-50/75"><input type="checkbox" checked={fastMode} onChange={(event) => setFastMode(event.target.checked)} className="h-4 w-4 accent-amber-300" /> FAST MODE (auto-next)</label></div>
      <div className="grid gap-5 md:grid-cols-[1fr_auto_1fr] md:items-center"><div className="order-2 md:order-1"><Hand cards={playerCards} label={question.situation.playerLabel.toUpperCase()} total={question.situation.total} isSoft={question.situation.handKind === "soft"} active dealt /></div><div className="order-1 md:order-2"><PlayingCard card={dealerCard} size="lg" dealt /><p className="mt-2 text-center text-xs font-black text-amber-100">DEALER {question.situation.dealerLabel}</p></div><div className="order-3 rounded-2xl border border-white/12 bg-black/20 p-4"><p className="text-xs font-bold leading-5 text-emerald-50/70">{mode === "speed" ? "表示と同時にTimer開始。H / S / D / P / Rも使えます。" : "Actionを選ぶとすぐにCorrect actionと短い理由を表示します。"}</p><div className="mt-4"><ActionButtons onAction={(action) => submit(action)} disabled={Boolean(feedback)} /></div></div></div>
      {feedback && <div className="mt-4"><FeedbackBanner correct={feedback.correct} correctAction={feedback.correctAction} message={feedback.message} responseMs={feedback.responseMs} />{speedBand && <p className="mt-2 text-center text-xs font-black tracking-wide text-amber-100">RESPONSE BAND: {speedBand}</p>}{!fastMode && <button type="button" onClick={next} className="focus-ring mt-3 w-full rounded-xl border border-amber-200/50 bg-amber-200/15 px-4 py-3 text-sm font-black text-amber-50 hover:bg-amber-200/25">NEXT HAND</button>}</div>}
    </section>
  </DrillShell>;
}

export function HiLoDrill({ onBack, onRecord }: { onBack: () => void; onRecord: (attempt: TrainingAttempt) => void }) {
  const [level, setLevel] = useState<1 | 2 | 3 | 4>(1);
  const [speed, setSpeed] = useState("Casino");
  const [showCount, setShowCount] = useState(false);
  const [sequence, setSequence] = useState(() => generateCountSequenceQuestion({ level: 1 }));
  const [table, setTable] = useState(() => generateTableCountQuestion({ level: 3 }));
  const [started, setStarted] = useState(false);
  const [shown, setShown] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const startAt = useRef(Date.now());
  const isTable = level >= 3;
  const activeRanks = isTable ? table.ranks : sequence.ranks;
  const expected = isTable ? table.expectedRunningCount : sequence.expectedRunningCount;

  const next = useCallback((nextLevel = level) => { setLevel(nextLevel); setSequence(generateCountSequenceQuestion({ level: nextLevel })); if (nextLevel >= 3) setTable(generateTableCountQuestion({ level: nextLevel as 3 | 4 })); setStarted(nextLevel === 1); setShown(nextLevel === 1 ? 1 : 0); setAnswer(""); setFeedback(null); startAt.current = Date.now(); }, [level]);
  useEffect(() => { if (level !== 2 || !started || feedback) return; if (shown >= sequence.ranks.length) return; const timer = window.setTimeout(() => setShown((value) => value + 1), SPEEDS[speed]); return () => window.clearTimeout(timer); }, [feedback, level, sequence.ranks.length, shown, speed, started]);
  useSpaceAdvance(() => next(level), Boolean(feedback));

  const answerCount = (candidate: number) => { if (feedback || (level === 2 && shown < sequence.ranks.length) || (isTable && !started)) return; const correct = candidate === expected; const responseMs = Date.now() - startAt.current; setFeedback({ correct, message: correct ? "Count maintained." : "You lost the count here.", responseMs }); onRecord({ mode: "hilo", correct, responseMs, weaknesses: [countingWeaknessContext(`Hi-Lo Level ${level}`)] }); };
  const visibleRanks = level === 1 ? sequence.ranks : level === 2 ? (shown === 0 ? [] : sequence.ranks.slice(Math.max(0, shown - 1), shown)) : activeRanks;
  const tableCards = (ranks: Rank[], label: string) => <Hand cards={ranks.map((rank, index) => drillCard(rank, `${table.id}-${label}`, index))} label={label} dealt total={undefined} showTotal={false} cardSize="sm" />;

  return <DrillShell title="HI-LO COUNTING" subtitle="2–6 = +1 / 7–9 = 0 / 10–A = −1。通常はRunning Countを隠して練習します。" onBack={onBack}>
    <section className="rounded-3xl border border-amber-100/25 bg-emerald-950/40 p-4 shadow-2xl sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{([1, 2, 3, 4] as const).map((value) => <button key={value} type="button" onClick={() => next(value)} className={`focus-ring rounded-lg border px-3 py-2 text-xs font-black ${level === value ? "border-amber-200 bg-amber-200/20 text-amber-100" : "border-white/15 bg-black/15 text-emerald-50/75"}`}>LEVEL {value}</button>)}</div><label className="flex items-center gap-2 text-xs font-bold text-emerald-50/75"><input type="checkbox" checked={showCount} onChange={(event) => setShowCount(event.target.checked)} className="h-4 w-4 accent-amber-300" /> SHOW COUNT</label></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/15 p-3"><div className="text-xs text-emerald-50/70">{level === 1 ? "カード1枚のTagを答える。" : level === 2 ? "高速表示を追い、最後にRCを答える。" : level === 3 ? "DealerとPlayerを含めて数える。" : "複数Playerの視覚情報量で数える。"}</div>{level === 2 && <label className="text-xs font-bold text-amber-100">SPEED <select value={speed} onChange={(event) => setSpeed(event.target.value)} className="ml-2 rounded bg-emerald-950 px-2 py-1 text-white">{Object.keys(SPEEDS).map((key) => <option key={key}>{key}</option>)}</select></label>}</div>
      {isTable ? <div className="mt-5">{started ? <div className="space-y-3"><div className="mx-auto max-w-md">{tableCards(table.dealerRanks, "DEALER")}</div><div className={`grid gap-2 ${table.playerSeats.length > 3 ? "md:grid-cols-3" : "md:grid-cols-" + table.playerSeats.length}`}>{table.playerSeats.map((seat) => <div key={seat.label}>{tableCards(seat.ranks, seat.label)}</div>)}</div></div> : <button type="button" onClick={() => { setStarted(true); startAt.current = Date.now(); }} className="focus-ring grid min-h-52 w-full place-items-center rounded-2xl border border-dashed border-amber-100/40 bg-black/20 text-lg font-black text-amber-100 hover:bg-amber-100/10">DEAL CARDS</button>}</div> : <div className="mt-5 grid min-h-56 place-items-center rounded-2xl border border-white/12 bg-black/20 p-5"><div className="flex min-h-36 items-center justify-center">{visibleRanks.length ? visibleRanks.map((rank, index) => <PlayingCard key={`${rank}-${index}-${shown}`} card={drillCard(rank, sequence.id, index)} size="lg" dealt />) : <span className="text-sm font-bold text-emerald-50/50">{started ? "Dealing…" : "READY"}</span>}</div>{level === 2 && !started && <button type="button" onClick={() => { setStarted(true); setShown(0); startAt.current = Date.now(); }} className="focus-ring mt-3 rounded-xl border border-amber-200/50 bg-amber-200/15 px-6 py-3 text-sm font-black text-amber-50">START COUNT</button>}</div>}
      {showCount && <div className="mt-3 rounded-lg border border-amber-100/20 bg-amber-100/10 px-3 py-2 text-center text-sm font-black text-amber-100">RC: {sign(expected)}</div>}
      {!feedback && level === 1 && <div className="mt-4 grid grid-cols-3 gap-2"><CountButton value={1} onClick={() => answerCount(1)} /><CountButton value={0} onClick={() => answerCount(0)} /><CountButton value={-1} onClick={() => answerCount(-1)} /></div>}
      {!feedback && level >= 2 && (level !== 2 || shown >= sequence.ranks.length) && (!isTable || started) && <form onSubmit={(event) => { event.preventDefault(); answerCount(Number(answer)); }} className="mt-4 flex gap-2"><input aria-label="Running Count" inputMode="numeric" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="What&apos;s the Running Count?" className="min-w-0 flex-1 rounded-xl border border-white/20 bg-black/25 px-4 py-3 text-center text-lg font-black text-white placeholder:text-sm placeholder:text-emerald-50/40 focus:outline-none" autoFocus /><button type="submit" className="focus-ring rounded-xl border border-amber-200/50 bg-amber-200/15 px-5 text-sm font-black text-amber-50">CHECK RC</button></form>}
      {feedback && <div className="mt-4"><FeedbackBanner correct={feedback.correct} message={feedback.message} responseMs={feedback.responseMs} /><div className="mt-3 rounded-xl border border-white/12 bg-black/20 p-3"><p className="text-xs font-black tracking-wide text-amber-100">COUNT TRAIL</p><div className="mt-2 flex flex-wrap gap-2 text-sm font-bold text-white">{activeRanks.map((rank, index) => <span key={`${rank}-${index}`} className="rounded bg-white/10 px-2 py-1">{rank} → {sign(activeRanks.slice(0, index + 1).reduce((count, item) => count + hiLoValue(item), 0))}</span>)}</div><p className="mt-3 text-sm text-emerald-50/75">Your answer: <strong className="text-white">{level === 1 ? (feedback.correct ? sign(hiLoValue(sequence.ranks[0]!)) : "—") : answer}</strong> · Correct: <strong className="text-amber-100">{sign(expected)}</strong></p></div><button type="button" onClick={() => next(level)} className="focus-ring mt-3 w-full rounded-xl border border-amber-200/50 bg-amber-200/15 px-4 py-3 text-sm font-black text-amber-50">NEXT SEQUENCE</button></div>}
    </section>
  </DrillShell>;
}

function CountButton({ value, onClick }: { value: number; onClick: () => void }) { return <button type="button" onClick={onClick} className="focus-ring min-h-16 rounded-xl border border-white/20 bg-black/20 text-xl font-black text-white hover:bg-amber-100/15">{sign(value)}</button>; }

export function TrueCountDrill({ initialPanel, onBack, onRecord }: { initialPanel: "true" | "deck"; onBack: () => void; onRecord: (attempt: TrainingAttempt) => void }) {
  const [panel, setPanel] = useState<"true" | "deck">(initialPanel);
  const [difficulty, setDifficulty] = useState<"Easy" | "Realistic">("Easy");
  const [tcQuestion, setTcQuestion] = useState(() => generateTrueCountQuestion());
  const [deckQuestion, setDeckQuestion] = useState(() => generateDeckEstimationQuestion());
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const startAt = useRef(Date.now());
  const next = (kind = panel) => { setPanel(kind); setAnswer(""); setFeedback(null); startAt.current = Date.now(); if (kind === "true") setTcQuestion(generateTrueCountQuestion()); else setDeckQuestion(generateDeckEstimationQuestion()); };
  useSpaceAdvance(next, Boolean(feedback));
  const submitTc = () => { if (feedback) return; const correct = isTrueCountCorrect(Number(answer), tcQuestion); const responseMs = Date.now() - startAt.current; setFeedback({ correct, message: `RC ${sign(tcQuestion.runningCount)} ÷ ${tcQuestion.decksRemaining} decks = ${tcQuestion.rawTrueCount.toFixed(2)} → ${sign(tcQuestion.expectedTrueCount)} (${tcQuestion.rounding})`, responseMs }); onRecord({ mode: "true-count", correct, responseMs, weaknesses: [trueCountWeaknessContext()] }); };
  const submitDeck = (value: number) => { if (feedback) return; const correct = isDeckEstimateCorrect(value, deckQuestion); const responseMs = Date.now() - startAt.current; setFeedback({ correct, message: `Correct estimate: ${deckQuestion.decksRemaining} decks remaining.`, responseMs }); onRecord({ mode: "true-count", correct, responseMs, weaknesses: [trueCountWeaknessContext("Deck Estimation")] }); };
  const activeShoe = panel === "true" ? tcQuestion.deckEstimate : deckQuestion;
  return <DrillShell title={panel === "true" ? "TRUE COUNT" : "DECK ESTIMATION"} subtitle="TC = Running Count ÷ estimated decks remaining。Index PlayではfloorしたTCを比較します。" onBack={onBack}>
    <section className="rounded-3xl border border-amber-100/25 bg-emerald-950/40 p-4 shadow-2xl sm:p-6"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => next("true")} className={`focus-ring rounded-lg border px-3 py-2 text-xs font-black ${panel === "true" ? "border-amber-200 bg-amber-200/20 text-amber-100" : "border-white/15"}`}>TRUE COUNT</button><button type="button" onClick={() => next("deck")} className={`focus-ring rounded-lg border px-3 py-2 text-xs font-black ${panel === "deck" ? "border-amber-200 bg-amber-200/20 text-amber-100" : "border-white/15"}`}>DECK ESTIMATION</button></div>
      {panel === "true" && <div className="mt-4 flex flex-wrap items-center justify-between rounded-xl border border-white/10 bg-black/15 p-3"><span className="text-xs text-emerald-50/70">Easyは数値表示、RealisticはShoeとDiscard Trayから推定。</span><div className="flex rounded-lg border border-white/15 p-0.5">{(["Easy", "Realistic"] as const).map((value) => <button key={value} type="button" onClick={() => setDifficulty(value)} className={`rounded-md px-3 py-1.5 text-xs font-black ${difficulty === value ? "bg-amber-200/20 text-amber-100" : "text-emerald-50/60"}`}>{value}</button>)}</div></div>}
      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center"><div className="rounded-2xl border border-white/12 bg-black/20 p-5 text-center"><p className="text-xs font-black tracking-[0.15em] text-emerald-50/65">RUNNING COUNT</p><div className="mt-2 text-5xl font-black text-amber-100">{panel === "true" ? sign(tcQuestion.runningCount) : "?"}</div>{panel === "true" && difficulty === "Easy" && <p className="mt-3 text-sm font-bold text-white">Decks remaining: {tcQuestion.decksRemaining}</p>}</div><div className="flex items-center justify-center gap-3"><Shoe totalCards={activeShoe.totalDecks * 52} remainingCards={Math.round(activeShoe.decksRemaining * 52)} deckCount={activeShoe.totalDecks} showDetails={panel === "deck" ? false : difficulty === "Easy"} /><DiscardTray totalCards={activeShoe.totalDecks * 52} discardedCards={Math.round(activeShoe.decksDiscarded * 52)} showDetails={false} /></div><div className="rounded-2xl border border-white/12 bg-black/20 p-5 text-center">{panel === "true" ? <><p className="text-xs font-black tracking-[0.15em] text-emerald-50/65">TRUE COUNT = ?</p><form onSubmit={(event) => { event.preventDefault(); submitTc(); }} className="mt-4 flex justify-center gap-2"><input aria-label="True Count" inputMode="numeric" value={answer} onChange={(event) => setAnswer(event.target.value)} className="w-24 rounded-xl border border-white/20 bg-black/30 px-3 py-3 text-center text-xl font-black text-white" autoFocus /><button className="focus-ring rounded-xl border border-amber-200/50 bg-amber-200/15 px-4 text-xs font-black text-amber-50">CHECK</button></form></> : <><p className="text-xs font-black tracking-[0.15em] text-emerald-50/65">DECKS REMAINING?</p><div className="mt-4 grid grid-cols-3 gap-2">{Array.from({ length: 11 }, (_, index) => (index + 1) * 0.5).map((value) => <button key={value} type="button" onClick={() => submitDeck(value)} className="focus-ring rounded-lg border border-white/20 bg-black/20 px-2 py-2 text-sm font-black text-white hover:bg-amber-100/15">{value}</button>)}</div></>}</div></div>
      {feedback && <div className="mt-4"><FeedbackBanner correct={feedback.correct} message={feedback.message} responseMs={feedback.responseMs} /><button type="button" onClick={() => next()} className="focus-ring mt-3 w-full rounded-xl border border-amber-200/50 bg-amber-200/15 px-4 py-3 text-sm font-black text-amber-50">NEXT {panel === "true" ? "TRUE COUNT" : "SHOE"}</button></div>}
    </section>
  </DrillShell>;
}

function makeDeviation(deviations: readonly HiLoDeviation[], rules: BlackjackRules): { deviation: HiLoDeviation; trueCount: number } { const deviation = deviations[Math.floor(Math.random() * deviations.length)]!; const index = deviation.indexBySoft17[rules.dealerSoft17]; const trueCount = Math.random() < 0.5 ? index - 1 - Math.floor(Math.random() * 3) : index + Math.floor(Math.random() * 4); return { deviation, trueCount }; }

export function DeviationDrill({ rules, onBack, onRecord }: { rules: BlackjackRules; onBack: () => void; onRecord: (attempt: TrainingAttempt) => void }) {
  const deviations = useMemo(() => getDeviationsForRules(rules), [rules]);
  const [question, setQuestion] = useState(() => makeDeviation(getDeviationsForRules(rules), rules));
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const startAt = useRef(Date.now());
  const next = useCallback(() => { setQuestion(makeDeviation(deviations, rules)); setFeedback(null); startAt.current = Date.now(); }, [deviations, rules]);
  useEffect(() => { next(); }, [next]);
  useSpaceAdvance(next, Boolean(feedback));
  const expected = getDeviationAction(question.deviation, question.trueCount, rules.dealerSoft17);
  const submit = (action: DeviationAction) => { if (feedback) return; const correct = action === expected; const responseMs = Date.now() - startAt.current; setFeedback({ correct, correctAction: expected, message: `Index ${question.deviation.indexBySoft17[rules.dealerSoft17]} (${rules.dealerSoft17}, floored TC).`, responseMs }); onRecord({ mode: "deviations", correct, responseMs, weaknesses: [deviationWeaknessContext(question.deviation.id, question.deviation.playerHand)] }); };
  const insurance = question.deviation.handKind === "INSURANCE";
  return <DrillShell title="STRATEGY DEVIATIONS" subtitle="Illustrious 18 + Fab 4。含まれるIndexは6-deck Hi-Lo、floorしたTrue Countで判定します。" onBack={onBack}>
    <section className="rounded-3xl border border-amber-100/25 bg-emerald-950/40 p-4 shadow-2xl sm:p-6"><div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center"><div className="rounded-2xl border border-white/12 bg-black/20 p-5 text-center"><p className="text-xs font-black tracking-[0.15em] text-emerald-50/65">PLAYER HAND</p><p className="mt-3 font-serif text-4xl font-black text-white">{question.deviation.playerHand}</p></div><div className="rounded-full border-4 border-amber-100/30 bg-black/20 px-6 py-5 text-center"><p className="text-[0.6rem] font-black tracking-[0.15em] text-emerald-50/65">TRUE COUNT</p><p className="mt-1 text-4xl font-black text-amber-100">{sign(question.trueCount)}</p></div><div className="rounded-2xl border border-white/12 bg-black/20 p-5 text-center"><p className="text-xs font-black tracking-[0.15em] text-emerald-50/65">DEALER UPCARD</p><p className="mt-3 font-serif text-4xl font-black text-white">{question.deviation.dealerUpcard}</p></div></div><p className="mt-5 text-center text-xs text-emerald-50/60">{question.deviation.family.replace("_", " ")} · {rules.dealerSoft17} · index comparison uses floor(TC)</p>
      <div className="mt-5">{insurance ? <div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => submit("INSURANCE")} className="focus-ring min-h-16 rounded-xl border border-amber-200/50 bg-amber-200/15 text-sm font-black text-amber-50">INSURANCE</button><button type="button" onClick={() => submit("NO_INSURANCE")} className="focus-ring min-h-16 rounded-xl border border-white/20 bg-black/20 text-sm font-black text-white">NO INSURANCE</button></div> : <ActionButtons onAction={(action) => submit(action)} disabled={Boolean(feedback)} />}</div>
      {feedback && <div className="mt-4"><FeedbackBanner correct={feedback.correct} correctAction={feedback.correctAction} message={feedback.message} responseMs={feedback.responseMs} /><details className="mt-3 rounded-xl border border-white/12 bg-black/20 p-3 text-xs text-emerald-50/70"><summary className="cursor-pointer font-bold text-amber-100">SOURCE / ASSUMPTION</summary><p className="mt-2 leading-5">{question.deviation.source}</p></details><button type="button" onClick={next} className="focus-ring mt-3 w-full rounded-xl border border-amber-200/50 bg-amber-200/15 px-4 py-3 text-sm font-black text-amber-50">NEXT INDEX PLAY</button></div>}
    </section>
  </DrillShell>;
}

export function WeaknessDrill({ rules, weaknesses, onBack, onRecord }: { rules: BlackjackRules; weaknesses: WeaknessReview[]; onBack: () => void; onRecord: (attempt: TrainingAttempt) => void }) {
  const [selected, setSelected] = useState<WeaknessReview | null>(null);
  if (selected?.situation) return <StrategyDrill mode="basic" recordMode="weakness-review" rules={rules} initialSituation={selected.situation} onBack={() => setSelected(null)} onRecord={onRecord} />;
  return <DrillShell title="WEAKNESS REVIEW" subtitle="正答率が低いSituationを優先して、同じPatternを反復します。" onBack={onBack}>
    <section className="rounded-3xl border border-amber-100/25 bg-emerald-950/40 p-4 shadow-2xl sm:p-6">{weaknesses.length === 0 ? <div className="grid min-h-64 place-items-center text-center"><div><p className="font-serif text-xl font-black text-amber-100">まだReviewするDataがありません。</p><p className="mt-2 text-sm text-emerald-50/65">Basic Strategy、Hi-Lo、True Countを数Hands進めると、ここに苦手Situationが出ます。</p></div></div> : <ol className="space-y-3">{weaknesses.map((weakness, index) => <li key={weakness.key} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/12 bg-black/20 p-4"><div><p className="text-xs font-black tracking-[0.15em] text-amber-100">{index + 1}. {weakness.dimension.toUpperCase()}</p><h2 className="mt-1 text-lg font-black text-white">{weakness.label}</h2><p className="mt-1 text-xs text-emerald-50/65">Accuracy: {Math.round(weakness.accuracy * 100)}% · {weakness.attempts} attempts</p></div>{weakness.situation ? <button type="button" onClick={() => setSelected(weakness)} className="focus-ring rounded-xl border border-amber-200/50 bg-amber-200/15 px-4 py-3 text-xs font-black text-amber-50">FOCUS DRILL</button> : <span className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-emerald-50/60">Practice related mode</span>}</li>)}</ol>}</section>
  </DrillShell>;
}
