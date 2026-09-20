import { describe, expect, it } from "vitest";

import {
  cardComposition,
  createDeck,
  createShoe,
  dealtCardCount,
  discardCards,
  drawCards,
  shuffle,
  shouldReshuffleBeforeRound,
} from "@/lib/deck";
import { mergeRules } from "@/types/rules";

describe("deck and shoe", () => {
  it("creates all 312 physical cards for a six-deck shoe", () => {
    const cards = createDeck(6);
    expect(cards).toHaveLength(312);
    expect(new Set(cards.map((card) => card.id)).size).toBe(312);
    expect(cardComposition(cards).get("A-spades")).toBe(6);
  });

  it("preserves card composition and caller order when shuffled", () => {
    const original = createDeck(2);
    const originalIds = original.map((card) => card.id);
    const shuffled = shuffle(original, () => 0);

    expect(shuffled).toHaveLength(original.length);
    expect(cardComposition(shuffled)).toEqual(cardComposition(original));
    expect(original.map((card) => card.id)).toEqual(originalIds);
    expect(new Set(shuffled.map((card) => card.id))).toEqual(new Set(originalIds));
  });

  it("consumes one continuous shoe and only requests a reshuffle between rounds", () => {
    const shoe = createShoe(mergeRules({ deckCount: 1, penetration: 0.1 }), () => 0.5);
    const draw = drawCards(shoe, 6);
    const discarded = discardCards(draw.shoe, draw.cards);

    expect(dealtCardCount(discarded)).toBe(6);
    expect(discarded.cards).toHaveLength(46);
    expect(discarded.discardPile).toHaveLength(6);
    expect(shouldReshuffleBeforeRound(discarded)).toBe(true);
  });
});
