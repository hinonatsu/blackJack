import type { Card, Rank } from "../../types/card";
import type { PlayerAction } from "../../types/game";
import type { DealerSoft17Rule } from "../../types/rules";

/** All practice surfaces represented in the home-screen score cards. */
export const TRAINING_MODES = [
  "basic",
  "speed",
  "hilo",
  "true-count",
  "full-table",
  "deviations",
  "weakness-review",
] as const;

export type TrainingMode = (typeof TRAINING_MODES)[number];

export type HandKind = "hard" | "soft" | "pair";

/**
 * A deliberately UI-neutral description of a basic-strategy decision.
 * Components can render this as cards, compact text, or a casino table hand.
 */
export interface StrategySituation {
  handKind: HandKind;
  /** The hand total. For a pair, this is the value of the two-card hand. */
  total: number;
  /** Present only for a pair; Ace is represented as "A". */
  pairRank?: Rank;
  /** Dealer Ace is represented as 11. */
  dealerValue: number;
  /** Human-readable casino notation, e.g. "Soft 18" or "8,8". */
  playerLabel: string;
  dealerLabel: string;
}

export interface StrategyQuestion {
  id: string;
  kind: "strategy";
  situation: StrategySituation;
  /** Ready for the shared PlayingCard / Hand components. */
  playerCards: Card[];
  dealerUpcard: Card;
  expectedAction: PlayerAction;
  reason?: string;
  createdAt: number;
}

interface CountQuestionBase {
  id: string;
  level: 1 | 2 | 3 | 4;
  /** Ranks are enough to calculate Hi-Lo and let the UI choose suits freely. */
  ranks: Rank[];
  /** The count before this sequence starts. */
  startingRunningCount: number;
  /** Net Hi-Lo change contributed by all visible cards in `ranks`. */
  sequenceDelta: number;
  expectedRunningCount: number;
  createdAt: number;
}

export interface CountSequenceQuestion extends CountQuestionBase {
  kind: "count-sequence";
}

export interface CountTableSeat {
  label: string;
  ranks: Rank[];
}

/** A table-shaped count drill for Levels 3 and 4. */
export interface TableCountQuestion extends CountQuestionBase {
  kind: "count-table";
  dealerRanks: Rank[];
  playerSeats: CountTableSeat[];
}

export type TrueCountRounding = "truncate" | "floor" | "nearest";

export interface DeckEstimationQuestion {
  id: string;
  kind: "deck-estimation";
  totalDecks: number;
  /** In 0.5-deck increments for realistic visual estimation practice. */
  decksRemaining: number;
  decksDiscarded: number;
  remainingRatio: number;
  createdAt: number;
}

export interface TrueCountQuestion {
  id: string;
  kind: "true-count";
  runningCount: number;
  decksRemaining: number;
  rawTrueCount: number;
  /** Answer accepted by the drill according to `rounding`. */
  expectedTrueCount: number;
  rounding: TrueCountRounding;
  /** A shoe visual can be reused by Realistic True Count mode. */
  deckEstimate: DeckEstimationQuestion;
  createdAt: number;
}

export type DeviationAction = PlayerAction | "INSURANCE" | "NO_INSURANCE";

export interface DeviationDefinition {
  id?: string;
  playerHand: string;
  dealerUpcard: number | "A";
  index: number;
  /** Optional rule-specific index entries, used by the published H17 variants. */
  indexBySoft17?: Readonly<Partial<Record<DealerSoft17Rule, number>>>;
  actionBelowIndex: DeviationAction;
  actionAtOrAboveIndex: DeviationAction;
  label?: string;
  source?: string;
}

export interface DeviationQuestion {
  id: string;
  kind: "deviation";
  deviation: DeviationDefinition;
  trueCount: number;
  /** The selected index after applying the table's S17 / H17 setting. */
  effectiveIndex: number;
  expectedAction: DeviationAction;
  createdAt: number;
}

export type WeaknessDimension =
  | "situation"
  | "player-total"
  | "dealer-upcard"
  | "hand-kind"
  | "counting"
  | "true-count"
  | "deviation";

export interface WeaknessContext {
  key: string;
  dimension: WeaknessDimension;
  label: string;
  /** Optional data the caller can use to create a focused replacement question. */
  situation?: StrategySituation;
}

export interface TrainingAttempt {
  id?: string;
  mode: TrainingMode;
  correct: boolean;
  /** Omit when a drill is not timed rather than storing a misleading zero. */
  responseMs?: number;
  answeredAt?: number;
  weaknesses?: WeaknessContext[];
}

export interface ModeStats {
  attempts: number;
  correct: number;
  totalResponseMs: number;
  timedAttempts: number;
  currentStreak: number;
  bestStreak: number;
}

export interface WeaknessStat extends WeaknessContext {
  attempts: number;
  correct: number;
  incorrect: number;
  totalResponseMs: number;
  timedAttempts: number;
  lastSeenAt: number;
}

export interface AttemptHistoryItem {
  id: string;
  mode: TrainingMode;
  correct: boolean;
  responseMs?: number;
  answeredAt: number;
  weaknessKeys: string[];
}

export interface TrainingSessionState {
  version: 2;
  createdAt: number;
  updatedAt: number;
  modeStats: Record<TrainingMode, ModeStats>;
  /** Per-calendar-day totals, retained for the 7-day growth view. */
  dailyStats: Record<string, Record<TrainingMode, ModeStats>>;
  weaknesses: Record<string, WeaknessStat>;
  /** Kept intentionally short: enough for a compact recent-activity UI, not analytics. */
  recentAttempts: AttemptHistoryItem[];
}

export interface ModePerformance extends ModeStats {
  accuracy: number;
  averageResponseMs: number | null;
}

export interface WeaknessReview extends WeaknessStat {
  accuracy: number;
  averageResponseMs: number | null;
}

export interface DailyProgress {
  /** Local calendar date in YYYY-MM-DD form. */
  date: string;
  attempts: number;
  correct: number;
  accuracy: number;
  averageResponseMs: number | null;
}

export interface WeeklyProgress {
  days: DailyProgress[];
  activeDays: number;
  attempts: number;
  correct: number;
  accuracy: number;
  averageResponseMs: number | null;
  /** Latest active day minus earliest active day in percentage points. */
  accuracyChange: number | null;
  /** Latest active day minus earliest active day in milliseconds. */
  responseTimeChangeMs: number | null;
}
