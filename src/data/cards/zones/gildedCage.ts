/**
 * Gilded-cage content (u-6c, amendment A5).
 *
 * Five regular enemies (NOT in KID_CARDS / SUPPLY_PLAN — accessed by id
 * via ZONE_METADATA['gilded-cage'].regularEnemyIds) plus the four
 * bosses that close out v2.0's zone spine:
 *   - Sentinel       (wild-boss, ~2 copies) — laser-beam thematic
 *   - Silver Chimera   (wild-boss, 1 copy, HARDER than Sentinel)
 *   - Cagewright Vurmox (region-boss, 1 copy, final fight)
 *   - Prism Chimera (post-completion bonus wild-boss)
 *
 * Stat contract (acceptance b, u-6c-bosses):
 *   Silver Chimera.hp    >= round(Sentinel.hp    * 1.5)
 *   Silver Chimera.power >= round(Sentinel.power * 1.5)
 * where `hp` maps to monster-drop.hearts and `power` maps to cost.red for
 * v2.0. Sentinel (red 10 / hearts 2) → Chimera floor (red 15 / hearts 3).
 *
 * Vurmox stat stance: red 18 + keys 2 + hearts 4 — matches the
 * region-boss heart-drop tier (broodmaw 4, ashen-tyrant 4 post
 * embertide-ycj 2026-04-22) and exceeds every wild boss.
 *
 * Post-REQ-32 (u-9a): the wild-bosses-cleared gate is retired. Vurmox is
 * always engageable once Gilded Cage is the active zone via
 * `currentRegionBossForZone`; Sentinel and Silver Chimera occupy the
 * parallel wild slot via `currentWildBossForZone` and are NOT a
 * pre-requisite for the region fight.
 */

import type { Card } from '../../../types/card';

const gildedCageRegularsList: readonly Card[] = [
  {
    // Laser turret — fires through the Temple's high halls. The "no
    // encounter hook" in v2.0 is represented as a plain baseline drop;
    // the thematic flavor is the stiffer 4-red cost relative to Sylvani
    // regulars. No key cost, no key drop.
    // Art follow-up: embertide-1ui (wardeye raster + ornament).
    id: 'wardeye',
    role: 'monster',
    cost: { red: 4 },
    effects: { kind: 'monster-drop', hearts: 1 },
  },
  {
    // Status-tick wisp — small cheap red cost (3) offset by a slightly
    // bigger heal burst when its flame pops. Hearts=2 represents the
    // "status tick" flavor: defeating it releases the pent-up charge
    // back to the defender as HP.
    // Art follow-up: embertide-h3o (bubble raster + ornament).
    id: 'emberskull',
    role: 'monster',
    cost: { red: 3 },
    effects: { kind: 'monster-drop', hearts: 2 },
  },
  {
    // Pickpocket puddle — eats your stuff and spits it back on defeat.
    // Thematic "drop a key" resolves via MonsterDropEffect.keys (u-6c
    // extension). Hearts=1 baseline +1 key on defeat.
    // Art follow-up: embertide-4sm (gulpmaw raster + ornament).
    id: 'gulpmaw',
    role: 'monster',
    cost: { red: 4 },
    effects: { kind: 'monster-drop', hearts: 1, keys: 1 },
  },
  {
    // Teleporting mage — the disable thematic is encoded as a key cost
    // (costs a key to "pin" for engagement). Rewards a bigger hearts=3
    // heal to compensate for the combined red+key tax. Highest red-cost
    // heal reward in the zone.
    // Art follow-up: embertide-39o (hexrobe raster + ornament).
    id: 'hexrobe',
    role: 'monster',
    cost: { red: 5, keys: 1 },
    effects: { kind: 'monster-drop', hearts: 3 },
  },
  {
    // Armored reanimated knight — highest red cost (6) encodes the
    // counterattack thematic. Hearts=2 + keys=1 drop: +1 HP heal per
    // REQ-2 baseline plus a bonus HP and a recovered key for slogging
    // through the fight. Hardest regular in Gilded Cage.
    // Art follow-up: embertide-25d (bone-knight raster + ornament).
    id: 'bone-knight',
    role: 'monster',
    cost: { red: 6 },
    effects: { kind: 'monster-drop', hearts: 2, keys: 1 },
  },
];

