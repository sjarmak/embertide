import { baseIdOf } from '../../data/cards';
import { getPassives } from '../../data/cardPassives';
import { applyHeartReward } from '../../core/vitalEmber';
import type { InnerEffectSpec } from '../../types/effectSpec';
import { drawCards } from './deck';
import type { KidGameState, KidPlayer } from '../types';

/**
 * v2 co-op victory sentinel (amendment A2). Co-op victory requires all
 * three shared shards — `wisdom && courage && power` on
 * `state.sharedEmbertide`. Exposed as a named constant so downstream
 * simulation harnesses and UX layers can reason about the target
 * without hardcoding `3` in multiple places.
 */
export const EMBERTIDE_PIECES_TO_WIN = 3;

/**
 * Advance to the next player's turn. When the rotation wraps back to the
 * first player (index 0), increment the `turn` counter. This is pure — it
 * does NOT handle shard grants or game-over checks; see the composed
 * endTurn pipeline in gameStore.ts for the full sequence.
 */
export function advanceTurn(state: KidGameState): KidGameState {
  if (state.players.length === 0) return state;
  const nextIdx = (state.currentPlayerIndex + 1) % state.players.length;
  const wrapped = nextIdx === 0;
  return {
    ...state,
    currentPlayerIndex: nextIdx,
    turn: wrapped ? state.turn + 1 : state.turn,
  };
}

// ---------------------------------------------------------------------------
// Start-of-turn Items triggers (REQ-4, u-2d — renamed from Constructs per
// amendment A6). Every item a player owns fires a deterministic trigger
// at the start of their turn, AFTER their new hand has been drawn. The
// effect is keyed on the card's canonical `baseId` so duplicate-suffixed
// copies (e.g. `short-sword-2`) dispatch identically to the base
// template.
//
// u-2d also wires the cooldown-readout decrement: for every item-active
// card in the zone, `cooldownTurns` is decremented (guarded at 0). v2.0
// ships every item-active with `cooldownTurns: 0`, so the decrement is
// visually a no-op today; the hook exists so v2.1 cooldown-gated items
// (u-7 softclock, u-4 balance passes) have a single canonical tick site.
// ---------------------------------------------------------------------------

function applyItemTrigger(player: KidPlayer, itemBaseId: string): KidPlayer {
  switch (itemBaseId) {
    case 'short-sword':
      return { ...player, red: player.red + 1 };
    case 'tower-shield':
      return { ...player, green: player.green + 1 };
    case 'short-bow':
      return { ...player, red: player.red + 1 };
    case 'curved-throwing-blade':
      return { ...player, red: player.red + 1 };
    case 'ancient-blade':
      return { ...player, red: player.red + 2 };
    default:
      return player;
  }
}

/**
 * Dispatch a single item-passive nested effect onto a player
 * (embertide-4uyn). Pure: returns a new `KidPlayer`. Coverage is
 * the small subset of `InnerEffectSpec` that the v2.1 4uyn item-passive
 * cards actually author — `gain`, `heal` (target='self'), `draw`. Other
 * inner-effect kinds (combat-bonus, damage-reduction, monster-drop, ...)
 * are no-ops here because no 4uyn card declares them as a passive
 * payload; future cards extending the coverage land their dispatch
 * branch alongside the new card.
 *
 * `damage-reduction` is dispatched separately — see {@link reduceIncomingDamage}
 * below, called from src/core/combat/damage.ts on every combat
 * damage-routing site (embertide-4uyn.1). It is NOT routed through
 * `applyPassivePayload` because it has to subtract from an in-flight
 * damage amount, not add a resource to the player.
 */
