/**
 * Tidehold content (embertide-gdd.1, v2.1 zone 3).
 *
 * 4 regulars + 1 wild boss (maelstrom) + 1 region boss (tidewraith). The
 * designer-review-approved roster lives in
 * `bd memories embertide-gdd-maren-roster-maren-s-domain-v2`. All
 * carry `zone: 'maren'` for back-reference; authoritative roster lives
 * in `ZONE_METADATA.maren` (src/rules/zones.ts).
 *
 * Tone pass: kid-6yo friendly. No corruption / horror — Zoran warriors
 * are fantasy fish-people, tidewraith is a friendly amoeba slime, maelstrom
 * is a Wind-Waker-canon armored octopus. Tide-gauge zone-mechanic
 * substrate ships in src/store/slices/zones.ts (gdd.1 — substrate-only;
 * full tuning lives in z5e follow-up). The combat reducer doesn't yet
 * wire the tide-gauge into tidewraith's tentacle-grab strength or
 * fangfish's fragility window — those land alongside the broader
 * tuning pass.
 *
 * r94e drop-variety: alignment with sylvani/emberpeak conventions.
 * Regulars carry +1 hp baseline plus zone-flavored extras (gem on
 * frost-jellet, key on a non-maren regular replaced by gem on reefblade
 * for shell-loot flavor). Wild + region bosses ship hearts + cardDraw
 * per the wild/region-tier cadence pattern established in 4uyn / r94e.
 *
 * Art governance: data-layer only. All maren cards ship with the
 * `[v2-art-pending]` art-pending tag in the docstring (no public
 * rasters yet). The art batch (4 regulars + maelstrom + tidewraith + zone
 * backdrop + 2 combat BGs + boss-door, ~9 rasters / ~0.45 FAL credits)
 * runs as a separate batch under REQ-30 conventions.
 */

import type { Card } from '../../../types/card';

// [v2-art-pending] maren-warrior — hostile Zoran spear-wielder. Standard
// regular shape: +1 hp on defeat. The "spear" thematic is encoded as a
// red-cost-3 card (entry-tier regular cost).
const zoraWarrior: Card = {
  id: 'maren-warrior',
  role: 'monster',
  cost: { red: 3 },
  effects: { kind: 'monster-drop', hearts: 1 },
  zone: 'maren',
};

// [v2-art-pending] reefblade — armored clam, blade-spinning attack.
// On-defeat layered drop: +1 hp + 1 gem (shell-loot flavor). Slightly
// stiffer red cost (4) reflects the carapace.
const reefblade: Card = {
  id: 'reefblade',
  role: 'monster',
  cost: { red: 4 },
  effects: { kind: 'monster-drop', hearts: 1, gems: 1 },
  zone: 'maren',
};

// [v2-art-pending] frost-jellet — water-element jellet variant (distinct
// from the sylvanwood jellet). Mirrors the sylvani jellet's split
// drop (1 heart + 1 gem) but with water-drop flavor; same red cost.
// The double-id distinction is intentional: frost-jellet is its own
// card with its own zone affinity, NOT a re-skin of jellet.
const frostJellet: Card = {
  id: 'frost-jellet',
  role: 'monster',
  cost: { red: 3 },
  effects: { kind: 'monster-drop', hearts: 1, gems: 1 },
  zone: 'maren',
};

// [v2-art-pending] fangfish — jagged piranha-school critter. Stiffer
// red cost (5) reflects the 'swarm' identity. Drop is +2 hp (above the
// regular baseline of +1) — the "swarm bite" thematic. The fragility
// window described in the roster memo (fangfish discards on next
// turn-end if not re-engaged) is z5e-tuning-bead scope; ships
// schema-only here per the substrate-only contract.
const fangfish: Card = {
  id: 'fangfish',
  role: 'monster',
  cost: { red: 5 },
  effects: { kind: 'monster-drop', hearts: 2 },
  zone: 'maren',
};

const zoraRegularsList: readonly Card[] = [zoraWarrior, reefblade, frostJellet, fangfish];

// [v2-art-pending] maelstrom — Wind-Waker-canon giant armored octopus
// wild-boss for Tidehold. `bossTier: 'wild-boss'` drives the
// shared-HP combat path (HP = 6 in BOSS_HP, in-line with craghorn/talus/
// sentinel wild-band 10–12; bumped DOWN to 6 because tidewraith is the
// region payoff and maelstrom's pressure comes from its
// `'aoe' or 'battlefield-then-player'` attack pattern — see
// bossAttackPatterns.ts for the canonical pattern). On-defeat: hearts
// 2 + gems 1 (shell-pearl loot) + cardDraw 1 — the wild-boss-tier
// drop cadence pattern (matches boulderkin shape minus the +2 gems
// to keep maren's wild-boss drop slightly leaner than the death-
// mountain-tier wild-boss). Wisp mint via `applyBossDefeatHooks` in
// combat.ts fires alongside this drop (no special-casing needed —
// every wild-boss bossTier triggers the wisp hook).
export const maelstrom: Card = {
  id: 'maelstrom',
  role: 'mini-boss',
  cost: { red: 10, keys: 1 },
  effects: { kind: 'monster-drop', hearts: 2, gems: 1, cardDraw: 1 },
  bossTier: 'wild-boss',
  zone: 'maren',
};

// [v2-art-pending] tidewraith — water-temple amoeba region-boss for Maren's
// Domain. `bossTier: 'region-boss'` + id === ZONE_METADATA.maren.regionBossId
// drives advanceZone in applyBossDefeatHooks. Defeat advances the
// active zone from 'maren' to 'gilded-cage' (per the post-gdd.1
// ZONE_ORDER), and per existing convention also resets the per-zone
// state (tide-gauge resets in advanceZone — see src/store/slices/zones.ts).
//
// Stats: red 14 + keys 1 (mid-tier between ashen-tyrant's 14/1 and
// broodmaw's 13/1; HP = 14 in BOSS_HP — between the sylvani/emberpeak
// region tier of 18-19 and a leaner 'mid-zone' shape so single-boss
// runs stay completable in the [5, 8] median-turn band even while
// tide-gauge interactions are still substrate-only). Drop is hearts 4
// matching the broodmaw/ashen-tyrant region-tier consistency.
//
// Tide-gauge interaction: spec'd in the roster memo (tentacle-grab
// strength = tideGauge), NOT yet wired in this substrate ship. The
// gdd.1-companion 'z5e' tuning bead picks up the dynamic-pattern
// resolver in bossAttackPatterns.ts at the same time as the broader
// combat-difficulty tuning pass. Until then tidewraith's pattern is a
// vanilla `battlefield-then-player` with a static damagePerTurn (see
// bossAttackPatterns.ts).
export const tidewraith: Card = {
  id: 'tidewraith',
  role: 'mini-boss',
  cost: { red: 14, keys: 1 },
  effects: { kind: 'monster-drop', hearts: 4 },
  bossTier: 'region-boss',
  zone: 'maren',
};

/**
 * Tidehold content (gdd.1). Exported for test lookup and zone-spawn
 * wiring. Ships in KID_CARDS / SUPPLY_PLAN below alongside the other zone
 * regulars + bosses.
 */
export const zoraRegulars: readonly Card[] = zoraRegularsList;
export const MAREN_REGULARS: readonly Card[] = zoraRegularsList;
export const MAREN_BOSSES: readonly Card[] = [maelstrom, tidewraith];
