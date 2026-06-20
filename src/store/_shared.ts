import type { Card } from '../types/card';
import type { KidGameState, KidPlayer, PendingBanishChoice } from './types';
import { baseIdOf } from '../data/cards';
import { drawCards } from './slices/deck';

/**
 * Shared store-layer scaffolding extracted from `gameStore.ts` (embertide-hik1).
 *
 * Houses the pure helpers that previously lived as private functions in
 * `gameStore.ts` — replacePlayer, requireMainPhase, WISP_BASE_IDS,
 * playerHasWisp, checkCoopLoss, and the on-play deltas / banish-choice
 * helpers. Per-domain slices (`banish`, `tutorial`, `dice`, `vendor`,
 * etc.) import from here rather than the store factory module to keep
 * the dependency graph one-directional (slice → _shared, never the
 * reverse).
 *
 * NOTE: `slices/chests.ts` and `slices/combat.ts` carry their own
 * private copy of `replacePlayer`. Those duplicates predate this
 * extraction and are intentionally out-of-scope for the current pass —
 * a follow-up bead will unify them once chests + combat slice
 * migrations land.
 */

/**
 * Replace `state.players[idx]` with `next` and return a new state. Pure /
 * immutable: clones the players array and the surrounding state.
 */
export function replacePlayer(state: KidGameState, idx: number, next: KidPlayer): KidGameState {
  const players = state.players.slice();
  players[idx] = next;
  return { ...state, players };
}

/**
 * Guard: main-phase actions (playCard / buyFromField / buyAlwaysAvailable /
 * fightMonster / defeatAlwaysAvailable / openChest / reviveTeammate /
 * playWispOn) require `state.phase === 'Main'`. Throws with a clear
 * message when called from any other phase. Called at the top of every
 * main-phase action after the outcome-gate check.
 */
export function requireMainPhase(state: KidGameState, actionName: string): void {
  if (state.phase !== 'Main') {
    throw new Error(`${actionName}: main-phase action attempted during phase '${state.phase}'`);
  }
}

/**
 * Set of wisp baseIds recognised by the co-op loss guard + `playWispOn`
 * dispatch (v2.1 gm0.16). Any card in the items zone whose baseId matches
 * one of these satisfies `playerHasWisp`. Plain 'wisp' is the original
 * u-1d card; 'great-wisp' and 'wisp-in-bottle' are the gm0.16 variants.
 */
export const WISP_BASE_IDS: ReadonlySet<string> = new Set([
  'wisp',
  'great-wisp',
  'wisp-in-bottle',
]);

/**
 * Scan a player's items zone for a wisp card. v2 co-op (amendment A3):
 * a wisp in either player's items prevents the shared-loss trigger.
 * u-1d declares the 'wisp' card, u-2d renamed the zone from `constructs`
 * to `items`. gm0.16 extends the check to the two new wisp variants
 * (`great-wisp`, `wisp-in-bottle`) so all three satisfy the co-op
 * loss guard and `playWispOn` dispatch.
 */
export function playerHasWisp(player: KidPlayer): boolean {
  return player.items.some((c) => WISP_BASE_IDS.has(baseIdOf(c)));
}

/**
 * Post-damage game-over check (amendment A3). When BOTH players are
 * downed AND both have already been teammate-revived this incident AND
 * neither player has a wisp available, the game ends in a shared loss.
 * Otherwise `state.outcome` is preserved.
 *
 * CALL-SITE CONTRACT: this check is wired into `endTurn` only (u-1a). Any
 * future unit that introduces a NEW mid-action damage source (chest trap,
 * monster counter-attack, Vurmox AoE, etc.) MUST also route through
 * `checkCoopLoss` OR schedule an endTurn-style re-check, otherwise a
 * both-downed state can persist past the triggering action without the
 * loss firing until the next endTurn. u-1d (revive + wisp) inherits
 * this contract; u-6c (Vurmox on-defeat) is the first landing unit that
 * will need the additional call-site.
 */
export function checkCoopLoss(state: KidGameState): KidGameState {
  if (state.outcome !== null) return state;
  if (state.players.length < 2) return state;
  const allDowned = state.players.every((p) => p.downed);
  if (!allDowned) return state;
  const allRevivedAlready = state.players.every((p) => p.revivedThisIncident);
  if (!allRevivedAlready) return state;
  const anyWisp = state.players.some(playerHasWisp);
  if (anyWisp) return state;
  return { ...state, outcome: 'loss' };
}

/**
 * On-play resource deltas + extra-draw count for hero / starter cards.
 * Item / legendary-sword cards skip this table (they route through the
 * Items zone in `playCard`).
 */
export interface HeroOnPlayDeltas {
  readonly green: number;
  readonly red: number;
  readonly keys: number;
  readonly extraDraw: number;
}

export const NO_DELTAS: HeroOnPlayDeltas = { green: 0, red: 0, keys: 0, extraDraw: 0 };

