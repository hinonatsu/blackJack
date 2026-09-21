import { describe, expect, it } from "vitest";

import { getBasicStrategyAction, getBasicStrategyDecision } from "@/lib/basicStrategy";
import { getDeviationAction, getDeviationDecision, HI_LO_DEVIATIONS } from "@/lib/deviations";
import { mergeRules } from "@/types/rules";
import type { Rank } from "@/types/card";
import { card, cards } from "./helpers";

const noSurrender = mergeRules({ lateSurrender: false });
const pdfRules = mergeRules({ deckCount: 6, dealerSoft17: "H17", doubleAfterSplit: true, lateSurrender: true });
const chartDealerRanks: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "A"];
const chartActions = {
  H: "HIT",
  S: "STAND",
  D: "DOUBLE",
  P: "SPLIT",
  R: "SURRENDER",
} as const;
type ChartCode = keyof typeof chartActions;

function expectPdfChartRow(playerRanks: Rank[], expected: readonly ChartCode[]): void {
  expected.forEach((code, index) => {
    expect(
      getBasicStrategyAction(cards(...playerRanks), card(chartDealerRanks[index]!), pdfRules),
      `${playerRanks.join(",")} vs ${chartDealerRanks[index]}`,
    ).toBe(chartActions[code]);
  });
}

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
    expect(getBasicStrategyAction(cards("4", "5"), card("3"), h17, { canDouble: false })).toBe("HIT");
    expect(getBasicStrategyAction(cards("A", "8"), card("6"), h17, { canDouble: false })).toBe("STAND");
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

  it("matches every actionable row of the supplied 6-deck H17, DAS, Late Surrender chart", () => {
    expectPdfChartRow(["2", "3"], ["H", "H", "H", "H", "H", "H", "H", "H", "H", "H"]);
    expectPdfChartRow(["2", "4"], ["H", "H", "H", "H", "H", "H", "H", "H", "H", "H"]);
    expectPdfChartRow(["2", "5"], ["H", "H", "H", "H", "H", "H", "H", "H", "H", "H"]);
    expectPdfChartRow(["2", "6"], ["H", "H", "H", "H", "H", "H", "H", "H", "H", "H"]);
    expectPdfChartRow(["4", "5"], ["H", "D", "D", "D", "D", "H", "H", "H", "H", "H"]);
    expectPdfChartRow(["4", "6"], ["D", "D", "D", "D", "D", "D", "D", "D", "H", "H"]);
    expectPdfChartRow(["5", "6"], ["D", "D", "D", "D", "D", "D", "D", "D", "D", "D"]);
    expectPdfChartRow(["5", "7"], ["H", "H", "S", "S", "S", "H", "H", "H", "H", "H"]);
    expectPdfChartRow(["5", "8"], ["S", "S", "S", "S", "S", "H", "H", "H", "H", "H"]);
    expectPdfChartRow(["6", "8"], ["S", "S", "S", "S", "S", "H", "H", "H", "H", "H"]);
    expectPdfChartRow(["7", "8"], ["S", "S", "S", "S", "S", "H", "H", "H", "R", "R"]);
    expectPdfChartRow(["7", "9"], ["S", "S", "S", "S", "S", "H", "H", "R", "R", "R"]);
    expectPdfChartRow(["8", "9"], ["S", "S", "S", "S", "S", "S", "S", "S", "S", "R"]);
    expectPdfChartRow(["8", "10"], ["S", "S", "S", "S", "S", "S", "S", "S", "S", "S"]);
    expectPdfChartRow(["9", "10"], ["S", "S", "S", "S", "S", "S", "S", "S", "S", "S"]);
    expectPdfChartRow(["10", "J"], ["S", "S", "S", "S", "S", "S", "S", "S", "S", "S"]);

    expectPdfChartRow(["A", "2"], ["H", "H", "H", "D", "D", "H", "H", "H", "H", "H"]);
    expectPdfChartRow(["A", "3"], ["H", "H", "H", "D", "D", "H", "H", "H", "H", "H"]);
    expectPdfChartRow(["A", "4"], ["H", "H", "D", "D", "D", "H", "H", "H", "H", "H"]);
    expectPdfChartRow(["A", "5"], ["H", "H", "D", "D", "D", "H", "H", "H", "H", "H"]);
    expectPdfChartRow(["A", "6"], ["H", "D", "D", "D", "D", "H", "H", "H", "H", "H"]);
    expectPdfChartRow(["A", "7"], ["D", "D", "D", "D", "D", "S", "S", "H", "H", "H"]);
    expectPdfChartRow(["A", "8"], ["S", "S", "S", "S", "D", "S", "S", "S", "S", "S"]);
    expectPdfChartRow(["A", "9"], ["S", "S", "S", "S", "S", "S", "S", "S", "S", "S"]);
    expectPdfChartRow(["A", "10"], ["S", "S", "S", "S", "S", "S", "S", "S", "S", "S"]);

    expectPdfChartRow(["2", "2"], ["P", "P", "P", "P", "P", "P", "H", "H", "H", "H"]);
    expectPdfChartRow(["3", "3"], ["P", "P", "P", "P", "P", "P", "H", "H", "H", "H"]);
    expectPdfChartRow(["4", "4"], ["H", "H", "H", "P", "P", "H", "H", "H", "H", "H"]);
    expectPdfChartRow(["5", "5"], ["D", "D", "D", "D", "D", "D", "D", "D", "H", "H"]);
    expectPdfChartRow(["6", "6"], ["P", "P", "P", "P", "P", "H", "H", "H", "H", "H"]);
    expectPdfChartRow(["7", "7"], ["P", "P", "P", "P", "P", "P", "H", "H", "H", "H"]);
    expectPdfChartRow(["8", "8"], ["P", "P", "P", "P", "P", "P", "P", "P", "P", "R"]);
    expectPdfChartRow(["9", "9"], ["P", "P", "P", "P", "P", "S", "P", "P", "S", "S"]);
    expectPdfChartRow(["10", "10"], ["S", "S", "S", "S", "S", "S", "S", "S", "S", "S"]);
    expectPdfChartRow(["A", "A"], ["P", "P", "P", "P", "P", "P", "P", "P", "P", "P"]);
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
