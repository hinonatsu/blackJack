import {
  RANKS,
  type Card,
  type Rank,
  type Suit,
} from "../../types/card";
import type { PlayerAction } from "../../types/game";
import type { BlackjackRules } from "../../types/rules";
import { getBasicStrategyDecision } from "../basicStrategy";
import { floorTrueCountForDeviation, getDeviationsForRules } from "../deviations";
import { applyHiLoCards, countSteps, hiLoValue } from "../hiloCount";
import {
  calculateTrueCount as calculateDomainTrueCount,
  roundTrueCount as roundDomainTrueCount,
  type TrueCountRounding as DomainTrueCountRounding,
} from "../trueCount";
import {
  type CountSequenceQuestion,
  type CountTableSeat,
  type DeckEstimationQuestion,
  type DeviationDefinition,
  type DeviationQuestion,
  type HandKind,
  type StrategyQuestion,
  type StrategySituation,
  type TableCountQuestion,
  type TrueCountQuestion,
  type TrueCountRounding,
} from "./types";

export type RandomSource = () => number;

const DEFAULT_RANDOM: RandomSource = Math.random;
const TRAINING_SUITS: readonly Suit[] = ["spades", "hearts", "clubs", "diamonds"];
const NON_ACE_RANKS: readonly Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const PAIR_RANKS: readonly Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "A"];

function clampRandom(random: RandomSource): number {
  // A custom deterministic test source may return 1; avoid an out-of-bounds pick.
  return Math.min(0.999999999, Math.max(0, random()));
}

function randomInt(min: number, max: number, random: RandomSource): number {
  return Math.floor(clampRandom(random) * (max - min + 1)) + min;
}

function pick<T>(values: readonly T[], random: RandomSource): T {
  if (values.length === 0) {
    throw new Error("Cannot choose from an empty collection.");
  }
  return values[Math.floor(clampRandom(random) * values.length)]!;
}

function questionId(prefix: string, now: number, random: RandomSource): string {
  return `${prefix}-${now.toString(36)}-${Math.floor(clampRandom(random) * 0x7fffffff).toString(36)}`;
}

function rankValue(rank: Rank): number {
  if (rank === "A") return 11;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  return Number(rank);
}

/** Public so a UI can show the small post-answer count trail without duplicating Hi-Lo rules. */
export function hiLoValueForRank(rank: Rank): number {
  return hiLoValue(rank);
}

export function runningCountForRanks(ranks: readonly Rank[], startingRunningCount = 0): number {
  return applyHiLoCards(startingRunningCount, ranks);
}

export interface CountTrailStep {
  rank: Rank;
  delta: -1 | 0 | 1;
  runningCount: number;
}

/**
 * Compact post-answer audit data, suitable for feedback such as
 * `5 → +1 · K → 0 · 3 → +1` when the player loses the count.
 */
export function countTrailForRanks(
  ranks: readonly Rank[],
  startingRunningCount = 0,
): CountTrailStep[] {
  return countSteps(ranks, startingRunningCount).map((step) => ({
    rank: typeof step.card === "string" ? step.card : step.card.rank,
    delta: step.delta,
    runningCount: step.runningCount,
  }));
}

function createTrainingCard(rank: Rank, position: number, seed: string): Card {
  return {
    id: `training-${seed}-${position}`,
    rank,
    suit: TRAINING_SUITS[position % TRAINING_SUITS.length]!,
    deckIndex: 0,
  };
}

/** Turns a counting sequence into card-shaped data for the shared card UI. */
export function cardsForCountRanks(ranks: readonly Rank[], seed = "count"): Card[] {
  return ranks.map((rank, index) => createTrainingCard(rank, index, seed));
}

function dealerRankFromValue(value: number, random: RandomSource): Rank {
  if (value === 11) return "A";
  if (value === 10) return pick(["10", "J", "Q", "K"], random);
  return String(value) as Rank;
}

function pairTotal(rank: Rank): number {
  return rank === "A" ? 12 : rankValue(rank) * 2;
}

function formatPair(rank: Rank): string {
  return `${rank},${rank}`;
}

function makeStrategySituation(
  handKind: HandKind,
  total: number,
  dealerValue: number,
  pairRank?: Rank,
): StrategySituation {
  const playerLabel =
    handKind === "pair" && pairRank
      ? formatPair(pairRank)
      : handKind === "soft"
        ? `Soft ${total}`
        : `Hard ${total}`;
  return {
    handKind,
    total,
    pairRank,
    dealerValue,
    playerLabel,
    dealerLabel: dealerValue === 11 ? "A" : String(dealerValue),
  };
}

