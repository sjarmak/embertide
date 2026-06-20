/**
 * Hollow Shrine content (embertide-gdd.2, v2.1 zone 4).
 *
 * 4 regulars + 1 wild boss (hollow-effigy) + 1 region boss (knell).
 * The designer-review-approved roster lives in
 * `bd memories embertide-designer-ruling-shadow-roster-2026-04-24`
 * (kid-6yo tone-pass: gibdo / redead / palegrasp rejected; substituted
 * willowisp / softened graspling + knell art per gdd.2.1). All cards
 * carry `zone: 'hollow-shrine'`; authoritative roster in
 * `ZONE_METADATA['hollow-shrine']` (src/rules/zones.ts).
 *
 * Tone pass: 'moonlit-haunt' per gdd.2.2 art-direction brief — spooky-
 * but-friendly, NOT horror. Graspling reads as 'cartoon oven-mitt'
 * (stitched silhouette + googly eyes, drop-from-ceiling telegraph
 * preserved). Bonelet = Pixar-Coco skeleton-kid. Willowisp = friendly-
 * lantern-ghost. Knell = taiko-drummer ghost (no stump/blood).
 *
 * Zone mechanic: shadow-creep counter ticks +1 per turn-end while in
 * the zone (cap 3, designer ruling 2026-04-25). Consumer:
 * `enterCombatAction` bumps boss `attackPattern.damagePerTurn` by
 * `state.shadowCreep` at combat-entry time. Mirrors Maren's tide-gauge
 * slice-hook one-for-one; differs in that the consumer is a flat damage
 * adder (NOT a deferred dynamic-pattern resolver — that pattern lands
 * for hollow-effigy's delayed-echo + knell's drum-telegraph in
 * gdd.2.4 / embertide-x1qg follow-ups).
 *
 * r94e drop-variety: regulars carry the +1 hp baseline plus zone-
 * flavored extras (gem on bonelet for skull-loot, key on graspling
 * for grab-flavor, no extra on willowisp / duskwing to keep the roster
 * from over-rewarding a single zone). Wild + region bosses ship hearts
 * + cardDraw per the wild/region-tier cadence pattern.
 *
 * Art governance: data-layer only. The art batch (~9 rasters / ~0.45
 * FAL credits) shipped via embertide-sqm6 — rasters live under
 * `public/illustrations/cathedral_monster_<id>_001.webp` and route
 * through `SPEC_BY_BASE_ID` in `src/ui/CardArt.tsx`. Zone backdrop +
 * boss combat BGs wired in `CombatScreen.tsx` `ZONE_BACKGROUND_SRC`;
 * boss-door portrait wired in `BossAltarVariants.tsx`.
 */

import type { Card } from '../../../types/card';

// willowisp — friendly-lantern-ghost regular. Standard
// regular shape: +1 hp on defeat. Mid red cost (3) — entry-tier shadow
// pressure. The roster memo's "on-play 2 power + 1 reveal" lantern
// flavor is encoded as the simple monster-drop +1 hp baseline at the
// substrate level; richer effect-text wiring lives in a future
// effect-spec follow-up if/when designers want to add the reveal hook.
const willowisp: Card = {
  id: 'willowisp',
  role: 'monster',
  cost: { red: 3 },
  effects: { kind: 'monster-drop', hearts: 1 },
  zone: 'hollow-shrine',
};

// graspling — cartoon oven-mitt drop-from-ceiling
// regular (gdd.2.1 art note: stitched silhouette + googly eyes, no
// severed-hand horror). Drop layered: +1 hp + 1 key — the "grab"
// flavor encoded as a recovered key. Mid red cost (4) reflects the
// telegraph/grab pattern.
const graspling: Card = {
  id: 'graspling',
  role: 'monster',
  cost: { red: 4 },
  effects: { kind: 'monster-drop', hearts: 1, keys: 1 },
  zone: 'hollow-shrine',
};

// bonelet — Pixar-Coco-style cartoon skeleton-kid
// regular (NOT crypt horror — gdd.2.1 substituted gibdo with bonelet
// to clear the kid-6yo tone bar). Drop: +1 hp + 1 gem (skull-loot
// flavor). Standard red cost (3) — entry-tier shadow regular.
const bonelet: Card = {
  id: 'bonelet',
  role: 'monster',
  cost: { red: 3 },
  effects: { kind: 'monster-drop', hearts: 1, gems: 1 },
  zone: 'hollow-shrine',
};

