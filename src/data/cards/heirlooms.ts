/**
 * Heirloom items (u-9b, REQ-32).
 *
 * Five reward-only items minted into the defeater's `items` zone when a
 * wild boss is defeated via the encounter slot (u-9c wires the drop
 * routing). Heirlooms are NOT in SUPPLY_PLAN — they can never be
 * purchased through the center row. They ship as `role: 'item'` +
 * `itemKind: 'item-active'` so they are picked up by the existing
 * combat-deck builder (`buildCombatDeck` in src/core/combatEngine.ts)
 * without needing a new role or item-kind discriminant.
 *
 * Combat effects (declared per-card via `Card.combatEffect` since
 * embertide-bq9b / ppf9-7a, 2026-05-01 — moved off the
 * EXPLICIT_OVERRIDES map in src/data/combatEffects.ts):
 *   - `craghorn-tusk`        → combat-attack-stun (damage 4, stunTurns 1)
 *   - `boulderkin-core`  → combat-absorb (hp 4) PLUS Card.passive
 *                           on-damage damage-reduction +1 (ppf9.1
 *                           designer ruling 2026-04-29). The passive
 *                           layer carries the original "boss-only +1
 *                           heart" rock-armor intent; combat-absorb 4
 *                           stays so the heirloom still enters the
 *                           combat-deck as a played battlefield-card.
 *   - `sentinel-eye`      → combat-attack (damage 6). "Pierce" is a
 *                           no-op under current rules (player→boss
 *                           damage already bypasses battlefield);
 *                           combat-attack 6 promoted to permanent shape
 *                           per ppf9.1 designer ruling 2026-04-29.
 *                           Reskin to true pierce deferred until a
 *                           boss-side damage-absorb mechanic lands.
 *   - `chimera-sword`       → combat-attack (damage 7). Silver-Chimera sole
 *                           drop per v2.1 gm0.17 (embertide-0jf).
 *   - `rainbow-ancient-chimera-sword` → combat-attack (damage 8). Rare
 *                           post-completion drop (embertide-044).
 *
 * (v2.1 gm0.17 retired the `silver-chimera-mane` heirloom — Silver Chimera
 * now drops `chimera-sword` as the sole wild-boss heirloom via
 * HEIRLOOM_DROPS. No draw-capable heirloom remains in the game.)
 *
 * The main-board `effects` field uses the neutral `{kind:'gain'}` no-op
 * pattern — same as the wisp — because the in-combat effect is the
 * real mechanic and there is no on-play resource grant on the main
 * board. Card-face rules-text is handled by effectTextFor's baseId
 * branch.
 *
 * Cooldown: 0 turns across the board; heirlooms fire once per combat
 * (once drawn + played from the combat deck) and do not carry a
 * main-board cooldown readout.
 */

import type { Card } from '../../types/card';

// embertide-uz7k (wun Track B): heirloom main-phase fire — drop-only
// cards now grant a real on-play "trophy" reward when drawn into hand and
// played, in addition to their combat-effect override. Dispatcher lives in
// `applyHeirloomOnEquip` (slices/inventory.ts) and fires only when the
// item actually slots into the Items zone (cap-overflow falls back to
// inPlay/discard and skips the bonus, mirroring the equip-bonus contract).
const craghornTusk: Card = {
  id: 'craghorn-tusk',
  role: 'item',
  cost: { green: 0 },
  effects: { kind: 'gain', red: 2, keys: 1 },
  itemKind: 'item-active',
  cooldownTurns: 0,
  lastUsedTurn: null,
  combatEffect: { kind: 'combat-attack-stun', damage: 4, stunTurns: 1 },
  // Combat-attack-stun 4+1: deals damage AND stuns (counters a boss
  // action). Meaningful attack + control — hybrid of attack + tech.
  cardType: 'hybrid',
};

// embertide-uz7k: the audit doc spec'd `conditional-heart` /
// `when:'boss'` for boulderkin-core, but that EffectSpec was retired
// (see ranch-keeper at line ~76 — its boss-bonus now fires from a
// hardcoded baseId check in slices/combat.ts). Substituting a flat
// `gain { red: 1, keys: 1 }` keeps the heirloom power tier roughly equal
// to the conditional intent (boss-only +1 heart was the design, and
// boulderkin-core ranks slightly below craghorn-tusk) without re-introducing
// a retired schema. Documented in the bd-close memo.
//
// ppf9.1 (embertide-ppf9.1) — designer ruling 2026-04-29 (memory
// embertide-designer-ruling-ppf9-1-heirloom-passives-2026): the
// original boss-only-+1-heart intent is now carried by a Card.passive
// on-damage damage-reduction +1 (mirrors elysian-shield / tower-shield /
// iron-ward shape). Sole heirloom of the five with always-on flavour
// per the cinder-bloom 2026-04-29 precedent — animate-stone-armor
// qualifies; horns / eyes / swords don't. Combat-side absorb hp 4
// (EXPLICIT_OVERRIDES) is preserved so boulderkin-core still enters
// the combat-deck as a played battlefield-card. The passive is the
// fourth behaviour surface (effects + EXPLICIT_OVERRIDES +
// applyHeirloomOnEquip + Card.passive) — accepted on this one card per
// the ruling; broader consolidation deferred to a post-ppf9 epic.
const boulderkinCore: Card = {
  id: 'boulderkin-core',
  role: 'item',
  cost: { green: 0 },
  effects: { kind: 'gain', red: 1, keys: 1 },
  passive: {
    kind: 'item-passive',
    description: 'Reduce damage taken by 1',
    trigger: 'on-damage',
    effect: { kind: 'damage-reduction', amount: 1 },
  },
  itemKind: 'item-active',
  cooldownTurns: 0,
  lastUsedTurn: null,
  combatEffect: { kind: 'combat-absorb', hp: 4 },
  // Combat-absorb 4 + passive damage reduction — defensive counter to
  // boss damage. Specific answer to incoming damage. Tech.
  cardType: 'tech',
};

