/**
 * Card-identity predicates used by combat-deck assembly and effect
 * routing. Pure / total — no store imports.
 */

import type { Card } from '../../types/card';

/**
 * Strip a trailing `-N` numeric suffix from a card id. Supply-minted
 * duplicates in `src/data/cards.ts` / `src/store/slices/` suffix fresh
 * copies with `-2`, `-3`, etc. (see `mintAlwaysAvailable`,
 * `grantWildBossFairy`). The base id is the authoring id from
 * `KID_CARDS`.
 */
export function baseIdOf(id: string): string {
  const match = id.match(/^(.*)-\d+$/);
  return match ? match[1] : id;
}

/**
 * Wisp identity check (PRD §B2). Fairies are excluded from the
 * combat deck — they remain main-board-revive only. The authoring
 * card id is `wisp`; wild-boss drops and chest loot mint duplicates
 * with numeric suffixes (`wisp-2`, `wisp-3`), so we compare the
 * stripped base id.
 */
export function isFairyCard(card: Card): boolean {
  return baseIdOf(card.id) === 'wisp';
}

/**
 * Starter ELIGIBILITY for the combat deck. §B2 + designer playtest
 * 2026-04-22 (rev-2): include ALL `starter-*` cards — green and red.
 * The 2026-04-21 exclusion was reversed because:
 *   - the surviving starter pool alone produced a ~9-card combat deck,
 *     too thin to survive even a single wild-boss combat before the
 *     hand ran empty (see player feedback 2026-04-22 — "two cards in
 *     hand and nothing to reshuffle").
 *   - starter-green / starter-red now carry distinct CombatEffect
 *     overrides (see src/data/combatEffects.ts): green → combat-draw 1
 *     (refills the hand), red → combat-attack 2 (stronger than the
 *     default 1). They are no longer inert filler.
 * j49z (2026-04-24): the third starter role (`starter-home`) was
 * retired entirely; the wildcard prefix gate still works because the
 * surviving starter roles share the `starter-` prefix.
 * Main-game eligibility is unchanged; this gate is scoped to
 * buildCombatDeck only.
 */
export function isCombatEligibleStarterRole(role: Card['role']): boolean {
  return role.startsWith('starter-');
}

/**
 * Is `card` active-item-ish? `item` and `legendary-sword` roles carry
 * the `itemKind` discriminant (u-2d). Only `item-active` cards
 * contribute to the combat deck; fairies are excluded elsewhere.
 */
export function isActiveItemCard(card: Card): boolean {
  if (card.role !== 'item' && card.role !== 'legendary-sword') return false;
  return card.itemKind === 'item-active';
}
