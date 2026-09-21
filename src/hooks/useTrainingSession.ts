"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { clearTrainingSession, loadTrainingSession, saveTrainingSession, type StorageLike } from "../lib/training/persistence";
import {
  createTrainingSession,
  getAllModePerformance,
  getWeeklyProgress,
  getWeaknessReview,
  recordTrainingAttempt,
  type WeaknessReviewOptions,
} from "../lib/training/session";
import type {
  TrainingAttempt,
  TrainingSessionState,
  WeaknessReview,
} from "../lib/training/types";
import type { PlayerAction } from "../types/game";

export interface UseTrainingSessionOptions {
  /** Override only for an isolated training profile or a test. */
  storageKey?: string;
  /** An in-memory StorageLike makes this hook easy to test without jsdom. */
  storage?: StorageLike;
  weaknessOptions?: WeaknessReviewOptions;
}

export interface TrainingSessionController {
  session: TrainingSessionState;
  hydrated: boolean;
  modePerformance: ReturnType<typeof getAllModePerformance>;
  weeklyProgress: ReturnType<typeof getWeeklyProgress>;
  weaknessReview: WeaknessReview[];
  recordAttempt: (attempt: TrainingAttempt) => void;
  resetSession: () => void;
}

/**
 * Browser-persistent state for all practice modes. It starts safely during SSR,
 * hydrates from localStorage on mount, and persists each completed answer.
 */
export function useTrainingSession(
  options: UseTrainingSessionOptions = {},
): TrainingSessionController {
  const { storage, storageKey, weaknessOptions } = options;
  const [session, setSession] = useState<TrainingSessionState>(() => createTrainingSession());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSession(loadTrainingSession(storage, storageKey));
    setHydrated(true);
  }, [storage, storageKey]);

  useEffect(() => {
    if (hydrated) {
      saveTrainingSession(session, storage, storageKey);
    }
  }, [hydrated, session, storage, storageKey]);

  const recordAttempt = useCallback((attempt: TrainingAttempt) => {
    setSession((current) => recordTrainingAttempt(current, attempt));
  }, []);

  const resetSession = useCallback(() => {
    clearTrainingSession(storage, storageKey);
    setSession(createTrainingSession());
  }, [storage, storageKey]);

  const modePerformance = useMemo(() => getAllModePerformance(session), [session]);
  const weeklyProgress = useMemo(() => getWeeklyProgress(session), [session]);
  const weaknessReview = useMemo(
    () => getWeaknessReview(session, weaknessOptions),
    [session, weaknessOptions],
  );

  return {
    session,
    hydrated,
    modePerformance,
    weeklyProgress,
    weaknessReview,
    recordAttempt,
    resetSession,
  };
}

export type ResponseSpeedBand = "under-1" | "one-to-one-point-five" | "one-point-five-to-two" | "over-2";

/** Matches the Speed Strategy thresholds from the practice brief. */
export function getResponseSpeedBand(responseMs: number): ResponseSpeedBand {
  if (responseMs < 1_000) return "under-1";
  if (responseMs < 1_500) return "one-to-one-point-five";
  if (responseMs <= 2_000) return "one-point-five-to-two";
  return "over-2";
}

function monotonicNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

/** Small timer primitive for Strategy and Full Table answer timing. */
export function useResponseTimer() {
  const startedAt = useRef<number | null>(null);

  const start = useCallback(() => {
    startedAt.current = monotonicNow();
  }, []);

  const stop = useCallback((): number | null => {
    if (startedAt.current === null) return null;
    const elapsed = Math.max(0, Math.round(monotonicNow() - startedAt.current));
    startedAt.current = null;
    return elapsed;
  }, []);

  const reset = useCallback(() => {
    startedAt.current = null;
  }, []);

  return { start, stop, reset };
}

const KEYBOARD_ACTIONS: Record<string, PlayerAction> = {
  h: "HIT",
  s: "STAND",
  d: "DOUBLE",
  p: "SPLIT",
  r: "SURRENDER",
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Adds the casino-action shortcuts while deliberately leaving text fields and
 * dropdowns alone. The caller decides which actions are legal in the moment.
 */
export function useActionHotkeys(
  onAction: (action: PlayerAction) => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      const action = KEYBOARD_ACTIONS[event.key.toLowerCase()];
      if (!action) return;
      event.preventDefault();
      onAction(action);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onAction]);
}

/** Advances feedback screens with Space while preserving normal text input. */
export function useSpaceAdvance(callback: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      event.preventDefault();
      callback();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [callback, enabled]);
}

/** Schedules Fast Mode's short feedback pause and cleans up on question changes. */
export function useAutoAdvance(
  callback: () => void,
  enabled: boolean,
  delayMs = 650,
): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const timeout = window.setTimeout(callback, Math.max(0, delayMs));
    return () => window.clearTimeout(timeout);
  }, [callback, delayMs, enabled]);
}
