/**
 * Sylvanwood content (amendment A5, u-6a).
 *
 * Layer-6 content drop: 4 zone-scoped regular enemies + 1 wild boss
 * (Craghorn) + 1 region boss (Broodmaw). All six carry `zone: 'sylvani'` so
 * the u-6a test can assert affinity against the Card type;
 * ZONE_METADATA.sylvani (src/rules/zones.ts) is the authoritative
 * runtime lookup for spawn rules.
 *
 * Cost tuning per u-6a balance target:
 *   - Regular enemies sit in the red 3-5 band (parity with grunt-orc /
 *     spear-orc / squidlet). +1 HP heal via monster-drop per REQ-2.
 *   - Craghorn (wild boss) sits at red 10 — "high enough that typically two
 *     turns or two players are needed" per acceptance; 2× the highest
 *     regular (scrabling @ 5). NO shard grant. Wisp drop is wired in
 *     src/store/slices/combat.ts on wild-boss defeat.
 *   - Broodmaw (region boss) sits at red 13 + 1 key — zone-clear gatekeeper.
 *     Post-REQ-32 (u-9a) Broodmaw is always engageable once the zone is
 *     active via `currentRegionBossForZone`; the previous wild-boss-cleared
 *     gate is retired. A Boss-phase turn gate still applies at the
 *     session-arc layer (u-7).
 *
 * Unique on-encounter / on-defeat effects: v2.0 combat.ts has no
 * on-encounter hook (fightMonster is resolve-only), so uniqueness lives
 * entirely in the on-defeat `effects` field. Regular enemies each carry
 * `monster-drop` with hearts tuned per card; Craghorn and Broodmaw carry
 * monster-drop with elevated hearts AND the bossTier discriminant that
 * drives the boss-defeat hooks (recordBossDefeat / advanceZone / wild
 * -boss wisp drop).
 *
 * Art: 6 follow-up beads tracked for raster finalization per
 * docs/art-governance.md.
 */

import type { Card } from '../../../types/card';

// bead embertide-d3v (art: thorn-scrub raster + ornament)
// r94e drop-variety: generic sylvani regular pays out the "1 heart + 1 gem"
// alt drop on defeat — the cheaper Ascension-style HONOR-equivalent
// reward layered onto the baseline HP heal so a kid clearing scrubs
// builds market currency too, not just HP.
const thornScrub: Card = {
  id: 'thorn-scrub',
  role: 'monster',
  cost: { red: 3 },
  effects: { kind: 'monster-drop', hearts: 1, gems: 1 },
  zone: 'sylvani',
};

// bead embertide-elf (art: snapvine raster + ornament)
const snapvine: Card = {
  id: 'snapvine',
  role: 'monster',
  cost: { red: 4 },
  // Snapvine's snap-bite drop is a heftier heal than a plain scrub —
  // +2 HP instead of +1 — carrying the "unique on-defeat" contract per
  // u-6a acceptance without inventing an on-encounter hook.
  effects: { kind: 'monster-drop', hearts: 2 },
  zone: 'sylvani',
};

// bead embertide-vjc (art: jellet raster + ornament)
// r94e drop-variety: generic sylvani regular ships the +1 heart / +1 gem
// alt drop alongside thorn-scrub. Same parity reasoning: low-cost beasts
// give a small market-currency nudge so kill-loop play funds market
// purchases without leaning entirely on the chest pool.
const jellet: Card = {
  id: 'jellet',
  role: 'monster',
  cost: { red: 3 },
  effects: { kind: 'monster-drop', hearts: 1, gems: 1 },
  zone: 'sylvani',
};

// bead embertide-3er (art: scrabling raster + ornament)
const scrabling: Card = {
  id: 'scrabling',
  role: 'monster',
  cost: { red: 5 },
  // Scrabling drops both +1 HP heal AND a key — its unique on-defeat
  // hook. Matches the v2.0 PRD's key-economy anchor (chest-std at
  // weight 55 + chest-boss at weight 2 is the primary key source; the
  // scrabling drop is an occasional-but-reliable secondary source).
  effects: { kind: 'monster-drop', hearts: 1, keys: 1 },
  zone: 'sylvani',
};

// Sylvanwood wild boss (u-6a). `bossTier: 'wild-boss'` drives the
// `applyBossDefeatHooks` path in src/store/slices/combat.ts —
// recordBossDefeat appends the id to state.defeatedBossIds (the FIFO
// queue in `currentWildBossForZone` then advances past Craghorn) and a
// fresh wisp is minted into the defeater's items zone (cap-safe
// routing with equipAsItem; overflow to teammate; both-full warns + drops).
// bead embertide-bbe (art: craghorn raster + ornament)
const craghorn: Card = {
  id: 'craghorn',
  role: 'mini-boss',
  cost: { red: 10, keys: 1 },
  // On-defeat: +3 HP heal (premium wild-boss drop, above mini-boss
  // baseline of 2) PLUS a wisp via the combat.ts wild-boss hook.
  // NO shard grant (amendment A2: shards come only from Princess / Map /
  // Vurmox — never from beasts or wild bosses).
  //
  // r94e drop-variety: wild-boss tier earns the bonus card-draw payout
  // (Slay the Spire-style relic-tier cadence overlay) — defeating Craghorn
  // both heals the team and triggers a +1 cardDraw deck spin so the
  // post-fight tempo carries the win-streak forward. Layered on top of
  // the existing wisp mint, not in place of it.
  effects: { kind: 'monster-drop', hearts: 3, cardDraw: 1 },
  bossTier: 'wild-boss',
  zone: 'sylvani',
};

// Sylvanwood region boss (u-6a). `bossTier: 'region-boss'` +
// id === ZONE_METADATA.sylvani.regionBossId drives advanceZone in
// applyBossDefeatHooks. Post-REQ-32 (u-9a) Broodmaw is always engageable
// once the zone is active via `currentRegionBossForZone`; the Boss-phase
// turn gate (turn 6+) at the session-arc layer is the remaining
// pre-requisite (landed in u-7).
// bead embertide-iy8 (art: broodmaw raster + ornate frame)
const broodmaw: Card = {
  id: 'broodmaw',
  role: 'mini-boss',
  cost: { red: 13, keys: 1 },
  // On-defeat: +4 HP heal (highest in the sylvani roster; region-boss
  // clearance is a narrative peak). Plus zone advance fires via the
  // region-boss hook. NO shard grant — Courage is gated by u-5b's
  // full-map-completion flip, not by region-boss kill itself.
  effects: { kind: 'monster-drop', hearts: 4 },
  bossTier: 'region-boss',
  zone: 'sylvani',
};

export const sylvaniRegulars: readonly Card[] = [thornScrub, snapvine, jellet, scrabling];
export const sylvaniBosses: readonly Card[] = [craghorn, broodmaw];
