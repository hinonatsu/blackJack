/** A standard playing-card suit. The explicit names keep UI color decisions out of game logic. */
export const SUITS = ["clubs", "diamonds", "hearts", "spades"] as const;
export type Suit = (typeof SUITS)[number];

/** Ranks use the labels players see on a casino card. */
export const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
] as const;
export type Rank = (typeof RANKS)[number];

/**
 * `id` is unique even in a multi-deck shoe. `deckIndex` is zero based and is
 * useful for diagnostics; game rules must never use it to distinguish cards.
 */
export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
  deckIndex: number;
}

/** The minimum blackjack value for a rank. Ace promotion to 11 is handled by hand evaluation. */
export function blackjackCardValue(rank: Rank): number {
  if (rank === "A") return 1;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  return Number(rank);
}

export function isTenValueRank(rank: Rank): boolean {
  return rank === "10" || rank === "J" || rank === "Q" || rank === "K";
}

export function suitSymbol(suit: Suit): string {
  switch (suit) {
    case "clubs":
      return "♣";
    case "diamonds":
      return "♦";
    case "hearts":
      return "♥";
    case "spades":
      return "♠";
  }
}

export function cardLabel(card: Pick<Card, "rank" | "suit">): string {
  return `${card.rank}${suitSymbol(card.suit)}`;
}