/**
 * Gilded-cage regular enemies (u-6c). Exported for test lookup and
 * for future zone-spawn wiring. NOT in KID_CARDS / SUPPLY_PLAN — zone
 * cards are accessed by id through `ZONE_METADATA['gilded-cage']
 * .regularEnemyIds`. The 5 cards here match `regularEnemyIds` exactly.
 */
export const GILDED_CAGE_REGULARS: readonly Card[] = gildedCageRegularsList;

// Sentinel — Gilded Cage wild boss #1. `bossTier: 'wild-boss'` drives
// the `applyBossDefeatHooks` wild-boss branch in combat.ts: appends 'sentinel'
// to state.defeatedBossIds (the wild slot then advances to 'silver-chimera'
// via `currentWildBossForZone`) and grants a fresh wisp via grantWildBossWisp.
// NO shard grant. Thematic: laser-beam defender of the cathedral interior —
// the unique on-defeat effect is the elevated hearts=2 drop + wisp reward.
//
// Keyword (lhlo.6, ZONE_BOSS_SPECS['sentinel']): Item-Check —
// **Guarded** until *item-tag-aegis-pane* (laser-reflect canon =
// aegis-pane gate). Forward-compat metadata only; no live consumer
// until lhlo.7 activation.
//
// Art landed: embertide-6gv — cathedral_monster_sentinel.json +
// /illustrations/cathedral_monster_sentinel_001.webp (nano-banana-pro 2K,
// teal-cyan palette, hex_lattice seg, mechanical_aperture ornament).
const sentinel: Card = {
  id: 'sentinel',
  role: 'mini-boss',
  cost: { red: 10, keys: 1 },
  effects: { kind: 'monster-drop', hearts: 2 },
  bossTier: 'wild-boss',
  zone: 'gilded-cage',
};

// Silver Chimera — Gilded Cage wild boss #2. HARDER than Sentinel per
// acceptance (b): hearts >= round(Sentinel.hearts * 1.5) AND red >=
// round(Sentinel.red * 1.5). Sentinel (red 10 / hearts 2) → Chimera floor
// (red 15 / hearts 3). Stone-silver mounted charge thematic is carried by
// the +3 hearts drop (tallest wild-boss heal in v2.0) and the keyed cost.
// Same wild-boss defeat mechanics as Sentinel — recordBossDefeat + wisp
// drop, no shard.
//
// Keyword (lhlo.6, ZONE_BOSS_SPECS['silver-chimera']): Duel —
// **Adaptive 3** (the first repeated card-kind each turn lands at -3
// effect). Locked by spec — Chimera listed under duel; sits one knob
// above COLOSSEUM_CHIMERA_T2 (penalty:2). Forward-compat metadata only;
// no live consumer until lhlo.7 activation.
//
// Art landed: embertide-a9t — cathedral_monster_silver_chimera.json +
// /illustrations/cathedral_monster_silver_chimera_001.webp (nano-banana-pro 2K,
// silver-gray palette, broken_spires seg, cathedral_arch ornament).
const silverChimera: Card = {
  id: 'silver-chimera',
  role: 'mini-boss',
  cost: { red: 15, keys: 1 },
  effects: { kind: 'monster-drop', hearts: 3 },
  bossTier: 'wild-boss',
  zone: 'gilded-cage',
};

