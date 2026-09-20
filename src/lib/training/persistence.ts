import { createTrainingSession, TRAINING_SESSION_VERSION } from "./session";
import {
  TRAINING_MODES,
  type ModeStats,
  type TrainingMode,
  type TrainingSessionState,
  type WeaknessStat,
} from "./types";

/** Tab-scoped by design: practice results survive refreshes, not indefinitely. */
export const TRAINING_SESSION_STORAGE_KEY = "vegas-blackjack-trainer:session:v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserSessionStorage(): StorageLike | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    return window.sessionStorage;
  } catch {
    // Storage can be blocked in privacy contexts. The app should still practice in memory.
    return undefined;
  }
}

function finiteNonNegative(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function safeModeStats(value: unknown): ModeStats {
  const input = value && typeof value === "object" ? (value as Partial<ModeStats>) : {};
  const attempts = Math.floor(finiteNonNegative(input.attempts));
  const correct = Math.min(attempts, Math.floor(finiteNonNegative(input.correct)));
  const timedAttempts = Math.min(attempts, Math.floor(finiteNonNegative(input.timedAttempts)));
  const currentStreak = Math.min(attempts, Math.floor(finiteNonNegative(input.currentStreak)));
  const bestStreak = Math.min(attempts, Math.floor(finiteNonNegative(input.bestStreak)));

  return {
    attempts,
    correct,
    totalResponseMs: finiteNonNegative(input.totalResponseMs),
    timedAttempts,
    currentStreak,
    bestStreak,
  };
}

function safeWeaknesses(value: unknown): Record<string, WeaknessStat> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const entries = Object.entries(value as Record<string, unknown>).flatMap(([key, candidate]) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const input = candidate as Partial<WeaknessStat>;
    if (typeof input.label !== "string" || typeof input.dimension !== "string") return [];
    const attempts = Math.floor(finiteNonNegative(input.attempts));
    const correct = Math.min(attempts, Math.floor(finiteNonNegative(input.correct)));
    const weakness: WeaknessStat = {
      key,
      dimension: input.dimension as WeaknessStat["dimension"],
      label: input.label,
      ...(input.situation ? { situation: input.situation } : {}),
      attempts,
      correct,
      // Derived rather than trusted so a manually altered storage entry cannot
      // make accuracy and error totals disagree.
      incorrect: attempts - correct,
      totalResponseMs: finiteNonNegative(input.totalResponseMs),
      timedAttempts: Math.min(attempts, Math.floor(finiteNonNegative(input.timedAttempts))),
      lastSeenAt: finiteNonNegative(input.lastSeenAt),
    };
    return [[key, weakness] as const];
  });

  return Object.fromEntries(entries);
}

function isTrainingMode(value: unknown): value is TrainingMode {
  return typeof value === "string" && (TRAINING_MODES as readonly string[]).includes(value);
}

function safeRecentAttempts(value: unknown): TrainingSessionState["recentAttempts"] {
  if (!Array.isArray(value)) return [];

  return value
    .flatMap((candidate) => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
      const input = candidate as Partial<TrainingSessionState["recentAttempts"][number]>;
      if (typeof input.id !== "string" || !isTrainingMode(input.mode) || typeof input.correct !== "boolean") {
        return [];
      }
      const responseMs = finiteNonNegative(input.responseMs, Number.NaN);
      return [
        {
          id: input.id,
          mode: input.mode,
          correct: input.correct,
          ...(Number.isNaN(responseMs) ? {} : { responseMs }),
          answeredAt: finiteNonNegative(input.answeredAt),
          weaknessKeys: Array.isArray(input.weaknessKeys)
            ? input.weaknessKeys.filter((key): key is string => typeof key === "string")
            : [],
        },
      ];
    })
    .slice(-100);
}

/**
 * Parses only the small schema we own. A stale or edited storage record simply
 * becomes a new session rather than breaking the home screen.
 */
export function parseTrainingSession(raw: string, fallbackNow = Date.now()): TrainingSessionState | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const input = parsed as Partial<TrainingSessionState>;
    if (input.version !== TRAINING_SESSION_VERSION) return null;

    const modeStatsInput = input.modeStats && typeof input.modeStats === "object" ? input.modeStats : {};
    const modeStats = Object.fromEntries(
      TRAINING_MODES.map((mode) => [
        mode,
        safeModeStats((modeStatsInput as Partial<Record<TrainingMode, unknown>>)[mode]),
      ]),
    ) as Record<TrainingMode, ModeStats>;

    return {
      version: TRAINING_SESSION_VERSION,
      createdAt: finiteNonNegative(input.createdAt, fallbackNow),
      updatedAt: finiteNonNegative(input.updatedAt, fallbackNow),
      modeStats,
      weaknesses: safeWeaknesses(input.weaknesses),
      recentAttempts: safeRecentAttempts(input.recentAttempts),
    };
  } catch {
    return null;
  }
}

export function loadTrainingSession(
  storage: StorageLike | undefined = browserSessionStorage(),
  key = TRAINING_SESSION_STORAGE_KEY,
  now = Date.now(),
): TrainingSessionState {
  if (!storage) return createTrainingSession(now);

  try {
    const raw = storage.getItem(key);
    return raw ? parseTrainingSession(raw, now) ?? createTrainingSession(now) : createTrainingSession(now);
  } catch {
    return createTrainingSession(now);
  }
}

/** Returns false instead of throwing when browser storage is unavailable. */
export function saveTrainingSession(
  session: TrainingSessionState,
  storage: StorageLike | undefined = browserSessionStorage(),
  key = TRAINING_SESSION_STORAGE_KEY,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export function clearTrainingSession(
  storage: StorageLike | undefined = browserSessionStorage(),
  key = TRAINING_SESSION_STORAGE_KEY,
): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