function applyPassivePayload(
  player: KidPlayer,
  effect: InnerEffectSpec,
  rng: () => number,
): KidPlayer {
  switch (effect.kind) {
    case 'gain': {
      return {
        ...player,
        green: player.green + (effect.green ?? 0),
        red: player.red + (effect.red ?? 0),
        keys: player.keys + (effect.keys ?? 0),
      };
    }
    case 'heal': {
      // 4uyn item-passives only author target='self' heals — team /
      // active heals route through their own dedicated dispatch sites
      // (wisp revive, Seer's Omen heal faces). Any non-self target
      // here is treated as self for safety: the alternative is silently
      // dropping the heal, which would hide an authoring mistake.
      const amount = effect.amount;
      if (amount <= 0) return player;
      return applyHeartReward(player, amount);
    }
    case 'draw': {
      const next = drawCards(
        { deck: player.deck, hand: player.hand, discard: player.discard },
        effect.amount,
        rng,
      );
      return { ...player, deck: next.deck, hand: next.hand, discard: next.discard };
    }
    // Inner-effect kinds NOT authored by any v2.1 4uyn item-passive —
    // these stay no-ops at the start-of-turn dispatch boundary so an
    // accidental passive payload of (say) shape `monster-drop` doesn't
    // silently fire a heart heal on the owner. Future units extending
    // the passive payload coverage update this switch.
    case 'shard':
    case 'combat-bonus':
    case 'damage-reduction':
    case 'monster-drop':
    case 'chest-draw':
    case 'on-play-power':
    case 'on-play-green-and-draw':
    case 'on-play-green-and-power':
    case 'banish-from-hand':
    case 'banish-from-discard':
    case 'shard-grant':
    case 'equip-bonus':
    case 'roll-die':
      return player;
    default: {
      const _exhaustive: never = effect;
      return _exhaustive;
    }
  }
}

/**
 * Fire every owned item-passive whose `trigger` matches the supplied
 * trigger discriminator (embertide-4uyn). Dispatches the nested
 * effect through `applyPassivePayload`. Pure — returns a new player.
 *
 * Used by:
 *   - `applyStartOfTurnItems` for `trigger: 'start-of-turn'` (this file).
 *   - `applyMonsterDefeatedPassives` for `trigger: 'on-monster-defeated'`
 *     (src/store/slices/combat.ts).
 *
 * Iteration order matches the player's items array — deterministic
 * given equip order.
 */
export function applyItemPassivesForTrigger(
  player: KidPlayer,
  trigger: 'start-of-turn' | 'on-combat-enter' | 'on-damage' | 'on-monster-defeated',
  rng: () => number,
): KidPlayer {
  let next = player;
  for (const item of next.items) {
    for (const passive of getPassives(item)) {
      if (passive.trigger !== trigger) continue;
      next = applyPassivePayload(next, passive.effect, rng);
    }
  }
  return next;
}

/**
 * Sum the `damage-reduction` amounts from every owned `on-damage`
 * item-passive (embertide-4uyn.1). Pure: a player with three
 * iron-wards equipped reduces incoming damage by 3 per hit; the
 * reducer in {@link reduceIncomingDamage} clamps the result at zero.
 *
 * Iteration order matches `player.items` so the sum is deterministic
 * given equip order. Other on-damage payload kinds (currently none —
 * iron-ward is the only v2.1 author) are ignored here; future cards
 * extending the passive payload coverage land their dispatch branch
 * alongside the new card.
 */
function totalOnDamageReduction(player: KidPlayer): number {
  let sum = 0;
  for (const item of player.items) {
    for (const passive of getPassives(item)) {
      if (passive.trigger !== 'on-damage') continue;
      if (passive.effect.kind !== 'damage-reduction') continue;
      sum += passive.effect.amount;
    }
  }
  return sum;
}

/**
 * Compute the post-passive damage amount that should land on the
 * player (embertide-4uyn.1). Fires once per damage instance —
 * every separate `applyDamage` call routes through here. Card text
 * "Reduce damage taken by 1" reads literally: each hit is reduced.
 * Multiple `on-damage` passives stack additively. Result is clamped
 * at zero so a 1-damage hit against a player holding two iron-wards
 * lands as 0 (no overheal credit).
 *
 * Pure — does NOT mutate the player; the returned number is the
 * reduced damage to feed into {@link applyDamage}. Use at every
 * combat damage routing site (see combatEngine.ts).
 */
export function reduceIncomingDamage(player: KidPlayer, amount: number): number {
  if (amount <= 0) return amount;
  const reduction = totalOnDamageReduction(player);
  if (reduction <= 0) return amount;
  return Math.max(0, amount - reduction);
}

/**
 * Decrement the cooldown readout on every item-active card in the
 * player's items zone (REQ-4, u-2d). Floored at 0 so no value goes
 * negative. Pure — returns a new `KidPlayer` (with a new items array)
 * only when at least one card carries `cooldownTurns > 0`; otherwise
 * returns the input reference unchanged so `===` identity comparisons
 * still work upstream.
 */