// duskwing — bat-swarm regular (canonically safe;
// already kid-friendly without softening). Stiffer red cost (4) and
// hearts=2 reflect the swarm-bite identity. The roster memo's
// "on-defeat discards from enemy draw" flavor is z5e-tuning-pass scope;
// substrate ships schema-only with the +2 hp.
const duskwing: Card = {
  id: 'duskwing',
  role: 'monster',
  cost: { red: 4 },
  effects: { kind: 'monster-drop', hearts: 2 },
  zone: 'hollow-shrine',
};

const shadowRegularsList: readonly Card[] = [willowisp, graspling, bonelet, duskwing];

// hollow-effigy — Hollow Shrine wild boss (gdd.2.1 + lhlo.4
// keyword-vocabulary port). `bossTier: 'wild-boss'` drives the
// shared-HP combat path; HP=6 in BOSS_HP per gdd.2.4 — leaner than
// the wild band to keep the mirror-fight inside [3, 5] turns.
//
// Combat — Duel: Adaptive 2. Each turn hollow-effigy mirrors the
// strongest play from last turn for clamp(BASE_DPT, lastMaxPower,
// MAX_DPT) damage to player-hp, bypassing battlefield. Adaptive
// penalty 2 = MAX_DPT 4 − BASE_DPT 2, the worst-case extra echo
// damage above the static floor; spec entry in
// `ZONE_BOSS_SPECS['hollow-effigy']`, bespoke resolver in
// `src/core/combat/bossResolvers/hollowEffigy.ts`. On-defeat: Heart x2,
// Acquire +1 (cardDraw), Wisp via the wild-boss `wisp-drop` hook in
// `applyBossDefeatHooks`. Spec doc:
// `docs/design/hollow-effigy-attack-pattern.md`.
//
// Designer ruling 2026-04-25 (gdd.2.1): hollow-effigy wins over
// palegrasp as the kid-safe canon mirror-fight; tone shifted from
// OoT-style purple/indigo doppelganger to TotK gloom-aesthetic
// (blackened body, gloom-tendrils, red-orange gloom-eyes — see
// `bd memories embertide-hollow-effigy-spec-2026-04-25-supersedes`).
export const hollowEffigy: Card = {
  id: 'hollow-effigy',
  role: 'mini-boss',
  cost: { red: 9, keys: 1 },
  effects: { kind: 'monster-drop', hearts: 2, cardDraw: 1 },
  bossTier: 'wild-boss',
  zone: 'hollow-shrine',
};

// knell — Hollow Shrine region boss (gdd.2.1 + lhlo.4
// keyword-vocabulary port). `bossTier: 'region-boss'` + id ===
// ZONE_METADATA['hollow-shrine'].regionBossId drives advanceZone in
// applyBossDefeatHooks; defeat advances the active zone from
// 'hollow-shrine' → 'gilded-cage' and resets the shadow-creep
// gauge to 0 (see `src/store/slices/zones.ts`).
//
// Combat — Sequence: telegraph → slam. The 2-step drum cadence keys
// off `combat.turnIndex % 2`: phase 0 (telegraph) emits 0 damage and
// a forecast log naming the incoming slam dpt, phase 1 (slam) deals
// the full pattern dpt to player-hp. Spec entry in
// `ZONE_BOSS_SPECS['knell']`, bespoke resolver in
// `src/core/combat/bossResolvers/knell.ts`. On-defeat: Heart x4
// matching the broodmaw/ashen-tyrant/tidewraith region-tier cadence.
//
// Stats: red 14 + keys 1 (mid-tier between tidewraith's 14/1 and a
// hypothetical heavier region boss; HP = 17 in BOSS_HP — between
// tidewraith's 16 and broodmaw's 18 on the region curve, intentionally just
// above tidewraith so shadow-creep's flat dpt adder doesn't trivialize
// the fight). Art note (gdd.2.1): drum-spirit masked-figure, no
// stump/blood.
export const knell: Card = {
  id: 'knell',
  role: 'mini-boss',
  cost: { red: 14, keys: 1 },
  effects: { kind: 'monster-drop', hearts: 4 },
  bossTier: 'region-boss',
  zone: 'hollow-shrine',
};

/**
 * Hollow Shrine content (gdd.2). Exported for test lookup and zone-spawn
 * wiring. Ships in KID_CARDS / SUPPLY_PLAN below alongside the other zone
 * regulars + bosses.
 */
export const shadowRegulars: readonly Card[] = shadowRegularsList;
export const SHADOW_REGULARS: readonly Card[] = shadowRegularsList;
export const SHADOW_BOSSES: readonly Card[] = [hollowEffigy, knell];
