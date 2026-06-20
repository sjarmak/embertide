/**
 * iron-sentinel-stagger resolver (embertide-2iyv — Spirit wild-boss).
 *
 * 3-turn wind-up / heavy-swing / stagger cycle keyed off
 * `combat.turnIndex % 3`. Wind-up turn deals `pattern.damagePerTurn`
 * (already includes the sandstorm zone bump) AND emits a forecast log
 * for the upcoming burst. Heavy-swing turn deals dpt + 1 — the
 * telegraphed big-hit. Stagger turn deals 0 damage with an
 * armor-cracks log; this is the player's reward window for surviving
 * the burst.
 */

import type { CombatState } from '../../../types/combat';
import type { BossResolveOutcome } from './types';

export const IRON_SENTINEL_BURST_BONUS = 1;

/**
 * Stable log fragments for resolver-test substring assertions.
 *
 * Tests in `combatEngine.ironKnuckleResolver.test.ts` import these
 * constants and assert `entry.includes(IRON_SENTINEL_LOG_*)` instead of
 * hard-coding bare substring literals. The constant is the contract —
 * a flavor rephrasing that drops the fragment from the rendered log
 * without updating the constant will fail the test loudly.
 */
export const IRON_SENTINEL_LOG_WINDUP = 'winds up';
export const IRON_SENTINEL_LOG_HEAVY_SWING = 'heavy swing';
export const IRON_SENTINEL_LOG_STAGGERED = 'staggered';
export const IRON_SENTINEL_LOG_ARMOR_CRACKS = 'armor cracks';

export function ironKnuckleStaggerResolver(combat: CombatState): BossResolveOutcome {
  const baseDpt = combat.boss.attackPattern.damagePerTurn;
  const phase = combat.turnIndex % 3;
  if (phase === 0) {
    // Wind-up — base dpt + forecast log for the burst.
    return {
      damage: baseDpt,
      combatLog: [
        `Iron-sentinel ${IRON_SENTINEL_LOG_WINDUP} — ${IRON_SENTINEL_LOG_HEAVY_SWING} of ${baseDpt + IRON_SENTINEL_BURST_BONUS} next turn!`,
      ],
      playerSideEffect: null,
      combatPatch: {},
    };
  }
  if (phase === 1) {
    // Heavy-swing burst — base dpt + 1.
    return {
      damage: baseDpt + IRON_SENTINEL_BURST_BONUS,
      combatLog: [
        `Iron-sentinel: ${IRON_SENTINEL_LOG_HEAVY_SWING} connects for ${baseDpt + IRON_SENTINEL_BURST_BONUS}!`,
      ],
      playerSideEffect: null,
      combatPatch: {},
    };
  }
  // Stagger turn — 0 damage, armor cracks.
  return {
    damage: 0,
    combatLog: [
      `Iron-sentinel is ${IRON_SENTINEL_LOG_STAGGERED} — ${IRON_SENTINEL_LOG_ARMOR_CRACKS}!`,
    ],
    playerSideEffect: null,
    combatPatch: {},
  };
}
