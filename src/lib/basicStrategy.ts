import type { Card, Rank } from "@/types/card";
import { blackjackCardValue, isTenValueRank } from "@/types/card";
import { evaluateHand } from "@/lib/blackjackEngine";
import type { HandValue, PlayerAction } from "@/types/game";
import type { BlackjackRules } from "@/types/rules";

export const DEALER_UPCARDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, "A"] as const;
export type DealerUpcard = (typeof DEALER_UPCARDS)[number];
export type StrategyAction = PlayerAction;
export type StrategyHandKind = "HARD" | "SOFT" | "PAIR";
export type PairRank = Exclude<Rank, "J" | "Q" | "K">;

/** A table cell can encode the usual chart notation D/H and D/S without UI logic. */
export type StrategyCell = StrategyAction | "DOUBLE_OR_HIT" | "DOUBLE_OR_STAND";
export type StrategyRow = Readonly<Record<DealerUpcard, StrategyCell>>;

export interface ClassifiedStrategyHand {
  kind: StrategyHandKind;
  cards: readonly Card[];
  value: HandValue;
  pairRank?: PairRank;
}

export interface BasicStrategyOptions {
  /** Pass true for an already split hand; it affects DAS and surrender availability. */
  isSplitHand?: boolean;
  isSplitAces?: boolean;
  /** Override automatic legality when a table-level split cap has been reached. */
  canSplit?: boolean;
  /** Override automatic legality when bankroll or a table restriction prevents doubling. */
  canDouble?: boolean;
  /** Override automatic legality when surrender is not available on this hand. */
  canSurrender?: boolean;
}

export interface BasicStrategyDecision {
  action: StrategyAction;
  hand: ClassifiedStrategyHand;
  dealerUpcard: DealerUpcard;
  reason: string;
}

const H: StrategyCell = "HIT";
const S: StrategyCell = "STAND";
const D_H: StrategyCell = "DOUBLE_OR_HIT";
const D_S: StrategyCell = "DOUBLE_OR_STAND";
const P: StrategyCell = "SPLIT";

function row(...cells: StrategyCell[]): StrategyRow {
  if (cells.length !== DEALER_UPCARDS.length) throw new Error("A strategy row must have ten dealer cells.");
  return Object.freeze(
    Object.fromEntries(DEALER_UPCARDS.map((upcard, index) => [upcard, cells[index]])) as Record<
      DealerUpcard,
      StrategyCell
    >,
  );
}

/**
 * Explicit total-dependent multi-deck table (4–8 decks), adapted from the
 * Wizard of Odds U.S. basic-strategy charts. H17/S17 and DAS/LS deltas are
 * applied below rather than hidden inside component conditionals.
 */
export const HARD_TOTAL_TABLE: Readonly<Record<number, StrategyRow>> = Object.freeze({
  4: row(H, H, H, H, H, H, H, H, H, H),
  5: row(H, H, H, H, H, H, H, H, H, H),
  6: row(H, H, H, H, H, H, H, H, H, H),
  7: row(H, H, H, H, H, H, H, H, H, H),
  8: row(H, H, H, H, H, H, H, H, H, H),
  9: row(H, D_H, D_H, D_H, D_H, H, H, H, H, H),
  10: row(D_H, D_H, D_H, D_H, D_H, D_H, D_H, D_H, H, H),
  11: row(D_H, D_H, D_H, D_H, D_H, D_H, D_H, D_H, D_H, H),
  12: row(H, H, S, S, S, H, H, H, H, H),
  13: row(S, S, S, S, S, H, H, H, H, H),
  14: row(S, S, S, S, S, H, H, H, H, H),
  15: row(S, S, S, S, S, H, H, H, H, H),
  16: row(S, S, S, S, S, H, H, H, H, H),
  17: row(S, S, S, S, S, S, S, S, S, S),
  18: row(S, S, S, S, S, S, S, S, S, S),
  19: row(S, S, S, S, S, S, S, S, S, S),
  20: row(S, S, S, S, S, S, S, S, S, S),
});

