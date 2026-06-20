/**
 * Princess Aurelia (post-crystal reward, fix-aurelia 2026-04-22).
 *
 * When the Princess Crystal is struck (`strikePrincessCrystal` flips
 * `princessCrystal.freed = true`), a fresh copy of this card is granted
 * to BOTH players' decks. She's a shared team buff — freed, now
 * fighting with you.
 *
 * Mechanic: `role: 'hero'` post-ajx1 re-role (2026-04-26). Crystal-break
 * grant pushes her to player.discard (Ascension-canonical "card joins
 * your deck") instead of the items zone. The pre-ajx1 on-play
 * +2g/+2r/+1k bundle is CUT — that bundle was item-tier compensation
 * for the equip-on-the-items-zone lifecycle. As a hero, the princess's
 * unique value is her in-combat Light Arrow (combat-attack damage=5)
 * keyed by baseId in combatEffects.ts; no main-board resource rider is
 * needed and the user explicitly framed her as a "special card design"
 * with no cost.
 *
 * NOT in SUPPLY_PLAN (never purchasable through the center row). The
 * only acquisition path is the crystal-break grant in
 * `strikePrincessCrystal`.
 */

import type { Card } from '../../types/card';

/**
 * Canonical base id for the Freed Princess card (granted on crystal break).
 * Generic role-based id per the IP-safety contract — display name
 * (`Princess Aurelia`) lives in runtime theme (src/theme/generic.ts and the
 * runtime theme.example.json loader).
 */
export const FREED_PRINCESS_ID = 'freed-princess';

export const freedPrincess: Card = {
  id: FREED_PRINCESS_ID,
  // embertide-ajx1 (2026-04-26, user-ratified per memory key
  // embertide-redesign-ratifications-2026-04-26): re-roled from
  // 'item' → 'hero'. The {kind:'gain'} shim with no fields keeps the
  // EffectSpec union valid; the on-play hero dispatcher
  // (heroOnPlayDeltas) falls through to NO_DELTAS for
  // baseId='freed-princess', mirroring mountain-king's "in-combat
  // value, no on-play fire" pattern.
  role: 'hero',
  cost: { green: 0 },
  effects: { kind: 'gain' },
  // In-combat Light Arrow (damage=5 via EXPLICIT_OVERRIDES) is the
  // primary value — a powerful attack card granted on crystal break.
  cardType: 'attack',
};
