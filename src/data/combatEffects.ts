/**
 * Combat effects data sheet — maps every authored `Card` to its in-combat
 * behaviour (PRD §B5, u-8d).
 *
 * Schema source of truth: `src/types/combat.ts`. This module owns the
 * lookup table ONLY — no reducer logic, no state mutation.
 *
 * Contract:
 *  - `combatEffectFor(card)` is TOTAL: it returns a valid `CombatEffect`
 *    for every authored `Card` in the game's card universe (KID_CARDS,
 *    ALWAYS_AVAILABLE, GILDED_CAGE_REGULARS, and any future card data).
 *  - It never returns `undefined` and never throws.
 *
 * Default rule: non-overridden cards produce a `combat-attack` whose
 * damage equals the card's attack-like stat. The v2.0 `Card` shape does
 * not carry a top-level `power`/`red` field — the nearest analogue is
 * `card.cost.red`, which is the authoring-time "red cost" that thematic
 * content already uses to encode combat heft (e.g. scrabling red=5 is a
 * harder hit than thorn-scrub red=3). We read from `cost.red`, falling
 * back to 1 so cards with no red cost (heroes, green-only items, starter
 * greens) still resolve to a non-zero baseline attack.
 */

import type { Card } from '../types/card';
import type { CombatEffect } from '../types/combatEffect';

/**
 * Explicit thematic overrides keyed by `baseId`-style card id (v2.0's
 * authored ids are the same as their base id; duplicate supply copies
 * carry a `-2` / `-3` suffix and `baseIdOf(card)` recovers the template
 * id — handled inside `combatEffectFor` below).
 *
 * Kept as a map rather than a switch so the override set is greppable
 * and the test-table can import it for coverage assertions if needed.
 *
 * Current overrides:
 *  - `tower-shield`: small shield → `combat-absorb` with hp 2 (enters
 *    the front-line and absorbs 2 damage before falling).
 *  - `wisp`: main-board full-revive item whose in-combat thematic is
 *    healing → `combat-heal` with amount 3 (restore 3 hp to a
 *    battlefield card or non-downed player).
 *
 * NOTE (embertide-bq9b / ppf9-7a, 2026-05-01): the five u-9b heirlooms
 * (`craghorn-tusk`, `boulderkin-core`, `sentinel-eye`, `chimera-sword`,
 * `rainbow-ancient-chimera-sword`) declare their combat effect in-card via
 * `Card.combatEffect` rather than this override map. `combatEffectFor`
 * checks `card.combatEffect` first, then falls back to this map, then to
 * the `cost.red` default. The remaining ~25 non-heirloom overrides stay
 * here pending a broader migration (ppf9-7b follow-up).
 */
