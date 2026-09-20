import {
  TRAINING_MODES,
  type AttemptHistoryItem,
  type ModePerformance,
  type ModeStats,
  type StrategySituation,
  type TrainingAttempt,
  type TrainingMode,
  type TrainingSessionState,
  type WeaknessContext,
  type WeaknessDimension,
  type WeaknessReview,
  type WeaknessStat,
} from "./types";

export const TRAINING_SESSION_VERSION = 1 as const;
export const RECENT_ATTEMPT_LIMIT = 100;

function createEmptyModeStats(): ModeStats {
  return {
    attempts: 0,
    correct: 0,
    totalResponseMs: 0,
    timedAttempts: 0,
    currentStreak: 0,
    bestStreak: 0,
  };
}

function createModeStatsRecord(): Record<TrainingMode, ModeStats> {
  return Object.fromEntries(
    TRAINING_MODES.map((mode) => [mode, createEmptyModeStats()]),
  ) as Record<TrainingMode, ModeStats>;
}

/** Creates a serializable blank state, suitable for an in-memory or browser session. */
export function createTrainingSession(now = Date.now()): TrainingSessionState {
  return {
    version: TRAINING_SESSION_VERSION,
    createdAt: now,
    updatedAt: now,
    modeStats: createModeStatsRecord(),
    weaknesses: {},
    recentAttempts: [],
  };
}

function normalizedResponseMs(responseMs: number | undefined): number | undefined {
  if (responseMs === undefined || !Number.isFinite(responseMs)) {
    return undefined;
  }

  return Math.max(0, Math.round(responseMs));
}

function updateModeStats(current: ModeStats | undefined, attempt: TrainingAttempt): ModeStats {
  const previous = current ?? createEmptyModeStats();
  const responseMs = normalizedResponseMs(attempt.responseMs);
  const currentStreak = attempt.correct ? previous.currentStreak + 1 : 0;

  return {
    attempts: previous.attempts + 1,
    correct: previous.correct + (attempt.correct ? 1 : 0),
    totalResponseMs: previous.totalResponseMs + (responseMs ?? 0),
    timedAttempts: previous.timedAttempts + (responseMs === undefined ? 0 : 1),
    currentStreak,
    bestStreak: Math.max(previous.bestStreak, currentStreak),
  };
}

function updateWeaknessStat(
  context: WeaknessContext,
  current: WeaknessStat | undefined,
  attempt: TrainingAttempt,
  answeredAt: number,
): WeaknessStat {
  const previous: WeaknessStat = current ?? {
    ...context,
    attempts: 0,
    correct: 0,
    incorrect: 0,
    totalResponseMs: 0,
    timedAttempts: 0,
    lastSeenAt: answeredAt,
  };
  const responseMs = normalizedResponseMs(attempt.responseMs);

  return {
    ...previous,
    // Labels may improve after a copy change; keep the latest wording.
    ...context,
    attempts: previous.attempts + 1,
    correct: previous.correct + (attempt.correct ? 1 : 0),
    incorrect: previous.incorrect + (attempt.correct ? 0 : 1),
    totalResponseMs: previous.totalResponseMs + (responseMs ?? 0),
    timedAttempts: previous.timedAttempts + (responseMs === undefined ? 0 : 1),
    lastSeenAt: answeredAt,
  };
}

function uniqueContexts(contexts: WeaknessContext[] | undefined): WeaknessContext[] {
  if (!contexts?.length) {
    return [];
  }

  const seen = new Set<string>();
  return contexts.filter((context) => {
    if (!context.key || seen.has(context.key)) {
      return false;
    }
    seen.add(context.key);
    return true;
  });
}

/**
 * Records one answer immutably. Consumers can keep this function outside React
 * to test session behavior without a DOM.
 */
export function recordTrainingAttempt(
  session: TrainingSessionState,
  attempt: TrainingAttempt,
  now = attempt.answeredAt ?? Date.now(),
): TrainingSessionState {
  const answeredAt = attempt.answeredAt ?? now;
  const contexts = uniqueContexts(attempt.weaknesses);
  const weaknesses = { ...session.weaknesses };

  for (const context of contexts) {
    weaknesses[context.key] = updateWeaknessStat(
      context,
      weaknesses[context.key],
      attempt,
      answeredAt,
    );
  }

  const historyItem: AttemptHistoryItem = {
    id: attempt.id ?? `${answeredAt}-${session.recentAttempts.length + 1}`,
    mode: attempt.mode,
    correct: attempt.correct,
    responseMs: normalizedResponseMs(attempt.responseMs),
    answeredAt,
    weaknessKeys: contexts.map((context) => context.key),
  };

  return {
    ...session,
    updatedAt: now,
    modeStats: {
      ...session.modeStats,
      [attempt.mode]: updateModeStats(session.modeStats[attempt.mode], attempt),
    },
    weaknesses,
    recentAttempts: [...session.recentAttempts, historyItem].slice(-RECENT_ATTEMPT_LIMIT),
  };
}