/** Soft 13–17 and soft 20 are shared. Soft 18/19 have documented H17 overlays. */
export const SOFT_TOTAL_TABLE: Readonly<Record<number, StrategyRow>> = Object.freeze({
  13: row(H, H, H, D_H, D_H, H, H, H, H, H),
  14: row(H, H, H, D_H, D_H, H, H, H, H, H),
  15: row(H, H, D_H, D_H, D_H, H, H, H, H, H),
  16: row(H, H, D_H, D_H, D_H, H, H, H, H, H),
  17: row(H, D_H, D_H, D_H, D_H, H, H, H, H, H),
  // S17: stand vs 2, double-or-stand vs 3–6, stand 7–8, hit 9–A.
  18: row(S, D_S, D_S, D_S, D_S, S, S, H, H, H),
  // S17: always stand; H17 changes the dealer-6 cell to double-or-stand.
  19: row(S, S, S, S, S, S, S, S, S, S),
  20: row(S, S, S, S, S, S, S, S, S, S),
});

/** Pair rows when Double After Split (DAS) is allowed. 5s and 10s use hard totals. */
export const PAIR_TABLE_DAS: Readonly<Partial<Record<PairRank, StrategyRow>>> = Object.freeze({
  A: row(P, P, P, P, P, P, P, P, P, P),
  "2": row(P, P, P, P, P, P, H, H, H, H),
  "3": row(P, P, P, P, P, P, H, H, H, H),
  "4": row(H, H, H, P, P, H, H, H, H, H),
  "6": row(P, P, P, P, P, H, H, H, H, H),
  "7": row(P, P, P, P, P, P, H, H, H, H),
  "8": row(P, P, P, P, P, P, P, P, P, P),
  "9": row(P, P, P, P, P, S, P, P, S, S),
});

/** Pair rows when Double After Split is not allowed. */
export const PAIR_TABLE_NO_DAS: Readonly<Partial<Record<PairRank, StrategyRow>>> = Object.freeze({
  A: row(P, P, P, P, P, P, P, P, P, P),
  "2": row(H, H, P, P, P, P, H, H, H, H),
  "3": row(H, H, P, P, P, P, H, H, H, H),
  "4": row(H, H, H, H, H, H, H, H, H, H),
  "6": row(H, P, P, P, P, H, H, H, H, H),
  "7": row(P, P, P, P, P, P, H, H, H, H),
  "8": row(P, P, P, P, P, P, P, P, P, P),
  "9": row(P, P, P, P, P, S, P, P, S, S),
});

/** Convert a dealer's face card into the one 10 column used by a strategy table. */
export function dealerUpcardValue(cardOrUpcard: Card | DealerUpcard): DealerUpcard {
  if (typeof cardOrUpcard === "number" || cardOrUpcard === "A") return cardOrUpcard;
  if (cardOrUpcard.rank === "A") return "A";
  return isTenValueRank(cardOrUpcard.rank) ? 10 : Number(cardOrUpcard.rank) as DealerUpcard;
}

export function classifyHand(cards: readonly Card[]): ClassifiedStrategyHand {
  if (cards.length === 0) throw new Error("A strategy hand needs at least one card.");
  const value = evaluateHand(cards);
  if (cards.length === 2 && blackjackCardValue(cards[0].rank) === blackjackCardValue(cards[1].rank)) {
    const pairRank: PairRank = isTenValueRank(cards[0].rank)
      ? "10"
      : (cards[0].rank as PairRank);
    return { kind: "PAIR", cards, value, pairRank };
  }
  return { kind: value.isSoft ? "SOFT" : "HARD", cards, value };
}

/**
 * Return the action a player should train under the selected rules. It is
 * deliberately pure: the round engine enforces legality and consumes cards.
 */
export function getBasicStrategyAction(
  cards: readonly Card[],
  dealerCard: Card | DealerUpcard,
  rules: Pick<
    BlackjackRules,
    | "deckCount"
    | "dealerSoft17"
    | "doubleAfterSplit"
    | "doubleAfterSplitAces"
    | "hitSplitAces"
    | "lateSurrender"
  >,
  options: BasicStrategyOptions = {},
): StrategyAction {
  return getBasicStrategyDecision(cards, dealerCard, rules, options).action;
}

export function getBasicStrategyDecision(
  cards: readonly Card[],
  dealerCard: Card | DealerUpcard,
  rules: Pick<
    BlackjackRules,
    | "deckCount"
    | "dealerSoft17"
    | "doubleAfterSplit"
    | "doubleAfterSplitAces"
    | "hitSplitAces"
    | "lateSurrender"
  >,
  options: BasicStrategyOptions = {},
): BasicStrategyDecision {
  const hand = classifyHand(cards);
  const dealerUpcard = dealerUpcardValue(dealerCard);
  const action = resolveBasicAction(hand, dealerUpcard, rules, options);
  return { action, hand, dealerUpcard, reason: strategyReason(hand, dealerUpcard, action) };
}

