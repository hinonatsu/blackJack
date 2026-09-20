import { describe, expect, it } from "vitest";

import { getBasicStrategyAction, getBasicStrategyDecision } from "@/lib/basicStrategy";
import { getDeviationAction, getDeviationDecision, HI_LO_DEVIATIONS } from "@/lib/deviations";
import { mergeRules } from "@/types/rules";
import { card, cards } from "./helpers";

const noSurrender = mergeRules({ lateSurrender: false });

describe("basic strategy", () => {
  it("covers core hard totals", () => {
    expect(getBasicStrategyAction(cards("3", "5"), card("6"), noSurrender)).toBe("HIT");
    expect(getBasicStrategyAction(cards("10", "2"), card("4"), noSurrender)).toBe("STAND");
    expect(getBasicStrategyAction(cards("10", "2"), card("2"), noSurrender)).toBe("HIT");
    expect(getBasicStrategyAction(cards("10", "6"), card("10"), noSurrender)).toBe("HIT");
    expect(getBasicStrategyAction(cards("10", "7"), card("A"), noSurrender)).toBe("STAND");
  });

  it("covers pairs and never splits fives or tens", () => {
    expect(getBasicStrategyAction(cards("8", "8"), card("10"), noSurrender)).toBe("SPLIT");
    expect(getBasicStrategyAction(cards("A", "A"), card("10"), noSurrender)).toBe("SPLIT");
    expect(getBasicStrategyAction(cards("10", "K"), card("6"), noSurrender)).toBe("STAND");
    expect(getBasicStrategyAction(cards("5", "5"), card("6"), noSurrender)).toBe("DOUBLE");
  });

  it("changes soft 18 and hard 11 vs Ace with S17/H17", () => {
    const s17 = mergeRules({ dealerSoft17: "S17", lateSurrender: false });
    const h17 = mergeRules({ dealerSoft17: "H17", lateSurrender: false });
    expect(getBasicStrategyAction(cards("A", "7"), card("2"), s17)).toBe("STAND");
    expect(getBasicStrategyAction(cards("A", "7"), card("2"), h17)).toBe("DOUBLE");
    expect(getBasicStrategyAction(cards("A", "7"), card("2"), h17, { canDouble: false })).toBe("STAND");
    expect(getBasicStrategyAction(cards("5", "6"), card("A"), s17)).toBe("HIT");
    expect(getBasicStrategyAction(cards("5", "6"), card("A"), h17)).toBe("DOUBLE");
  });

  it("changes pair strategy with DAS and includes late surrender", () => {
    expect(getBasicStrategyAction(cards("4", "4"), card("5"), mergeRules({ doubleAfterSplit: true, lateSurrender: false }))).toBe("SPLIT");
    expect(getBasicStrategyAction(cards("4", "4"), card("5"), mergeRules({ doubleAfterSplit: false, lateSurrender: false }))).toBe("HIT");
    expect(getBasicStrategyDecision(cards("10", "6"), card("10"), mergeRules({ lateSurrender: true }))).toMatchObject({
      action: "SURRENDER",
    });
  });

  it("uses documented single-deck H17/no-DAS exceptions", () => {
    const singleDeck = mergeRules({ deckCount: 1, dealerSoft17: "H17", doubleAfterSplit: false, lateSurrender: false });
    expect(getBasicStrategyAction(cards("4", "4"), card("5"), singleDeck)).toBe("DOUBLE");
    expect(getBasicStrategyAction(cards("7", "7"), card("10"), singleDeck)).toBe("STAND");
    expect(getBasicStrategyAction(cards("A", "7"), card("2"), singleDeck)).toBe("STAND");
    expect(getBasicStrategyAction(cards("4", "6"), card("9"), singleDeck)).toBe("DOUBLE");
  });

  it("uses documented double-deck H17/DAS exceptions", () => {
    const doubleDeck = mergeRules({ deckCount: 2, dealerSoft17: "H17", doubleAfterSplit: true, lateSurrender: false });
    expect(getBasicStrategyAction(cards("4", "5"), card("2"), doubleDeck)).toBe("DOUBLE");
    expect(getBasicStrategyAction(cards("A", "7"), card("2"), doubleDeck)).toBe("STAND");
    expect(getBasicStrategyAction(cards("6", "6"), card("7"), doubleDeck)).toBe("SPLIT");
    expect(getBasicStrategyAction(cards("7", "7"), card("8"), doubleDeck)).toBe("SPLIT");
  });
});

describe("published Hi-Lo deviations", () => {
  it("contains Illustrious 18 plus Fab 4 and compares floored true counts", () => {
    expect(HI_LO_DEVIATIONS).toHaveLength(22);
    const insurance = HI_LO_DEVIATIONS.find((deviation) => deviation.id === "insurance-vs-ace");
    if (!insurance) throw new Error("missing insurance deviation");
    expect(getDeviationAction(insurance, 2.9)).toBe("NO_INSURANCE");
    expect(getDeviationAction(insurance, 3)).toBe("INSURANCE");
  });

  it("chooses the correct non-surrender and Fab 4 action", () => {
    const noLsRules = mergeRules({ lateSurrender: false, dealerSoft17: "S17" });
    expect(getDeviationDecision({ cards: cards("10", "6"), dealerUpcard: card("10"), trueCount: -0.1, rules: noLsRules })?.action).toBe("HIT");
    expect(getDeviationDecision({ cards: cards("10", "6"), dealerUpcard: card("10"), trueCount: 0, rules: noLsRules })?.action).toBe("STAND");

    const lsRules = mergeRules({ lateSurrender: true, dealerSoft17: "S17" });
    expect(getDeviationDecision({ cards: cards("9", "6"), dealerUpcard: card("10"), trueCount: -1, rules: lsRules })?.action).toBe("HIT");
    expect(getDeviationDecision({ cards: cards("9", "6"), dealerUpcard: card("10"), trueCount: 0, rules: lsRules })?.action).toBe("SURRENDER");
  });
});