function possibleHardCards(total: number): [Rank, Rank] | undefined {
  // Pick a non-pair representation when possible, preserving basic-strategy classification.
  for (const left of NON_ACE_RANKS) {
    for (const right of NON_ACE_RANKS) {
      if (rankValue(left) + rankValue(right) !== total) continue;
      if (left !== right) return [left, right];
    }
  }

  // Hard 20 is normally represented by two ten-value cards. Two different labels
  // avoid accidentally presenting it as a literal pair in a UI.
  if (total === 20) return ["10", "J"];
  return undefined;
}

function cardsForSituation(situation: StrategySituation, seed: string): Card[] {
  let ranks: [Rank, Rank];

  if (situation.handKind === "pair") {
    const rank = situation.pairRank ?? "8";
    ranks = [rank, rank];
  } else if (situation.handKind === "soft") {
    const secondValue = situation.total - 11;
    if (secondValue < 2 || secondValue > 9) {
      throw new Error(`Soft total ${situation.total} cannot be represented as a two-card hand.`);
    }
    ranks = ["A", String(secondValue) as Rank];
  } else {
    const result = possibleHardCards(situation.total);
    if (!result) {
      throw new Error(`Hard total ${situation.total} cannot be represented as a two-card hand.`);
    }
    ranks = result;
  }

  return ranks.map((rank, index) => createTrainingCard(rank, index, seed));
}

function randomHardSituation(random: RandomSource): StrategySituation {
  // 5–20 covers the actionable two-card hard hands and avoids blackjack.
  const total = randomInt(5, 20, random);
  return makeStrategySituation("hard", total, randomInt(2, 11, random));
}

function randomSoftSituation(random: RandomSource): StrategySituation {
  // A,2 through A,9; A,10 is a blackjack and needs no player decision.
  const total = randomInt(13, 20, random);
  return makeStrategySituation("soft", total, randomInt(2, 11, random));
}

function randomPairSituation(random: RandomSource): StrategySituation {
  const pairRank = pick(PAIR_RANKS, random);
  return makeStrategySituation(
    "pair",
    pairTotal(pairRank),
    randomInt(2, 11, random),
    pairRank,
  );
}

export interface StrategyActionResolution {
  action: PlayerAction;
  reason?: string;
}

/**
 * Kept injectable so this training layer stays reusable with any rules-aware
 * basic-strategy engine. The application should pass `getBasicStrategyAction`.
 */
export type StrategyActionResolver = (
  playerCards: Card[],
  dealerUpcard: Card,
  rules: BlackjackRules,
) => PlayerAction | StrategyActionResolution;

export interface StrategyQuestionOptions {
  rules: BlackjackRules;
  resolveAction: StrategyActionResolver;
  /** Use this for Weakness Review instead of rolling a new random scenario. */
  situation?: StrategySituation;
  handKind?: HandKind;
  random?: RandomSource;
  now?: number;
}

/**
 * Produces a playable two-card decision and asks the supplied, rules-aware
 * engine for the answer. No strategy table is duplicated in the UI layer.
 */
export function generateStrategyQuestion(options: StrategyQuestionOptions): StrategyQuestion {
  const random = options.random ?? DEFAULT_RANDOM;
  const now = options.now ?? Date.now();
  const handKind = options.handKind ?? pick<HandKind>(["hard", "hard", "soft", "pair"], random);
  const situation =
    options.situation ??
    (handKind === "soft"
      ? randomSoftSituation(random)
      : handKind === "pair"
        ? randomPairSituation(random)
        : randomHardSituation(random));
  const id = questionId("strategy", now, random);
  const playerCards = cardsForSituation(situation, id);
  const dealerUpcard = createTrainingCard(
    dealerRankFromValue(situation.dealerValue, random),
    2,
    id,
  );
  const resolved = options.resolveAction(playerCards, dealerUpcard, options.rules);
  const resolution = typeof resolved === "string" ? { action: resolved } : resolved;

  return {
    id,
    kind: "strategy",
    situation,
    playerCards,
    dealerUpcard,
    expectedAction: resolution.action,
    reason: resolution.reason,
    createdAt: now,
  };
}

/**
 * The app-level shortcut for ordinary Basic and Speed Strategy practice. It
 * delegates both the answer and the compact reason to the single rules-aware
 * domain engine, so a rule-setting change cannot leave a stale question table.
 */
export function generateBasicStrategyQuestion(
  options: Omit<StrategyQuestionOptions, "resolveAction">,
): StrategyQuestion {
  return generateStrategyQuestion({
    ...options,
    resolveAction: (playerCards, dealerUpcard, rules) => {
      const decision = getBasicStrategyDecision(playerCards, dealerUpcard, rules);
      return { action: decision.action, reason: decision.reason };
    },
  });
}