const EXPLICIT_OVERRIDES: Readonly<Record<string, CombatEffect>> = {
  // Designer playtest 2026-04-22 (rev-2): economy starters rejoin the
  // combat deck (see combatEngine.isCombatEligibleStarterRole) with
  // distinct combat roles so they aren't inert filler:
  //   - starter-green (green shard) → combat-draw 1. Refills the
  //     shared hand; pairs with reshuffle (drawIntoHand rng) so the
  //     "hand runs dry turn 3" death spiral goes away.
  //   - starter-red (red shard) → combat-attack 2. Thematically red
  //     is the combat resource; damage 2 is one step above the 1-
  //     damage default so drawing a red feels like a clean swing.
  'starter-green-shard': { kind: 'combat-draw', count: 1 },
  'starter-red-shard': { kind: 'combat-attack', damage: 2 },
  // ---------------------------------------------------------------------
  // embertide-2gp pass (2026-04-22): market cards get distinct
  // combat roles so owned heroes/items stop collapsing into 1-damage
  // filler in the rev-2 thicker combat deck. Every market hero /
  // always-available hero / market item gets a unique CombatEffect so
  // the 6-kind engine surface is actually exercised by drawn cards.
  //
  // Distribution:
  //   combat-attack:       water-warrior 3, wandering-merchant 2,
  //                        short-sword 2, militia-grunt 2,
  //                        ancient-blade 5 (legendary one-shot)
  //   combat-absorb:       sage-keeper 3, tower-shield 2, mystic 2
  //   combat-heal:         ranch-keeper 3
  //   combat-draw:         scholar-princess 2
  //   combat-multishot:    forest-sage 2×2, short-bow 1×3
  //   combat-attack-stun:  mountain-king 2 +1, curved-throwing-blade 2 +1
  // (embertide-1eby retired the key-vendor combat-draw entry —
  // Pell is a vendor service, not a deck card, so he never enters
  // combat.)
  //
  // Cost curves: higher-green-cost cards get bigger combat impact
  // (ancient-blade g6 → 5 dmg; scholar-princess / forest-sage / mountain-
  // king all g5 → pairs with their main-board utility).
  // ---------------------------------------------------------------------
  // Market heroes.
  'sage-keeper': { kind: 'combat-absorb', hp: 3 },
  'water-warrior': { kind: 'combat-attack', damage: 3 },
  'scholar-princess': { kind: 'combat-draw', count: 2 },
  'wandering-merchant': { kind: 'combat-attack', damage: 2 },
  'ranch-keeper': { kind: 'combat-heal', amount: 3 },
  'forest-sage': { kind: 'combat-multishot', damage: 2, shots: 2 },
  'mountain-king': { kind: 'combat-attack-stun', damage: 2, stunTurns: 1 },
  // Always-available heroes. `wild-wolf` is a monster and never enters
  // the combat deck, so no override is needed; it falls through to the
  // default combat-attack (damage = cost.red = 2) only reached by test
  // fixtures.
  mystic: { kind: 'combat-absorb', hp: 2 },
  'militia-grunt': { kind: 'combat-attack', damage: 2 },
  // Market items (tower-shield already overridden below; listed here
  // for locality of reasoning).
  'short-sword': { kind: 'combat-attack', damage: 2 },
  'short-bow': { kind: 'combat-multishot', damage: 1, shots: 3 },
  'curved-throwing-blade': {
    kind: 'combat-attack-stun',
    damage: 2,
    stunTurns: 1,
  },
  'ancient-blade': { kind: 'combat-attack', damage: 5 },
  'tower-shield': { kind: 'combat-absorb', hp: 2 },
  wisp: { kind: 'combat-heal', amount: 3 },
  // lhlo.23 §WEAKEN / §VULNERABLE keyword cards (embertide-lhlo.23).
  //   curse-charm   → weaken 2: hex-caster hero who saps the boss's next
  //                  attack, buying the team a safer window.
  //   shadow-veil   → vulnerable 3: scout hero who exposes the boss to a
  //                  burst turn — pairs with any multi-card attack combo.
  'curse-charm': { kind: 'combat-weaken', amount: 2 },
  'shadow-veil': { kind: 'combat-vulnerable', amount: 3 },
  // v2.1 gm0.16 wisp variants.
  //   - great-wisp      → combat-heal amount:5 (enhanced heal — rare
  //                        premium-item / boss-chest drop).
  //   - wisp-in-bottle  → combat-heal amount:3 (same as plain wisp;
  //                        the reusable-once-per-combat mechanic lives
  //                        in `playWispOn`, not the combat effect).
  'great-wisp': { kind: 'combat-heal', amount: 5 },
  'wisp-in-bottle': { kind: 'combat-heal', amount: 3 },
  // (Heirloom overrides — craghorn-tusk, boulderkin-core, sentinel-eye,
  // chimera-sword, rainbow-ancient-chimera-sword — moved to per-card
  // Card.combatEffect declarations in src/data/cards/heirlooms.ts per
  // embertide-bq9b / ppf9-7a, 2026-05-01.)
  // fix-aurelia (2026-04-22): Freed Princess's signature move — light
  // arrow, 5 damage to the boss. Granted to both players when the
  // crystal is struck (see src/store/slices/crystal.ts
  // strikePrincessCrystal). Display name "Princess Aurelia" lives in
  // runtime theme; the card id is generic per IP-safety policy.
  'freed-princess': { kind: 'combat-attack', damage: 5 },
  // -------------------------------------------------------------------
  // v2.1 gm0.15 (embertide-9hy): six new weapon/tool items.
  //
  // Five supply items (bow, boomerang, elysian-shield, cinder-bloom,
  // ancient-sword) + one heirloom (chimera-sword — sole Silver Chimera
  // wild-boss drop per v2.1 gm0.17 retiring of silver-chimera-mane; routed
  // via HEIRLOOM_DROPS). Each main-board shim pairs with a distinct
  // combat effect:
  //   bow           → multishot 2 × 2 shots (green:4 → 4 dmg budget).
  //   boomerang     → attack-stun 2 + stun 1 (green:4, stall tool).
  //   elysian-shield → absorb 4 (green:5 upgrade of tower-shield 2).
  //   cinder-bloom   → attack 4 single burst (green:4, repeatable per
  //                   existing cooldown hooks — not consumable).
  //   ancient-sword → attack 5 (green:6, legendary tier below
  //                   ancient-blade which also caps at 5 but lands
  //                   via the legendary-sword role).
  //   chimera-sword   → attack 7 (silver-chimera heirloom, sits between
  //                   sentinel-eye 6 and rainbow-ancient-chimera-sword 8).
  // -------------------------------------------------------------------
  bow: { kind: 'combat-multishot', damage: 2, shots: 2 },
  boomerang: { kind: 'combat-attack-stun', damage: 2, stunTurns: 1 },
  'elysian-shield': { kind: 'combat-absorb', hp: 4 },
  'cinder-bloom': { kind: 'combat-attack', damage: 4 },
  'ancient-sword': { kind: 'combat-attack', damage: 5 },
  // (chimera-sword's combat-attack 7 declaration migrated to
  // Card.combatEffect on the heirloom card itself — see heirlooms.ts.)
  // -------------------------------------------------------------------
  // embertide-akop: three item-check opener tools. Designer ruling
  // 2026-05-26 (memory embertide-designer-ruling-item-check-openers-
  // 2026-05-26). No reflect/pull combat primitive exists, so canon maps
  // onto combat-attack / combat-multishot:
  //   grapplethorn      → grapple-strike, single hit 3 (green:3 opener).
  //   grapnels     → Double Grapnels = 2 × 2 multishot (green:4).
  //   aegis-pane → reflect the beam into the eye, burst 4 (green:4);
  //                   offensive, NOT absorb (elysian-shield owns absorb).
  // -------------------------------------------------------------------
  grapplethorn: { kind: 'combat-attack', damage: 3 },
  grapnels: { kind: 'combat-multishot', damage: 2, shots: 2 },
  'aegis-pane': { kind: 'combat-attack', damage: 4 },
};

