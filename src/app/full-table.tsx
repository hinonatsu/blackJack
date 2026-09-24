"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ActionButtons, Chip, DealerArea, DiscardTray, FeedbackBanner, PlayerArea, Shoe } from "@/components";
import { getBasicStrategyDecision } from "@/lib/basicStrategy";
import { canDoubleHand, canSurrenderHand, canSplitHand, createPlayerHand, doubleHand, evaluateHand, hitHand, isBlackjack, playDealerHand, splitHand, standHand, surrenderHand, availablePlayerActions, settleRound } from "@/lib/blackjackEngine";
import { createShoe, discardCards, drawCard, drawCards, reshuffleShoe, shouldReshuffleBeforeRound } from "@/lib/deck";
import { applyHiLoCards, hiLoValue } from "@/lib/hiloCount";
import { calculateTrueCount, decksRemainingFromCards } from "@/lib/trueCount";
import { countingWeaknessContext, strategyWeaknessContexts, trueCountWeaknessContext } from "@/lib/training/session";
import type { TrainingAttempt } from "@/lib/training/types";
import { useSpaceAdvance } from "@/hooks/useTrainingSession";
import type { BlackjackRules, Card, HandSettlement, PlayerAction, PlayerHand, ShoeState } from "@/types";

type LivePhase = "BETTING" | "INSURANCE" | "PLAYER_TURN" | "SETTLED";
type TrainingScope = "basic" | "counting" | "combined";
type AnimationMode = "Off" | "Fast" | "Realistic";

interface ActionReview { action: PlayerAction; expected: PlayerAction; correct: boolean; reason: string; responseMs: number; }
interface LiveGame {
  shoe: ShoeState;
  bankrollCents: number;
  tableMinimumCents: number;
  selectedBetCents: number;
  phase: LivePhase;
  dealerCards: PlayerHand["cards"];
  playerHands: PlayerHand[];
  activeHandIndex: number | null;
  runningCount: number;
  insuranceWagerCents: number;
  settlements: HandSettlement[];
  actionReview: ActionReview | null;
  notice: string | null;
}

const CHIP_VALUES = [500, 1000, 2500, 5000, 10000];
const TABLE_MINIMUMS = [500, 1000, 1500, 2500];

function blankGame(rules: BlackjackRules): LiveGame {
  return { shoe: createShoe(rules), bankrollCents: 30000, tableMinimumCents: 500, selectedBetCents: 500, phase: "BETTING", dealerCards: [], playerHands: [], activeHandIndex: null, runningCount: 0, insuranceWagerCents: 0, settlements: [], actionReview: null, notice: null };
}

function visibleAtInitialDeal(cards: readonly Card[]): Card[] { return cards.length >= 3 ? [cards[0]!, cards[1]!, cards[2]!] : [...cards]; }

function dealerNeedsPlay(game: LiveGame): boolean {
  if (isBlackjack(game.dealerCards)) return false;
  return game.playerHands.some((hand) => hand.status === "ACTIVE" || hand.status === "STOOD");
}

/** Reveal the hole card, play the dealer if needed, settle all hands, and move cards to the discard tray. */
function settleLiveRound(game: LiveGame, rules: BlackjackRules): LiveGame {
  let shoe = game.shoe;
  let runningCount = applyHiLoCards(game.runningCount, game.dealerCards.slice(1));
  let dealerCards = [...game.dealerCards];

  if (dealerNeedsPlay(game)) {
    const dealerResult = playDealerHand(dealerCards, rules, () => {
      const drawn = drawCard(shoe);
      shoe = drawn.shoe;
      runningCount += hiLoValue(drawn.card);
      return drawn.card;
    });
    dealerCards = dealerResult.cards;
  }

  const round = settleRound(game.playerHands, dealerCards, rules, game.insuranceWagerCents);
  shoe = discardCards(shoe, [...game.playerHands.flatMap((hand) => hand.cards), ...dealerCards]);
  return { ...game, shoe, dealerCards, runningCount, bankrollCents: game.bankrollCents + round.returnedCents, settlements: round.hands, phase: "SETTLED", activeHandIndex: null, notice: round.insurance ? `Insurance ${round.insurance.outcome}` : null };
}

