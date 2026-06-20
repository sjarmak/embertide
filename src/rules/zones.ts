/**
 * Map-zone rules (amendment A5, u-5a; REQ-32 u-9a).
 *
 * This module is the single source of truth for:
 *   - the v2.0 zone ordering (Sylvani → Emberpeak → Gilded Cage)
 *   - per-zone metadata (display name, theme hint, enemy + boss id lists)
 *   - helpers for zone progression (`isTerminalZone`, `nextZone`)
 *   - the per-zone current-boss slot selectors
 *     (`currentWildBossForZone`, `currentRegionBossForZone`) — REQ-32
 *     replaces the retired `canSpawnRegionBoss` gate. The region slot is
 *     always engageable once the zone is active; the wild slot is a
 *     FIFO queue through `wildBossIds`.
 *
 * Self-contained — no import from `src/data/` so card definitions can
 * reference this module without creating a cycle.
 */

import type { KidGameState, ZoneId } from '../store/types';

/**
 * v2.0 zone sequence (amendment A5). Three zones ship in v2.0.
 * v2.1 splices maren / hollow-shrine / dune-sanctum between
 * 'emberpeak' and 'gilded-cage' without changing Sylvani's or
 * Gilded-cage's positions.
 */
export const ZONE_ORDER: readonly ZoneId[] = [
  'sylvani',
  'emberpeak',
  // embertide-gdd.1: Tidehold spliced between emberpeak
  // and gilded-cage per the v2.1 zone-extension plan. ZONE_ORDER is
  // the single source of truth for sequence ordering — every consumer
  // that walks the spine (advanceZone, checkCourageUnlock, emptyBossKeys)
  // automatically picks up the new zone. The Courage gate now requires
  // all FOUR zones in zoneHistory before flipping (was three).
  'maren',
  // embertide-gdd.2: Hollow Shrine spliced between maren and
  // gilded-cage per the v2.1 zone-extension plan (substrate ship).
  // Knell's defeat advances 'hollow-shrine' → 'dune-sanctum'
  // via `advanceZone`'s nextZone walk (was 'gilded-cage' pre-gdd.3).
  'hollow-shrine',
  // embertide-gdd.3: Dune Sanctum spliced between hollow-shrine
  // and gilded-cage per the v2.1 zone-extension plan (substrate
  // ship). The Courage gate now requires all SIX zones in zoneHistory
  // before flipping (was five). Hextwins's defeat advances
  // 'dune-sanctum' → 'gilded-cage' via `advanceZone`'s nextZone
  // walk.
  'dune-sanctum',
  'gilded-cage',
];

/**
 * Per-zone metadata. Kept as a plain record so unit tests and UI
 * components can index directly without threading a selector.
 */
export interface ZoneMetadata {
  readonly id: ZoneId;
  readonly displayName: string;
  /**
   * Thematic hint used by the UI backdrop tinting and by raster prompts.
   * Intentionally short — free-text descriptors live in design docs.
   */
  readonly themeHint: string;
  /**
   * Card ids of the regular enemies that live in this zone. Populated
   * by u-6a/b/c. u-5a leaves this empty.
   */
  readonly regularEnemyIds: readonly string[];
  /**
   * Card ids of the wild bosses in this zone. `currentWildBossForZone`
   * walks this list in order and returns the first id not in
   * `state.defeatedBossIds` (FIFO queue) — REQ-32 retires the old
   * "region boss gated on all wilds cleared" contract; wild and region
   * slots are now independent. u-6a/b/c populate this list.
   */
  readonly wildBossIds: readonly string[];
  /**
   * The single card id that, when defeated, advances the zone. `null`
   * until u-6a/b/c wires a specific card (Broodmaw / Ashen Tyrant / Vurmox).
   */
  readonly regionBossId: string | null;
}

