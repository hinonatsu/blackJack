import { classifyHand, dealerUpcardValue, type DealerUpcard, type PairRank } from "@/lib/basicStrategy";
import type { Card } from "@/types/card";
import type { PlayerAction } from "@/types/game";
import type { BlackjackRules, DealerSoft17Rule } from "@/types/rules";

export type DeviationFamily = "ILLUSTRIOUS_18" | "FAB_4";
export type DeviationAction = PlayerAction | "INSURANCE" | "NO_INSURANCE";
export type DeviationHandKind = "INSURANCE" | "HARD_TOTAL" | "PAIR";

/**
 * A published Hi-Lo index play. `index` is the canonical S17 entry retained
 * for simple displays; `indexBySoft17` makes the H17 rule difference explicit.
 */
export interface HiLoDeviation {
  id: string;
  family: DeviationFamily;
  order: number;
  playerHand: string;
  handKind: DeviationHandKind;
  total?: number;
  pairRank?: PairRank;
  dealerUpcard: DealerUpcard;
  /** Canonical six-deck S17 Hi-Lo index. */
  index: number;
  indexBySoft17: Readonly<Record<DealerSoft17Rule, number>>;
  actionBelowIndex: DeviationAction;
  actionAtOrAboveIndex: DeviationAction;
  /** These rows make sense only where Late Surrender is actually offered. */
  requiresLateSurrender?: boolean;
  /** Surrender supersedes these hit/stand rows when it is offered. */
  requiresNoLateSurrender?: boolean;
  source: string;
}

const SCHLESINGER_SOURCE =
  "Don Schlesinger, Blackjack Attack (Illustrious 18 / Fab 4), republished with permission by Wizard of Odds: https://wizardofodds.com/games/blackjack/card-counting/high-low/";
const H17_VARIANT_SOURCE =
  "H17 index deltas cross-checked against the rule-difference chart: https://www.blackjacktrainer.fyi/charts/deviations/s17";

const indexFor = (s17: number, h17 = s17): Readonly<Record<DealerSoft17Rule, number>> =>
  Object.freeze({ S17: s17, H17: h17 });

/**
 * The canonical six-deck Hi-Lo Illustrious 18 and Fab 4.
 *
 * Source conditions for the primary numbers: 6 decks, S17, DAS, Late
 * Surrender, resplit to four hands (Wizard of Odds reproduces the published
 * Blackjack Attack table with permission). H17-specific differences are
 * documented per row rather than guessed. Values are floored true-count
 * indices; use `floorTrueCountForDeviation` before comparing a raw TC.
 */