function nextActiveHand(hands: readonly PlayerHand[], afterIndex: number): number | null {
  for (let offset = 1; offset <= hands.length; offset += 1) {
    const index = (afterIndex + offset) % hands.length;
    if (hands[index]!.status === "ACTIVE") return index;
  }
  return null;
}

function progressLiveRound(game: LiveGame, rules: BlackjackRules, preferredIndex: number): LiveGame {
  if (game.playerHands[preferredIndex]?.status === "ACTIVE") return { ...game, activeHandIndex: preferredIndex };
  const activeHandIndex = nextActiveHand(game.playerHands, preferredIndex);
  return activeHandIndex === null ? settleLiveRound({ ...game, activeHandIndex: null }, rules) : { ...game, activeHandIndex };
}

function formatSigned(value: number): string { return value > 0 ? `+${value}` : String(value); }

/** A small synthesized table sound keeps the app asset-free and is opt-in. */
function playTableTone(enabled: boolean, frequency: number): void {
  if (!enabled || typeof window === "undefined" || !window.AudioContext) return;
  try {
    const context = new window.AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.09);
    oscillator.connect(gain).connect(context.destination);
    oscillator.addEventListener("ended", () => { void context.close(); }, { once: true });
    oscillator.start();
    oscillator.stop(context.currentTime + 0.095);
  } catch {
    // Browsers may block Web Audio; the table remains fully usable without sound.
  }
}

function liveActions(game: LiveGame, hand: PlayerHand, rules: BlackjackRules): PlayerAction[] {
  return availablePlayerActions(hand, game.playerHands.length, rules).filter((action) => {
    if (action !== "DOUBLE" && action !== "SPLIT") return true;
    return game.bankrollCents >= hand.baseWagerCents;
  });
}

function strategySituationFromDecision(decision: ReturnType<typeof getBasicStrategyDecision>) {
  return {
    handKind: decision.hand.kind === "PAIR" ? "pair" as const : decision.hand.kind === "SOFT" ? "soft" as const : "hard" as const,
    total: decision.hand.value.total,
    pairRank: decision.hand.pairRank,
    dealerValue: decision.dealerUpcard === "A" ? 11 : decision.dealerUpcard,
    playerLabel: decision.hand.kind === "PAIR" ? `${decision.hand.pairRank},${decision.hand.pairRank}` : `${decision.hand.kind === "SOFT" ? "Soft" : "Hard"} ${decision.hand.value.total}`,
    dealerLabel: decision.dealerUpcard === "A" ? "A" : String(decision.dealerUpcard),
  };
}