const sentinelEye: Card = {
  id: 'sentinel-eye',
  role: 'item',
  cost: { green: 0 },
  effects: { kind: 'draw', amount: 2 },
  itemKind: 'item-active',
  cooldownTurns: 0,
  lastUsedTurn: null,
  combatEffect: { kind: 'combat-attack', damage: 6 },
  // Main-board draws 2 cards (significant card advantage); combat-attack
  // 6 is a top-tier damage hit. Meaningfully spans two sub-classes:
  // attack (combat) + skill (main-board draw). Hybrid.
  cardType: 'hybrid',
};

// embertide-044 (2026-04-24): rare post-completion heirloom
// dropped by Prism Chimera (supersedes the fix-rainbow-chimera
// 'rainbow-prism' card — same mechanical slot, renamed to reflect
// the designer-corrected identity: the drop is an heirloom SWORD,
// not a prism crystal). Same shape as the other u-9b heirlooms
// (role=item, itemKind=item-active, neutral `{kind:'gain'}` no-op on
// the main board; the real mechanic is the combat-effect override in
// src/data/combatEffects.ts). Combat effect: `combat-attack` damage=8
// — the single most powerful attack card in the game, fitting the
// once-per-game completion reward stance. Because Rainbow is a bonus
// boss outside the core balance band (u-9f), its heirloom is likewise
// outside the heirloom power curve.
//
// Art: bespoke sword raster cathedral_item_rainbow_ancient_chimera_sword_001.webp
// (embertide-ydc, 2026-04-24) — tarnished silver-blue Ancient Sword with a
// rainbow-prismatic chromatic coat, echoing the Prism Chimera's aura.
// Replaces the earlier rainbow-prism placeholder (kept on disk for rollback).
const rainbowAncientChimeraSword: Card = {
  id: 'rainbow-ancient-chimera-sword',
  role: 'item',
  cost: { green: 0 },
  effects: { kind: 'gain', red: 2 },
  itemKind: 'item-active',
  cooldownTurns: 0,
  lastUsedTurn: null,
  combatEffect: { kind: 'combat-attack', damage: 8 },
  // Highest damage attack card in the game — post-completion reward.
  // Primarily deals damage. Attack.
  cardType: 'attack',
};

// v2.1 gm0.17 (embertide-0jf): `chimera-sword` is the SOLE Silver
// Chimera wild-boss drop (designer direction: "no chimera sword instead of
// mane"). Same "heirloom shape" as the other entries (role=item,
// itemKind=item-active, neutral `{kind:'gain'}` no-op on the main
// board; the real mechanic is the combat-effect override in
// src/data/combatEffects.ts: `combat-attack` damage=7). Routed via the
// primary `HEIRLOOM_DROPS` map — the gm0.15 `HEIRLOOM_DROPS_SECONDARY`
// dual-drop mechanism was retired along with `silver-chimera-mane`.
//
// Power: damage=7 sits between `sentinel-eye` (6) and
// `rainbow-ancient-chimera-sword` (8, the top-end post-completion
// reward). Silver Chimera is the last
// core wild boss before the Temple region boss (Vurmox) — a meaningful
// end-of-core-game weapon feels right for the encounter's difficulty.
const chimeraSword: Card = {
  id: 'chimera-sword',
  role: 'item',
  cost: { green: 0 },
  effects: { kind: 'gain', green: 1, red: 2 },
  itemKind: 'item-active',
  cooldownTurns: 0,
  lastUsedTurn: null,
  combatEffect: { kind: 'combat-attack', damage: 7 },
  // Combat-attack damage=7 — second-highest damage card. Primarily
  // deals damage. Attack.
  cardType: 'attack',
};

/**
 * The five heirloom items, in wild-boss drop order across the three
 * v2.0 zones (Sylvani → Emberpeak → Gilded Cage). Temple's FIFO
 * carries Sentinel + Silver Chimera; the Prism Chimera is a
 * dynamic-spawn post-completion encounter (embertide-044) whose
 * heirloom (`rainbow-ancient-chimera-sword`) lands via the same
 * HEIRLOOM_DROPS path. v2.1 gm0.17 retired `silver-chimera-mane`; Silver
 * Chimera now drops `chimera-sword` as its sole wild-boss heirloom.
 */
export const heirlooms: readonly Card[] = [
  craghornTusk,
  boulderkinCore,
  sentinelEye,
  chimeraSword,
  rainbowAncientChimeraSword,
];

/**
 * Lookup table: wild-boss card id → heirloom card id. u-9c reads this
 * when routing the drop from a wild-boss defeat. Region bosses are
 * intentionally absent — they drop shards (Power / Courage / Wisdom)
 * via the pre-existing combat-resolve hook, not heirlooms.
 */
export const HEIRLOOM_DROPS: Record<string, string> = {
  craghorn: 'craghorn-tusk',
  'boulderkin': 'boulderkin-core',
  sentinel: 'sentinel-eye',
  // v2.1 gm0.17 (embertide-0jf): Silver Chimera now drops `chimera-sword`
  // as its sole wild-boss heirloom (retiring `silver-chimera-mane` and the
  // `HEIRLOOM_DROPS_SECONDARY` dual-drop mechanism from gm0.15).
  'silver-chimera': 'chimera-sword',
  // embertide-044 (2026-04-24): rare post-completion wild boss →
  // rainbow-ancient-chimera-sword heirloom (combat-attack damage=8 via
  // EXPLICIT_OVERRIDES).
  'prism-chimera': 'rainbow-ancient-chimera-sword',
};
