import { createCard } from "@/lib/deck";
import type { Card, Rank, Suit } from "@/types/card";

let serial = 0;

export function card(rank: Rank, suit: Suit = "spades"): Card {
  serial += 1;
  return createCard(rank, suit, 0, `test-${serial}-${rank}-${suit}`);
}

export function cards(...ranks: Rank[]): Card[] {
  return ranks.map((rank, index) => card(rank, index % 2 === 0 ? "spades" : "hearts"));
}