export const ZONE_METADATA: Record<ZoneId, ZoneMetadata> = {
  sylvani: {
    id: 'sylvani',
    displayName: 'Sylvanwood',
    themeHint: 'lush green forest canopy with dappled sunlight',
    // u-6a content: 4 regular enemies + Craghorn (wild) + Broodmaw (region).
    // Ids must stay in sync with src/data/cards.ts; the u-6a test file
    // (src/data/kokiriContent.test.ts) asserts two-way consistency.
    regularEnemyIds: ['thorn-scrub', 'snapvine', 'jellet', 'scrabling'],
    wildBossIds: ['craghorn'],
    regionBossId: 'broodmaw',
  },
  'emberpeak': {
    id: 'emberpeak',
    displayName: 'Emberpeak',
    themeHint: 'volcanic peak with ash-tinted skies',
    // u-6b populates the Emberpeak roster:
    //   regulars: saurian, ashjaw, skittermite, red-squidlet
    //   wild:     boulderkin   (wisp drop on defeat — see combat.ts)
    //   region:   ashen-tyrant  (advanceZone on defeat via u-5a hook)
    regularEnemyIds: ['saurian', 'ashjaw', 'skittermite', 'red-squidlet'],
    wildBossIds: ['boulderkin'],
    regionBossId: 'ashen-tyrant',
  },
  maren: {
    id: 'maren',
    displayName: "Tidehold",
    // gdd.1: tide-gauge zone — themeHint feeds raster prompts for the
    // upcoming combat-bg + boss-door art batch (gdd.1 step 6, art batch
    // ships separately under the art-pending convention).
    themeHint: 'underwater grotto with cathedral arches and refracted aqua light',
    // gdd.1 designer-review-approved roster (see
    // bd memories embertide-gdd-maren-roster-maren-s-domain-v2):
    //   regulars: maren-warrior, reefblade, frost-jellet, fangfish
    //   wild:     maelstrom       (shared-HP wild-boss, wisp drop)
    //   region:   tidewraith         (advanceZone on defeat → hollow-shrine)
    regularEnemyIds: ['maren-warrior', 'reefblade', 'frost-jellet', 'fangfish'],
    wildBossIds: ['maelstrom'],
    regionBossId: 'tidewraith',
  },
  'hollow-shrine': {
    id: 'hollow-shrine',
    displayName: 'Hollow Shrine',
    // gdd.2: 'moonlit-haunt' tone (gdd.2.2 art-direction brief). themeHint
    // feeds raster prompts for the future zone backdrop + combat BG +
    // boss-door art batch (~9 rasters / ~0.45 FAL credits) — kept under
    // the [v2-art-pending] convention until explicit user sign-off on
    // the knell art per gdd.2.1's designer-user-review flag.
    themeHint: 'moonlit haunted shrine with lantern-lit corridors and silver mist',
    // gdd.2 roster (see gdd.2.1 designer ruling — softened for the kid-6yo
    // audience: willowisp = friendly-lantern-ghost; graspling = cartoon
    // oven-mitt; bonelet = Pixar-Coco skeleton-kid; duskwing = bat
    // swarm; hollow-effigy = doppelganger mirror-fight (Water Temple-canonical);
    // knell = taiko-drummer ghost, no stump/blood):
    //   regulars: willowisp, graspling, bonelet, duskwing
    //   wild:     hollow-effigy    (shared-HP wild-boss, wisp drop;
    //                             delayed-echo dynamic resolver deferred
    //                             to gdd.2.4 follow-up — substrate ships
    //                             with vanilla static pattern)
    //   region:   knell    (advanceZone on defeat → dune-sanctum
    //                             post-gdd.3; drum-telegraph dynamic dpt
    //                             deferred to embertide-x1qg follow-up)
    regularEnemyIds: ['willowisp', 'graspling', 'bonelet', 'duskwing'],
    wildBossIds: ['hollow-effigy'],
    regionBossId: 'knell',
  },
  'dune-sanctum': {
    id: 'dune-sanctum',
    displayName: 'Dune Sanctum',
    // gdd.3: 'sun-bleached desert ruin' tone. themeHint feeds raster
    // prompts for the future zone backdrop + combat BG + boss-door art
    // batch (~9 rasters / ~0.45 FAL credits) — kept under the
    // [v2-art-pending] convention until explicit user sign-off per the
    // gdd.2.1 art-gate precedent.
    themeHint: 'sun-bleached desert ruin with sandstone arches and golden dust haze',
    // gdd.3 roster (see designer ruling 2026-04-25 — softened for the
    // kid-6yo audience: duneweed = sand-burrowing plant; sandwyrm = WW
    // sand-worm juvenile; sunbleached-reaver = sun-bleached skeleton, the
    // single skeletal archetype this zone gets; scuttlespine = sand-centipede
    // SUBBED IN to replace anubis-jackal-undead which busted the
    // undead-density bar; iron-sentinel = armored-knight wild;
    // hextwins = single-card sister-duo region-boss):
    //   regulars: duneweed, sandwyrm, sunbleached-reaver, scuttlespine
    //   wild:     iron-sentinel  (shared-HP wild-boss, wisp drop;
    //                            stagger mechanic dynamic resolver
    //                            deferred to gdd.3.3 follow-up —
    //                            substrate ships with vanilla
    //                            heavy-swing static pattern)
    //   region:   hextwins      (advanceZone on defeat → gilded-cage;
    //                            fire/ice 3-turn cycle dynamic dpt
    //                            deferred to gdd.3.2 follow-up —
    //                            substrate ships with vanilla
    //                            battlefield-then-player static pattern)
    regularEnemyIds: ['duneweed', 'sandwyrm', 'sunbleached-reaver', 'scuttlespine'],
    wildBossIds: ['iron-sentinel'],
    regionBossId: 'hextwins',
  },
  'gilded-cage': {
    id: 'gilded-cage',
    displayName: 'Gilded Cage',
    themeHint: 'sun-washed cathedral interior with stained glass',
    // u-6c-regulars populated regulars. u-6c-bosses (Layer 7) populated
    // wild bosses (Sentinel + Silver Chimera) and the region boss
    // (Cagewright Vurmox). Post-REQ-32 (u-9a): the region slot is always
    // engageable once the zone is active — there is no longer a
    // "wild-bosses-cleared" gate on Vurmox's spawn. The wild slot cycles
    // through `wildBossIds` in order via `currentWildBossForZone`
    // (Sentinel first, then Silver Chimera, then null). Vurmox defeat still
    // triggers advanceZone (terminal zone — appends 'gilded-cage' to
    // zoneHistory + fires the u-5b courage unlock) AND an explicit
    // sharedTriforce.power flip in combat.ts (gated on defeated.id ===
    // 'cagewright-vurmox').
    regularEnemyIds: ['wardeye', 'emberskull', 'bone-knight', 'gulpmaw', 'hexrobe'],
    // embertide-044 (2026-04-24): Temple's FIFO queue holds only
    // the two core wild bosses (Sentinel + Silver Chimera). The rare
    // `prism-chimera` post-completion boss is NO LONGER part
    // of the FIFO — it is a dynamic-spawn encounter rolled once at
    // Silver Chimera's defeat via the linear-ramp formula in
    // `computeGoldenRainbowLynelSpawnChance` below. `currentWildBossForZone`
    // surfaces it only after the FIFO is cleared AND
    // `state.goldenRainbowLynelSpawned` is true AND the boss itself
    // is not yet defeated.
    wildBossIds: ['sentinel', 'silver-chimera'],
    regionBossId: 'cagewright-vurmox',
  },
};

