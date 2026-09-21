import { describe, expect, it } from "vitest";

import { loadTrainingSession, parseTrainingSession, saveTrainingSession, type StorageLike } from "./persistence";
import {
  createTrainingSession,
  getModePerformance,
  getWeeklyProgress,
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

  it("keeps seven daily totals so weekly accuracy and response-time changes are measurable", () => {
    const firstDay = new Date(2026, 8, 20, 12).getTime();
    const latestDay = new Date(2026, 8, 21, 12).getTime();
    const first = recordTrainingAttempt(
      createTrainingSession(firstDay),
      { mode: "basic", correct: false, responseMs: 1_200, answeredAt: firstDay },
    );
    const latest = recordTrainingAttempt(
      first,
      { mode: "speed", correct: true, responseMs: 800, answeredAt: latestDay },
    );
    const progress = getWeeklyProgress(latest, latestDay);

    expect(progress).toMatchObject({
      activeDays: 2,
      attempts: 2,
      correct: 1,
      accuracy: 0.5,
      averageResponseMs: 1_000,
      accuracyChange: 100,
      responseTimeChangeMs: -400,
    });
    expect(progress.days.at(-1)).toMatchObject({ attempts: 1, correct: 1, accuracy: 1 });
  });

  it("round-trips safely through persistent browser storage", () => {
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

  it("rebuilds daily progress from a legacy session's recent answers", () => {
    const answeredAt = new Date(2026, 8, 21, 12).getTime();
    const legacy = JSON.stringify({
      version: 1,
      createdAt: answeredAt,
      updatedAt: answeredAt,
      modeStats: {},
      weaknesses: {},
      recentAttempts: [
        { id: "legacy-1", mode: "basic", correct: true, responseMs: 900, answeredAt, weaknessKeys: [] },
      ],
    });
    const migrated = parseTrainingSession(legacy, answeredAt);

    expect(migrated?.version).toBe(2);
    expect(getWeeklyProgress(migrated!, answeredAt).days.at(-1)).toMatchObject({
      attempts: 1,
      correct: 1,
      averageResponseMs: 900,
    });
  });
});
