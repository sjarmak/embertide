/**
 * Combat-engine state envelope + action union (v2.1 combat layer, u-8b).
 *
 * The task spec signs off on `combatTurnReducer(state, action): CombatState`
 * as the shape. In practice the engine needs access to the KidPlayer
 * snapshot to route boss damage and detect LOSS, so we widen the state
 * argument to a `CombatTurnState` envelope that carries the combat
 * sub-state, the player snapshot, a terminal flag, and the
 * plays-this-turn counter. u-8c composes this envelope from
 * KidGameState when dispatching PLAYER_PLAY_CARD / PLAYER_PASS /
 * BOSS_RESOLVE and splats the result back onto
 * `{ players, activeCombat }` when the sub-turn resolves.
 */

import type { CombatEffect } from '../../types/combatEffect';
import type { CombatState } from '../../types/combat';
import type { KidPlayer } from '../../store/types';

/**
 * Terminal marker produced by `combatTurnReducer` when the combat
 * resolves. u-8c reads this to know when to fire `COMBAT_RESOLVE_WIN`
 * or `COMBAT_RESOLVE_LOSS` on the main-board reducer.
 */
export type CombatTerminal = 'win' | 'loss' | null;

/**
 * Engine state envelope. Carries the immutable CombatState plus the
 * KidPlayer snapshot that damage routing mutates, plus engine-local
 * bookkeeping (playsThisTurn budget + terminal marker).
 */
export interface CombatTurnState {
  readonly combat: CombatState;
  readonly players: readonly KidPlayer[];
  /** `null` while combat is in progress; `'win'` / `'loss'` when resolved. */
  readonly terminal: CombatTerminal;
  /**
   * Count of `PLAYER_PLAY_CARD` actions resolved during the current
   * players-turn. Reset to 0 at `PLAYER_PASS` and at the end of
   * `BOSS_RESOLVE`. Refuses further plays once it reaches
   * `COMBAT_PLAYS_PER_TURN`.
   */
  readonly playsThisTurn: number;
  /**
   * Duel-archetype Adaptive penalty tracker (embertide-lhlo.14).
   *
   * Tracks which `CombatEffect.kind` values have already been played
   * this players-turn when the opponent is a duel-archetype boss. On
   * the SECOND play of the same effect kind within the same turn, the
   * boss's `adaptive.penalty` is subtracted from that play's damage
   * (clamped at 0). Cleared at `PLAYER_PASS` and at `BOSS_RESOLVE`
   * so each players-turn starts with a fresh slate.
   *
   * `undefined` when no duel-archetype boss is in play (saves
   * allocation for non-duel combats). Read sites guard on falsy value.
   *
   * Key: `CombatEffect['kind']` — the best available card-class
   * discriminant until `Card.cardType` lands.
   *
   * TODO(lhlo.32 / kw.card-typing): key on Card.cardType once it lands.
   */
  readonly adaptiveTurnTracker?: ReadonlySet<CombatEffect['kind']>;
}

/**
 * Player plays a card from `combatHand`. The card is resolved via the
 * inline default `combat-attack` (damage = card.power ?? 1) until u-8d
 * lands the data sheet.
 */
export interface PlayerPlayCardAction {
  readonly type: 'PLAYER_PLAY_CARD';
  readonly cardId: string;
  readonly playerId: string;
}

/** Ends the players-turn; next `BOSS_RESOLVE` applies the boss's attack pattern. */
export interface PlayerPassAction {
  readonly type: 'PLAYER_PASS';
}

/** Resolves the boss's attack and advances the turn counter. */
export interface BossResolveAction {
  readonly type: 'BOSS_RESOLVE';
}

/** Discriminated union of engine-local combat-turn actions. */
export type CombatTurnAction = PlayerPlayCardAction | PlayerPassAction | BossResolveAction;
