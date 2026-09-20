import { blackjackCardValue, type Card } from "@/types/card";
import {
  type HandSettlement,
  type HandStatus,
  type HandValue,
  type PlayerAction,
  type PlayerHand,
  type SettlementOutcome,
} from "@/types/game";
import type { BlackjackRules } from "@/types/rules";

export type CardDraw = () => Card;

/**
 * Values aces optimally: start all aces at one, then promote at most one to
 * eleven when it cannot bust the hand. This is the casino meaning of “soft.”
 */
export function evaluateHand(cards: readonly Card[]): HandValue {
  const aceCount = cards.filter((card) => card.rank === "A").length;
  const hardTotal = cards.reduce((total, card) => total + blackjackCardValue(card.rank), 0);
  const canUseAceAsEleven = aceCount > 0 && hardTotal + 10 <= 21;
  const acesAsEleven = canUseAceAsEleven ? 1 : 0;
  const total = hardTotal + acesAsEleven * 10;

  return {
    total,
    hardTotal,
    isSoft: acesAsEleven > 0,
    aceCount,
    acesAsEleven,
    isBust: total > 21,
  };
}

export function isBust(cards: readonly Card[]): boolean {
  return evaluateHand(cards).isBust;
}

/** A blackjack is exactly two cards totaling 21; a split-Ace 21 is not a natural. */
export function isBlackjack(cards: readonly Card[]): boolean {
  return cards.length === 2 && evaluateHand(cards).total === 21;
}

export function isNaturalBlackjack(hand: Pick<PlayerHand, "cards" | "isSplitHand">): boolean {
  return !hand.isSplitHand && isBlackjack(hand.cards);
}

export function dealerShouldHit(
  cards: readonly Card[],
  rules: Pick<BlackjackRules, "dealerSoft17">,
): boolean {
  const value = evaluateHand(cards);
  if (value.isBust) return false;
  if (value.total < 17) return true;
  return value.total === 17 && value.isSoft && rules.dealerSoft17 === "H17";
}

export interface DealerPlayResult {
  cards: Card[];
  drawnCards: Card[];
  value: HandValue;
}

/** Deal the dealer to completion. The caller controls the shoe through `drawCard`. */
export function playDealerHand(
  initialCards: readonly Card[],
  rules: Pick<BlackjackRules, "dealerSoft17">,
  drawCard: CardDraw,
): DealerPlayResult {
  const cards = [...initialCards];
  const drawnCards: Card[] = [];

  while (dealerShouldHit(cards, rules)) {
    const card = drawCard();
    if (!card) {
      throw new Error("Dealer attempted to draw a missing card.");
    }
    cards.push(card);
    drawnCards.push(card);
  }

  return { cards, drawnCards, value: evaluateHand(cards) };
}

export interface CreatePlayerHandOptions {
  id?: string;
  isSplitHand?: boolean;
  isSplitAces?: boolean;
  actions?: PlayerAction[];
}

export function createPlayerHand(
  cards: readonly Card[],
  wagerCents: number,
  options: CreatePlayerHandOptions = {},
): PlayerHand {
  assertCents(wagerCents, "wagerCents");
  const isSplitHand = options.isSplitHand ?? false;
  const value = evaluateHand(cards);
  const status: HandStatus = value.isBust
    ? "BUST"
    : !isSplitHand && isBlackjack(cards)
      ? "BLACKJACK"
      : "ACTIVE";

  return {
    id: options.id ?? "player-hand",
    cards: [...cards],
    wagerCents,
    baseWagerCents: wagerCents,
    status,
    isSplitHand,
    isSplitAces: options.isSplitAces ?? false,
    doubled: false,
    actions: [...(options.actions ?? [])],
  };
}

export function isHandTerminal(hand: Pick<PlayerHand, "status">): boolean {
  return hand.status !== "ACTIVE";
}

export function canDoubleHand(
  hand: PlayerHand,
  rules: Pick<BlackjackRules, "doubleAfterSplit" | "doubleAfterSplitAces" | "hitSplitAces">,
): boolean {
  if (hand.status !== "ACTIVE" || hand.cards.length !== 2 || hand.doubled) return false;
  if (!hand.isSplitHand) return true;
  if (!rules.doubleAfterSplit) return false;
  if (hand.isSplitAces && (!rules.hitSplitAces || !rules.doubleAfterSplitAces)) return false;
  return true;
}

export function canSurrenderHand(
  hand: PlayerHand,
  rules: Pick<BlackjackRules, "lateSurrender">,
): boolean {
  // The practice rules do not allow late surrender after a split.
  return rules.lateSurrender && !hand.isSplitHand && hand.status === "ACTIVE" && hand.cards.length === 2;
}

export function isSplittablePair(cards: readonly Card[]): boolean {
  return cards.length === 2 && blackjackCardValue(cards[0].rank) === blackjackCardValue(cards[1].rank);
}

