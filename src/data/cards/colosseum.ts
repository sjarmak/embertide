/**
 * Colosseum cards (embertide-p24m + lhlo.35, sub of 4hr1).
 *
 * Cards that surface in the Colosseum mode (tiered + repeatable boss
 * rush). NOT in SUPPLY_PLAN — colosseum bosses are never market-
 * purchasable; they're encountered through the colosseum slot routing
 * (lands in 4hr1). Registered in KID_CARDS so by-id lookups
 * (effectTextFor, combat-deck minting, GENERIC_BASE_ID_THEME, CardArt
 * SPEC_BY_BASE_ID) resolve.
 *
 * Cost on these cards is never read at runtime (the colosseum entry
 * path doesn't go through the center-row Acquire/Defeat flow), but the
 * Card schema requires it — a high red cost is set as a sensible
 * default that mirrors the canonical "boss-tier" cost band.
 *
 * bossTier is intentionally OMITTED on all colosseum cards — the v2.0/v2.1
 * boss-tier values ('wild-boss' | 'region-boss') drive zone-routing hooks
 * (advanceZone, wisp-drop) that don't apply to colosseum entries. The
 * colosseum slot router (4hr1) owns the tiering signal.
 *
 * effects is a neutral `gain` no-op on all colosseum cards — they never
 * resolve through the main-board Defeat path; real behaviour lives in the
 * per-tier combat specs (tier1.ts ... tier5.ts) consumed at colosseum-entry
 * time.
 *
 * Art status per card is noted inline. Slots without shipped art are
 * registered here for by-id resolution (lhlo.35 acceptance gate) and will
 * gain art alongside their designated art-batch beads.
 */

import type { Card } from '../../types/card';

// ---------------------------------------------------------------------------
// Tier-1 colosseum boss cards (lhlo.35 — kw.colosseum-card-registration).
// ---------------------------------------------------------------------------

/**
 * Coilworm — Tier-1 Eye archetype. Art pending (art-batch follow-up bead).
 */
export const coilworm: Card = {
  id: 'coilworm',
  role: 'mini-boss',
  cost: { red: 12, keys: 1 },
  effects: { kind: 'gain', red: 0 },
};

/**
 * Bonereaver — Tier-1 Duel archetype. Art: existing bone-knight /
 * sunbleached-reaver reskin (noted in tier1.ts spec).
 */
export const bonereaver: Card = {
  id: 'bonereaver',
  role: 'mini-boss',
  cost: { red: 12, keys: 1 },
  effects: { kind: 'gain', red: 0 },
};

// ---------------------------------------------------------------------------
// Tier-2 colosseum boss cards (lhlo.35).
// ---------------------------------------------------------------------------

/**
 * Chimera — Tier-2 Duel archetype. Art pending (distinct from silver-chimera /
 * prism-chimera which are zone bosses in gildedCage.ts).
 */
export const chimeraColosseum: Card = {
  id: 'chimera',
  role: 'mini-boss',
  cost: { red: 16, keys: 1 },
  effects: { kind: 'gain', red: 0 },
};

/**
 * Blackguard — Tier-2 Layered archetype. Art pending.
 */
export const blackguard: Card = {
  id: 'blackguard',
  role: 'mini-boss',
  cost: { red: 16, keys: 1 },
  effects: { kind: 'gain', red: 0 },
};

/**
 * Cinderwyrm — Tier-2 Item-Check archetype. Art pending.
 */
export const cinderwyrm: Card = {
  id: 'cinderwyrm',
  role: 'mini-boss',
  cost: { red: 16, keys: 1 },
  effects: { kind: 'gain', red: 0 },
};

/**
 * Phantom Vurmox — Tier-2 Sequence archetype. Art pending.
 */
export const phantomVurmox: Card = {
  id: 'phantom-vurmox',
  role: 'mini-boss',
  cost: { red: 16, keys: 1 },
  effects: { kind: 'gain', red: 0 },
};

/**
 * Palegrasp — Tier-2 Swarm archetype. Art pending.
 */
export const palegrasp: Card = {
  id: 'palegrasp',
  role: 'mini-boss',
  cost: { red: 16, keys: 1 },
  effects: { kind: 'gain', red: 0 },
};

// ---------------------------------------------------------------------------
// Tier-3 colosseum boss cards (lhlo.35).
// ---------------------------------------------------------------------------

/**
 * Skrall King — Tier-3 Layered archetype (Iron Mask → Bare Head).
 * Art pending.
 */
export const skrallKing: Card = {
  id: 'skrall-king',
  role: 'mini-boss',
  cost: { red: 20, keys: 1 },
  effects: { kind: 'gain', red: 0 },
};

/**
 * Voltwyrm — Tier-3 Item-Check archetype (Grapnels-gated guard).
 * Art pending.
 */
export const voltwyrm: Card = {
  id: 'voltwyrm',
  role: 'mini-boss',
  cost: { red: 20, keys: 1 },
  effects: { kind: 'gain', red: 0 },
};

