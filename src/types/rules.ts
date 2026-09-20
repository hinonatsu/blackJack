/** Deck counts exposed by the practice-table settings. */
export type DeckCount = 1 | 2 | 6 | 8;
export type BlackjackPayout = "3:2" | "6:5";
export type DealerSoft17Rule = "S17" | "H17";

/**
 * All rules that can change a legal action, settlement, or basic-strategy
 * answer. Values are deliberately explicit rather than inferred from a preset.
 */
export interface BlackjackRules {
  deckCount: DeckCount;
  blackjackPayout: BlackjackPayout;
  dealerSoft17: DealerSoft17Rule;
  doubleAfterSplit: boolean;
  /** Some tables prohibit doubling split aces even when DAS is otherwise allowed. */
  doubleAfterSplitAces: boolean;
  lateSurrender: boolean;
  /** Includes the original hand; four means an initial pair can be split up to three times. */
  maxSplitHands: number;
  resplitAces: boolean;
  /** False means a split ace gets one draw and must then stand, unless it can be re-split. */
  hitSplitAces: boolean;
  insuranceAllowed: boolean;
  /** American hole-card / peek procedure, common in Las Vegas shoe games. */
  dealerPeeksForBlackjack: boolean;
  /** Portion of the shoe normally dealt before a cut-card reshuffle, from 0 to 1. */
  penetration: number;
}

/**
 * The default practice table is a liberal Vegas-style six-deck shoe:
 * H17, 3:2, DAS, late surrender, up to four hands, resplit aces, one-card
 * split aces, and a dealer peek. Individual casinos can differ; users can
 * change every exposed rule in settings.
 */
export const VEGAS_SIX_DECK_RULES: Readonly<BlackjackRules> = Object.freeze({
  deckCount: 6,
  blackjackPayout: "3:2",
  dealerSoft17: "H17",
  doubleAfterSplit: true,
  doubleAfterSplitAces: false,
  lateSurrender: true,
  maxSplitHands: 4,
  resplitAces: true,
  hitSplitAces: false,
  insuranceAllowed: true,
  dealerPeeksForBlackjack: true,
  penetration: 0.75,
});

export const DEFAULT_RULES = VEGAS_SIX_DECK_RULES;

/** Merge settings without mutating a shared preset. */
export function mergeRules(overrides: Partial<BlackjackRules> = {}): BlackjackRules {
  const rules = { ...VEGAS_SIX_DECK_RULES, ...overrides };
  validateRules(rules);
  return rules;
}

export function validateRules(rules: BlackjackRules): void {
  if (!Number.isInteger(rules.deckCount) || ![1, 2, 6, 8].includes(rules.deckCount)) {
    throw new Error("deckCount must be one of 1, 2, 6, or 8.");
  }
  if (!Number.isInteger(rules.maxSplitHands) || rules.maxSplitHands < 2) {
    throw new Error("maxSplitHands must be an integer of at least 2.");
  }
  if (rules.penetration <= 0 || rules.penetration > 1 || !Number.isFinite(rules.penetration)) {
    throw new Error("penetration must be greater than 0 and at most 1.");
  }
}