function decrementItemCooldowns(player: KidPlayer): KidPlayer {
  let anyChanged = false;
  const next = player.items.map((card) => {
    if (card.itemKind !== 'item-active') return card;
    const current = card.cooldownTurns ?? 0;
    if (current <= 0) return card;
    anyChanged = true;
    return { ...card, cooldownTurns: current - 1 };
  });
  if (!anyChanged) return player;
  return { ...player, items: next };
}

/**
 * Apply every item's start-of-turn trigger + cooldown decrement to the
 * current active player. Call AFTER the player's hand has been drawn so
 * effect order matches the Ascension rulebook (start-of-turn triggers
 * resolve before the first voluntary play). Pure — returns a new state.
 *
 * Trigger order (embertide-4uyn):
 *   1. Cooldown decrement (item-active only).
 *   2. Legacy baseId-keyed triggers for v2.0 Relics (short-sword etc.).
 *   3. EffectSpec-driven `item-passive` start-of-turn dispatch (4uyn
 *      Ascension-style constructs: forge-of-power, well-of-vitality,
 *      merchants-charm, scholars-tome).
 *
 * The two trigger paths are independent — a v2.0 baseId-keyed Relic and
 * a 4uyn item-passive are never the same card, so there's no double-
 * fire risk. Future cards migrating from baseId-key to declarative
 * EffectSpec replace one path with the other, never both.
 */
export function applyStartOfTurnItems(state: KidGameState): KidGameState {
  const idx = state.currentPlayerIndex;
  const player = state.players[idx];
  if (!player) return state;
  if (player.items.length === 0) return state;

  let next: KidPlayer = decrementItemCooldowns(player);
  for (const item of next.items) {
    next = applyItemTrigger(next, baseIdOf(item));
  }
  next = applyItemPassivesForTrigger(next, 'start-of-turn', state.rng);

  const players = state.players.slice();
  players[idx] = next;
  return { ...state, players };
}

// ---------------------------------------------------------------------------
// Champion start-of-turn passives (§14 / embertide-57p).
//
// Each player chooses one Champion at setup. Wisdom's passive is handled by
// the endTurn pipeline (drawing 6 instead of 5) via EXTRA_DRAW_CHAMPION_ID.
// Power and Sword grant +power / +green at the start of every turn. Courage
// is a combat-triggered passive — its +HP-heal fires from the combat slice
// on mini-boss / final-boss defeats and is NOT applied here.
// ---------------------------------------------------------------------------

/** Champion id whose passive is "draw 1 extra card at start of turn". */
export const EXTRA_DRAW_CHAMPION_ID = 'champion-wisdom';

/**
 * Apply the active player's Champion start-of-turn passive. Pure — returns
 * a new `KidPlayer`. Call AFTER the new hand is drawn so the bonus sits
 * alongside drawn resources.
 */
export function applyChampionPower(player: KidPlayer): KidPlayer {
  switch (player.championId) {
    case 'champion-power':
      return {
        ...player,
        red: player.red + 2,
        championPassivePulse: player.championPassivePulse + 1,
      };
    case 'champion-sword':
      return {
        ...player,
        green: player.green + 1,
        championPassivePulse: player.championPassivePulse + 1,
      };
    case 'champion-wisdom':
    case 'champion-courage':
    default:
      return player;
  }
}

/**
 * v2 co-op victory check (amendment A2). If all three shared shards are
 * granted and the game is still active (`outcome === null`), transition
 * to `outcome = 'win'`. Both players win together. No-op when outcome
 * is already resolved or when any shard remains ungranted.
 *
 * REQ-14/REQ-28 (embertide-gm0.5): on the outcome transition, any
 * Sets `outcome = 'win'` exactly once. Idempotent — re-entry with
 * `outcome !== null` is an early return.
 */
export function checkCoopVictory(state: KidGameState): KidGameState {
  if (state.outcome !== null) return state;
  const { wisdom, courage, power } = state.sharedEmbertide;
  if (wisdom && courage && power) {
    return { ...state, outcome: 'win' };
  }
  return state;
}
