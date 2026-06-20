/**
 * tidewraith-tentacle-grab resolver (embertide-gdd.1.2 — Maren region-boss).
 *
 * Reads `combat.tideGaugeSnapshot` (frozen at COMBAT_ENTER), scales
 * dpt via `tidewraithTentacleGrabDpt`, and at the high-tide threshold
 * (`tideGauge >= 4`) applies a chain-discard side effect: every
 * non-downed attacker player drops one card from their main-board
 * hand. Both effects also fire the canonical telegraph log entry so
 * the player sees the gauge-driven escalation.
 */

import type { CombatState } from '../../../types/combat';
import type { KidPlayer } from '../../../store/types';
import type { BossResolveOutcome } from './types';

/**
 * Tuning constants for `tidewraith-tentacle-grab` (embertide-gdd.1.2).
 * Exported for test transparency; consumed only by the resolver below.
 */
export const TIDEWRAITH_TENTACLE_GRAB_BASE_DPT = 2;
export const TIDEWRAITH_TENTACLE_GRAB_MAX_DPT = 5;
export const TIDEWRAITH_TENTACLE_GRAB_HIGH_TIDE_THRESHOLD = 4;

/**
 * Stable log fragments for resolver-test substring assertions.
 *
 * Tests in `combatEngine.tidewraithResolver.test.ts` import these
 * constants and assert `entry.includes(TIDEWRAITH_LOG_*)` (or
 * `entry.startsWith(TIDEWRAITH_LOG_TELEGRAPH_PREFIX)`) instead of
 * hard-coding bare substring literals. The constant is the contract —
 * a flavor rephrasing that drops the fragment from the rendered log
 * without updating the constant will fail the test loudly.
 */
export const TIDEWRAITH_LOG_TELEGRAPH_PREFIX = 'Tidewraith gathers the tide';
export const TIDEWRAITH_LOG_WILL_HIT = 'will hit for';
export const TIDEWRAITH_LOG_TENTACLES_DRAG = 'tentacles drag';

/**
 * Compute tidewraith's tentacle-grab dpt from a tideGauge value.
 *
 * Curve: dpt = clamp(2, 2 + floor(tideGauge / 2), 5).
 *
 *   tideGauge=0 → 2  (entry-tier baseline)
 *   tideGauge=1 → 2
 *   tideGauge=2 → 3  (mid-zone bump)
 *   tideGauge=3 → 3
 *   tideGauge=4 → 4  (high-tide — also triggers chain-discard)
 *   tideGauge=5+ → 5 (capped; gauge clamps at TIDE_GAUGE_MAX=4 today
 *                     so this branch is unreachable in practice but
 *                     keeps the resolver future-proof for a higher cap)
 *
 * Pure / total / no NaN paths. Negative inputs (defensive against
 * malformed mocks) clamp at the base.
 */
export function tidewraithTentacleGrabDpt(tideGauge: number): number {
  const safe = Math.max(0, Math.floor(tideGauge));
  const raw = TIDEWRAITH_TENTACLE_GRAB_BASE_DPT + Math.floor(safe / 2);
  if (raw < TIDEWRAITH_TENTACLE_GRAB_BASE_DPT) return TIDEWRAITH_TENTACLE_GRAB_BASE_DPT;
  if (raw > TIDEWRAITH_TENTACLE_GRAB_MAX_DPT) return TIDEWRAITH_TENTACLE_GRAB_MAX_DPT;
  return raw;
}

/**
 * Chain-discard arithmetic: the bead spec says "discard 1 hand-card
 * per (tideGauge / threshold) tick" — at threshold=4 and gauge cap=4
 * that resolves to exactly 1 card per side-effect fire (since
 * floor(4/4)=1). The formula generalises naturally if the cap rises
 * later, so the resolver computes it dynamically.
 */
export function tidewraithTentacleGrabResolver(combat: CombatState): BossResolveOutcome {
  const tideGauge = combat.tideGaugeSnapshot ?? 0;
  const damage = tidewraithTentacleGrabDpt(tideGauge);

  const log = [`${TIDEWRAITH_LOG_TELEGRAPH_PREFIX}... ${TIDEWRAITH_LOG_WILL_HIT} ${damage} next turn`];

  const highTide = tideGauge >= TIDEWRAITH_TENTACLE_GRAB_HIGH_TIDE_THRESHOLD;
  if (!highTide) {
    return {
      damage,
      combatLog: log,
      playerSideEffect: null,
      combatPatch: {},
    };
  }

  // High-tide chain-discard side effect. One card per
  // floor(tideGauge / threshold) tick, applied to each non-downed
  // attacker. We discard from the END of the hand (most-recently-drawn
  // card) to keep removal deterministic and avoid leaking shuffle
  // information.
  const discardsPerPlayer = Math.max(
    1,
    Math.floor(tideGauge / TIDEWRAITH_TENTACLE_GRAB_HIGH_TIDE_THRESHOLD),
  );
  const sideEffect = (players: readonly KidPlayer[]): readonly KidPlayer[] => {
    return players.map((p) => {
      if (p.downed) return p;
      if (p.hand.length === 0) return p;
      const dropCount = Math.min(discardsPerPlayer, p.hand.length);
      const keep = p.hand.slice(0, p.hand.length - dropCount);
      const dropped = p.hand.slice(p.hand.length - dropCount);
      return {
        ...p,
        hand: keep,
        discard: [...p.discard, ...dropped],
      };
    });
  };

  return {
    damage,
    combatLog: [
      ...log,
      `Tidewraith's ${TIDEWRAITH_LOG_TENTACLES_DRAG} ${discardsPerPlayer === 1 ? 'a card' : `${discardsPerPlayer} cards`} into the tide!`,
    ],
    playerSideEffect: sideEffect,
    combatPatch: {},
  };
}
