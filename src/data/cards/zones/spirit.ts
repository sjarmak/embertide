/**
 * Dune Sanctum content (embertide-gdd.3, v2.1 zone 5).
 *
 * 4 regulars + 1 wild boss (iron-sentinel) + 1 region boss (hextwins).
 * The designer-review-approved roster lives in
 * `bd memories embertide-designer-ruling-dune-sanctum-substrate-2026-04-25`
 * (kid-6yo tone-pass: anubis-jackal-undead REJECTED for undead-density;
 * substituted scuttlespine sand-centipede). All cards carry
 * `zone: 'dune-sanctum'`; authoritative roster in
 * `ZONE_METADATA['dune-sanctum']` (src/rules/zones.ts).
 *
 * Tone pass: 'sun-bleached desert ruin' — bright/sandy not horror.
 * Bonereaver-desert is the single skeletal archetype (sun-bleached, not
 * crypt). Scuttlespine is a cartoon sand-centipede paired visually with
 * sandwyrm (segmented sand-burrower siblings). Iron-sentinel = armored
 * knight (helmet not skull). Hextwins = single-card sister-duo
 * (Koume + Kotake on one card; sister-duo lives in art/flavor only).
 *
 * Zone mechanic: sandstorm-counter ticks +1 per turn-end while in the
 * zone (cap 3, designer ruling 2026-04-25). Consumer:
 * `enterCombatAction` bumps boss `attackPattern.damagePerTurn` by
 * `state.sandstormCounter` at combat-entry time. Mirrors Shadow's
 * shadow-creep slice-hook one-for-one. Substrate-only flat-adder; the
 * memo's full discard-from-hand semantics defer to a follow-up bead
 * pending playtest data. Hextwins's fire/ice 3-turn cycle dynamic dpt
 * (gdd.3.2) and iron-sentinel's stagger (gdd.3.3) defer to follow-ups.
 *
 * r94e drop-variety: regulars carry the +1 hp baseline plus zone-
 * flavored extras (gem on sunbleached-reaver for skull-loot, key on
 * scuttlespine for desert-treasure flavor, no extra on duneweed / sandwyrm to
 * keep the roster from over-rewarding a single zone). Wild + region
 * bosses ship hearts + cardDraw per the wild/region-tier cadence
 * pattern.
 *
 * Art governance: data-layer only. All spirit cards ship with the
 * `[v2-art-pending]` art-pending tag. The art batch (~9 rasters /
 * ~0.45 FAL credits) requires explicit user sign-off before
 * generation — see gdd.2.1 ruling's designer-user-review precedent.
 */

import type { Card } from '../../../types/card';

// [v2-art-pending] duneweed — sand-burrowing plant regular. Standard
// regular shape: +1 hp on defeat. Mid red cost (3) — entry-tier spirit
// pressure. The roster memo's "burrow: skip 1 damage this turn"
// flavor is encoded as the simple monster-drop +1 hp baseline at the
// substrate level; richer effect-text wiring lives in a future
// effect-spec follow-up if/when designers want to add the burrow hook.
const duneweed: Card = {
  id: 'duneweed',
  role: 'monster',
  cost: { red: 3 },
  effects: { kind: 'monster-drop', hearts: 1 },
  zone: 'dune-sanctum',
};

// [v2-art-pending] sandwyrm — Wind Waker sand-worm juvenile regular.
// Drop: +1 hp + 2 hearts (juvenile-burrow flavor). The roster memo's
// "3 power but self-removes after 2 turns" semantics defer to an
// effect-spec follow-up; substrate ships schema-only with the base
// hp drop. Slightly stiffer red cost (4) reflects the swarm-burrow
// telegraph.
const sandwyrm: Card = {
  id: 'sandwyrm',
  role: 'monster',
  cost: { red: 4 },
  effects: { kind: 'monster-drop', hearts: 2 },
  zone: 'dune-sanctum',
};

// [v2-art-pending] sunbleached-reaver — sun-bleached cartoon-skeleton
// regular (the single skeletal archetype Spirit gets per the designer
// undead-density ruling — distinct from Gilded-cage bone-knight
// by flavor + art). Drop: +1 hp + 1 gem (skull-loot flavor). Standard
// red cost (3) — entry-tier spirit regular.
const sunbleachedReaver: Card = {
  id: 'sunbleached-reaver',
  role: 'monster',
  cost: { red: 3 },
  effects: { kind: 'monster-drop', hearts: 1, gems: 1 },
  zone: 'dune-sanctum',
};

