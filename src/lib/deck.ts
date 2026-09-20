import { RANKS, SUITS, type Card, type Rank, type Suit } from "@/types/card";
import type { ShoeState } from "@/types/game";
import type { BlackjackRules } from "@/types/rules";

export type RandomSource = () => number;

export function createCard(
  rank: Rank,
  suit: Suit,
  deckIndex = 0,
  id = `${deckIndex}-${suit}-${rank}`,
): Card {
  return { id, rank, suit, deckIndex };
}

/** Create ordered physical cards. Multi-deck copies have distinct ids. */
export function createDeck(deckCount = 1): Card[] {
  if (!Number.isInteger(deckCount) || deckCount < 1) {
    throw new Error("deckCount must be a positive integer.");
  }

  const cards: Card[] = [];
  for (let deckIndex = 0; deckIndex < deckCount; deckIndex += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push(createCard(rank, suit, deckIndex));
      }
    }
  }
  return cards;
}

/** Fisher-Yates shuffle. It returns a new array and never reorders the caller's cards. */
export function shuffle<T>(cards: readonly T[], random: RandomSource = Math.random): T[] {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    // Clamp custom RNGs so a malformed value cannot introduce an undefined card.
    const rawIndex = Math.floor(random() * (index + 1));
    const swapIndex = Math.min(index, Math.max(0, rawIndex));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function createShoe(
  rules: Pick<BlackjackRules, "deckCount" | "penetration">,
  random: RandomSource = Math.random,
): ShoeState {
  const cards = shuffle(createDeck(rules.deckCount), random);
  const initialCardCount = cards.length;
  return {
    cards,
    discardPile: [],
    initialCardCount,
    cutCardPosition: Math.floor(initialCardCount * rules.penetration),
    shuffleCount: 1,
  };
}

/** Number of cards that have left the draw stack during this shoe. */
export function dealtCardCount(shoe: ShoeState): number {
  return shoe.initialCardCount - shoe.cards.length;
}

/** The cut card is checked between rounds so an in-progress hand is never interrupted. */
export function shouldReshuffleBeforeRound(shoe: ShoeState): boolean {
  return dealtCardCount(shoe) >= shoe.cutCardPosition || shoe.cards.length === 0;
}

export interface DrawResult {
  card: Card;
  shoe: ShoeState;
}

/** Draw from the end of the draw stack, preserving the original shoe value. */
export function drawCard(shoe: ShoeState): DrawResult {
  const card = shoe.cards.at(-1);
  if (!card) {
    throw new Error("Cannot draw from an empty shoe.");
  }
  return {
    card,
    shoe: { ...shoe, cards: shoe.cards.slice(0, -1) },
  };
}

export interface DrawManyResult {
  cards: Card[];
  shoe: ShoeState;
}

export function drawCards(shoe: ShoeState, count: number): DrawManyResult {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("count must be a non-negative integer.");
  }
  if (count > shoe.cards.length) {
    throw new Error("Cannot draw more cards than remain in the shoe.");
  }

  let currentShoe = shoe;
  const cards: Card[] = [];
  for (let index = 0; index < count; index += 1) {
    const draw = drawCard(currentShoe);
    cards.push(draw.card);
    currentShoe = draw.shoe;
  }
  return { cards, shoe: currentShoe };
}

/** Move completed-hand cards into the discard tray without silently reshuffling. */
export function discardCards(shoe: ShoeState, cards: readonly Card[]): ShoeState {
  return { ...shoe, discardPile: [...shoe.discardPile, ...cards] };
}

/** Start a fresh shuffled shoe. `shuffleCount` is retained for session diagnostics. */
export function reshuffleShoe(
  previousShoe: ShoeState,
  rules: Pick<BlackjackRules, "deckCount" | "penetration">,
  random: RandomSource = Math.random,
): ShoeState {
  const shoe = createShoe(rules, random);
  return { ...shoe, shuffleCount: previousShoe.shuffleCount + 1 };
}

/** Useful for tests and audit displays: the physical makeup must never change on shuffle. */
export function cardComposition(cards: readonly Card[]): Map<string, number> {
  const composition = new Map<string, number>();
  for (const card of cards) {
    const key = `${card.rank}-${card.suit}`;
    composition.set(key, (composition.get(key) ?? 0) + 1);
  }
  return composition;
}
