/**
 * Sequence-archetype end-of-boss-turn resolver (embertide-j0ik,
 * sub of lhlo + 4hr1). Second archetype resolver after eye (3986).
 * Pure boss-only transform — no `CombatState` dependency.
 *
 * State machine: applied at the end of each boss-turn, the resolver
 * advances the sequence-tag's `currentIndex` by 1 modulo
 * `steps.length`. The current step (the one indexed by `currentIndex`
 * BEFORE this tick) is the step that fired during the just-finished
 * boss-turn; the post-tick `currentIndex` names the step that will
 * fire on the NEXT boss-turn. Per-step damage/effect dispatch is
 * owned by per-consumer `bossAttackResolver` beads (e.g. trinity
 * aurogax 3-head dispatcher); this resolver only owns the pointer
 * advance.
 *
 * Shipped consumers (data already in place):
 *   - `COLOSSEUM_PHANTOM_VURMOX_T2` — 2-step ball-volley rotation.
 *   - `COLOSSEUM_TRINITY_AUROGAX_T5` — 3-step head rotation.
 */

import type { BossStateTag, CombatBoss } from '../../../types/combat';

/**
 * Apply one end-of-boss-turn Sequence-archetype tick to `boss`. Returns
 * the same reference when no transformation applies — lets the caller
 * use `result === boss` to short-circuit downstream work. No-ops when:
 *   - archetype is not `'sequence'`
 *   - `stateTags` is missing
 *   - no sequence tag is present
 *   - the sequence tag has fewer than 2 steps (defensive — a degenerate
 *     spec; 0 steps would NaN out modular arithmetic, and 1 step can
 *     never rotate so allocating a new boss object would silently break
 *     the same-reference no-op contract)
 */
export function applySequenceArchetypeTick(boss: CombatBoss): CombatBoss {
  if (boss.archetype !== 'sequence') return boss;
  const tags = boss.stateTags;
  if (!tags) return boss;

  const seqIndex = tags.findIndex((t) => t.kind === 'sequence');
  if (seqIndex < 0) return boss;
  const seqTag = tags[seqIndex];
  if (seqTag.kind !== 'sequence') return boss;
  if (seqTag.steps.length <= 1) return boss;

  const nextIndex = (seqTag.currentIndex + 1) % seqTag.steps.length;
  const nextSeq: BossStateTag = {
    kind: 'sequence',
    steps: seqTag.steps,
    currentIndex: nextIndex,
  };

  const nextTags = tags.slice();
  nextTags[seqIndex] = nextSeq;
  return { ...boss, stateTags: nextTags };
}
