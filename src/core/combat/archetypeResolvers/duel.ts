/**
 * Duel-archetype resolver (embertide-lhlo.14, sub of lhlo).
 * Pure transforms — no `CombatState` dependency.
 *
 * KEYWORD: Adaptive — the FIRST repeated card-type each turn has a
 * −X effect (X = `adaptive.penalty`). It resists you repeating
 * yourself.
 *
 * This file owns two surfaces:
 *
 *   1. `applyDuelArchetypeTick` — end-of-boss-turn registry peg.
 *      Duel has NO end-of-boss-turn state-tag evolution (the Adaptive
 *      mechanic fires at player-card-play time, not on the boss turn).
 *      This resolver exists solely as the `ARCHETYPE_RESOLVERS` peg so
 *      `applyArchetypeTick` dispatches cleanly for duel bosses. The
 *      same-reference return is intentional and correct.
 *
 *   2. `applyDuelAdaptivePenalty` — called at every player-card-play
 *      site when the boss archetype is `'duel'`. When the played
 *      card's effect kind has ALREADY appeared in the current
 *      players-turn (i.e., is present in `adaptiveTurnTracker`), the
 *      boss's `adaptive.penalty` is subtracted from the effect's
 *      damage (clamped at 0). Returns the modified effect and the
 *      updated tracker — both as new values (immutable).
 *
 * CARD-CLASS KEY DECISION: The discriminant used to identify "repeated
 * card type" is `CombatEffect['kind']` — the effect kind resolved from
 * the played card. This is the best available proxy for the eventual
 * `Card.cardType` sub-classification (Attack/Skill/Item/Engine/Tech/
 * Hybrid) that lands in lhlo.32. The effect kind clusters cards into
 * functional combat roles (`combat-attack`, `combat-attack-stun`,
 * `combat-multishot`, `combat-absorb`, `combat-heal`, `combat-draw`,
 * `combat-weaken`, `combat-vulnerable`) which maps closely to the
 * intended card-type taxonomy.
 *
 * TODO(lhlo.32 / kw.card-typing): key on Card.cardType once it lands.
 *
 * ZONE / COLOSSEUM GATING:
 *   - COLOSSEUM duel bosses (`COLOSSEUM_BONEREAVER_T1`, `COLOSSEUM_CHIMERA_T2`)
 *     carry `archetype: 'duel'` pre-populated on their spec literal and
 *     are ALWAYS active — no zone-allowlist gate.
 *   - ZONE duel bosses (`hollow-effigy`, `silver-chimera`, `prism-chimera`)
 *     require the card's zone to appear in
 *     `KEYWORD_VOCABULARY_ZONE_ALLOWLIST` before their spec from
 *     `ZONE_BOSS_SPECS` is merged into the `CombatBoss`. This gating
 *     happens entirely in `enterCombatAction` (combatBootstrap.ts)
 *     before the boss is handed to the combat engine — the resolver
 *     itself never sees a zone boss with `archetype: 'duel'` unless
 *     the allowlist gate has already passed.
 */

import type { BossStateAdaptive, CombatBoss } from '../../../types/combat';
import type { CombatEffect } from '../../../types/combatEffect';

/**
 * Apply one end-of-boss-turn Duel-archetype tick to `boss`. Returns
 * the same reference — duel has no end-of-boss-turn state-tag
 * evolution. This function exists solely as the registry peg in
 * `ARCHETYPE_RESOLVERS`; the Adaptive penalty fires at player-card-
 * play time via `applyDuelAdaptivePenalty`.
 */
export function applyDuelArchetypeTick(boss: CombatBoss): CombatBoss {
  if (boss.archetype !== 'duel') return boss;
  // Duel has no end-of-boss-turn state-tag evolution — the Adaptive
  // mechanic fires at player-card-play time. Return same ref.
  return boss;
}

// ---------------------------------------------------------------------------
// Adaptive penalty application (called at every player-card-play site).
// ---------------------------------------------------------------------------

