/**
 * Item-Check-archetype resolvers (embertide-swlb close-window +
 * embertide-4hr1.1 open-window, subs of lhlo + 4hr1).
 *
 * Two pure boss-only transforms — neither has a `CombatState`
 * dependency.
 *
 * CLOSE-WINDOW (`applyItemCheckArchetypeTick`, swlb) — applied at the
 * end of each boss-turn:
 *
 *   exposed{revertsTo: guarded(until)}  →  guarded(until)
 *
 * The original `until` discriminant (e.g. `'item-tag-bomb'` for
 * Cinderwyrm) is preserved byte-for-byte across the round-trip via the
 * `BossStateExposed.revertsTo` substrate field — without preservation
 * the boss would forget which item-tag re-arms the guard each cycle.
 *
 * OPEN-WINDOW (`applyItemCheckOpenTrigger`, 4hr1.1) — applied when a
 * player plays a card during combat:
 *
 *   guarded(until) + card.tags ∋ until  →
 *     exposed{bonus, revertsTo: guarded(until)}
 *
 * The `revertsTo` payload preserves the original `BossStateGuarded`
 * verbatim so the close-window resolver can restore the exact same
 * `until` discriminant after the exposed window elapses.
 *
 * Both resolvers no-op (return the same reference) when their
 * preconditions don't hold — lets callers short-circuit downstream
 * work via `result === boss`.
 */

import type { BossStateTag, CombatBoss } from '../../../types/combat';
import type { Card } from '../../../types/card';

/**
 * Damage bonus written onto the `BossStateExposed` tag when the
 * Item-Check open-window trigger fires. Hardcoded to 1 to match the
 * entry-tier Eye archetype (`EYE_EXPOSED_BONUS`); per-tier or
 * per-card-tag scaling can replace this constant later if a future
 * spec asks for it.
 */
export const ITEM_CHECK_EXPOSED_BONUS = 1;

/**
 * Apply one end-of-boss-turn Item-Check-archetype tick to `boss`.
 * Returns the same reference when no transformation applies — lets the
 * caller use `result === boss` to short-circuit downstream work.
 */
export function applyItemCheckArchetypeTick(boss: CombatBoss): CombatBoss {
  if (boss.archetype !== 'item-check') return boss;
  const tags = boss.stateTags;
  if (!tags) return boss;

  const exposedIndex = tags.findIndex((t) => t.kind === 'exposed');
  if (exposedIndex < 0) return boss;
  const exposedTag = tags[exposedIndex];
  if (exposedTag.kind !== 'exposed') return boss;
  if (!exposedTag.revertsTo) return boss;

  const nextTags = tags.slice();
  nextTags[exposedIndex] = exposedTag.revertsTo;
  return { ...boss, stateTags: nextTags };
}

/**
 * Apply the Item-Check OPEN-WINDOW trigger when `card` has been played
 * against `boss`. Flips `guarded(until)` → `exposed{revertsTo:
 * guarded(until)}` when the card's `tags` include the boss's
 * `guarded.until` discriminant.
 *
 * No-op (returns the same reference) when:
 *   - archetype is not `'item-check'`
 *   - `boss.stateTags` is missing
 *   - the boss has no `guarded` tag (already exposed, or break-only)
 *   - the guarded tag has no `until` discriminant (degenerate spec)
 *   - the played card has no `tags` (or empty tags)
 *   - none of the card's tags match the guard's `until`
 *
 * The triggering play does NOT itself benefit from the new exposed
 * `bonus` — `applyPlayerEffect` reads `exposedBonusFor(boss)` BEFORE
 * the open-trigger fires, mirroring the eye archetype's "flip at
 * end-of-boss-turn → next-play benefits" cadence. Subsequent plays
 * within the same players-turn DO see the bonus through the same
 * `exposedBonusFor` read on the updated boss.
 */
export function applyItemCheckOpenTrigger(boss: CombatBoss, card: Card): CombatBoss {
  if (boss.archetype !== 'item-check') return boss;
  const tags = boss.stateTags;
  if (!tags) return boss;

  const cardTags = card.tags;
  if (!cardTags) return boss;

  const guardedIndex = tags.findIndex((t) => t.kind === 'guarded');
  if (guardedIndex < 0) return boss;
  const guardedTag = tags[guardedIndex];
  if (guardedTag.kind !== 'guarded') return boss;
  if (!guardedTag.until) return boss;
  if (!cardTags.includes(guardedTag.until)) return boss;

  const exposedTag: BossStateTag = {
    kind: 'exposed',
    bonus: ITEM_CHECK_EXPOSED_BONUS,
    revertsTo: { kind: 'guarded', until: guardedTag.until },
  };

  const nextTags = tags.slice();
  nextTags[guardedIndex] = exposedTag;
  return { ...boss, stateTags: nextTags };
}
