import { describe, expect, it } from "vitest";

import {
  canTakeInsurance,
  createPlayerHand,
  dealerShouldHit,
  doubleHand,
  evaluateHand,
  isBlackjack,
  isBust,
  maxInsuranceWagerCents,
  playDealerHand,
  settleHand,
  settleInsurance,
  settleRound,
  splitHand,
  standHand,
  surrenderHand,
} from "@/lib/blackjackEngine";
import { mergeRules } from "@/types/rules";
import { cards } from "./helpers";

describe("hand evaluation", () => {
  it("handles soft and hard ace totals", () => {
    expect(evaluateHand(cards("A", "6"))).toMatchObject({ total: 17, hardTotal: 7, isSoft: true });
    expect(evaluateHand(cards("A", "6", "10"))).toMatchObject({ total: 17, hardTotal: 17, isSoft: false });
    expect(evaluateHand(cards("A", "A", "9"))).toMatchObject({ total: 21, isSoft: true });
  });

  it("recognizes a natural blackjack and a bust", () => {
    expect(isBlackjack(cards("A", "K"))).toBe(true);
    expect(isBlackjack(cards("A", "K", "2"))).toBe(false);
    expect(isBust(cards("K", "6", "8"))).toBe(true);
  });
});

describe("dealer play", () => {
  it("stands on soft 17 under S17", () => {
    const initial = cards("A", "6");
    expect(dealerShouldHit(initial, mergeRules({ dealerSoft17: "S17" }))).toBe(false);
    const result = playDealerHand(initial, mergeRules({ dealerSoft17: "S17" }), () => {
      throw new Error("S17 must not draw");
    });
    expect(result.cards).toHaveLength(2);
  });

  it("hits soft 17 under H17 and stops after the one forced draw", () => {
    const drawQueue = cards("10");
    const result = playDealerHand(cards("A", "6"), mergeRules({ dealerSoft17: "H17" }), () => {
      const next = drawQueue.shift();
      if (!next) throw new Error("unexpected draw");
      return next;
    });
    expect(result.drawnCards).toHaveLength(1);
    expect(result.value).toMatchObject({ total: 17, isSoft: false });
  });
});

describe("settlement", () => {
  const rules = mergeRules({ lateSurrender: true });

  it("settles normal wins, losses, and pushes in integer cents", () => {
    const winner = standHand(createPlayerHand(cards("K", "Q"), 500, { id: "win" }));
    const loser = standHand(createPlayerHand(cards("10", "6"), 500, { id: "loss" }));
    const push = standHand(createPlayerHand(cards("10", "8"), 500, { id: "push" }));
    const dealer18 = cards("10", "8");

    expect(settleHand({ player: winner, dealerCards: dealer18, rules })).toMatchObject({
      outcome: "WIN",
      returnedCents: 1000,
      profitCents: 500,
    });
    expect(settleHand({ player: loser, dealerCards: dealer18, rules })).toMatchObject({
      outcome: "LOSS",
      returnedCents: 0,
      profitCents: -500,
    });
    expect(settleHand({ player: push, dealerCards: dealer18, rules })).toMatchObject({
      outcome: "PUSH",
      returnedCents: 500,
      profitCents: 0,
    });
  });

  it("pays natural blackjacks at 3:2 and 6:5 without floats", () => {
    const blackjack = createPlayerHand(cards("A", "K"), 500, { id: "blackjack" });
    const dealer = cards("10", "7");

    expect(settleHand({ player: blackjack, dealerCards: dealer, rules: mergeRules({ blackjackPayout: "3:2" }) })).toMatchObject({
      outcome: "BLACKJACK",
      returnedCents: 1250,
      profitCents: 750,
    });
    expect(settleHand({ player: blackjack, dealerCards: dealer, rules: mergeRules({ blackjackPayout: "6:5" }) })).toMatchObject({
      outcome: "BLACKJACK",
      returnedCents: 1100,
      profitCents: 600,
    });
  });

  it("uses the doubled wager and settles independent split hands", () => {
    const doubled = doubleHand(createPlayerHand(cards("5", "5"), 500, { id: "double" }), cards("10")[0], rules);
    expect(settleHand({ player: doubled, dealerCards: cards("10", "8"), rules })).toMatchObject({
      outcome: "WIN",
      returnedCents: 2000,
      profitCents: 1000,
    });

    const pair = createPlayerHand(cards("8", "8"), 500, { id: "split" });
    const split = splitHand(pair, [cards("K")[0], cards("3")[0]], 1, rules).hands.map((hand) => standHand(hand));
    const settlement = settleRound(split, cards("10", "7"), rules);
    expect(settlement.hands.map((hand) => hand.outcome)).toEqual(["WIN", "LOSS"]);
    expect(settlement.returnedCents).toBe(1000);
    expect(settlement.profitCents).toBe(0);
  });

  it("returns half the wager for surrender and correctly handles insurance", () => {
    const surrender = surrenderHand(createPlayerHand(cards("10", "6"), 500, { id: "surrender" }), rules);
    expect(settleHand({ player: surrender, dealerCards: cards("10", "7"), rules })).toMatchObject({
      outcome: "SURRENDER",
      returnedCents: 250,
      profitCents: -250,
    });
    expect(settleInsurance(250, cards("A", "K"))).toMatchObject({
      outcome: "WIN",
      returnedCents: 750,
      profitCents: 500,
    });
    const eligibleHand = createPlayerHand(cards("10", "6"), 500);
    expect(maxInsuranceWagerCents(500)).toBe(250);
    expect(canTakeInsurance(cards("A")[0], eligibleHand, rules)).toBe(true);
    expect(canTakeInsurance(cards("10")[0], eligibleHand, rules)).toBe(false);
  });
});