/**
 * Card id of the rare post-completion wild boss rolled at Silver
 * Chimera's defeat (embertide-044). Exported so consumers
 * (`currentWildBossForZone`, `COMBAT_RESOLVE_WIN` roll site) share a
 * single source-of-truth id constant rather than duplicating the
 * string literal across files.
 */
export const PRISM_CHIMERA_ID = 'prism-chimera';

/**
 * Linear-ramp coefficient for the Prism Chimera spawn chance
 * (embertide-044, designer decision 2026-04-24). Each center-row
 * kill adds 5% to the probability, capped at {@link PRISM_CHIMERA_SPAWN_CAP}.
 */
export const PRISM_CHIMERA_SPAWN_STEP = 0.05;

/**
 * Upper bound on the Prism Chimera spawn probability
 * (embertide-044). 85% by design — a meaningful cap so ~15% of
 * runs won't see Rainbow, keeping it a genuinely-rare post-completion
 * reward rather than a guaranteed victory-lap encounter.
 */
export const PRISM_CHIMERA_SPAWN_CAP = 0.85;

/**
 * Compute the one-shot spawn probability for the Prism Chimera
 * given a run's accumulated center-row kill count (embertide-044).
 *
 *   P = min(0.05 * centerRowKillCount, 0.85)
 *
 * Defensive: negative inputs clamp to 0. The formula is intentionally
 * linear (not exponential) so the ramp reads as "one more kill = one
 * more ~5-percentage-point chance" — fast to mentally model from the
 * UI side. Pure / side-effect free.
 */
