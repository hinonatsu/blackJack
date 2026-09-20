import type { Card } from "./card";
import type { BlackjackRules } from "./rules";

export const PLAYER_ACTIONS = ["HIT", "STAND", "DOUBLE", "SPLIT", "SURRENDER"] as const;
export type PlayerAction = (typeof PLAYER_ACTIONS)[number];

export type HandStatus = "ACTIVE" | "STOOD" | "BUST" | "BLACKJACK" | "SURRENDERED";
export type RoundPhase = "BETTING" | "DEALING" | "PLAYER_TURN" | "DEALER_TURN" | "SETTLED";
export type SettlementOutcome = "WIN" | "LOSS" | "PUSH" | "BLACKJACK" | "SURRENDER";

/** A normalized blackjack total. `hardTotal` counts every ace as one. */
export interface HandValue {
  total: number;
  hardTotal: number;
  isSoft: boolean;
  aceCount: number;
  acesAsEleven: number;
  isBust: boolean;
}

/** Cards plus enough state to decide which actions remain legal. Wagers are integer cents. */
export interface PlayerHand {
  id: string;
  cards: Card[];
  /** Total amount currently at risk, including a double when made. */
  wagerCents: number;
  /** Original wager for display and split/double auditing. */
  baseWagerCents: number;
  status: HandStatus;
  isSplitHand: boolean;
  isSplitAces: boolean;
  doubled: boolean;
  actions: PlayerAction[];
}

/** A generic card hand is useful to components that do not need player state. */
export interface Hand {
  cards: Card[];
}

export interface DealerHand extends Hand {
  holeCardRevealed: boolean;
}

/**
 * `cards` is the draw stack: array end is the next card dealt. Keeping it
 * separate from `discardPile` makes a shoe's consumption auditable.
 */
export interface ShoeState {
  cards: Card[];
  discardPile: Card[];
  initialCardCount: number;
  /** Number of dealt cards at which the next round must reshuffle. */
  cutCardPosition: number;
  shuffleCount: number;
}

export interface HandSettlement {
  handId: string;
  outcome: SettlementOutcome;
  /** Chips returned to the bankroll after this hand. */
  returnedCents: number;
  /** Net change relative to the amount at risk. */
  profitCents: number;
}

export interface GameState {
  rules: BlackjackRules;
  phase: RoundPhase;
  shoe: ShoeState;
  bankrollCents: number;
  dealer: DealerHand;
  playerHands: PlayerHand[];
  activeHandIndex: number | null;
  runningCount: number;
  insuranceWagerCents: number;
  settlements: HandSettlement[];
}
