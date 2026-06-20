/**
 * Combat-deck assembly + draw helpers (§B2).
 *
 * Pure functions that build the combat deck from a `KidGameState`
 * snapshot, deal the initial draw, and refill the combat hand
 * (with a deterministic discard→deck reshuffle when needed).
 */

import type { Card } from '../../types/card';
import type { CombatEntryContext } from '../../types/combat';
import type { KidGameState, KidPlayer } from '../../store/types';
import { createSeededRng } from '../../rules/chestPool';
import { COMBAT_HAND_CAP, COMBAT_INITIAL_DRAW } from '../balance';
import { baseIdOf, isActiveItemCard, isCombatEligibleStarterRole, isWispCard } from './identity';

/**
 * Gather all cards from a single player's zones that contribute to
 * the combat deck.
 *
 * Designer playtest 2026-04-22 (rev-2) relaxed the original §B2 rule
 * so every hero the player OWNS reaches combat, not only the ones
 * they happened to play this turn. Before: heroes bought from the
 * market but still sitting in `deck`/`discard`/`hand` were invisible
 * to combat unless the player spent a setup turn playing them first —
 * a hidden "staging turn" trap. Now the combat deck pulls heroes
 * from all four main-board zones. Contract:
 *   - Heroes from `deck`, `discard`, `hand`, `inPlay` — any copy of
 *     any hero the player owns at combat entry is eligible.
 *   - item-active items from `items` (not fairies).
 *   - championSlot hero resolution lives in `findChampionSlotHero`
 *     below; called separately by `buildCombatDeck`.
 */
function gatherPlayerContributions(player: KidPlayer): Card[] {
  const contributions: Card[] = [];

  // Heroes live in every main-board zone at combat entry. A hero
  // card in the main-board `deck` / `discard` / `hand` is a card the
  // player owns; there is no design reason it should be ineligible
  // for combat just because the player hasn't re-drawn or played it
  // this turn.
  for (const zone of [player.deck, player.hand, player.discard, player.inPlay] as const) {
    for (const card of zone) {
      if (card.role === 'hero') {
        contributions.push(card);
      }
    }
  }

  for (const card of player.items) {
    if (isActiveItemCard(card) && !isWispCard(card)) {
      contributions.push(card);
    }
  }

  return contributions;
}

/**
 * Aggregate every starter card in play across every player zone.
 * Starter cards are role-eligible regardless of which zone they
 * happen to sit in at combat entry (deck / hand / discard /
 * inPlay) — §B2's "excluded main-board draw deck" rule is about
 * *non-starter* cards sitting in those zones, not the starters
 * themselves.
 */
function gatherStarterCards(players: readonly KidPlayer[]): Card[] {
  const starters: Card[] = [];
  for (const player of players) {
    for (const zone of [player.deck, player.hand, player.discard, player.inPlay] as const) {
      for (const card of zone) {
        if (isCombatEligibleStarterRole(card.role)) {
          starters.push(card);
        }
      }
    }
  }
  return starters;
}

/**
 * Resolve the championSlot hero card for a player.
 *
 * §B2 names the championSlot hero as an explicit eligibility source,
 * separate from `inPlay`. The champion identity lives on
 * `player.championSlot` (a `ChampionId`); the actual hero card with
 * that identity typically lives in the player's deck / hand /
 * discard / inPlay. We scan every player zone (plus `items`, for
 * safety) looking for a hero card whose id base matches the
 * championSlot identity. The first match wins.
 *
 * Implementation note: championSlot is a `ChampionId` literal like
 * `'champion-sword'`. The hero cards authored in `src/data/cards.ts`
 * use different ids (e.g. `'sage-keeper'`). The championSlot-hero
 * lookup is data-layer territory (u-8d), so for u-8b we conservatively
 * emit the championSlot hero ONLY when a card whose `baseIdOf(id)`
 * matches the championSlot string is found in the zones we scan.
 * If no such card exists, the championSlot hero simply does not
 * contribute — tests and future data drops can assert the exact rule.
 */
function findChampionSlotHero(player: KidPlayer): Card | null {
  if (player.championSlot == null) return null;
  const target = player.championSlot;
  const zones = [player.deck, player.hand, player.discard, player.inPlay, player.items] as const;
  for (const zone of zones) {
    for (const card of zone) {
      if (card.role === 'hero' && baseIdOf(card.id) === target) {
        return card;
      }
    }
  }
  return null;
}

/**
 * Fisher–Yates shuffle. Pure: returns a new array; input is
 * untouched.
 */
function shuffle<T>(items: readonly T[], rng: () => number): T[] {
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
 * Mulberry32 seeded PRNG. The codebase already exposes the
 * implementation as `createSeededRng` in `src/rules/chestPool.ts`;
 * this alias names it after the algorithm for clarity at combat
 * call sites, matching the PRD wording "mulberry32(state.seed +
 * combatEntryTurn)".
 */
export const mulberry32 = createSeededRng;