export function canSplitHand(
  hand: PlayerHand,
  activeHandCount: number,
  rules: Pick<BlackjackRules, "maxSplitHands" | "resplitAces">,
): boolean {
  if (hand.status !== "ACTIVE" || !isSplittablePair(hand.cards)) return false;
  if (activeHandCount >= rules.maxSplitHands) return false;
  const isAcePair = hand.cards[0].rank === "A" && hand.cards[1].rank === "A";
  return !isAcePair || !hand.isSplitHand || rules.resplitAces;
}

export function availablePlayerActions(
  hand: PlayerHand,
  activeHandCount: number,
  rules: Pick<
    BlackjackRules,
    | "lateSurrender"
    | "doubleAfterSplit"
    | "doubleAfterSplitAces"
    | "hitSplitAces"
    | "maxSplitHands"
    | "resplitAces"
  >,
): PlayerAction[] {
  if (hand.status !== "ACTIVE") return [];
  const actions: PlayerAction[] = ["STAND"];
  const splitAceLocked = hand.isSplitAces && !rules.hitSplitAces;
  if (!splitAceLocked) actions.unshift("HIT");
  if (canDoubleHand(hand, rules)) actions.push("DOUBLE");
  if (canSplitHand(hand, activeHandCount, rules)) actions.push("SPLIT");
  if (canSurrenderHand(hand, rules)) actions.push("SURRENDER");
  return actions;
}

/** Add one normal hit and update only the state that a hit can change. */
export function hitHand(hand: PlayerHand, card: Card): PlayerHand {
  if (hand.status !== "ACTIVE") throw new Error("Cannot hit a completed hand.");
  const cards = [...hand.cards, card];
  const value = evaluateHand(cards);
  const status: HandStatus = value.isBust ? "BUST" : value.total === 21 ? "STOOD" : "ACTIVE";
  return { ...hand, cards, status, actions: [...hand.actions, "HIT"] };
}

export function standHand(hand: PlayerHand): PlayerHand {
  if (hand.status !== "ACTIVE") throw new Error("Cannot stand a completed hand.");
  return { ...hand, status: "STOOD", actions: [...hand.actions, "STAND"] };
}

/** Double receives exactly one card and then automatically stands unless it busts. */
export function doubleHand(
  hand: PlayerHand,
  card: Card,
  rules: Pick<BlackjackRules, "doubleAfterSplit" | "doubleAfterSplitAces" | "hitSplitAces">,
): PlayerHand {
  if (!canDoubleHand(hand, rules)) throw new Error("Double is not legal for this hand.");
  const cards = [...hand.cards, card];
  const value = evaluateHand(cards);
  return {
    ...hand,
    cards,
    wagerCents: hand.wagerCents * 2,
    doubled: true,
    status: value.isBust ? "BUST" : "STOOD",
    actions: [...hand.actions, "DOUBLE"],
  };
}

export function surrenderHand(
  hand: PlayerHand,
  rules: Pick<BlackjackRules, "lateSurrender">,
): PlayerHand {
  if (!canSurrenderHand(hand, rules)) throw new Error("Surrender is not legal for this hand.");
  return { ...hand, status: "SURRENDERED", actions: [...hand.actions, "SURRENDER"] };
}

export interface SplitHandResult {
  hands: [PlayerHand, PlayerHand];
}

/**
 * Split a pair after their replacement cards have been drawn from the shoe.
 * Bankroll accounting is intentionally left to the round coordinator: each
 * returned hand carries the original base wager, so the added split stake is
 * visible rather than hidden in this pure operation.
 */
export function splitHand(
  hand: PlayerHand,
  replacementCards: readonly [Card, Card],
  activeHandCount: number,
  rules: Pick<BlackjackRules, "maxSplitHands" | "resplitAces" | "hitSplitAces">,
): SplitHandResult {
  if (!canSplitHand(hand, activeHandCount, rules)) throw new Error("Split is not legal for this hand.");

  const isSplitAces = hand.cards[0].rank === "A" && hand.cards[1].rank === "A";
  const makeHand = (original: Card, replacement: Card, position: number): PlayerHand => {
    const cards = [original, replacement];
    const mayResplitAces = isSplitAces && replacement.rank === "A" && rules.resplitAces;
    const lockedSplitAce = isSplitAces && !rules.hitSplitAces && !mayResplitAces;
    const value = evaluateHand(cards);
    return {
      id: `${hand.id}-split-${position}`,
      cards,
      wagerCents: hand.baseWagerCents,
      baseWagerCents: hand.baseWagerCents,
      status: lockedSplitAce || value.total === 21 ? "STOOD" : "ACTIVE",
      isSplitHand: true,
      isSplitAces,
      doubled: false,
      actions: [...hand.actions, "SPLIT"],
    };
  };

  return {
    hands: [makeHand(hand.cards[0], replacementCards[0], 1), makeHand(hand.cards[1], replacementCards[1], 2)],
  };
}

export interface SettleHandInput {
  player: PlayerHand;
  dealerCards: readonly Card[];
  rules: Pick<BlackjackRules, "blackjackPayout">;
}

/**
 * Settle one completed player hand. `returnedCents` is the amount put back
 * into the bankroll after all stakes have already been removed. It is thus
 * safe to add across normal, split, and doubled hands without floats.
 */
