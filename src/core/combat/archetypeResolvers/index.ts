/**
 * Archetype-resolver dispatch (embertide-3986, sub of lhlo).
 *
 * Per-archetype end-of-boss-turn ticks evolve `CombatBoss.stateTags`
 * by one step. Pure boss-only transforms — no `CombatState`
 * dependency. Distinct from `bossResolvers/` (which resolves the
 * boss's own attack each turn): archetype resolvers handle
 * cross-cutting state-tag bookkeeping (cycle counters, exposed
 * windows, layer transitions, etc.) and run AFTER the attack
 * resolves.
 *
 * Wired archetypes:
 *   - `'eye'` (embertide-3986) — guarded ↔ exposed cycle.
 *   - `'sequence'` (embertide-j0ik) — currentIndex modular advance.
 *   - `'item-check'` (embertide-swlb) — exposed{revertsTo} →
 *     guarded close-window cleanup. Companion open-trigger
 *     (`applyItemCheckOpenTrigger`, embertide-4hr1.1) is NOT in
 *     this end-of-boss-turn dispatch — it fires at player-card-play
 *     time and is invoked directly from `reducePlayerPlayCard`.
 *   - `'layered'` (embertide-lhlo.11) — registry peg only; no
 *     end-of-boss-turn state-tag evolution. Damage routing lives in
 *     `routeLayeredDamage` (damage.ts), called at player-attack sites.
 *   - `'duel'` (embertide-lhlo.14) — registry peg only; no
 *     end-of-boss-turn state-tag evolution. Adaptive penalty fires at
 *     player-card-play time via `applyDuelAdaptivePenalty` (duel.ts),
 *     called from `reducePlayerPlayCard`.
 *
 * Future archetypes (swarm) land as separate beads under lhlo.
 */

import type { BossArchetype, CombatBoss } from '../../../types/combat';
import { applyDuelArchetypeTick } from './duel';
import { applyEyeArchetypeTick } from './eye';
import { applyItemCheckArchetypeTick } from './itemCheck';
import { applyLayeredArchetypeTick } from './layered';
import { applySequenceArchetypeTick } from './sequence';

export type ArchetypeResolver = (boss: CombatBoss) => CombatBoss;

const ARCHETYPE_RESOLVERS: Partial<Record<BossArchetype, ArchetypeResolver>> = {
  eye: applyEyeArchetypeTick,
  sequence: applySequenceArchetypeTick,
  'item-check': applyItemCheckArchetypeTick,
  layered: applyLayeredArchetypeTick,
  duel: applyDuelArchetypeTick,
};

/**
 * Apply the registered archetype tick to `boss`. No-op when the boss
 * has no archetype declared or its archetype has no resolver wired
 * yet — returns the same reference for cheap caller-side
 * short-circuiting.
 */
export function applyArchetypeTick(boss: CombatBoss): CombatBoss {
  if (!boss.archetype) return boss;
  const resolver = ARCHETYPE_RESOLVERS[boss.archetype];
  if (!resolver) return boss;
  return resolver(boss);
}

export { applyDuelArchetypeTick, applyDuelAdaptivePenalty } from './duel';
export { applyEyeArchetypeTick, EYE_EXPOSED_BONUS, EYE_REVERT_GUARDED_UNTIL } from './eye';
export {
  applyItemCheckArchetypeTick,
  applyItemCheckOpenTrigger,
  ITEM_CHECK_EXPOSED_BONUS,
} from './itemCheck';
export { applyLayeredArchetypeTick, routeLayeredDamage } from './layered';
export { applySequenceArchetypeTick } from './sequence';