export const HI_LO_DEVIATIONS: readonly HiLoDeviation[] = Object.freeze([
  {
    id: "insurance-vs-ace",
    family: "ILLUSTRIOUS_18",
    order: 1,
    playerHand: "Insurance",
    handKind: "INSURANCE",
    dealerUpcard: "A",
    index: 3,
    indexBySoft17: indexFor(3),
    actionBelowIndex: "NO_INSURANCE",
    actionAtOrAboveIndex: "INSURANCE",
    source: SCHLESINGER_SOURCE,
  },
  {
    id: "hard-16-vs-10",
    family: "ILLUSTRIOUS_18",
    order: 2,
    playerHand: "Hard 16",
    handKind: "HARD_TOTAL",
    total: 16,
    dealerUpcard: 10,
    index: 0,
    indexBySoft17: indexFor(0),
    actionBelowIndex: "HIT",
    actionAtOrAboveIndex: "STAND",
    requiresNoLateSurrender: true,
    source: SCHLESINGER_SOURCE,
  },
  {
    id: "hard-15-vs-10",
    family: "ILLUSTRIOUS_18",
    order: 3,
    playerHand: "Hard 15",
    handKind: "HARD_TOTAL",
    total: 15,
    dealerUpcard: 10,
    index: 4,
    indexBySoft17: indexFor(4),
    actionBelowIndex: "HIT",
    actionAtOrAboveIndex: "STAND",
    requiresNoLateSurrender: true,
    source: SCHLESINGER_SOURCE,
  },
  {
    id: "pair-10-vs-5",
    family: "ILLUSTRIOUS_18",
    order: 4,
    playerHand: "10,10",
    handKind: "PAIR",
    pairRank: "10",
    dealerUpcard: 5,
    index: 5,
    indexBySoft17: indexFor(5),
    actionBelowIndex: "STAND",
    actionAtOrAboveIndex: "SPLIT",
    source: SCHLESINGER_SOURCE,
  },
  {
    id: "pair-10-vs-6",
    family: "ILLUSTRIOUS_18",
    order: 5,
    playerHand: "10,10",
    handKind: "PAIR",
    pairRank: "10",
    dealerUpcard: 6,
    index: 4,
    indexBySoft17: indexFor(4),
    actionBelowIndex: "STAND",
    actionAtOrAboveIndex: "SPLIT",
    source: SCHLESINGER_SOURCE,
  },
  {
    id: "hard-10-vs-10",
    family: "ILLUSTRIOUS_18",
    order: 6,
    playerHand: "Hard 10",
    handKind: "HARD_TOTAL",
    total: 10,
    dealerUpcard: 10,
    index: 4,
    indexBySoft17: indexFor(4),
    actionBelowIndex: "HIT",
    actionAtOrAboveIndex: "DOUBLE",
    source: SCHLESINGER_SOURCE,
  },
  {
    id: "hard-12-vs-3",
    family: "ILLUSTRIOUS_18",
    order: 7,
    playerHand: "Hard 12",
    handKind: "HARD_TOTAL",
    total: 12,
    dealerUpcard: 3,
    index: 2,
    indexBySoft17: indexFor(2),
    actionBelowIndex: "HIT",
    actionAtOrAboveIndex: "STAND",
    source: SCHLESINGER_SOURCE,
  },
  {
    id: "hard-12-vs-2",
    family: "ILLUSTRIOUS_18",
    order: 8,
    playerHand: "Hard 12",
    handKind: "HARD_TOTAL",
    total: 12,
    dealerUpcard: 2,
    index: 3,
    indexBySoft17: indexFor(3),
    actionBelowIndex: "HIT",
    actionAtOrAboveIndex: "STAND",
    source: SCHLESINGER_SOURCE,
  },
  {
    id: "hard-11-vs-ace",
    family: "ILLUSTRIOUS_18",
    order: 9,
    playerHand: "Hard 11",
    handKind: "HARD_TOTAL",
    total: 11,
    dealerUpcard: "A",
    index: 1,
    indexBySoft17: indexFor(1, -1),
    actionBelowIndex: "HIT",
    actionAtOrAboveIndex: "DOUBLE",
    source: `${SCHLESINGER_SOURCE} ${H17_VARIANT_SOURCE}`,
  },
  {
    id: "hard-9-vs-2",
    family: "ILLUSTRIOUS_18",
    order: 10,
    playerHand: "Hard 9",
    handKind: "HARD_TOTAL",
    total: 9,
    dealerUpcard: 2,
    index: 1,
    indexBySoft17: indexFor(1),
    actionBelowIndex: "HIT",
    actionAtOrAboveIndex: "DOUBLE",
    source: SCHLESINGER_SOURCE,
  },
  {
    id: "hard-10-vs-ace",
    family: "ILLUSTRIOUS_18",
    order: 11,
    playerHand: "Hard 10",
    handKind: "HARD_TOTAL",
    total: 10,
    dealerUpcard: "A",
    index: 4,
    indexBySoft17: indexFor(4, 3),
    actionBelowIndex: "HIT",
    actionAtOrAboveIndex: "DOUBLE",
    source: `${SCHLESINGER_SOURCE} ${H17_VARIANT_SOURCE}`,
  },
  {
    id: "hard-9-vs-7",
    family: "ILLUSTRIOUS_18",
    order: 12,
    playerHand: "Hard 9",
    handKind: "HARD_TOTAL",
    total: 9,
    dealerUpcard: 7,
    index: 3,
    indexBySoft17: indexFor(3),
    actionBelowIndex: "HIT",
    actionAtOrAboveIndex: "DOUBLE",
    source: SCHLESINGER_SOURCE,
  },
  {
    id: "hard-16-vs-9",
    family: "ILLUSTRIOUS_18",
    order: 13,
    playerHand: "Hard 16",
    handKind: "HARD_TOTAL",
    total: 16,
    dealerUpcard: 9,
    index: 5,
    indexBySoft17: indexFor(5),
    actionBelowIndex: "HIT",
    actionAtOrAboveIndex: "STAND",
    requiresNoLateSurrender: true,
    source: SCHLESINGER_SOURCE,
  },
  {
    id: "hard-13-vs-2",
    family: "ILLUSTRIOUS_18",
    order: 14,
    playerHand: "Hard 13",
    handKind: "HARD_TOTAL",
    total: 13,
    dealerUpcard: 2,
    index: -1,
    indexBySoft17: indexFor(-1),
    actionBelowIndex: "HIT",
    actionAtOrAboveIndex: "STAND",
    source: SCHLESINGER_SOURCE,
  },
  {
    id: "hard-12-vs-4",
    family: "ILLUSTRIOUS_18",
    order: 15,
    playerHand: "Hard 12",
    handKind: "HARD_TOTAL",
    total: 12,
    dealerUpcard: 4,
    index: 0,
    indexBySoft17: indexFor(0),
    actionBelowIndex: "HIT",
    actionAtOrAboveIndex: "STAND",
    source: SCHLESINGER_SOURCE,
  },
  {
    id: "hard-12-vs-5",
    family: "ILLUSTRIOUS_18",
    order: 16,
    playerHand: "Hard 12",
    handKind: "HARD_TOTAL",
    total: 12,
    dealerUpcard: 5,
    index: -2,
    indexBySoft17: indexFor(-2),
    actionBelowIndex: "HIT",
    actionAtOrAboveIndex: "STAND",
    source: SCHLESINGER_SOURCE,
  },
  {
    id: "hard-12-vs-6",
    family: "ILLUSTRIOUS_18",
    order: 17,
    playerHand: "Hard 12",
    handKind: "HARD_TOTAL",
    total: 12,
    dealerUpcard: 6,
    index: -1,
    indexBySoft17: indexFor(-1, -3),
    actionBelowIndex: "HIT",
    actionAtOrAboveIndex: "STAND",
    source: `${SCHLESINGER_SOURCE} ${H17_VARIANT_SOURCE}`,
  },
  {
    id: "hard-13-vs-3",
    family: "ILLUSTRIOUS_18",
    order: 18,
    playerHand: "Hard 13",
    handKind: "HARD_TOTAL",
    total: 13,
    dealerUpcard: 3,
    index: -2,
    indexBySoft17: indexFor(-2),
    actionBelowIndex: "HIT",
    actionAtOrAboveIndex: "STAND",
    source: SCHLESINGER_SOURCE,
  },
  {
    id: "hard-14-vs-10-surrender",
    family: "FAB_4",
    order: 1,
    playerHand: "Hard 14",
    handKind: "HARD_TOTAL",
    total: 14,
    dealerUpcard: 10,
    index: 3,
    indexBySoft17: indexFor(3),
    actionBelowIndex: "HIT",
    actionAtOrAboveIndex: "SURRENDER",
    requiresLateSurrender: true,
    source: SCHLESINGER_SOURCE,
  },
  {
    id: "hard-15-vs-9-surrender",
    family: "FAB_4",
    order: 2,
    playerHand: "Hard 15",
    handKind: "HARD_TOTAL",
    total: 15,
    dealerUpcard: 9,
    index: 2,
    indexBySoft17: indexFor(2),
    actionBelowIndex: "HIT",
    actionAtOrAboveIndex: "SURRENDER",
    requiresLateSurrender: true,
    source: SCHLESINGER_SOURCE,
  },
  {
    id: "hard-15-vs-10-surrender",
    family: "FAB_4",
    order: 3,
    playerHand: "Hard 15",
    handKind: "HARD_TOTAL",
    total: 15,
    dealerUpcard: 10,
    index: 0,
    indexBySoft17: indexFor(0),
    actionBelowIndex: "HIT",
    actionAtOrAboveIndex: "SURRENDER",
    requiresLateSurrender: true,
    source: SCHLESINGER_SOURCE,
  },
  {
    id: "hard-15-vs-ace-surrender",
    family: "FAB_4",
    order: 4,
    playerHand: "Hard 15",
    handKind: "HARD_TOTAL",
    total: 15,
    dealerUpcard: "A",
    index: 1,
    indexBySoft17: indexFor(1, -1),
    actionBelowIndex: "HIT",
    actionAtOrAboveIndex: "SURRENDER",
    requiresLateSurrender: true,
    source: `${SCHLESINGER_SOURCE} ${H17_VARIANT_SOURCE}`,
  },
]);