// Cagewright Vurmox — Gilded Cage region boss / v2.0 final fight.
// `bossTier: 'region-boss'` drives the region-boss branch in
// applyBossDefeatHooks: recordBossDefeat + advanceZone. Because
// gilded-cage is the terminal zone in ZONE_ORDER, advanceZone:
//   (1) appends 'gilded-cage' to zoneHistory (u-5b amendment), and
//   (2) fires checkCourageUnlock — which flips sharedEmbertide.courage
//       to true the first time the full 3-zone sequence is in history.
// combat.ts layers an EXPLICIT sharedEmbertide.power = true flip on
// defeated.id === 'cagewright-vurmox' in the same defeat transaction —
// Vurmox is the ONLY card in v2.0 that grants Power. Both shard flips
// happen in one returned KidGameState.
//
// Spawn gates (post-REQ-32, u-9a):
//   (1) `currentRegionBossForZone('gilded-cage')` returns 'cagewright-vurmox'
//       whenever the zone is active and Vurmox is not yet defeated — no
//       wild-boss pre-requisite.
//   (2) Session-arc Climax-phase (turn 9+) gate in u-7
//       (src/store/slices/session.ts).
//
// Role stance: 'mini-boss' (not 'final-boss') to keep cards.test.ts
// role-count invariants stable — legacy `dark-lord` remains the sole
// 'final-boss' carrier. The "final fight" identity is carried by zone
// affinity + regionBossId + the dual shard flip on defeat.
//
// Keyword (lhlo.6, ZONE_BOSS_SPECS['cagewright-vurmox']): Sequence —
// 3-step rotation [gloom-charge → bolt-volley → sword-strike] capturing
// the canonical 75/50/25 HP-threshold cadence of multi-phase Vurmox.
// Mirrors COLOSSEUM_TRINITY_AUROGAX_T5's 3-step capstone shape; the
// multi-phase HP-threshold consumer is OUT OF SCOPE here (file
// follow-up bead). Forward-compat metadata only; no live consumer
// until lhlo.7 activation.
//
// Art landed: embertide-aph — cathedral_monster_cagewright_vurmox.json +
// /illustrations/cathedral_monster_cagewright_vurmox_001.webp (nano-banana-pro 2K,
// crimson+gold palette, radial_halo seg, cathedral_arch ornament — highest
// governance-weight surface in the v2.0 ship).
const cagewrightVurmox: Card = {
  id: 'cagewright-vurmox',
  role: 'mini-boss',
  cost: { red: 18, keys: 2 },
  effects: { kind: 'monster-drop', hearts: 4 },
  bossTier: 'region-boss',
  zone: 'gilded-cage',
};

// Prism Chimera — rare post-completion wild boss
// (embertide-044, 2026-04-24; supersedes the fix-rainbow-chimera
// 'prism-chimera' card — Prism Chimera is a SEPARATE
// variant from the regular Silver Chimera, not a rainbow-coated silver
// chimera). Dynamic-spawn encounter rolled once at Silver Chimera's
// defeat via `computePrismChimeraSpawnChance` in
// src/rules/zones.ts; no longer part of Gilded Cage's FIFO
// wild-boss queue. The encounter is intentionally OUTSIDE the normal
// boss-band balance curve (u-9f) — a bonus climax once Silver Chimera
// falls. Stats ~2× Silver Chimera HP and ~1.5× dpt; live in
// src/data/bossAttackPatterns.ts. Heirloom drop:
// `rainbow-ancient-chimera-sword` (raw damage=8 combat-attack, single
// most powerful attack card in the game — fitting post-completion
// reward). Same wild-boss defeat mechanics as Silver Chimera
// (recordBossDefeat + wisp drop via combat.ts).
//
// IP-safety: the id contains 'golden', 'rainbow', and 'chimera' — none
// is in the FORBIDDEN_SUBSTRINGS list in cards.test.ts (only 'aurelia',
// 'link', 'vurmox', 'embertide', 'emberblade', 'elysia' are
// protected).
//
// Keyword (lhlo.6, ZONE_BOSS_SPECS['prism-chimera']): Duel —
// **Adaptive 4** (the first repeated card-kind each turn lands at -4
// effect). Chimera-class Adaptive variant sitting one knob above
// silver-chimera (penalty:3); the post-completion encounter earns the
// tightest duel-discipline knob in v2.0. The dynamic-spawn path
// (`computePrismChimeraSpawnChance`, src/rules/zones.ts) reads
// this spec via the same Card.id lookup so the lhlo.7 telegraph
// affordance fires identically with the FIFO queue path.
//
// Art: cathedral_monster_prism_chimera_001.webp (raster file
// name intentionally retained from the prior ship — the existing
// golden-chrome prismatic raster already depicts this variant).
const prismChimera: Card = {
  id: 'prism-chimera',
  role: 'mini-boss',
  cost: { red: 22, keys: 1 },
  // On-defeat: +5 hearts — tallest heal in v2.0 (above Vurmox's 4). The
  // rare post-completion encounter earns the biggest bite-reward in the
  // heal table.
  effects: { kind: 'monster-drop', hearts: 5 },
  bossTier: 'wild-boss',
  zone: 'gilded-cage',
};

/**
 * Gilded-cage bosses (u-6c-bosses + embertide-044). Exported for
 * test lookup. NOT in GILDED_CAGE_REGULARS — bosses ship in KID_CARDS +
 * SUPPLY_PLAN below.
 */
export const GILDED_CAGE_BOSSES: readonly Card[] = [
  sentinel,
  silverChimera,
  cagewrightVurmox,
  prismChimera,
];