export function computeGoldenRainbowLynelSpawnChance(centerRowKillCount: number): number {
  const kills = Math.max(0, centerRowKillCount);
  return Math.min(PRISM_CHIMERA_SPAWN_STEP * kills, PRISM_CHIMERA_SPAWN_CAP);
}

/**
 * Is `zoneId` the last zone in the v2.0 sequence? True for the zone at
 * `ZONE_ORDER[ZONE_ORDER.length - 1]` (currently `'gilded-cage'`).
 */
export function isTerminalZone(zoneId: ZoneId): boolean {
  return zoneId === ZONE_ORDER[ZONE_ORDER.length - 1];
}

/**
 * Return the zone that comes after `zoneId` in `ZONE_ORDER`, or `null`
 * when `zoneId` is already terminal. Pure.
 */
export function nextZone(zoneId: ZoneId): ZoneId | null {
  const idx = ZONE_ORDER.indexOf(zoneId);
  if (idx < 0) return null;
  const next = ZONE_ORDER[idx + 1];
  return next ?? null;
}

/**
 * Return the first wild boss id in `zoneId`'s queue that is NOT yet in
 * `state.defeatedBossIds`, or `null` when every wild boss in the zone
 * is defeated. FIFO over `ZONE_METADATA[zoneId].wildBossIds` — for
 * Gilded Cage (`wildBossIds: ['sentinel', 'silver-chimera']`) this
 * yields `'sentinel'` first, then `'silver-chimera'` once Sentinel is in
 * `defeatedBossIds`.
 *
 * embertide-044 (2026-04-24): Temple has an additional
 * dynamic-spawn wild slot — the Prism Chimera. When the FIFO is
 * exhausted AND `state.goldenRainbowLynelSpawned === true` AND
 * `'prism-chimera'` is not yet in `defeatedBossIds`, the slot
 * surfaces the rare post-completion boss. The spawn-flag flip is
 * rolled once at Silver Chimera's defeat (see
 * `computeGoldenRainbowLynelSpawnChance`); a failed roll leaves the
 * slot empty for the rest of the run.
 *
 * Defensive: an unknown `zoneId` returns `null`.
 */
export function currentWildBossForZone(state: KidGameState, zoneId: ZoneId): string | null {
  const meta = ZONE_METADATA[zoneId];
  if (!meta) return null;
  const defeated = new Set(state.defeatedBossIds);
  for (const wildId of meta.wildBossIds) {
    if (defeated.has(wildId)) continue;
    return wildId;
  }
  // embertide-044: FIFO exhausted for this zone. Gilded Cage
  // gets a post-completion dynamic slot when the one-shot Rainbow
  // spawn roll has succeeded and the boss isn't already defeated.
  if (
    zoneId === 'gilded-cage' &&
    state.goldenRainbowLynelSpawned &&
    !defeated.has(PRISM_CHIMERA_ID)
  ) {
    return PRISM_CHIMERA_ID;
  }
  return null;
}

/**
 * Return `zoneId`'s region boss id when it has not yet been defeated,
 * otherwise `null`. REQ-32 (u-9a) removes the "wild-bosses-cleared"
 * gate from the old `canSpawnRegionBoss` — the region slot is always
 * engageable once the zone is active. Returns `null` for an unknown
 * `zoneId` or a zone whose `regionBossId` is still null (defensive).
 */
export function currentRegionBossForZone(state: KidGameState, zoneId: ZoneId): string | null {
  const meta = ZONE_METADATA[zoneId];
  if (!meta) return null;
  const regionId = meta.regionBossId;
  if (regionId === null) return null;
  if (state.defeatedBossIds.includes(regionId)) return null;
  return regionId;
}