export interface DeviationQuery {
  /** Omit cards to query the Insurance play. */
  cards?: readonly Card[];
  dealerUpcard: Card | DealerUpcard;
  trueCount: number;
  rules: Pick<BlackjackRules, "dealerSoft17" | "lateSurrender">;
}

export interface DeviationDecision {
  deviation: HiLoDeviation;
  /** The raw true count is floored before the published index comparison. */
  flooredTrueCount: number;
  index: number;
  action: DeviationAction;
  isAtOrAboveIndex: boolean;
}

/** Index tables use floored true counts (including negative values). */
export function floorTrueCountForDeviation(trueCount: number): number {
  if (!Number.isFinite(trueCount)) throw new Error("trueCount must be finite.");
  return Math.floor(trueCount);
}

export function getDeviationAction(
  deviation: HiLoDeviation,
  trueCount: number,
  dealerSoft17: DealerSoft17Rule = "S17",
): DeviationAction {
  const index = deviation.indexBySoft17[dealerSoft17];
  return floorTrueCountForDeviation(trueCount) >= index
    ? deviation.actionAtOrAboveIndex
    : deviation.actionBelowIndex;
}

/**
 * Resolve a published index-play situation. Returns null for ordinary basic
 * strategy hands and for a row made irrelevant by the table's surrender rule.
 */