/** Gets cards for a generated strategy question without adding UI state to the question object. */
export function cardsForStrategySituation(situation: StrategySituation, seed = "preview"): Card[] {
  return cardsForSituation(situation, seed);
}

export function dealerCardForStrategySituation(
  situation: StrategySituation,
  seed = "preview",
): Card {
  return createTrainingCard(
    dealerRankFromValue(situation.dealerValue, DEFAULT_RANDOM),
    2,
    seed,
  );
}

function defaultCountLength(level: 1 | 2 | 3 | 4): number {
  switch (level) {
    case 1:
      return 1;
    case 2:
      return 6;
    case 3:
      return 8;
    case 4:
      return 12;
  }
}

export interface CountSequenceOptions {
  level: 1 | 2 | 3 | 4;
  length?: number;
  startingRunningCount?: number;
  random?: RandomSource;
  now?: number;
}

/** Generates visible cards with the same rank frequency as a real deck. */
export function generateCountSequenceQuestion(
  options: CountSequenceOptions,
): CountSequenceQuestion {
  const random = options.random ?? DEFAULT_RANDOM;
  const now = options.now ?? Date.now();
  const length = Math.max(1, Math.floor(options.length ?? defaultCountLength(options.level)));
  const ranks = Array.from({ length }, () => pick(RANKS, random));
  const startingRunningCount = options.startingRunningCount ?? 0;
  const sequenceDelta = runningCountForRanks(ranks);

  return {
    id: questionId("count", now, random),
    kind: "count-sequence",
    level: options.level,
    ranks,
    startingRunningCount,
    sequenceDelta,
    expectedRunningCount: startingRunningCount + sequenceDelta,
    createdAt: now,
  };
}

export interface TableCountQuestionOptions {
  level: 3 | 4;
  playerCount?: number;
  cardsPerPlayer?: number;
  startingRunningCount?: number;
  random?: RandomSource;
  now?: number;
}

/**
 * Produces a count drill that can be laid out as a dealer plus one (Level 3)
 * or three-to-five (Level 4) player positions. All included cards are visible.
 */
export function generateTableCountQuestion(
  options: TableCountQuestionOptions,
): TableCountQuestion {
  const random = options.random ?? DEFAULT_RANDOM;
  const now = options.now ?? Date.now();
  const playerCount = Math.max(
    1,
    Math.floor(options.playerCount ?? (options.level === 3 ? 1 : randomInt(3, 5, random))),
  );
  const cardsPerPlayer = Math.max(2, Math.floor(options.cardsPerPlayer ?? 2));
  const dealerRanks = Array.from({ length: 2 }, () => pick(RANKS, random));
  const playerSeats: CountTableSeat[] = Array.from({ length: playerCount }, (_, index) => ({
    label: `Player ${index + 1}`,
    ranks: Array.from({ length: cardsPerPlayer }, () => pick(RANKS, random)),
  }));
  const ranks = [...dealerRanks, ...playerSeats.flatMap((seat) => seat.ranks)];
  const startingRunningCount = options.startingRunningCount ?? 0;
  const sequenceDelta = runningCountForRanks(ranks);

  return {
    id: questionId("count-table", now, random),
    kind: "count-table",
    level: options.level,
    ranks,
    dealerRanks,
    playerSeats,
    startingRunningCount,
    sequenceDelta,
    expectedRunningCount: startingRunningCount + sequenceDelta,
    createdAt: now,
  };
}

export interface DeckEstimationOptions {
  totalDecks?: number;
  /** Default is half a deck, matching a practical casino estimate. */
  increment?: number;
  minimumDecksRemaining?: number;
  maximumDecksRemaining?: number;
  random?: RandomSource;
  now?: number;
}