/**
 * Vinemaw — Tier-3 Item-Check archetype (bomb-tag guard, same as
 * Cinderwyrm T2). Art pending.
 */
export const vinemaw: Card = {
  id: 'vinemaw',
  role: 'mini-boss',
  cost: { red: 20, keys: 1 },
  effects: { kind: 'gain', red: 0 },
};

/**
 * Sandscourge — Tier-3 Layered archetype (Twin Pincers → Tail Stinger).
 * Art pending.
 */
export const sandscourge: Card = {
  id: 'sandscourge',
  role: 'mini-boss',
  cost: { red: 20, keys: 1 },
  effects: { kind: 'gain', red: 0 },
};

/**
 * Idolarch — Tier-3 Swarm archetype (6 detachable sword-arm minions).
 * Art pending.
 */
export const idolarch: Card = {
  id: 'idolarch',
  role: 'mini-boss',
  cost: { red: 20, keys: 1 },
  effects: { kind: 'gain', red: 0 },
};

// ---------------------------------------------------------------------------
// Tier-4 colosseum boss cards (lhlo.35).
// ---------------------------------------------------------------------------

/**
 * Ossiarch (Twilit Fossil) — Tier-4 Layered archetype (Twilit Spine →
 * Floating Skull). Art pending.
 */
export const ossiarch: Card = {
  id: 'ossiarch',
  role: 'mini-boss',
  cost: { red: 25, keys: 2 },
  effects: { kind: 'gain', red: 0 },
};

/**
 * The Fettered — Tier-4 Sequence archetype (toe-charge → toe-strike →
 * lap-up). Art pending.
 */
export const theFettered: Card = {
  id: 'the-fettered',
  role: 'mini-boss',
  cost: { red: 25, keys: 2 },
  effects: { kind: 'gain', red: 0 },
};

/**
 * Pyrax — Tier-4 Eye archetype (chained-eye weakpoint). Art pending.
 */
export const pyrax: Card = {
  id: 'pyrax',
  role: 'mini-boss',
  cost: { red: 25, keys: 2 },
  effects: { kind: 'gain', red: 0 },
};

/**
 * Oblivar — Tier-4 Sequence archetype (charge → lightning → sword).
 * Art pending.
 */
export const oblivar: Card = {
  id: 'oblivar',
  role: 'mini-boss',
  cost: { red: 25, keys: 2 },
  effects: { kind: 'gain', red: 0 },
};

// ---------------------------------------------------------------------------
// Tier-5 colosseum boss cards.
// ---------------------------------------------------------------------------

/**
 * Trinity Aurogax (Aurogax) — Tier-5 capstone of the
 * colosseum. Three heads × three eras (Demon-King gloom + Umbra
 * ancient-tech + Auren sacred machinery). Mechanic spec lives in
 * `src/data/colosseum/tier5.ts` (Sequence archetype, 3-step rotation).
 *
 * `role: 'mini-boss'` (not `'final-boss'`) — the `'final-boss'` role is
 * pinned in the market center-row and gates v2.0 endgame branches
 * (`isPinnedRole` in `src/store/slices/market.ts`, the
 * `isMiniOrFinalBoss` / `isRegionOrFinalBoss` discriminants in
 * `src/store/combatBootstrap.ts`). Trinity Aurogax is a colosseum-only
 * capstone — it's not the v2.0 final fight and shouldn't share that
 * runtime semantics. `mini-boss` matches the role used by region
 * bosses (Broodmaw, Ashen Tyrant) and stays out of pin / endgame logic.
 *
 * Art: APPROVED 2026-05-02 — cathedral_monster_aurogax
 * raster + JSON spec already shipped (see bd 4hr1 notes).
 */
export const trinityAurogax: Card = {
  id: 'trinity-aurogax',
  role: 'mini-boss',
  cost: { red: 30, keys: 2 },
  effects: { kind: 'gain', red: 0 },
};

// ---------------------------------------------------------------------------
// Public roster of colosseum-only cards.
// ---------------------------------------------------------------------------

/**
 * Re-exported from the cards barrel so KID_CARDS can spread it without
 * re-listing every entry. All colosseum boss cards across tiers 1-5.
 * Cards without art are registration-only (placeholder); art-batch beads
 * land the rasters/ornaments per the 4hr1 pipeline schedule.
 */
export const colosseumCards: readonly Card[] = [
  // Tier 1
  coilworm,
  bonereaver,
  // Tier 2
  chimeraColosseum,
  blackguard,
  cinderwyrm,
  phantomVurmox,
  palegrasp,
  // Tier 3
  skrallKing,
  voltwyrm,
  vinemaw,
  sandscourge,
  idolarch,
  // Tier 4
  ossiarch,
  theFettered,
  pyrax,
  oblivar,
  // Tier 5
  trinityAurogax,
];
