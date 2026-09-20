import { describe, expect, it } from "vitest";

import { createDeck } from "@/lib/deck";
import { applyHiLoCards, countSteps, hiLoValue, runningCountForCards } from "@/lib/hiloCount";
import {
  calculateTrueCount,
  decksRemainingFromCards,
  nearestHalfDeck,
  roundTrueCount,
} from "@/lib/trueCount";
import { cards } from "./helpers";

describe("Hi-Lo", () => {
  it("assigns the standard tags", () => {
    expect(hiLoValue("2")).toBe(1);
    expect(hiLoValue("6")).toBe(1);
    expect(hiLoValue("7")).toBe(0);
    expect(hiLoValue("9")).toBe(0);
    expect(hiLoValue("10")).toBe(-1);
    expect(hiLoValue("K")).toBe(-1);
    expect(hiLoValue("A")).toBe(-1);
  });

  it("is balanced across a complete deck and exposes an audit trail", () => {
    expect(runningCountForCards(createDeck())).toBe(0);
    expect(applyHiLoCards(2, cards("5", "K", "8", "3"))).toBe(3);
    expect(countSteps(cards("5", "K", "8", "3"))).toMatchObject([
      { delta: 1, runningCount: 1 },
      { delta: -1, runningCount: 0 },
      { delta: 0, runningCount: 0 },
      { delta: 1, runningCount: 1 },
    ]);
  });
});

describe("true count", () => {
  it("calculates RC +6 / 3 decks as +2", () => {
    expect(calculateTrueCount(6, 3)).toBe(2);
  });

  it("makes rounding choice explicit", () => {
    expect(roundTrueCount(2.7, "FLOOR")).toBe(2);
    expect(roundTrueCount(-1.2, "FLOOR")).toBe(-2);
    expect(roundTrueCount(-1.2, "TRUNCATE")).toBe(-1);
    expect(calculateTrueCount(7, 4, "NEAREST")).toBe(2);
    expect(decksRemainingFromCards(130)).toBe(2.5);
    expect(nearestHalfDeck(2.26)).toBe(2.5);
  });
});