/**
 * Assemble the combat deck from the current `KidGameState` per §B2.
 *
 * Eligibility:
 *   - INCLUDED: starter cards (role starts with `'starter-'`) found in
 *     any player zone; championSlot hero; heroes in `inPlay`;
 *     item-active items from `items` (fairies excluded).
 *   - EXCLUDED: main-board draw deck / discard pile / chest contents
 *     (`state.field`, `state.supply`, `state.chestRow`,
 *     `state.chestSupply`, `state.defeated`) — never sourced. Gems
 *     and re-roll tokens are per-player resource counters
 *     (`green` / `red` / `keys`), not Card objects, so they have no
 *     Card-shaped contribution to filter out.
 *
 * Shuffle is deterministic via `mulberry32(state.seed +
 * entryContext.combatEntryTurn)`.
 *
 * Returns the SHUFFLED combat deck. Callers pair this with
 * `initialCombatDraw` to fill the starting hand.
 */
export function buildCombatDeck(state: KidGameState, entryContext: CombatEntryContext): Card[] {
  const eligible: Card[] = [];

  // 1. Starter cards (role starts with 'starter-') across every
  //    player zone. Duplicates are INTENTIONAL — a starter deck has
  //    7 refs to STARTER_GREEN and 2 refs to STARTER_RED (same object
  //    pushed N times by buildStarterDeck), and each copy is a real
  //    playable card in the main game that should enter combat
  //    independently. The earlier dedupe-by-identity collapsed all
  //    copies to 1, which left the combat deck too thin to refill
  //    the hand across turns.
  for (const starter of gatherStarterCards(state.players)) {
    eligible.push(starter);
  }

  // 2. championSlot hero per player. Uniquified by player id via the
  //    loop structure; findChampionSlotHero returns the first matching
  //    card reference in the player's zones, which is distinct per
  //    player so no dedupe is needed.
  for (const player of state.players) {
    const champion = findChampionSlotHero(player);
    if (champion !== null) eligible.push(champion);
  }

  // 3. Heroes in `inPlay` + item-active items (non-wisp). Each
  //    player's contribution is scoped to their own zones; same-card
  //    references across players are possible (market-duplicated
  //    hero cards) but v2.0 data has per-copy mint so collisions are
  //    rare. Accept duplicates if they occur.
  for (const player of state.players) {
    for (const card of gatherPlayerContributions(player)) {
      eligible.push(card);
    }
  }

  const rng = mulberry32(state.seed + entryContext.combatEntryTurn);
  return shuffle(eligible, rng);
}

/**
 * Deal the initial combat draw into `combatHand` (§B2 initial draw =
 * 5, hand cap = 5). Excess cards — none at initial draw, but this
 * helper also powers subsequent `combat-draw` effects — route to
 * `combatDiscard`.
 */
export function initialCombatDraw(deck: readonly Card[]): {
  combatDeck: Card[];
  combatHand: Card[];
  combatDiscard: Card[];
} {
  const deckCopy = deck.slice();
  const hand: Card[] = [];
  const discard: Card[] = [];
  let drawn = 0;
  while (drawn < COMBAT_INITIAL_DRAW && deckCopy.length > 0) {
    const card = deckCopy.shift()!;
    if (hand.length < COMBAT_HAND_CAP) {
      hand.push(card);
    } else {
      discard.push(card);
    }
    drawn += 1;
  }
  return { combatDeck: deckCopy, combatHand: hand, combatDiscard: discard };
}

/**
 * Draw `count` cards from `deck` into `hand` respecting
 * `COMBAT_HAND_CAP`. Overflow routes to `discard`. Pure: returns new
 * arrays.
 *
 * Designer polish 2026-04-22 (rev-2): when `deck` is exhausted
 * mid-draw AND `discard` is non-empty AND an `rng` is supplied, the
 * discard is shuffled back into the deck and the draw continues.
 * This removes the "hand runs dry turn 3" death spiral the original
 * one-pass design (§B2 "no auto-shuffle") produced with small combat
 * decks. Reshuffle is deterministic per-call — seed the rng off
 * `combatEntryTurn + turnIndex + reshuffle counter` if reproducibility
 * is needed.
 *
 * If `rng` is omitted the old one-pass behavior is preserved (the
 * function stops drawing when the deck empties, leaving discard
 * untouched). That path only matters for tests written against the
 * prior contract.
 */
export function drawIntoHand(
  deck: readonly Card[],
  hand: readonly Card[],
  discard: readonly Card[],
  count: number,
  rng?: () => number,
): { deck: Card[]; hand: Card[]; discard: Card[] } {
  let deckCopy = deck.slice();
  const handCopy = hand.slice();
  let discardCopy = discard.slice();
  let drawn = 0;
  while (drawn < count) {
    if (deckCopy.length === 0) {
      // Reshuffle discard → deck if an rng is available and there's
      // anything to reshuffle. No rng = legacy one-pass behavior.
      if (rng === undefined || discardCopy.length === 0) break;
      deckCopy = shuffle(discardCopy, rng);
      discardCopy = [];
    }
    const card = deckCopy.shift()!;
    if (handCopy.length < COMBAT_HAND_CAP) {
      handCopy.push(card);
    } else {
      discardCopy.push(card);
    }
    drawn += 1;
  }
  return { deck: deckCopy, hand: handCopy, discard: discardCopy };
}
