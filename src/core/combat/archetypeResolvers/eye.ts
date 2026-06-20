/**
 * Eye-archetype end-of-boss-turn resolver (embertide-3986, sub of
 * lhlo). First consumer of the keyword-vocabulary substrate (k08m +
 * auft). Pure boss-only transform — no `CombatState` dependency.
 *
 * State machine, applied at the end of each boss-turn:
 *
 *   guarded + cycle(c, t)         (c+1 < t)  → guarded + cycle(c+1, t)
 *   guarded + cycle(c, t)         (c+1 >= t) → exposed{bonus} + cycle(0, t)
 *   exposed + cycle(c, t)                    → guarded{cycle-trigger} + cycle(0, t)
 *
 * Net effect: the boss spends `threshold` boss-turns guarded, then
 * exactly one boss-turn exposed (during which the player's NEXT turn
 * lands attacks against an exposed boss with `bonus` damage). The
 * exposed window closes at the boss-turn after it opened.
 *
 * The `bonus` payload is data-only at this resolver. The damage path
 * that consumes it lands in a follow-up bead
 * (kw.boss-state-resolver.eye-bonus-damage); for now this resolver
 * just makes the tag-evolution observable.
 */

import type { BossStateTag, CombatBoss } from '../../../types/combat';

/**
 * Damage bonus written onto the `BossStateExposed` tag when the
 * exposed window opens. Hardcoded to 1 for the entry-tier Eye
 * archetype; archetype-tier-scaled values can replace this constant
 * once the bonus-damage consumer lands.
 */
export const EYE_EXPOSED_BONUS = 1;

/**
 * Canonical `BossStateGuarded.until` flavor used when reverting from
 * exposed → guarded. The original `until` string from the source spec
 * (e.g. Coilworm's `'tail-exposed-cycle'`) is normalised to this name
 * after the first flip-cycle. Acceptable concession — the keyword
 * substrate doc treats `until` as flavor at this stage.
 *
 * Sibling note: `BossStateExposed.revertsTo` shipped in
 * embertide-swlb (item-check archetype's round-trip preservation).
 * Eye intentionally does NOT use it — the cycle-trigger constant is
 * the canonical eye revert flavor. If a future eye-tier needs
 * per-cycle revert variance, swap the constant for a `revertsTo` read.
 */
export const EYE_REVERT_GUARDED_UNTIL = 'cycle-trigger';

/**
 * Apply one end-of-boss-turn Eye-archetype tick to `boss`. Returns the
 * same reference when no transformation applies — lets the caller use
 * `result === boss` to short-circuit downstream work.
 */
export function applyEyeArchetypeTick(boss: CombatBoss): CombatBoss {
  if (boss.archetype !== 'eye') return boss;
  const tags = boss.stateTags;
  if (!tags) return boss;

  const cycleIndex = tags.findIndex((t) => t.kind === 'cycle');
  if (cycleIndex < 0) return boss;
  const cycleTag = tags[cycleIndex];
  if (cycleTag.kind !== 'cycle') return boss;

  const exposedIndex = tags.findIndex((t) => t.kind === 'exposed');
  if (exposedIndex >= 0) {
    return withTags(
      boss,
      replaceTwo(
        tags,
        exposedIndex,
        { kind: 'guarded', until: EYE_REVERT_GUARDED_UNTIL },
        cycleIndex,
        { kind: 'cycle', counter: 0, threshold: cycleTag.threshold, trigger: cycleTag.trigger },
      ),
    );
  }

  const guardedIndex = tags.findIndex((t) => t.kind === 'guarded');
  if (guardedIndex < 0) return boss;
  const guardedTag = tags[guardedIndex];
  if (guardedTag.kind !== 'guarded') return boss;

  const nextCounter = cycleTag.counter + 1;
  if (nextCounter >= cycleTag.threshold) {
    return withTags(
      boss,
      replaceTwo(tags, guardedIndex, { kind: 'exposed', bonus: EYE_EXPOSED_BONUS }, cycleIndex, {
        kind: 'cycle',
        counter: 0,
        threshold: cycleTag.threshold,
        trigger: cycleTag.trigger,
      }),
    );
  }

  return withTags(
    boss,
    replaceOne(tags, cycleIndex, {
      kind: 'cycle',
      counter: nextCounter,
      threshold: cycleTag.threshold,
      trigger: cycleTag.trigger,
    }),
  );
}

function withTags(boss: CombatBoss, stateTags: readonly BossStateTag[]): CombatBoss {
  return { ...boss, stateTags };
}

function replaceOne(
  tags: readonly BossStateTag[],
  index: number,
  next: BossStateTag,
): readonly BossStateTag[] {
  const out = tags.slice();
  out[index] = next;
  return out;
}

function replaceTwo(
  tags: readonly BossStateTag[],
  indexA: number,
  nextA: BossStateTag,
  indexB: number,
  nextB: BossStateTag,
): readonly BossStateTag[] {
  const out = tags.slice();
  out[indexA] = nextA;
  out[indexB] = nextB;
  return out;
}
