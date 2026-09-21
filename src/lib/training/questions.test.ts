import { describe, expect, it } from "vitest";

import { VEGAS_SIX_DECK_RULES } from "../../types/rules";
import {
  generateDeckEstimationQuestion,
  generateBasicStrategyQuestion,
  generateStrategyQuestion,
  generateTrueCountQuestion,
  countTrailForRanks,
  hiLoValueForRank,
  roundTrueCount,
  runningCountForRanks,
} from "./questions";

describe("training question utilities", () => {
  it("uses the Hi-Lo values and remains balanced across one rank set", () => {
    expect(hiLoValueForRank("2")).toBe(1);
    expect(hiLoValueForRank("7")).toBe(0);
    expect(hiLoValueForRank("A")).toBe(-1);
    expect(runningCountForRanks(["2", "6", "7", "9", "10", "A"])).toBe(0);
    expect(countTrailForRanks(["5", "K", "3"])).toEqual([
      { rank: "5", delta: 1, runningCount: 1 },
      { rank: "K", delta: -1, runningCount: 0 },
      { rank: "3", delta: 1, runningCount: 1 },
    ]);
  });

  it("makes a strategy question from a resolver rather than a duplicate table", () => {
    const question = generateStrategyQuestion({
      rules: VEGAS_SIX_DECK_RULES,
      handKind: "soft",
      now: 1_000,
      random: () => 0,
      resolveAction: (cards, dealer, rules) => {
        expect(cards.map((card) => card.rank)).toEqual(["A", "2"]);
        expect(dealer.rank).toBe("2");
        expect(rules.deckCount).toBe(6);
        return { action: "HIT", reason: "Test decision" };
      },
    });

    expect(question.situation).toMatchObject({ handKind: "soft", total: 13, dealerValue: 2 });
    expect(question.playerCards.map((card) => card.rank)).toEqual(["A", "2"]);
    expect(question.expectedAction).toBe("HIT");
    expect(question.reason).toBe("Test decision");
  });

  it("uses the same rules-aware engine for the action that the UI grades", () => {
    const question = generateBasicStrategyQuestion({
      rules: VEGAS_SIX_DECK_RULES,
      situation: {
        handKind: "soft",
        total: 15,
        dealerValue: 10,
        playerLabel: "Soft 15",
        dealerLabel: "10",
      },
      now: 1_000,
      random: () => 0,
    });

    // The supplied H17 / Late Surrender chart says Hit. This also guards
    // against treating a soft 15 as a hard 15 surrender decision.
    expect(question.expectedAction).toBe("HIT");
  });

  it("uses half-deck visual estimates and an explicit true-count rounding rule", () => {
    const deck = generateDeckEstimationQuestion({ totalDecks: 6, random: () => 0, now: 1_000 });
    expect(deck.decksRemaining).toBe(0.5);
    expect(deck.remainingRatio).toBeCloseTo(1 / 12);

    const trueCount = generateTrueCountQuestion({
      totalDecks: 6,
      minimumDecksRemaining: 2.5,
      maximumDecksRemaining: 2.5,
      runningCount: 6,
      rounding: "truncate",
      random: () => 0,
      now: 1_000,
    });
    expect(trueCount.rawTrueCount).toBe(2.4);
    expect(trueCount.expectedTrueCount).toBe(2);
    expect(roundTrueCount(-2.4, "floor")).toBe(-3);
    expect(roundTrueCount(-2.4, "truncate")).toBe(-2);
  });
});