export function FullTableSimulation({ rules, onBack, onRecord }: { rules: BlackjackRules; onBack: () => void; onRecord: (attempt: TrainingAttempt) => void }) {
  const [game, setGame] = useState<LiveGame>(() => blankGame(rules));
  const [scope, setScope] = useState<TrainingScope>("combined");
  const [casinoMode, setCasinoMode] = useState(false);
  const [animation, setAnimation] = useState<AnimationMode>("Fast");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [rcAnswer, setRcAnswer] = useState("");
  const [tcAnswer, setTcAnswer] = useState("");
  const [countFeedback, setCountFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const roundStartedAt = useRef(Date.now());
  const sound = useCallback((frequency: number) => playTableTone(soundEnabled, frequency), [soundEnabled]);

  // A rule change begins a clean Shoe rather than altering an in-progress physical shoe.
  useEffect(() => { setGame(blankGame(rules)); setCountFeedback(null); setRcAnswer(""); setTcAnswer(""); }, [rules]);

  const deal = useCallback(() => {
    sound(520);
    setGame((current) => {
      if (current.phase !== "BETTING") return current;
      let shoe = current.shoe;
      let runningCount = current.runningCount;
      let notice: string | null = null;
      if (shouldReshuffleBeforeRound(shoe)) { shoe = reshuffleShoe(shoe, rules); runningCount = 0; notice = "CUT CARD — SHUFFLE"; }
      if (current.selectedBetCents < current.tableMinimumCents) return { ...current, notice: "Bet must meet the table minimum." };
      if (current.selectedBetCents > current.bankrollCents) return { ...current, notice: "Insufficient bankroll for this bet." };
      const dealt = drawCards(shoe, 4);
      shoe = dealt.shoe;
      const [playerFirst, dealerUpcard, playerSecond, dealerHole] = dealt.cards;
      const player = createPlayerHand([playerFirst!, playerSecond!], current.selectedBetCents);
      const base: LiveGame = { ...current, shoe, bankrollCents: current.bankrollCents - current.selectedBetCents, dealerCards: [dealerUpcard!, dealerHole!], playerHands: [player], activeHandIndex: 0, runningCount: applyHiLoCards(runningCount, visibleAtInitialDeal(dealt.cards)), insuranceWagerCents: 0, settlements: [], actionReview: null, notice, phase: "PLAYER_TURN" };
      roundStartedAt.current = Date.now();
      if (dealerUpcard!.rank === "A" && rules.insuranceAllowed) return { ...base, phase: "INSURANCE", notice: "Insurance? Up to half your original bet." };
      if ((dealerUpcard!.rank === "A" || dealerUpcard!.rank === "10" || dealerUpcard!.rank === "J" || dealerUpcard!.rank === "Q" || dealerUpcard!.rank === "K") && isBlackjack(base.dealerCards)) return settleLiveRound(base, rules);
      if (isBlackjack(player.cards)) return settleLiveRound(base, rules);
      return base;
    });
    setCountFeedback(null); setRcAnswer(""); setTcAnswer("");
  }, [rules, sound]);

  const chooseInsurance = useCallback((takeInsurance: boolean) => {
    sound(takeInsurance ? 610 : 360);
    setGame((current) => {
      if (current.phase !== "INSURANCE") return current;
      const wager = takeInsurance ? Math.floor(current.selectedBetCents / 2) : 0;
      if (wager > current.bankrollCents) return { ...current, notice: "Insufficient bankroll for Insurance." };
      const updated = { ...current, bankrollCents: current.bankrollCents - wager, insuranceWagerCents: wager, phase: "PLAYER_TURN" as const, notice: takeInsurance ? `Insurance ${formatSigned(-wager / 100)}` : "No Insurance" };
      if (isBlackjack(updated.dealerCards) || isBlackjack(updated.playerHands[0]!.cards)) return settleLiveRound(updated, rules);
      return updated;
    });
  }, [rules, sound]);

  const playAction = useCallback((action: PlayerAction) => {
    const snapshot = game;
    if (snapshot.phase !== "PLAYER_TURN" || snapshot.activeHandIndex === null) return;
    const snapshotHand = snapshot.playerHands[snapshot.activeHandIndex];
    if (!snapshotHand || !liveActions(snapshot, snapshotHand, rules).includes(action)) return;
    sound(action === "HIT" ? 420 : action === "DOUBLE" ? 620 : action === "SPLIT" ? 700 : 350);
    const snapshotDecision = getBasicStrategyDecision(snapshotHand.cards, snapshot.dealerCards[0]!, rules, {
      isSplitHand: snapshotHand.isSplitHand,
      isSplitAces: snapshotHand.isSplitAces,
        canSplit: canSplitHand(snapshotHand, snapshot.playerHands.length, rules) && snapshot.bankrollCents >= snapshotHand.baseWagerCents,
        canDouble: canDoubleHand(snapshotHand, rules) && snapshot.bankrollCents >= snapshotHand.baseWagerCents,
      canSurrender: canSurrenderHand(snapshotHand, rules),
    });
    const responseMs = Date.now() - roundStartedAt.current;
    const isInitialDecision = snapshotHand.actions.length === 0;
    if (isInitialDecision && scope !== "counting") {
      onRecord({ mode: "full-table", correct: action === snapshotDecision.action, responseMs, weaknesses: strategyWeaknessContexts(strategySituationFromDecision(snapshotDecision)) });
    }
    setGame((current) => {
      if (current.phase !== "PLAYER_TURN" || current.activeHandIndex === null) return current;
      const hand = current.playerHands[current.activeHandIndex];
      if (!hand) return current;
      const legal = liveActions(current, hand, rules);
      if (!legal.includes(action)) return current;

      const isInitialDecision = hand.actions.length === 0;
      const review = isInitialDecision ? { action, expected: snapshotDecision.action, correct: action === snapshotDecision.action, reason: snapshotDecision.reason, responseMs } : current.actionReview;

      let shoe = current.shoe;
      let bankrollCents = current.bankrollCents;
      let runningCount = current.runningCount;
      let hands = [...current.playerHands];
      const index = current.activeHandIndex;

      if (action === "HIT") { const drawn = drawCard(shoe); shoe = drawn.shoe; runningCount += hiLoValue(drawn.card); hands[index] = hitHand(hand, drawn.card); }
      else if (action === "STAND") hands[index] = standHand(hand);
      else if (action === "DOUBLE") { const drawn = drawCard(shoe); shoe = drawn.shoe; runningCount += hiLoValue(drawn.card); bankrollCents -= hand.baseWagerCents; hands[index] = doubleHand(hand, drawn.card, rules); }
      else if (action === "SURRENDER") hands[index] = surrenderHand(hand, rules);
      else if (action === "SPLIT") { const drawn = drawCards(shoe, 2); shoe = drawn.shoe; runningCount = applyHiLoCards(runningCount, drawn.cards); const split = splitHand(hand, [drawn.cards[0]!, drawn.cards[1]!], hands.length, rules); bankrollCents -= hand.baseWagerCents; hands = [...hands.slice(0, index), ...split.hands, ...hands.slice(index + 1)]; }
      const updated: LiveGame = { ...current, shoe, bankrollCents, runningCount, playerHands: hands, actionReview: review };
      return progressLiveRound(updated, rules, action === "SPLIT" ? index : index);
    });
  }, [game, onRecord, rules, scope, sound]);

  const activeHand = game.activeHandIndex === null ? null : game.playerHands[game.activeHandIndex] ?? null;
  const legalActions = activeHand ? liveActions(game, activeHand, rules) : [];
  const settlementMap = useMemo(() => new Map(game.settlements.map((settlement) => [settlement.handId, settlement])), [game.settlements]);
  const displayHands = game.playerHands.map((hand) => { const value = evaluateHand(hand.cards); return { ...hand, total: value.total, isSoft: value.isSoft, status: settlementMap.get(hand.id)?.outcome ?? hand.status }; });
  const actualTc = game.shoe.cards.length > 0 ? calculateTrueCount(game.runningCount, decksRemainingFromCards(game.shoe.cards.length), "TRUNCATE") : 0;
  const submitCountFeedback = () => { const rcCorrect = Number(rcAnswer) === game.runningCount; const tcCorrect = Number(tcAnswer) === actualTc; const correct = scope === "basic" ? true : scope === "counting" ? rcCorrect && tcCorrect : rcCorrect && tcCorrect && (game.actionReview?.correct ?? true); setCountFeedback({ correct, message: `Count: Your RC ${rcAnswer || "—"} / Actual RC ${formatSigned(game.runningCount)} · Your TC ${tcAnswer || "—"} / Actual TC ${formatSigned(actualTc)}.` }); if (scope !== "basic") onRecord({ mode: "full-table", correct: rcCorrect && tcCorrect, weaknesses: [countingWeaknessContext("Full Table Running Count"), trueCountWeaknessContext("Full Table True Count")] }); };
  const nextRound = () => { setGame((current) => ({ ...current, phase: "BETTING", playerHands: [], dealerCards: [], activeHandIndex: null, settlements: [], insuranceWagerCents: 0, actionReview: null, notice: shouldReshuffleBeforeRound(current.shoe) ? "CUT CARD reached — next hand will shuffle." : null })); setCountFeedback(null); setRcAnswer(""); setTcAnswer(""); };
  const resetBankroll = () => { setGame(blankGame(rules)); setCountFeedback(null); };
  useSpaceAdvance(nextRound, game.phase === "SETTLED" && (scope === "basic" || Boolean(countFeedback)));

  return <div className={`mx-auto w-full max-w-7xl px-3 pb-10 sm:px-6 ${casinoMode ? "pt-1" : ""}`}>
    {!casinoMode && <div className="mb-3"><p className="text-[0.62rem] font-black tracking-[0.18em] text-amber-200">LIVE SHOE</p><h1 className="font-serif text-2xl font-black tracking-wide text-white sm:text-3xl">FULL TABLE SIMULATION</h1><p className="mt-1 text-sm text-emerald-50/70">Shoeから実際に312 cardsを消費します。結果には短期Varianceがあります。</p></div>}
    {!casinoMode && <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/12 bg-black/20 p-3"><div className="flex flex-wrap gap-1 rounded-lg border border-white/15 p-0.5">{(["basic", "counting", "combined"] as const).map((value) => <button key={value} type="button" onClick={() => setScope(value)} className={`focus-ring rounded-md px-3 py-1.5 text-xs font-black ${scope === value ? "bg-amber-200/20 text-amber-100" : "text-emerald-50/60"}`}>{value === "basic" ? "Basic Strategy only" : value === "counting" ? "Counting only" : "Combined"}</button>)}</div><div className="flex flex-wrap items-center gap-3 text-xs font-bold text-emerald-50/75"><label>DEAL ANIMATION <select value={animation} onChange={(event) => setAnimation(event.target.value as AnimationMode)} className="ml-1 rounded bg-emerald-950 px-2 py-1 text-white"><option>Off</option><option>Fast</option><option>Realistic</option></select></label><label className="flex items-center gap-1"><input type="checkbox" checked={soundEnabled} onChange={(event) => setSoundEnabled(event.target.checked)} className="accent-amber-300" /> SOUND {soundEnabled ? "ON" : "OFF"}</label><label className="flex items-center gap-1"><input type="checkbox" checked={casinoMode} onChange={(event) => setCasinoMode(event.target.checked)} className="accent-amber-300" /> CASINO MODE</label></div></div>}
    {casinoMode && <div className="mb-2 flex justify-end"><button type="button" onClick={() => setCasinoMode(false)} className="focus-ring rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-xs font-bold text-emerald-50">EXIT CASINO MODE</button></div>}
    <section className="felt-texture relative overflow-hidden rounded-[2rem] border border-amber-100/30 bg-emerald-900/30 p-3 shadow-2xl sm:p-6"><div className="pointer-events-none absolute inset-x-[8%] bottom-0 h-48 rounded-t-[50%] border-t border-amber-100/20" />
      <div className="relative flex items-start justify-between gap-2"><Shoe totalCards={game.shoe.initialCardCount} remainingCards={game.shoe.cards.length} deckCount={rules.deckCount} showDetails={!casinoMode} compact={casinoMode} /><div className="text-center">{!casinoMode && <><div className="text-[0.58rem] font-black tracking-[0.16em] text-amber-100/80">RUNNING COUNT</div><div className="mt-1 text-xl font-black text-amber-100">{scope === "basic" ? "—" : "HIDDEN"}</div></>}<div className="mt-2 text-[0.58rem] font-bold text-emerald-50/60">SHUFFLE #{game.shoe.shuffleCount}</div></div><DiscardTray totalCards={game.shoe.initialCardCount} discardedCards={game.shoe.discardPile.length} showDetails={!casinoMode} compact={casinoMode} /></div>
      <DealerArea cards={game.dealerCards} total={game.phase === "SETTLED" ? evaluateHand(game.dealerCards).total : undefined} isSoft={game.phase === "SETTLED" ? evaluateHand(game.dealerCards).isSoft : false} hideHoleCard={game.phase !== "SETTLED"} holeCardIndex={1} status={game.phase === "SETTLED" && isBlackjack(game.dealerCards) ? "BLACKJACK" : undefined} dealerRule={rules.dealerSoft17} dealt={animation !== "Off"} />
      <div className="relative my-5 min-h-20">{game.phase === "BETTING" && <BetArea game={game} onMinimum={(minimum) => setGame((current) => ({ ...current, tableMinimumCents: minimum, selectedBetCents: Math.max(current.selectedBetCents, minimum) }))} onBet={(value) => setGame((current) => ({ ...current, selectedBetCents: value, notice: null }))} onDeal={deal} />}{game.phase === "INSURANCE" && <div className="mx-auto max-w-md rounded-2xl border border-amber-200/45 bg-black/35 p-5 text-center"><p className="font-serif text-xl font-black text-amber-100">INSURANCE?</p><p className="mt-2 text-xs text-emerald-50/70">Wager up to half of your original Bet. Pays 2:1 if Dealer has Blackjack.</p><div className="mt-4 grid grid-cols-2 gap-3"><button type="button" onClick={() => chooseInsurance(true)} className="focus-ring rounded-xl border border-amber-200/50 bg-amber-200/15 py-3 text-sm font-black text-amber-50">TAKE INSURANCE</button><button type="button" onClick={() => chooseInsurance(false)} className="focus-ring rounded-xl border border-white/20 bg-black/20 py-3 text-sm font-black text-white">NO INSURANCE</button></div></div>}{game.phase === "PLAYER_TURN" && <div className="mx-auto max-w-3xl"><p className="mb-3 text-center text-xs font-black tracking-[0.15em] text-amber-100">PLAYER TURN {game.playerHands.length > 1 ? `• HAND ${(game.activeHandIndex ?? 0) + 1}` : ""}</p><ActionButtons onAction={playAction} availableActions={legalActions} /></div>}{game.phase === "SETTLED" && <RoundFeedback game={game} scope={scope} rcAnswer={rcAnswer} tcAnswer={tcAnswer} setRcAnswer={setRcAnswer} setTcAnswer={setTcAnswer} feedback={countFeedback} onSubmit={submitCountFeedback} onNext={nextRound} casinoMode={casinoMode} />}</div>
      <PlayerArea hands={displayHands} activeHandId={activeHand?.id} bankrollCents={game.bankrollCents} tableMinimumCents={game.tableMinimumCents} dealt={animation !== "Off"} />
      {game.notice && !casinoMode && <p className="relative mt-3 text-center text-xs font-bold text-amber-100">{game.notice}</p>}
    </section>
    <div className="mt-4 flex flex-wrap justify-between gap-2"><button type="button" onClick={onBack} className="focus-ring rounded-lg border border-white/20 bg-black/15 px-4 py-2 text-xs font-bold text-emerald-50">← TRAINING MENU</button><button type="button" onClick={resetBankroll} className="focus-ring rounded-lg border border-white/20 bg-black/15 px-4 py-2 text-xs font-bold text-emerald-50">RESET $300 BANKROLL</button></div>
  </div>;
}

function BetArea({ game, onMinimum, onBet, onDeal }: { game: LiveGame; onMinimum: (minimum: number) => void; onBet: (value: number) => void; onDeal: () => void }) {
  return <div className="mx-auto max-w-3xl rounded-2xl border border-white/12 bg-black/25 p-4 text-center sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="text-left"><p className="text-[0.6rem] font-black tracking-[0.15em] text-emerald-50/65">TABLE MINIMUM</p><select value={game.tableMinimumCents} onChange={(event) => onMinimum(Number(event.target.value))} className="mt-1 rounded-lg border border-white/15 bg-emerald-950 px-2 py-1 text-sm font-black text-white">{TABLE_MINIMUMS.map((value) => <option key={value} value={value}>${value / 100} table</option>)}</select></div><div><p className="text-[0.6rem] font-black tracking-[0.15em] text-emerald-50/65">YOUR BET</p><p className="mt-1 text-2xl font-black text-amber-100">${(game.selectedBetCents / 100).toLocaleString()}</p></div><div className="text-right"><p className="text-[0.6rem] font-black tracking-[0.15em] text-emerald-50/65">BANKROLL</p><p className="mt-1 text-lg font-black text-white">${(game.bankrollCents / 100).toLocaleString()}</p></div></div><div className="mt-4 flex flex-wrap justify-center gap-2">{CHIP_VALUES.map((value) => <Chip key={value} valueCents={value} size="sm" selected={game.selectedBetCents === value} disabled={value < game.tableMinimumCents || value > game.bankrollCents} onClick={() => onBet(value)} />)}</div><button type="button" onClick={onDeal} className="focus-ring mt-5 min-h-14 w-full rounded-xl border border-amber-200/55 bg-amber-200/15 text-sm font-black tracking-[0.14em] text-amber-50 hover:bg-amber-200/25">PLACE BET & DEAL</button></div>;
}

function RoundFeedback({ game, scope, rcAnswer, tcAnswer, setRcAnswer, setTcAnswer, feedback, onSubmit, onNext, casinoMode }: { game: LiveGame; scope: TrainingScope; rcAnswer: string; tcAnswer: string; setRcAnswer: (value: string) => void; setTcAnswer: (value: string) => void; feedback: { correct: boolean; message: string } | null; onSubmit: () => void; onNext: () => void; casinoMode: boolean }) {
  return <div className="mx-auto max-w-3xl rounded-2xl border border-white/15 bg-black/35 p-4 sm:p-5"><h2 className="text-center font-serif text-xl font-black tracking-wide text-amber-100">HAND COMPLETE</h2>{game.actionReview && scope !== "counting" && <div className="mt-3"><FeedbackBanner correct={game.actionReview.correct} correctAction={game.actionReview.expected} message={game.actionReview.reason} responseMs={game.actionReview.responseMs} /></div>}{scope !== "basic" && !feedback && <div className="mt-4 grid gap-2 sm:grid-cols-2"><label className="text-xs font-bold text-emerald-50/70">YOUR RUNNING COUNT<input value={rcAnswer} onChange={(event) => setRcAnswer(event.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-center text-lg font-black text-white" placeholder="RC" /></label><label className="text-xs font-bold text-emerald-50/70">YOUR TRUE COUNT<input value={tcAnswer} onChange={(event) => setTcAnswer(event.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border border-white/20 bg-black/25 px-3 py-2 text-center text-lg font-black text-white" placeholder="TC" /></label></div>}{scope !== "basic" && !feedback && <button type="button" onClick={onSubmit} className="focus-ring mt-3 w-full rounded-xl border border-amber-200/50 bg-amber-200/15 px-4 py-3 text-sm font-black text-amber-50">CHECK COUNT</button>}{feedback && <div className="mt-3"><FeedbackBanner correct={feedback.correct} message={feedback.message} /></div>}{scope === "basic" || feedback ? <button type="button" onClick={onNext} className="focus-ring mt-4 w-full rounded-xl border border-amber-200/50 bg-amber-200/15 px-4 py-3 text-sm font-black text-amber-50">NEXT HAND</button> : null}{casinoMode && <p className="mt-3 text-center text-xs text-emerald-50/55">Casino Mode feedback is shown only after the hand ends.</p>}</div>;
}