// [v2-art-pending] scuttlespine — cartoon sand-centipede regular (SUBBED IN
// to replace anubis-jackal-undead per the designer ruling: two undead
// in one zone busted the kid-6yo undead-density bar). Drop: +1 hp +
// 1 key (desert-treasure flavor). Stiffer red cost (4) reflects the
// segmented-burrower silhouette.
const scuttlespine: Card = {
  id: 'scuttlespine',
  role: 'monster',
  cost: { red: 4 },
  effects: { kind: 'monster-drop', hearts: 1, keys: 1 },
  zone: 'dune-sanctum',
};

const spiritRegularsList: readonly Card[] = [duneweed, sandwyrm, sunbleachedReaver, scuttlespine];

// [v2-art-pending] iron-sentinel — armored-knight wild-boss for the
// Dune Sanctum (designer ruling: classic Dune-Sanctum mini-boss,
// helmet-not-skull silhouette, clear telegraphed heavy-swing —
// excellent 6yo fit). `bossTier: 'wild-boss'` drives the shared-HP
// combat path. HP=6 in BOSS_HP per the bead memo — leaner than the
// wild band to keep the heavy-swing fight inside [3, 5] turns. The
// stagger dynamic resolver (telegraphed big-hit + 1 turn stagger)
// ships as gdd.3.3 follow-up; substrate ships the spec's vanilla
// fallback (dpt=2 'heavy-swing', 'player-hp', wisp-drop) in
// bossAttackPatterns.ts. Drop: hearts 2 + cardDraw 1 (matches the
// wild-boss-tier cadence pattern from maelstrom / hollow-effigy). Wisp
// mint via `applyBossDefeatHooks` in combat.ts fires automatically
// (every wild-boss bossTier triggers).
//
// Keyword-glossary card text (embertide-lhlo.5, per
// `bd memories embertide-keyword-glossary-2026-05-02-designer-drop`):
//   "Layered (Iron Armor 4 HP, Bare Knight 2 HP). Combat — outer
//    armor must be defeated before the bare knight takes damage."
// Spec entry lives in src/data/zones/bossSpecs.ts; resolver wiring +
// telegraph affordance ship with lhlo.7 activation.
export const ironSentinel: Card = {
  id: 'iron-sentinel',
  role: 'mini-boss',
  cost: { red: 9, keys: 1 },
  effects: { kind: 'monster-drop', hearts: 2, cardDraw: 1 },
  bossTier: 'wild-boss',
  zone: 'dune-sanctum',
};

// [v2-art-pending] hextwins — Koume + Kotake sister-duo region-boss
// for the Dune Sanctum (designer ruling: SINGLE-CARD representation;
// sister-duo lives in art/flavor only — splitting into two cards
// would double cognitive load on the boss-encounter screen and break
// the one-target-per-region-boss pattern from Knell / Tidewraith).
// `bossTier: 'region-boss'` + id ===
// ZONE_METADATA['dune-sanctum'].regionBossId drives advanceZone in
// applyBossDefeatHooks. Defeat advances the active zone from
// 'dune-sanctum' → 'gilded-cage' (per the post-gdd.3 ZONE_ORDER),
// and resets the sandstorm-counter to 0 in advanceZone — see
// src/store/slices/zones.ts.
//
// Stats: red 14 + keys 1 (mid-tier region cost, mirrors tidewraith /
// knell); HP = 10 in BOSS_HP per the bead memo, sized small for
// the substrate vanilla pattern + sandstorm flat-adder. The fire/ice
// 3-turn cycle dynamic dpt is spec'd in gdd.3.2 follow-up (depends
// on Track B's resolver discriminator + the gdd.3 sandstorm slice).
// Until then hextwins's pattern is vanilla `battlefield-then-player`
// at dpt 2 (see bossAttackPatterns.ts).
//
// Keyword-glossary card text (embertide-lhlo.5, per
// `bd memories embertide-keyword-glossary-2026-05-02-designer-drop`):
//   "Sequence (Fire → Ice → Fire). Combat — each turn advances one
//    step; ice freezes a card from your hand; fire deals damage."
// Spec entry lives in src/data/zones/bossSpecs.ts; resolver wiring +
// telegraph affordance ship with lhlo.7 activation.
export const hextwins: Card = {
  id: 'hextwins',
  role: 'mini-boss',
  cost: { red: 14, keys: 1 },
  effects: { kind: 'monster-drop', hearts: 4 },
  bossTier: 'region-boss',
  zone: 'dune-sanctum',
};

/**
 * Dune Sanctum content (gdd.3). Exported for test lookup and zone-spawn
 * wiring. Ships in KID_CARDS / SUPPLY_PLAN below alongside the other zone
 * regulars + bosses.
 */
export const spiritRegulars: readonly Card[] = spiritRegularsList;
export const SPIRIT_REGULARS: readonly Card[] = spiritRegularsList;
export const SPIRIT_BOSSES: readonly Card[] = [ironSentinel, hextwins];