function resolveBasicAction(
  hand: ClassifiedStrategyHand,
  dealerUpcard: DealerUpcard,
  rules: Pick<
    BlackjackRules,
    | "deckCount"
    | "dealerSoft17"
    | "doubleAfterSplit"
    | "doubleAfterSplitAces"
    | "hitSplitAces"
    | "lateSurrender"
  >,
  options: BasicStrategyOptions,
): StrategyAction {
  if (hand.value.total >= 21) return "STAND";

  if (shouldLateSurrender(hand, dealerUpcard, rules, options)) return "SURRENDER";

  const canDouble = canDoubleForStrategy(hand, rules, options);
  const canSplit = options.canSplit ?? hand.cards.length === 2;

  if (hand.kind === "PAIR" && canSplit && hand.pairRank && hand.pairRank !== "5" && hand.pairRank !== "10") {
    const pairTable = rules.doubleAfterSplit ? PAIR_TABLE_DAS : PAIR_TABLE_NO_DAS;
    const pairCell = deckSpecificPairCell(hand.pairRank, dealerUpcard, rules) ?? pairTable[hand.pairRank]?.[dealerUpcard];
    if (pairCell) return resolveCell(pairCell, canDouble);
  }

  if (hand.kind === "SOFT") {
    return resolveCell(softCell(hand.value.total, dealerUpcard, rules), canDouble);
  }

  // A pair of 5s is a hard 10 and a pair of ten-valued cards is a hard 20.
  return resolveCell(hardCell(hand.value.total, dealerUpcard, rules), canDouble);
}

function hardCell(
  total: number,
  dealerUpcard: DealerUpcard,
  rules: Pick<BlackjackRules, "deckCount" | "dealerSoft17">,
): StrategyCell {
  // Documented one-deck total-dependent exceptions to the 4–8 deck base chart.
  // They apply to the neutral, initial two-card strategy chart; the app does not
  // claim composition-dependent precision after further cards are exposed.
  if (rules.deckCount === 1) {
    if (total === 8 && (dealerUpcard === 5 || dealerUpcard === 6)) return D_H;
    if (total === 9 && dealerUpcard === 2) return D_H;
    // S17 single-deck charts hit 10 vs 9; H17 changes that one cell to a double.
    if (total === 10 && dealerUpcard === 9 && rules.dealerSoft17 === "S17") return H;
  }
  // Two-deck H17: the smaller pack makes 9 vs 2 a profitable double.
  if (rules.deckCount === 2 && rules.dealerSoft17 === "H17" && total === 9 && dealerUpcard === 2) {
    return D_H;
  }

  if (total === 11 && dealerUpcard === "A" && rules.dealerSoft17 === "H17") return D_H;
  return HARD_TOTAL_TABLE[Math.min(20, Math.max(4, total))]?.[dealerUpcard] ?? S;
}

function softCell(
  total: number,
  dealerUpcard: DealerUpcard,
  rules: Pick<BlackjackRules, "deckCount" | "dealerSoft17">,
): StrategyCell {
  // One-deck H17 / no-DAS charts add these four documented double cells and
  // stand on A,7 vs 2 (rather than the shoe-game H17 double).
  if (rules.deckCount === 1) {
    if ((total === 13 || total === 14) && dealerUpcard === 4) return D_H;
    if (total === 17 && dealerUpcard === 2) return D_H;
    if (total === 18 && dealerUpcard === 2) return S;
  }
  // Two-deck H17 returns A,7 vs 2 to a stand; the standard shoe H17 chart doubles.
  if (rules.deckCount === 2 && total === 18 && dealerUpcard === 2) return S;
  if (total === 18 && rules.dealerSoft17 === "H17") {
    if (dealerUpcard === 2) return D_S;
    if (dealerUpcard === 3 || dealerUpcard === 4 || dealerUpcard === 5 || dealerUpcard === 6) return D_S;
  }
  if (total === 19 && rules.dealerSoft17 === "H17" && dealerUpcard === 6) return D_S;
  return SOFT_TOTAL_TABLE[Math.min(20, Math.max(13, total))]?.[dealerUpcard] ?? S;
}