/**
 * Locate the `adaptive` tag on a duel-archetype boss. Returns `null`
 * for any boss that should not apply the penalty (non-duel archetype,
 * missing stateTags, no adaptive tag).
 */
function findAdaptiveTag(boss: CombatBoss): BossStateAdaptive | null {
  if (boss.archetype !== 'duel') return null;
  const tags = boss.stateTags;
  if (!tags) return null;
  for (const tag of tags) {
    if (tag.kind === 'adaptive') return tag;
  }
  return null;
}

/**
 * Result of `applyDuelAdaptivePenalty`: the (possibly reduced) effect
 * and the updated tracker for the remainder of the players-turn.
 */
export interface DuelPenaltyResult {
  /** The played effect, with damage reduced by `penalty` if repeated. */
  readonly effect: CombatEffect;
  /**
   * Tracker updated to include the played effect kind.
   * The caller must thread this back through `CombatTurnState` so
   * subsequent plays in the same turn see the accumulated history.
   */
  readonly nextTracker: ReadonlySet<CombatEffect['kind']>;
}

/**
 * Apply the Duel-archetype Adaptive penalty to a player's card play.
 *
 * When `boss.archetype === 'duel'` and the played `effect.kind` is
 * already present in `seenKinds` (i.e., the same effect kind has
 * already been played this turn), reduce the effect's damage by
 * `adaptive.penalty` (clamped at 0). The FIRST play of a given kind
 * is always unaffected.
 *
 * Only damage-bearing effects (`combat-attack`, `combat-attack-stun`,
 * `combat-multishot`) are reduced. Non-damage effects
 * (`combat-absorb`, `combat-heal`, `combat-draw`, `combat-weaken`,
 * `combat-vulnerable`) are recorded in the tracker but their
 * non-damage fields are unaffected — penalty only applies to damage
 * quantities.
 *
 * Returns `null` when the boss is not a duel-archetype (fast path for
 * the common case — callers can skip the tracker update entirely).
 *
 * Pure: input boss / tracker are not mutated.
 */
export function applyDuelAdaptivePenalty(
  boss: CombatBoss,
  effect: CombatEffect,
  seenKinds: ReadonlySet<CombatEffect['kind']> | undefined,
): DuelPenaltyResult | null {
  const adaptiveTag = findAdaptiveTag(boss);
  if (adaptiveTag === null) return null;

  const currentSeen = seenKinds ?? new Set<CombatEffect['kind']>();
  const isRepeat = currentSeen.has(effect.kind);

  // Build the next tracker including this effect kind.
  const nextTracker: Set<CombatEffect['kind']> = new Set(currentSeen);
  nextTracker.add(effect.kind);

  if (!isRepeat) {
    // First play of this kind — pass through unmodified.
    return { effect, nextTracker };
  }

  // Second (or later) play of this kind — apply the penalty to damage.
  const penalty = adaptiveTag.penalty;
  const reducedEffect = applyPenaltyToEffect(effect, penalty);
  return { effect: reducedEffect, nextTracker };
}

/**
 * Subtract `penalty` from the damage field of a damage-bearing
 * `CombatEffect`. Non-damage effects are returned unchanged (the
 * penalty only applies to damage quantities; non-damage effect fields
 * have no `damage` to reduce). Damage is clamped at 0.
 */
function applyPenaltyToEffect(effect: CombatEffect, penalty: number): CombatEffect {
  switch (effect.kind) {
    case 'combat-attack':
      return { ...effect, damage: Math.max(0, effect.damage - penalty) };
    case 'combat-attack-stun':
      return { ...effect, damage: Math.max(0, effect.damage - penalty) };
    case 'combat-multishot':
      return { ...effect, damage: Math.max(0, effect.damage - penalty) };
    // Non-damage effects: record in tracker but field values unchanged.
    case 'combat-absorb':
    case 'combat-heal':
    case 'combat-draw':
    case 'combat-weaken':
    case 'combat-vulnerable':
      return effect;
    default: {
      const _exhaustive: never = effect;
      return _exhaustive;
    }
  }
}