export function getDeviationDecision(query: DeviationQuery): DeviationDecision | null {
  const dealerUpcard = dealerUpcardValue(query.dealerUpcard);
  const candidates = HI_LO_DEVIATIONS.filter((deviation) =>
    matchesDeviation(deviation, query.cards, dealerUpcard, query.rules),
  );
  if (candidates.length === 0) return null;

  // There is one potential overlap (15 vs 10). Fab 4 surrender takes priority
  // when legal; otherwise its I18 hit/stand counterpart is the only candidate.
  const deviation = candidates.find((candidate) => candidate.family === "FAB_4") ?? candidates[0];
  const flooredTrueCount = floorTrueCountForDeviation(query.trueCount);
  const index = deviation.indexBySoft17[query.rules.dealerSoft17];
  return {
    deviation,
    flooredTrueCount,
    index,
    action: flooredTrueCount >= index ? deviation.actionAtOrAboveIndex : deviation.actionBelowIndex,
    isAtOrAboveIndex: flooredTrueCount >= index,
  };
}

/** Filter the practice deck to rows that are legal under the current table rules. */
export function getDeviationsForRules(
  rules: Pick<BlackjackRules, "lateSurrender">,
): readonly HiLoDeviation[] {
  return HI_LO_DEVIATIONS.filter((deviation) => {
    if (deviation.requiresLateSurrender && !rules.lateSurrender) return false;
    if (deviation.requiresNoLateSurrender && rules.lateSurrender) return false;
    return true;
  });
}

function matchesDeviation(
  deviation: HiLoDeviation,
  cards: readonly Card[] | undefined,
  dealerUpcard: DealerUpcard,
  rules: Pick<BlackjackRules, "lateSurrender">,
): boolean {
  if (deviation.dealerUpcard !== dealerUpcard) return false;
  if (deviation.requiresLateSurrender && !rules.lateSurrender) return false;
  if (deviation.requiresNoLateSurrender && rules.lateSurrender) return false;
  // Player-action queries supply cards; insurance is queried independently by
  // omitting them, preventing an Ace upcard from masking e.g. hard 11 vs Ace.
  if (deviation.handKind === "INSURANCE") return !cards;
  if (!cards || cards.length !== 2) return false;

  const hand = classifyHand(cards);
  if (deviation.handKind === "PAIR") {
    return hand.kind === "PAIR" && hand.pairRank === deviation.pairRank;
  }

  // 5,5 is deliberately treated as hard 10, matching basic-strategy practice.
  const isFivePairHardTen = hand.kind === "PAIR" && hand.pairRank === "5" && deviation.total === 10;
  return (hand.kind === "HARD" || isFivePairHardTen) && hand.value.total === deviation.total;
}