/**
 * Recover the canonical role-based id from a supply card. Duplicate
 * copies carry a `-<n>` suffix (see `buildSupply` / `mintAlwaysAvailable`
 * in `src/data/cards.ts`) and a `baseId` field. We look up the override
 * table by the base id so every duplicate copy resolves the same way.
 *
 * Inlined rather than imported from `cards.ts` to keep this module's
 * dependency footprint minimal (combat data should not pull in the
 * supply builder).
 */
function baseIdOfCard(card: Card): string {
  const withBase = card as Card & { readonly baseId?: string };
  return withBase.baseId ?? card.id;
}

/**
 * Resolve a `CombatEffect` for a card. TOTAL — returns a valid effect
 * for every `Card`, never `undefined`, never throws.
 *
 * Precedence (embertide-bq9b / ppf9-7a, 2026-05-01):
 *   1. `card.combatEffect` (in-card declaration; heirlooms ship this
 *      shape). Wins over the override map so authoring lives next to
 *      the rest of the card.
 *   2. `EXPLICIT_OVERRIDES[baseIdOf(card)]` (legacy keyed-map for the
 *      remaining ~25 non-heirloom overrides; broader migration is the
 *      ppf9-7b follow-up).
 *   3. `combat-attack` with `damage = card.cost.red ?? 1` (filler
 *      default for cards with no override authored).
 */
export function combatEffectFor(card: Card): CombatEffect {
  if (card.combatEffect) {
    return card.combatEffect;
  }
  const override = EXPLICIT_OVERRIDES[baseIdOfCard(card)];
  if (override) {
    return override;
  }
  const redCost = card.cost.red;
  const damage = typeof redCost === 'number' ? redCost : 1;
  return { kind: 'combat-attack', damage };
}
