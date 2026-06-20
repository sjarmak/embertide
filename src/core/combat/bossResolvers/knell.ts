/**
 * knell-drum resolver (embertide-x1qg — Shadow region-boss).
 *
 * 2-turn telegraph/slam cycle keyed off `combat.turnIndex % 2`. The
 * resolver emits 0 damage on telegraph turns (with a forecast log
 * entry that names the incoming slam value) and the full pattern dpt
 * on slam turns. The zone's shadow-creep adder is already baked into
 * `pattern.damagePerTurn` at combat-entry (see `enterCombatAction`),
 * so no additional state lookup is required.
 */

import type { CombatState } from '../../../types/combat';
import type { BossResolveOutcome } from './types';

/**
 * Stable log fragments for resolver-test substring assertions.
 *
 * Tests in `combatEngine.bongoBongoResolver.test.ts` import these
 * constants and assert `entry.includes(KNELL_LOG_*)` instead of
 * hard-coding bare substring literals. The constant is the contract —
 * a flavor rephrasing that drops the fragment from the rendered log
 * without updating the constant will fail the test loudly.
 */
export const KNELL_LOG_TELEGRAPH = 'drum-slam coming for';
export const KNELL_LOG_SLAM = 'slams for';

export function bongoBongoDrumResolver(combat: CombatState): BossResolveOutcome {
  const slamDpt = combat.boss.attackPattern.damagePerTurn;
  const phase = combat.turnIndex % 2;
  if (phase === 0) {
    // Telegraph turn — drum-warm-up. Forecast the incoming slam.
    return {
      damage: 0,
      combatLog: [`Knell: ${KNELL_LOG_TELEGRAPH} ${slamDpt} next turn!`],
      playerSideEffect: null,
      combatPatch: {},
    };
  }
  // Slam turn — full dpt to player-hp (targeting on the static pattern).
  return {
    damage: slamDpt,
    combatLog: [`Knell ${KNELL_LOG_SLAM} ${slamDpt}!`],
    playerSideEffect: null,
    combatPatch: {},
  };
}
