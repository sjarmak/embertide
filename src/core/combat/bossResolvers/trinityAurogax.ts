/**
 * trinity-aurogax-heads resolver (embertide-nlr8 — Colosseum
 * tier-5 capstone sequence-archetype boss).
 *
 * Reads the boss's sequence stateTag `currentIndex` (set BEFORE the
 * j0ik archetype tick advances it at end-of-boss-turn) and dispatches
 * the 3-head rotation:
 *
 *   - 'gloom-head': base dpt + gloom-flavor log (Demon-King power).
 *   - 'umbra-head': base dpt + ancient-arrow flavor log (Umbra
 *     ancient-tech).
 *   - 'auren-head': base dpt + auren sacred-machinery flavor log
 *     (Auren era).
 *
 * Per-head TARGETING variance is intentionally NOT modeled in v1.
 * `reduceBossResolve` reads `effectiveTargeting(boss)` BEFORE
 * dispatching the resolver, so per-step targeting overrides require
 * either a `combatPatch` overlay path or a reducer change. Per the
 * `nlr8` plan-phase decision, v1 keeps the spec's
 * `'battlefield-then-player'` targeting uniform across heads and
 * varies per-head flavor via `combatLog` only — heads telegraph
 * differently but route the same shape. Per-head targeting variance
 * is queued as a follow-up bead.
 *
 * Defensive default: when no sequence stateTag is present (or the
 * step name is unknown / empty steps), falls back to
 * `pattern.damagePerTurn` so behavior matches the legacy static-dpt
 * path. Numbers are illustrative — first-pass placeholders matching
 * the tier-5 dpt baseline (Trinity dpt=4); final tuning is a playtest
 * follow-up.
 */

import type { CombatState } from '../../../types/combat';
import type { BossResolveOutcome } from './types';
import { currentSequenceStep } from './sequenceStep';

/**
 * Stable log fragments for resolver-test substring assertions.
 *
 * Tests in `combatEngine.trinityAurogaxResolver.test.ts` import these
 * constants and assert `entry.toLowerCase().includes(TRINITY_AUROGAX_LOG_*)`
 * instead of hard-coding bare substring literals. The constant is the
 * contract — a flavor rephrasing that drops the fragment from the
 * rendered log without updating the constant will fail the test loudly.
 *
 * The umbra-head log uses two fragments (umbra/ancient) because the
 * existing test asserts on either keyword as a flavor-flexibility hook.
 */
export const TRINITY_AUROGAX_LOG_GLOOM = 'gloom';
export const TRINITY_AUROGAX_LOG_UMBRA = 'umbra';
export const TRINITY_AUROGAX_LOG_ANCIENT = 'ancient';
export const TRINITY_AUROGAX_LOG_AUREN = 'auren';

export function trinityAurogaxHeadsResolver(combat: CombatState): BossResolveOutcome {
  const baseDpt = combat.boss.attackPattern.damagePerTurn;
  const step = currentSequenceStep(combat.boss);

  if (step === 'gloom-head') {
    return {
      damage: baseDpt,
      combatLog: [
        `Trinity Aurogax's ${TRINITY_AUROGAX_LOG_GLOOM} head exhales Demon-King miasma for ${baseDpt}!`,
      ],
      playerSideEffect: null,
      combatPatch: {},
    };
  }

  if (step === 'umbra-head') {
    return {
      damage: baseDpt,
      combatLog: [
        `Trinity Aurogax's ${TRINITY_AUROGAX_LOG_UMBRA} head looses an ${TRINITY_AUROGAX_LOG_ANCIENT}-arrow strike for ${baseDpt}!`,
      ],
      playerSideEffect: null,
      combatPatch: {},
    };
  }

  if (step === 'auren-head') {
    return {
      damage: baseDpt,
      combatLog: [
        `Trinity Aurogax's ${TRINITY_AUROGAX_LOG_AUREN} head crackles with sacred machinery for ${baseDpt}!`,
      ],
      playerSideEffect: null,
      combatPatch: {},
    };
  }

  // Defensive default — no sequence tag, empty steps, or unknown step.
  return {
    damage: baseDpt,
    combatLog: [],
    playerSideEffect: null,
    combatPatch: {},
  };
}
