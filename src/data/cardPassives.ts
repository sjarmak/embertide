import type { Card } from '../types/card';
import type { ItemPassiveEffect } from '../types/effectSpec';

/**
 * Single source of truth for reading item-passive effects off a Card
 * (embertide-ppf9.4.1). Concatenates two slots:
 *
 *   1. `Card.effects` — when its discriminant is `'item-passive'` (the
 *      legacy 4uyn shape; ten existing passive cards live here).
 *   2. `Card.passive` — the dedicated second-slot field landed by
 *      ppf9.4 for dual-behaviour items (e.g. an on-equip gem grant
 *      whose owner ALSO carries an `on-damage` reduction passive).
 *
 * Order is stable: effects-slot first, passive-slot second. This is
 * the contract dual-behaviour cards (ppf9.4.2 onward) iterate against.
 *
 * Mutual exclusion: a card declaring BOTH slots is malformed authoring.
 * The load-bearing enforcement is the test-time invariant in
 * `cardPassives.test.ts` ("every card in KID_CARDS satisfies the
 * mutual-exclusion contract"); this function additionally throws as a
 * defense-in-depth backstop so the malformed shape can never silently
 * fire two passives per item.
 *
 * Direct reads of `card.effects.kind === 'item-passive'` (or any
 * aliased `<member>.kind` discriminator on the literal `'item-passive'`)
 * are banned outside this module + `src/ui/effectText.tsx` (pending
 * ppf9.4.4) + tests by the `hc/no-raw-item-passive-read` ESLint rule.
 */
export function getPassives(card: Card): readonly ItemPassiveEffect[] {
  const out: ItemPassiveEffect[] = [];
  if (card.effects.kind === 'item-passive') {
    if (card.passive !== undefined) {
      throw new Error(
        `Malformed card '${card.id}': declares both Card.effects (item-passive) and Card.passive — these are mutually exclusive per ppf9.4 schema lock-in. Move one slot's payload or delete the other.`,
      );
    }
    // Discriminant narrows card.effects to ItemPassiveEffect here.
    out.push(card.effects);
  }
  if (card.passive !== undefined) {
    out.push(card.passive);
  }
  return Object.freeze(out);
}
