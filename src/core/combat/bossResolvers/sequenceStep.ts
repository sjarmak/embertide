/**
 * Sequence-archetype step-name lookup helper (embertide-nlr8).
 *
 * Per-step `bossAttackResolver` ids (e.g. `phantom-vurmox-volley`,
 * `trinity-aurogax-heads`) all share the same lookup shape: find the
 * boss's sequence stateTag, return `steps[currentIndex]` (the step
 * firing during the just-finished boss-turn — the j0ik archetype tick
 * that advances `currentIndex` runs AFTER the resolver). Returns
 * `null` when the boss has no sequence tag, an empty steps list, or
 * a `currentIndex` outside the steps range; the caller falls back to
 * `pattern.damagePerTurn` for legacy parity.
 */

import type { CombatBoss } from '../../../types/combat';

/**
 * @internal — shared between sibling per-consumer resolvers in this
 * directory (`phantomVurmox.ts`, `trinityAurogax.ts`). Not re-exported
 * from `bossResolvers/index.ts`; reach for it from a sibling file
 * only.
 */
export function currentSequenceStep(boss: CombatBoss): string | null {
  const tags = boss.stateTags;
  if (!tags) return null;
  const seq = tags.find((t) => t.kind === 'sequence');
  if (!seq || seq.kind !== 'sequence') return null;
  if (seq.steps.length === 0) return null;
  // Explicit bounds check — without `noUncheckedIndexedAccess` in
  // tsconfig, indexed access narrows to `string` even when the index
  // could be out of range. Defensive against malformed specs that set
  // `currentIndex >= steps.length`.
  if (seq.currentIndex < 0 || seq.currentIndex >= seq.steps.length) return null;
  return seq.steps[seq.currentIndex];
}
