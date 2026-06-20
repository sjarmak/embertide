/**
 * Per-turn boss-resolve outcome contract (embertide-gdd.1.2).
 *
 * Boss-attack resolvers are pure functions that read CombatState and
 * the static pattern, then produce both the damage value AND any
 * per-turn side effects (combat-log entries, hand discards, echoQueue
 * mutations, etc.). The core reducer (`reduceBossResolve`) owns the
 * targeting / battlefield-then-player / aoe routing layer; resolvers
 * never route damage themselves.
 */

import type { CombatState } from '../../../types/combat';
import type { KidPlayer } from '../../../store/types';

/**
 * Per-turn boss-resolve outcome produced by a dynamic resolver. The
 * core reducer (`reduceBossResolve`) routes `damage` through the
 * pattern's `targeting` field, applies `playerSideEffect` to the
 * player snapshot (if any), merges `combatLog` entries onto
 * `state.combat.combatLog`, and overlays `combatPatch` onto the
 * outgoing `CombatState`.
 *
 * Each field is optional so resolvers stay narrow — most only need
 * the damage scalar + a log entry.
 */
export interface BossResolveOutcome {
  readonly damage: number;
  readonly combatLog: readonly string[];
  /**
   * Pure transformation applied to the player snapshot AFTER damage
   * routing. Used by resolvers with player-side effects (hand-discard,
   * resource drain). Not invoked when `null`.
   */
  readonly playerSideEffect: ((players: readonly KidPlayer[]) => readonly KidPlayer[]) | null;
  /**
   * Partial overlay merged into the outgoing CombatState. Use for
   * resolver-specific bookkeeping (e.g. hollow-effigy clearing
   * echoQueue after firing). Empty object = no overlay.
   *
   * `boss` is intentionally excluded (embertide-4w8a): the boss-turn
   * reducer applies `applyArchetypeTick` to produce `tickedBoss`, then
   * spreads `combatPatch` over the outgoing state. Allowing a resolver
   * to overwrite `boss` here would silently roll back the archetype
   * tick. If a resolver needs to override boss state (multi-phase
   * transitions), introduce a dedicated `bossOverride` field so the
   * reducer can sequence it correctly.
   *
   * `arena` is excluded for the same reason (embertide-lhlo.26): the
   * reducer applies `applyArenaHazards` to produce the post-tick arena
   * before spreading `combatPatch`, so letting a resolver overwrite
   * `arena` would roll back that turn's hazard tick.
   */
  readonly combatPatch: Omit<Partial<CombatState>, 'boss' | 'arena'>;
}

export type BossResolver = (combat: CombatState) => BossResolveOutcome;