function deckSpecificPairCell(
  pairRank: PairRank,
  dealerUpcard: DealerUpcard,
  rules: Pick<BlackjackRules, "deckCount" | "dealerSoft17" | "doubleAfterSplit">,
): StrategyCell | undefined {
  // Source: documented H17 one- and two-deck basic-strategy charts.
  if (rules.dealerSoft17 !== "H17") return undefined;
  if (rules.deckCount === 1 && !rules.doubleAfterSplit) {
    if (pairRank === "4" && (dealerUpcard === 5 || dealerUpcard === 6)) return D_H;
    if (pairRank === "7" && dealerUpcard === 10) return S;
  }
  // Two-deck H17 DAS: the smaller shoe opens two additional split cells.
  if (rules.deckCount === 2 && rules.doubleAfterSplit) {
    if (pairRank === "6" && dealerUpcard === 7) return P;
    if (pairRank === "7" && dealerUpcard === 8) return P;
  }
  return undefined;
}

function resolveCell(cell: StrategyCell, canDouble: boolean): StrategyAction {
  if (cell === "DOUBLE_OR_HIT") return canDouble ? "DOUBLE" : "HIT";
  if (cell === "DOUBLE_OR_STAND") return canDouble ? "DOUBLE" : "STAND";
  return cell;
}

function canDoubleForStrategy(
  hand: ClassifiedStrategyHand,
  rules: Pick<BlackjackRules, "doubleAfterSplit" | "doubleAfterSplitAces" | "hitSplitAces">,
  options: BasicStrategyOptions,
): boolean {
  if (options.canDouble !== undefined) return options.canDouble;
  if (hand.cards.length !== 2) return false;
  if (!options.isSplitHand) return true;
  if (!rules.doubleAfterSplit) return false;
  if (options.isSplitAces && (!rules.hitSplitAces || !rules.doubleAfterSplitAces)) return false;
  return true;
}

/**
 * Late-surrender rows are kept separately because they depend on deck count
 * and H17/S17. Source: Wizard of Odds “When to Surrender in Blackjack”,
 * total-dependent tables (1, 2, and 4+ decks). Pair 8,8 has its documented
 * H17 six-deck exception and otherwise remains a split.
 */
function shouldLateSurrender(
  hand: ClassifiedStrategyHand,
  dealerUpcard: DealerUpcard,
  rules: Pick<BlackjackRules, "deckCount" | "dealerSoft17" | "lateSurrender">,
  options: BasicStrategyOptions,
): boolean {
  const canSurrender = options.canSurrender ?? (!options.isSplitHand && hand.cards.length === 2);
  if (!rules.lateSurrender || !canSurrender) return false;

  if (hand.kind === "PAIR" && hand.pairRank === "8") {
    return rules.deckCount >= 6 && rules.dealerSoft17 === "H17" && dealerUpcard === "A";
  }

  const total = hand.value.total;
  const h17Ace = dealerUpcard === "A" && rules.dealerSoft17 === "H17";
  if (rules.deckCount === 1) {
    return (
      (total === 15 && h17Ace) ||
      (total === 16 && (dealerUpcard === 10 || dealerUpcard === "A")) ||
      (total === 17 && h17Ace)
    );
  }
  if (rules.deckCount === 2) {
    return (
      (total === 15 && (dealerUpcard === 10 || h17Ace)) ||
      (total === 16 && (dealerUpcard === 10 || dealerUpcard === "A")) ||
      (total === 17 && h17Ace)
    );
  }
  return (
    (total === 15 && (dealerUpcard === 10 || h17Ace)) ||
    (total === 16 && (dealerUpcard === 9 || dealerUpcard === 10 || dealerUpcard === "A")) ||
    (total === 17 && h17Ace)
  );
}

export function strategyReason(
  hand: ClassifiedStrategyHand,
  dealerUpcard: DealerUpcard,
  action: StrategyAction,
): string {
  if (action === "SPLIT") return "Split the pair to play two stronger starting hands.";
  if (action === "SURRENDER") return "Late Surrender limits a costly matchup to half the wager.";
  if (action === "DOUBLE") return "Double when one extra card has the best expected value.";
  if (action === "STAND") {
    return typeof dealerUpcard === "number" && dealerUpcard >= 2 && dealerUpcard <= 6
      ? "Dealer is showing a weak upcard; let the dealer draw."
      : hand.value.total >= 17
        ? "Your total is strong enough to stand."
        : "Standing has the better expected value here.";
  }
  return "Hit to improve this hand against the dealer upcard.";
}