function snappedDeckCount(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

/** Creates the shoe state for a visual deck-estimation question. */
export function generateDeckEstimationQuestion(
  options: DeckEstimationOptions = {},
): DeckEstimationQuestion {
  const random = options.random ?? DEFAULT_RANDOM;
  const now = options.now ?? Date.now();
  const totalDecks = options.totalDecks ?? 6;
  const increment = options.increment ?? 0.5;
  if (!Number.isFinite(totalDecks) || totalDecks <= 0) {
    throw new Error("totalDecks must be a positive number.");
  }
  if (!Number.isFinite(increment) || increment <= 0) {
    throw new Error("increment must be a positive number.");
  }

  const minimum = Math.max(increment, options.minimumDecksRemaining ?? increment);
  const maximum = Math.min(
    totalDecks - increment,
    options.maximumDecksRemaining ?? totalDecks - increment,
  );
  if (maximum < minimum) {
    throw new Error("Deck-estimation bounds leave no valid shoe state.");
  }
  const steps = Math.floor((maximum - minimum) / increment);
  const decksRemaining = snappedDeckCount(minimum + randomInt(0, steps, random) * increment, increment);

  return {
    id: questionId("deck", now, random),
    kind: "deck-estimation",
    totalDecks,
    decksRemaining,
    decksDiscarded: snappedDeckCount(totalDecks - decksRemaining, increment),
    remainingRatio: decksRemaining / totalDecks,
    createdAt: now,
  };
}

export function isDeckEstimateCorrect(
  answer: number,
  question: DeckEstimationQuestion,
  tolerance = 0.01,
): boolean {
  return Number.isFinite(answer) && Math.abs(answer - question.decksRemaining) <= tolerance;
}

/**
 * The default `truncate` rule rounds toward zero. It is explicit here because
 * true-count rounding conventions vary by school; callers can choose floor or
 * nearest for a different drill without hiding that choice.
 */
export function roundTrueCount(value: number, rounding: TrueCountRounding = "truncate"): number {
  return roundDomainTrueCount(value, toDomainTrueCountRounding(rounding));
}

function toDomainTrueCountRounding(rounding: TrueCountRounding): DomainTrueCountRounding {
  switch (rounding) {
    case "floor":
      return "FLOOR";
    case "nearest":
      return "NEAREST";
    case "truncate":
      return "TRUNCATE";
  }
}

export interface TrueCountQuestionOptions extends DeckEstimationOptions {
  runningCount?: number;
  rounding?: TrueCountRounding;
}

export function generateTrueCountQuestion(
  options: TrueCountQuestionOptions = {},
): TrueCountQuestion {
  const random = options.random ?? DEFAULT_RANDOM;
  const now = options.now ?? Date.now();
  const deckEstimate = generateDeckEstimationQuestion({ ...options, random, now });
  const runningCount = options.runningCount ?? randomInt(-12, 12, random);
  const rawTrueCount = calculateDomainTrueCount(runningCount, deckEstimate.decksRemaining);
  const rounding = options.rounding ?? "truncate";

  return {
    id: questionId("true-count", now, random),
    kind: "true-count",
    runningCount,
    decksRemaining: deckEstimate.decksRemaining,
    rawTrueCount,
    expectedTrueCount: roundTrueCount(rawTrueCount, rounding),
    rounding,
    deckEstimate,
    createdAt: now,
  };
}

export function isTrueCountCorrect(answer: number, question: TrueCountQuestion): boolean {
  return Number.isFinite(answer) && answer === question.expectedTrueCount;
}

export interface DeviationQuestionOptions {
  deviations: readonly DeviationDefinition[];
  /** Useful for a targeted review of one failed Index Play. */
  deviation?: DeviationDefinition;
  trueCount?: number;
  /** Uses a published H17-specific index when the definition supplies one. */
  dealerSoft17?: BlackjackRules["dealerSoft17"];
  random?: RandomSource;
  now?: number;
}

/**
 * Selects a count on either side of an index, making the action depend on the
 * index rather than inviting a memorized answer to one fixed true count.
 */
export function generateDeviationQuestion(
  options: DeviationQuestionOptions,
): DeviationQuestion {
  const random = options.random ?? DEFAULT_RANDOM;
  const now = options.now ?? Date.now();
  const deviation = options.deviation ?? pick(options.deviations, random);
  const effectiveIndex =
    deviation.indexBySoft17?.[options.dealerSoft17 ?? "S17"] ?? deviation.index;
  const trueCount =
    options.trueCount ??
    (clampRandom(random) < 0.5
      ? effectiveIndex - randomInt(1, 4, random)
      : effectiveIndex + randomInt(0, 4, random));
  const flooredTrueCount = floorTrueCountForDeviation(trueCount);

  return {
    id: questionId("deviation", now, random),
    kind: "deviation",
    deviation,
    trueCount,
    effectiveIndex,
    expectedAction:
      flooredTrueCount >= effectiveIndex
        ? deviation.actionAtOrAboveIndex
        : deviation.actionBelowIndex,
    createdAt: now,
  };
}

/**
 * Uses the checked-in Illustrious 18 + Fab 4 set, filtered for the active
 * Late Surrender rule and indexed for the active S17/H17 dealer rule.
 */
export function generateHiLoDeviationQuestion(
  options: Omit<DeviationQuestionOptions, "deviations" | "dealerSoft17"> & {
    rules: Pick<BlackjackRules, "dealerSoft17" | "lateSurrender">;
  },
): DeviationQuestion {
  return generateDeviationQuestion({
    ...options,
    deviations: getDeviationsForRules(options.rules),
    dealerSoft17: options.rules.dealerSoft17,
  });
}
