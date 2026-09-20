import type { Card, Rank } from "@/types/card";

export type HiLoValue = -1 | 0 | 1;
export type CardOrRank = Card | Rank;

/**
 * Hi-Lo tags: 2–6 = +1, 7–9 = 0, and ten-valued cards/A = -1.
 * This is the balanced Hi-Lo system used by the trainer's true-count drills.
 */
export function hiLoValue(cardOrRank: CardOrRank): HiLoValue {
  const rank = typeof cardOrRank === "string" ? cardOrRank : cardOrRank.rank;
  if (rank === "2" || rank === "3" || rank === "4" || rank === "5" || rank === "6") return 1;
  if (rank === "7" || rank === "8" || rank === "9") return 0;
  return -1;
}

export function applyHiLoCard(runningCount: number, cardOrRank: CardOrRank): number {
  assertFiniteCount(runningCount);
  return runningCount + hiLoValue(cardOrRank);
}

export function applyHiLoCards(initialRunningCount: number, cards: readonly CardOrRank[]): number {
  return cards.reduce((runningCount, card) => applyHiLoCard(runningCount, card), initialRunningCount);
}

export function runningCountForCards(cards: readonly CardOrRank[]): number {
  return applyHiLoCards(0, cards);
}

export interface CountStep {
  card: CardOrRank;
  delta: HiLoValue;
  runningCount: number;
}

/** A review-friendly audit trail, e.g. 5 → +1, K → 0. */
export function countSteps(cards: readonly CardOrRank[], initialRunningCount = 0): CountStep[] {
  let runningCount = initialRunningCount;
  return cards.map((card) => {
    const delta = hiLoValue(card);
    runningCount += delta;
    return { card, delta, runningCount };
  });
}

function assertFiniteCount(value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error("runningCount must be finite.");
  }
}