export function settleHand({ player, dealerCards, rules }: SettleHandInput): HandSettlement {
  assertCents(player.wagerCents, "player.wagerCents");
  const dealerBlackjack = isBlackjack(dealerCards);
  const playerBlackjack = isNaturalBlackjack(player);
  const playerValue = evaluateHand(player.cards);
  const dealerValue = evaluateHand(dealerCards);

  if (dealerBlackjack) {
    return settlementFor(player, playerBlackjack ? "PUSH" : "LOSS");
  }
  if (player.status === "SURRENDERED") {
    return settlementFor(player, "SURRENDER");
  }
  if (playerBlackjack) {
    return settlementFor(player, "BLACKJACK", rules.blackjackPayout);
  }
  if (player.status === "BUST" || playerValue.isBust) {
    return settlementFor(player, "LOSS");
  }
  if (dealerValue.isBust) {
    return settlementFor(player, "WIN");
  }
  if (playerValue.total > dealerValue.total) {
    return settlementFor(player, "WIN");
  }
  if (playerValue.total < dealerValue.total) {
    return settlementFor(player, "LOSS");
  }
  return settlementFor(player, "PUSH");
}

export interface InsuranceSettlement {
  outcome: "WIN" | "LOSS";
  wagerCents: number;
  returnedCents: number;
  profitCents: number;
}

/** Insurance is offered only against a dealer Ace, before the player's first action. */
export function canTakeInsurance(
  dealerUpcard: Card,
  hand: Pick<PlayerHand, "cards" | "isSplitHand" | "status">,
  rules: Pick<BlackjackRules, "insuranceAllowed">,
): boolean {
  return (
    rules.insuranceAllowed &&
    dealerUpcard.rank === "A" &&
    !hand.isSplitHand &&
    hand.status === "ACTIVE" &&
    hand.cards.length === 2
  );
}

/** A casino insurance wager is capped at one half of the original main wager. */
export function maxInsuranceWagerCents(mainWagerCents: number): number {
  assertCents(mainWagerCents, "mainWagerCents");
  return Math.floor(mainWagerCents / 2);
}

/** Insurance pays 2:1 profit, so a winning $5 insurance wager returns $15. */
export function settleInsurance(
  insuranceWagerCents: number,
  dealerCards: readonly Card[],
): InsuranceSettlement {
  assertCents(insuranceWagerCents, "insuranceWagerCents");
  if (isBlackjack(dealerCards)) {
    return {
      outcome: "WIN",
      wagerCents: insuranceWagerCents,
      returnedCents: insuranceWagerCents * 3,
      profitCents: insuranceWagerCents * 2,
    };
  }
  return { outcome: "LOSS", wagerCents: insuranceWagerCents, returnedCents: 0, profitCents: -insuranceWagerCents };
}

export interface RoundSettlement {
  hands: HandSettlement[];
  insurance: InsuranceSettlement | null;
  returnedCents: number;
  profitCents: number;
}

export function settleRound(
  playerHands: readonly PlayerHand[],
  dealerCards: readonly Card[],
  rules: Pick<BlackjackRules, "blackjackPayout">,
  insuranceWagerCents = 0,
): RoundSettlement {
  const hands = playerHands.map((player) => settleHand({ player, dealerCards, rules }));
  const insurance = insuranceWagerCents > 0 ? settleInsurance(insuranceWagerCents, dealerCards) : null;
  return {
    hands,
    insurance,
    returnedCents: hands.reduce((sum, result) => sum + result.returnedCents, 0) + (insurance?.returnedCents ?? 0),
    profitCents: hands.reduce((sum, result) => sum + result.profitCents, 0) + (insurance?.profitCents ?? 0),
  };
}

function settlementFor(
  player: Pick<PlayerHand, "id" | "wagerCents">,
  outcome: SettlementOutcome,
  blackjackPayout: BlackjackRules["blackjackPayout"] = "3:2",
): HandSettlement {
  const wagerCents = player.wagerCents;
  switch (outcome) {
    case "WIN":
      return { handId: player.id, outcome, returnedCents: wagerCents * 2, profitCents: wagerCents };
    case "LOSS":
      return { handId: player.id, outcome, returnedCents: 0, profitCents: -wagerCents };
    case "PUSH":
      return { handId: player.id, outcome, returnedCents: wagerCents, profitCents: 0 };
    case "SURRENDER": {
      // The app's chips are in whole cents. Standard practice wagers are even cents.
      const returnedCents = Math.floor(wagerCents / 2);
      return { handId: player.id, outcome, returnedCents, profitCents: returnedCents - wagerCents };
    }
    case "BLACKJACK": {
      const profitCents = multiplyCents(
        wagerCents,
        blackjackPayout === "3:2" ? 3 : 6,
        blackjackPayout === "3:2" ? 2 : 5,
      );
      return {
        handId: player.id,
        outcome,
        returnedCents: wagerCents + profitCents,
        profitCents,
      };
    }
  }
}

/** Integer arithmetic avoids binary floating-point errors in 3:2 and 6:5 payouts. */
function multiplyCents(cents: number, numerator: number, denominator: number): number {
  return Math.round((cents * numerator) / denominator);
}

function assertCents(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer number of cents.`);
  }
}
