/**
 * Emberpeak content (u-6b, amendment A5).
 *
 * 4 regulars + 1 wild boss (boulderkin) + 1 region boss (ashen-tyrant).
 * All carry `zone: 'emberpeak'` for convenience back-reference; the
 * authoritative roster is ZONE_METADATA['emberpeak'] in src/rules/zones.ts
 * (consulted by the `currentWildBossForZone` / `currentRegionBossForZone`
 * slot selectors + the region-boss gate in combat.ts).
 *
 * Regulars: red cost 3-5, monster-drop hearts=+1 HP heal per REQ-2, no
 * bossTier, no shard grant. "Unique on-encounter + on-defeat effects" is
 * interpreted as carrying a non-generic EffectSpec:
 *   - `skittermite`:      monster-drop with a key drop (hearts=1 + keys=1) —
 *                     only regular that yields a key on kill.
 *   - `ashjaw`:      higher-heal drop (hearts=2) — interpreted as the
 *                     "bigger bite" lizard mini-drop.
 *   - `saurian` / `red-squidlet`: standard hearts=1 drops (baseline).
 *
 * Art governance: each card below registers an art follow-up bead in the
 * declaration comment. Data ships with generic role frames until art lands.
 */

import type { Card } from '../../../types/card';

// Art follow-up: embertide-284 (saurian).
const emberpeakSaurian: Card = {
  id: 'saurian',
  role: 'monster',
  cost: { red: 3 },
  effects: { kind: 'monster-drop', hearts: 1 },
  zone: 'emberpeak',
};

// Art follow-up: embertide-izt (ashjaw). Unique on-defeat: hearts=2
// — "bigger bite" lizard compared to the other regulars.
// r94e drop-variety: tougher-regular tier — the +2 hearts (kept) layer
// with +1 gem on defeat. The "tougher regular" tuning rung from the
// drop-variety design: heftier than a sylvani scrub's split drop, and
// the +1 gem matches Ascension's intermediate-tier HONOR reward shape.
const emberpeakAshjaw: Card = {
  id: 'ashjaw',
  role: 'monster',
  cost: { red: 5 },
  effects: { kind: 'monster-drop', hearts: 2, gems: 1 },
  zone: 'emberpeak',
};

// Art follow-up: embertide-wg5 (skittermite). Unique on-defeat: drops a
// key (keys=1) in addition to the heal — the only Emberpeak regular
// that yields a key on kill.
const emberpeakSkittermite: Card = {
  id: 'skittermite',
  role: 'monster',
  cost: { red: 4 },
  effects: { kind: 'monster-drop', hearts: 1, keys: 1 },
  zone: 'emberpeak',
};

// Art follow-up: embertide-zkl (red-squidlet).
const emberpeakRedSquidlet: Card = {
  id: 'red-squidlet',
  role: 'monster',
  cost: { red: 3 },
  effects: { kind: 'monster-drop', hearts: 1 },
  zone: 'emberpeak',
};

export const emberpeakRegulars: readonly Card[] = [
  emberpeakSaurian,
  emberpeakAshjaw,
  emberpeakSkittermite,
  emberpeakRedSquidlet,
];

// Art follow-up: embertide-gv6 (boulderkin).
//
// Wild-boss for Emberpeak. 3 copies in supply. Tougher stats than
// regulars: red cost 10 (2× highest regular's red=5), which — for a
// typical mid-game player with 4-6 red per turn — usually requires two
// turns of accumulation or one well-timed teammate assist. Carries a
// monster-drop of hearts=2 (standard boss bite), but the signature
// on-defeat effect is the wisp drop wired in src/store/slices/combat.ts
// (on any `bossTier === 'wild-boss'` kill: mint a fresh wisp into the
// defeater's items zone, with 3-cap routing to teammate and then to a
// console.warn drop). NO shard grant — v2 beasts/wild-bosses never grant.
export const boulderkin: Card = {
  id: 'boulderkin',
  role: 'mini-boss',
  cost: { red: 10 },
  // r94e drop-variety: wild-boss tier with a "rocky reward" payout —
  // +2 hearts (existing) plus +2 gems (the rubble shedding loose
  // green shards) plus a +1 cardDraw bonus. Wild-boss tier is the
  // Spire-style relic-cadence: hearts cover survival, gems fund the
  // post-fight market, cardDraw keeps tempo. Wisp mint via
  // applyBossDefeatHooks still fires alongside this drop.
  effects: { kind: 'monster-drop', hearts: 2, gems: 2, cardDraw: 1 },
  bossTier: 'wild-boss',
  zone: 'emberpeak',
};

// Art follow-up: embertide-q7s (ashen-tyrant).
//
// Region-boss for Emberpeak. u-9a / REQ-32: no longer in the market
// supply; spawns exclusively through `currentRegionBossForZone` and is
// always engageable once Emberpeak is the active zone (subject to
// the session-arc Boss-phase turn gate in u-7). On defeat the u-5a hook
// in applyBossDefeatHooks fires advanceZone (emberpeak →
// gilded-cage) because ashen-tyrant's id matches
// ZONE_METADATA['emberpeak'].regionBossId. Still NO shard grant —
// only Vurmox grants Power (u-6c).
//
// Stats: red 14 + keys 1 (matches the v1 final-boss-style cost). Carries
// a monster-drop of hearts=2 (boss bite), same as boulderkin — the
// signature reward is the zone advance itself.
export const ashenTyrant: Card = {
  id: 'ashen-tyrant',
  role: 'mini-boss',
  cost: { red: 14, keys: 1 },
  // embertide-ycj tuning pass (2026-04-22): bumped from hearts=2
  // to hearts=4 so the region-boss heart-drop tier is consistent
  // across zones (broodmaw=4, ashen-tyrant=4, cagewright-vurmox=4). With
  // combats now running 5-10 turns against 18-20 HP region bosses,
  // the prior 2-heart drop was trivial relative to cumulative player
  // damage. +1 wisdom shard on defeat is still the signature reward;
  // the heart bump just closes the drop-table consistency gap.
  effects: { kind: 'monster-drop', hearts: 4 },
  bossTier: 'region-boss',
  zone: 'emberpeak',
};