/**
 * Pure table of on-play resource deltas for every hero and starter card.
 * Keyed on role + baseId so duplicate supply copies (e.g. `mystic-3`)
 * resolve through `baseIdOf`. Mountain-king returns NO_DELTAS — its
 * per-kill bonus fires from the combat slice. Ranch-keeper now grants
 * +1g flat (mvjx) on top of its boss-conditional heal (which still
 * fires from `ranchKeeperHealBonus` in slices/combat.ts).
 */
export function heroOnPlayDeltas(card: Card): HeroOnPlayDeltas {
  if (card.role === 'starter-green') return { ...NO_DELTAS, green: 1 };
  if (card.role === 'starter-red') return { ...NO_DELTAS, red: 1 };
  // j49z (2026-04-24): the `starter-home` branch was retired alongside the
  // role itself — the dispatch was never reachable in v2 because the
  // 2026-04-24 starter-deck change removed champion hero cards from the
  // opening deck (see src/store/slices/deck.ts). Champion portraits are
  // now rendered via KidChampion.portraitCardId for the Setup picker only.
  if (card.role === 'hero') {
    switch (baseIdOf(card)) {
      case 'sage-keeper':
        return { ...NO_DELTAS, green: 2, keys: 1 };
      case 'water-warrior':
        return { ...NO_DELTAS, red: 2 };
      // mvjx (wun Track C, 2026-04-25): scholar-princess differentiated
      // — main grants +2g, combat keeps draw 2 (EXPLICIT_OVERRIDES).
      case 'scholar-princess':
        return { ...NO_DELTAS, green: 2 };
      case 'wandering-merchant':
        return { ...NO_DELTAS, green: 1, red: 1 };
      // mvjx (wun Track C, 2026-04-25): ranch-keeper's main fire is now
      // a flat +1g on every play. Boss-conditional +1♥ stays in combat.
      case 'ranch-keeper':
        return { ...NO_DELTAS, green: 1 };
      // gm0.10 (2026-04-24, v2.1 REQ-6): forest-sage no longer carries a
      // flat on-play resource grant. Its on-play effect is the d6 omen
      // roll handled by `rollForestSageOmen` (fired from `playCard` after
      // the card moves hand → inPlay). All resource deltas land via
      // `applyForestSageOmenOutcome` once the player commits a face.
      case 'mystic':
        return { ...NO_DELTAS, green: 2 };
      case 'militia-grunt':
        return { ...NO_DELTAS, red: 2 };
      // embertide-1eby (2026-04-24): key-vendor (Pell) was reframed
      // as a vendor service — no card mints, no on-play firing, so the
      // hero on-play case is gone. The trade is handled by
      // `tradeWithKeyVendor` which writes resource deltas directly.
      default:
        return NO_DELTAS;
    }
  }
  return NO_DELTAS;
}

/**
 * Move `card` from `player.hand` into `player.inPlay` and apply its on-play
 * resource deltas (+ optional extra draw). Pure; assumes the card is in
 * hand. Called from `playCard` for hero / starter cards.
 */
export function applyHeroPlay(player: KidPlayer, card: Card, rng: () => number): KidPlayer {
  const handIdx = player.hand.findIndex((c) => c.id === card.id);
  if (handIdx === -1) return player;
  const hand = player.hand.slice();
  hand.splice(handIdx, 1);

  const deltas = heroOnPlayDeltas(card);
  let next: KidPlayer = {
    ...player,
    hand,
    inPlay: [...player.inPlay, card],
    green: player.green + deltas.green,
    red: player.red + deltas.red,
    keys: player.keys + deltas.keys,
  };

  if (deltas.extraDraw > 0) {
    const drawn = drawCards(
      { deck: next.deck, hand: next.hand, discard: next.discard },
      deltas.extraDraw,
      rng,
    );
    next = {
      ...next,
      deck: drawn.deck,
      hand: drawn.hand,
      discard: drawn.discard,
    };
  }

  return next;
}

/**
 * Build a {@link PendingBanishChoice} payload for `playCard` when the
 * just-played card declares a `banish-from-hand` EffectSpec
 * (embertide-91p, commit b). Returns `null` when:
 *   - the card's effect kind is not `banish-from-hand`, OR
 *   - the player has no banishable cards in hand (the effect fizzles
 *     silently rather than surfacing an empty modal — matches
 *     `banishFromHand`'s defensive throw on empty selection sets).
 *
 * Snapshot semantics: the returned `cardIds` is taken AT CALL TIME from
 * `player.hand`. The reducer body in `playCard` invokes this helper
 * AFTER `applyHeroPlay` has moved the just-played card hand → inPlay,
 * so the snapshot can never include the triggering card itself.
 */
export function pendingBanishChoiceFor(card: Card, player: KidPlayer): PendingBanishChoice | null {
  if (card.effects.kind !== 'banish-from-hand') return null;
  if (player.hand.length === 0) return null;
  return {
    playerId: player.id,
    cardIds: player.hand.map((c) => c.id),
  };
}
