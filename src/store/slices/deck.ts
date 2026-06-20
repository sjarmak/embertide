import type { Card } from '../../types/card';

/**
 * Starter shard-generator templates.
 *
 * These do not appear in KID_CARDS by design — they are pure mechanical
 * filler for each player's 10-card starter deck. When played they grant +1
 * green or +1 red respectively.
 */
export const STARTER_GREEN: Card = {
  id: 'starter-green-shard',
  role: 'starter-green',
  cost: {},
  effects: { kind: 'shard', green: 1 },
};

export const STARTER_RED: Card = {
  id: 'starter-red-shard',
  role: 'starter-red',
  cost: {},
  effects: { kind: 'shard', red: 1 },
};

/**
 * Starter deck composition (designer direction 2026-04-24): 5 gems
 * (starter-green) + 5 power (starter-red) = 10 cards, no champion-
 * specific hero card. The previous 7g/2r/1-hero mix drew the champion
 * hero into the opening hand, which the designer rejected — heroes are
 * acquired from the market, not handed out in the starter.
 *
 * Follow-up (j49z, 2026-04-24): the `starter-home` role and its four
 * card entries (spirit-arrow, seer-rune, warblade, ancient-keepsake)
 * were retired entirely. The bespoke rasters live on as portrait-only
 * art keyed by champion via `portraitCardId` in src/data/champions.ts,
 * surfaced in the Setup champion picker only.
 */
export const STARTER_GREEN_COUNT = 5;
export const STARTER_RED_COUNT = 5;
export const DRAW_SIZE = 5;

interface PlayerDeckView {
  readonly deck: readonly Card[];
  readonly hand: readonly Card[];
  readonly discard: readonly Card[];
}

/**
 * Fisher–Yates shuffle using the supplied PRNG. Returns a NEW array.
 */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Build a 10-card starter deck: 5 gems (starter-green) + 5 power
 * (starter-red), shuffled. Designer direction 2026-04-24: the starter
 * deck no longer includes a champion-specific hero card — heroes are
 * acquired from the market.
 */
export function buildStarterDeck(rng: () => number): Card[] {
  const cards: Card[] = [];
  for (let i = 0; i < STARTER_GREEN_COUNT; i += 1) cards.push(STARTER_GREEN);
  for (let i = 0; i < STARTER_RED_COUNT; i += 1) cards.push(STARTER_RED);
  return shuffle(cards, rng);
}

/**
 * Draw up to `count` cards from `deck` into `hand`. If the deck is exhausted
 * while drawing AND the discard is non-empty, reshuffles the discard into the
 * deck (using `rng`) and continues drawing. Returns a new deck view — NEVER
 * mutates inputs.
 */
export function drawCards(view: PlayerDeckView, count: number, rng: () => number): PlayerDeckView {
  let deck = view.deck.slice();
  let discard = view.discard.slice();
  const hand: Card[] = view.hand.slice();

  for (let i = 0; i < count; i += 1) {
    if (deck.length === 0) {
      if (discard.length === 0) break;
      deck = shuffle(discard, rng);
      discard = [];
    }
    const card = deck.shift();
    if (!card) break;
    hand.push(card);
  }

  return { deck, hand, discard };
}

/**
 * Draw up to 5 cards for the player, returning a new deck view. Wraps
 * `drawCards` with the DRAW_SIZE constant for the Kid-Mode cadence.
 */
export function drawFiveFor(view: PlayerDeckView, rng: () => number): PlayerDeckView {
  return drawCards(view, DRAW_SIZE, rng);
}
