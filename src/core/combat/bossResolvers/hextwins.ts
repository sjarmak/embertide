/**
 * hextwins-fire-ice resolver (embertide-jghb — Spirit region-boss).
 *
 * 3-turn fire/ice/fire cycle keyed off `combat.turnIndex % 3`. Fire
 * turns deal `pattern.damagePerTurn` (already includes the
 * sandstorm-counter zone bump baked in at combat-entry). Ice turn
 * deals 0 damage but discards one card from each non-downed attacker's
 * main-board hand — the canonical "freeze a card" beat. Hand-discard
 * is end-of-hand to match tidewraith's chain-discard convention so the
 * removal is deterministic and doesn't leak shuffle information.
 */

import type { CombatState } from '../../../types/combat';
import type { KidPlayer } from '../../../store/types';
import type { BossResolveOutcome } from './types';

/**
 * Stable log fragments for resolver-test substring assertions.
 *
 * Tests in `combatEngine.hextwinsResolver.test.ts` import these
 * constants and assert `entry.includes(HEXTWINS_LOG_*)` instead of
 * hard-coding bare substring literals. The constant is the contract —
 * a flavor rephrasing that drops the fragment from the rendered log
 * without updating the constant will fail the test loudly.
 */
export const HEXTWINS_LOG_FIRE_HITS = 'fire blast hits for';
export const HEXTWINS_LOG_ICE_FREEZES = 'ice freezes';

export function hextwinsFireIceResolver(combat: CombatState): BossResolveOutcome {
  const dpt = combat.boss.attackPattern.damagePerTurn;
  const phase = combat.turnIndex % 3;
  if (phase === 1) {
    // Ice turn — 0 damage, freeze one hand-card per non-downed attacker.
    const sideEffect = (players: readonly KidPlayer[]): readonly KidPlayer[] => {
      return players.map((p) => {
        if (p.downed) return p;
        if (p.hand.length === 0) return p;
        const dropped = p.hand[p.hand.length - 1];
        return {
          ...p,
          hand: p.hand.slice(0, p.hand.length - 1),
          discard: [...p.discard, dropped],
        };
      });
    };
    return {
      damage: 0,
      combatLog: [`Hextwins: ${HEXTWINS_LOG_ICE_FREEZES} a card from your hand!`],
      playerSideEffect: sideEffect,
      combatPatch: {},
    };
  }
  // Fire turns (phase 0 + 2).
  return {
    damage: dpt,
    combatLog: [`Hextwins: ${HEXTWINS_LOG_FIRE_HITS} ${dpt}!`],
    playerSideEffect: null,
    combatPatch: {},
  };
}
