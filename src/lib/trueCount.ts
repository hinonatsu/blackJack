import type { ShoeState } from "@/types/game";

/**
 * Rounding is kept separate from calculation. The UI can show the raw decimal
 * TC while index drills request FLOOR, the convention used for the included
 * Hi-Lo index tables.
 */
export type TrueCountRounding = "NONE" | "FLOOR" | "TRUNCATE" | "NEAREST";

export function calculateTrueCount(
  runningCount: number,
  decksRemaining: number,
  rounding: TrueCountRounding = "NONE",
): number {
  if (!Number.isFinite(runningCount)) throw new Error("runningCount must be finite.");
  if (!Number.isFinite(decksRemaining) || decksRemaining <= 0) {
    throw new Error("decksRemaining must be a finite number greater than zero.");
  }
  return roundTrueCount(runningCount / decksRemaining, rounding);
}

export function roundTrueCount(trueCount: number, rounding: TrueCountRounding = "NONE"): number {
  if (!Number.isFinite(trueCount)) throw new Error("trueCount must be finite.");
  switch (rounding) {
    case "NONE":
      return trueCount;
    case "FLOOR":
      return Math.floor(trueCount);
    case "TRUNCATE":
      return Math.trunc(trueCount);
    case "NEAREST":
      return Math.round(trueCount);
  }
}

export function decksRemainingFromCards(cardsRemaining: number): number {
  if (!Number.isFinite(cardsRemaining) || cardsRemaining < 0) {
    throw new Error("cardsRemaining must be a non-negative finite number.");
  }
  return cardsRemaining / 52;
}

export function calculateTrueCountFromShoe(
  runningCount: number,
  shoe: Pick<ShoeState, "cards">,
  rounding: TrueCountRounding = "NONE",
): number {
  return calculateTrueCount(runningCount, decksRemainingFromCards(shoe.cards.length), rounding);
}

/** Round a visual deck estimate to the half-deck resolution used in realistic drills. */
export function nearestHalfDeck(decksRemaining: number): number {
  if (!Number.isFinite(decksRemaining) || decksRemaining < 0) {
    throw new Error("decksRemaining must be a non-negative finite number.");
  }
  return Math.round(decksRemaining * 2) / 2;
}
