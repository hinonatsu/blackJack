import { describe, expect, it } from "vitest";

import { loadTrainingSession, saveTrainingSession, type StorageLike } from "./persistence";
import {
  createTrainingSession,
  getModePerformance,
  getWeaknessReview,
  recordTrainingAttempt,
  strategyWeaknessContexts,
} from "./session";

describe("training session", () => {
  it("keeps accuracy, average answer time, and streaks per mode", () => {
    const first = recordTrainingAttempt(
      createTrainingSession(100),
      { mode: "speed", correct: true, responseMs: 800, answeredAt: 200 },
    );
    const second = recordTrainingAttempt(
      first,
      { mode: "speed", correct: false, responseMs: 1_200, answeredAt: 300 },
    );
    const stats = getModePerformance(second.modeStats.speed);

    expect(stats).toMatchObject({
      attempts: 2,
      correct: 1,
      currentStreak: 0,
      bestStreak: 1,
      accuracy: 0.5,
      averageResponseMs: 1_000,
    });
  });

  it("records a focused situation plus required aggregate weakness dimensions", () => {
    const situation = {
      handKind: "soft" as const,
      total: 18,
      dealerValue: 9,
      playerLabel: "Soft 18",
      dealerLabel: "9",
    };
    const contexts = strategyWeaknessContexts(situation);
    const session = recordTrainingAttempt(
      createTrainingSession(100),
      { mode: "basic", correct: false, weaknesses: contexts, answeredAt: 200 },
    );
    const review = getWeaknessReview(session, { dimensions: ["situation"] });

    expect(contexts).toHaveLength(4);
    expect(review).toHaveLength(1);
    expect(review[0]).toMatchObject({
      label: "Soft 18 vs Dealer 9",
      incorrect: 1,
      accuracy: 0,
    });
  });

  it("round-trips safely through tab-scoped storage", () => {
    const values = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => void values.set(key, value),
      removeItem: (key) => void values.delete(key),
    };
    const session = recordTrainingAttempt(
      createTrainingSession(100),
      { mode: "hilo", correct: true, responseMs: 700, answeredAt: 200 },
    );

    expect(saveTrainingSession(session, storage, "test-session")).toBe(true);
    expect(loadTrainingSession(storage, "test-session", 300).modeStats.hilo).toMatchObject({
      attempts: 1,
      correct: 1,
      totalResponseMs: 700,
    });
  });
});