export function getModePerformance(stats: ModeStats): ModePerformance {
  return {
    ...stats,
    accuracy: stats.attempts === 0 ? 0 : stats.correct / stats.attempts,
    averageResponseMs:
      stats.timedAttempts === 0 ? null : stats.totalResponseMs / stats.timedAttempts,
  };
}

export function getAllModePerformance(
  session: TrainingSessionState,
): Record<TrainingMode, ModePerformance> {
  return Object.fromEntries(
    TRAINING_MODES.map((mode) => [
      mode,
      getModePerformance(session.modeStats[mode] ?? createEmptyModeStats()),
    ]),
  ) as Record<TrainingMode, ModePerformance>;
}

export function toWeaknessReview(stat: WeaknessStat): WeaknessReview {
  return {
    ...stat,
    accuracy: stat.attempts === 0 ? 0 : stat.correct / stat.attempts,
    averageResponseMs:
      stat.timedAttempts === 0 ? null : stat.totalResponseMs / stat.timedAttempts,
  };
}

export interface WeaknessReviewOptions {
  limit?: number;
  minAttempts?: number;
  /** Omit to show every tracked dimension; pass `situation` for focused drills. */
  dimensions?: WeaknessDimension[];
}

/**
 * Returns the most error-prone items first. Ties favor situations practiced more
 * often, so a one-off miss does not displace a durable weakness.
 */
export function getWeaknessReview(
  session: TrainingSessionState,
  options: WeaknessReviewOptions = {},
): WeaknessReview[] {
  const { limit = 8, minAttempts = 1, dimensions } = options;
  const allowedDimensions = dimensions ? new Set(dimensions) : undefined;

  return Object.values(session.weaknesses)
    .filter((stat) => stat.attempts >= minAttempts)
    .filter((stat) => !allowedDimensions || allowedDimensions.has(stat.dimension))
    .map(toWeaknessReview)
    .sort((left, right) => {
      const leftErrorRate = 1 - left.accuracy;
      const rightErrorRate = 1 - right.accuracy;
      if (rightErrorRate !== leftErrorRate) {
        return rightErrorRate - leftErrorRate;
      }
      if (right.attempts !== left.attempts) {
        return right.attempts - left.attempts;
      }
      return right.lastSeenAt - left.lastSeenAt;
    })
    .slice(0, Math.max(0, limit));
}

function stableDealerLabel(value: number): string {
  return value === 11 ? "A" : String(value);
}

function playerTotalLabel(situation: StrategySituation): string {
  if (situation.handKind === "pair") {
    return `Pair ${situation.playerLabel}`;
  }
  return `${situation.handKind === "soft" ? "Soft" : "Hard"} ${situation.total}`;
}

/**
 * Tracks the exact strategy scenario plus the aggregate dimensions requested in
 * the brief: player total, dealer upcard, and hard/soft/pair category.
 */
export function strategyWeaknessContexts(situation: StrategySituation): WeaknessContext[] {
  const player = playerTotalLabel(situation);
  const dealer = stableDealerLabel(situation.dealerValue);
  const handKindLabel =
    situation.handKind === "pair"
      ? "Pair"
      : situation.handKind === "soft"
        ? "Soft hand"
        : "Hard hand";
  const exactKey = [
    "strategy",
    situation.handKind,
    situation.pairRank ?? situation.total,
    dealer,
  ].join(":");

  return [
    {
      key: exactKey,
      dimension: "situation",
      label: `${player} vs Dealer ${dealer}`,
      situation,
    },
    {
      key: `strategy:total:${situation.handKind}:${situation.pairRank ?? situation.total}`,
      dimension: "player-total",
      label: player,
    },
    {
      key: `strategy:dealer:${dealer}`,
      dimension: "dealer-upcard",
      label: `Dealer ${dealer}`,
    },
    {
      key: `strategy:kind:${situation.handKind}`,
      dimension: "hand-kind",
      label: handKindLabel,
    },
  ];
}

export function countingWeaknessContext(label = "Running Count"): WeaknessContext {
  return { key: "counting:running-count", dimension: "counting", label };
}

export function trueCountWeaknessContext(label = "True Count"): WeaknessContext {
  return { key: "true-count:calculation", dimension: "true-count", label };
}

export function deviationWeaknessContext(
  deviationId: string,
  label: string,
): WeaknessContext {
  return {
    key: `deviation:${deviationId}`,
    dimension: "deviation",
    label,
  };
}
