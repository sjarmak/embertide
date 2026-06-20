/**
 * u-6c-bosses Gilded Cage boss content test suite (amendment A5,
 * Layer 7).
 *
 * Verifies the Gilded Cage boss roster:
 *   (a) Sentinel and Silver Chimera both exist with bossTier='wild-boss',
 *       role='mini-boss', zone='gilded-cage', and appear in
 *       ZONE_METADATA['gilded-cage'].wildBossIds.
 *   (b) Stat-ordering invariant: Silver Chimera is HARDER than Sentinel —
 *       Chimera.hearts >= round(Sentinel.hearts * 1.5) AND Chimera.red >=
 *       round(Sentinel.red * 1.5). (v2.0 maps "hp" → monster-drop.hearts
 *       and "power" → cost.red.)
 *   (c) Cagewright Vurmox exists with bossTier='region-boss', role=
 *       'mini-boss', zone='gilded-cage', and is the regionBossId in
 *       ZONE_METADATA['gilded-cage']. No shard field on its effects
 *       (shard flips happen in combat.ts transactionally, not on the card).
 *   (d) REQ-32 (u-9a): the canSpawnRegionBoss gate is retired. Vurmox is
 *       always engageable once Gilded Cage is the active zone via
 *       `currentRegionBossForZone`. Selector coverage lives in
 *       src/rules/zones.test.ts.
 *   (e) Sentinel / Silver Chimera defeat grants a wisp via the existing
 *       wild-boss hook and does NOT flip any sharedEmbertide shard.
 *   (f) Vurmox defeat flips BOTH sharedEmbertide.power AND
 *       sharedEmbertide.courage in the same returned state (Power via
 *       the combat.ts gate on defeated.id === 'cagewright-vurmox',
 *       Courage via u-5b's checkCourageUnlock fired from advanceZone).
 *   (g) Vurmox defeat with Wisdom already granted produces a full 3/3
 *       sharedEmbertide end-state — the co-op victory condition.
 *
 * IP-safety note: u-6c-bosses authors the id 'cagewright-vurmox' per
 * amendment A5; the IP-safety substring list in cards.test.ts was
 * updated to preserve core franchise-icon protections without forbidding
 * the amendment-authored id.
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { KID_CARDS, baseIdOf } from './cards';
import type { Card } from '../types/card';
import type { KidGameState, KidPlayer } from '../store/types';
import { fightMonster } from '../store/slices/combat';
import { createSeededRng } from '../rules/chestPool';
import { ZONE_METADATA } from '../rules/zones';
import { makeKidPlayer, makeKidGameState } from '../testing/stateFixtures';

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer =>
  makeKidPlayer({ red: 30, keys: 5, ...overrides });

function makeState(overrides: Partial<KidGameState> = {}): KidGameState {
  return makeKidGameState({
    players: [makePlayer({ id: 'p0' }), makePlayer({ id: 'p1' })],
    seed: 1,
    rng: createSeededRng(1),
    currentZone: 'gilded-cage',
    zoneHistory: ['sylvani', 'emberpeak'],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Shared lookups (sanity-checked inside tests (a)-(c)).
// ---------------------------------------------------------------------------

const SENTINEL = KID_CARDS.find((c) => c.id === 'sentinel');
const SILVER_CHIMERA = KID_CARDS.find((c) => c.id === 'silver-chimera');
const VURMOX = KID_CARDS.find((c) => c.id === 'cagewright-vurmox');

function dropHearts(card: Card | undefined): number {
  const e = card?.effects as { kind: string; hearts?: number } | undefined;
  return e?.hearts ?? 0;
}

// ---------------------------------------------------------------------------
// console.warn spy lifecycle (suppress wild-boss wisp-drop warn messages).
// ---------------------------------------------------------------------------

let warnSpy: ReturnType<typeof vi.spyOn> | null = null;
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
    /* suppressed for test output readability */
  });
});
afterEach(() => {
  warnSpy?.mockRestore();
  warnSpy = null;
});

// ---------------------------------------------------------------------------
// (a) Sentinel + Silver Chimera wild bosses present with correct tags.
// ---------------------------------------------------------------------------

describe('u-6c-bosses Sentinel + Silver Chimera wild bosses (a)', () => {
  it('declares both wild boss cards in KID_CARDS', () => {
    expect(SENTINEL).toBeDefined();
    expect(SILVER_CHIMERA).toBeDefined();
  });

  it('both carry role="mini-boss", bossTier="wild-boss", zone="gilded-cage"', () => {
    for (const card of [SENTINEL, SILVER_CHIMERA]) {
      expect(card?.role).toBe('mini-boss');
      expect(card?.bossTier).toBe('wild-boss');
      expect(card?.zone).toBe('gilded-cage');
    }
  });

  it('both appear in ZONE_METADATA["gilded-cage"].wildBossIds (FIFO holds only the two cores)', () => {
    const ids = ZONE_METADATA['gilded-cage'].wildBossIds;
    expect(ids).toContain('sentinel');
    expect(ids).toContain('silver-chimera');
    // embertide-044 (2026-04-24): Prism Chimera is a
    // dynamic-spawn encounter rolled at Silver Chimera's defeat —
    // NOT part of the zone's FIFO queue. See src/rules/zones.test.ts
    // for spawn-roll coverage.
    expect(ids).toEqual(['sentinel', 'silver-chimera']);
  });

  it('both carry monster-drop effects with hearts >= 1 (REQ-2 baseline) and NO shard field', () => {
    for (const card of [SENTINEL, SILVER_CHIMERA]) {
      const effects = card?.effects as { kind: string; hearts?: number };
      expect(effects.kind).toBe('monster-drop');
      expect(effects.hearts ?? 0).toBeGreaterThanOrEqual(1);
      expect(JSON.stringify(effects)).not.toContain('shard');
    }
  });
});

// ---------------------------------------------------------------------------
// (b) Silver Chimera stat-ordering invariant.
// ---------------------------------------------------------------------------

describe('u-6c-bosses Silver Chimera is HARDER than Sentinel (b)', () => {
  it('Silver Chimera.hearts >= round(Sentinel.hearts * 1.5)', () => {
    const sentinelHearts = dropHearts(SENTINEL);
    const chimeraHearts = dropHearts(SILVER_CHIMERA);
    const floor = Math.round(sentinelHearts * 1.5);
    expect(chimeraHearts).toBeGreaterThanOrEqual(floor);
  });

  it('Silver Chimera.red >= round(Sentinel.red * 1.5)', () => {
    const sentinelRed = SENTINEL?.cost.red ?? 0;
    const chimeraRed = SILVER_CHIMERA?.cost.red ?? 0;
    const floor = Math.round(sentinelRed * 1.5);
    expect(chimeraRed).toBeGreaterThanOrEqual(floor);
  });
});

// ---------------------------------------------------------------------------
// (c) Cagewright Vurmox region boss present with correct tags.
// ---------------------------------------------------------------------------

describe('u-6c-bosses Cagewright Vurmox region boss (c)', () => {
  it('exists in KID_CARDS with role="mini-boss", bossTier="region-boss", zone="gilded-cage"', () => {
    expect(VURMOX).toBeDefined();
    expect(VURMOX?.role).toBe('mini-boss');
    expect(VURMOX?.bossTier).toBe('region-boss');
    expect(VURMOX?.zone).toBe('gilded-cage');
  });

  it('is the regionBossId in ZONE_METADATA["gilded-cage"]', () => {
    expect(ZONE_METADATA['gilded-cage'].regionBossId).toBe('cagewright-vurmox');
  });

  it('carries monster-drop effects with NO shard field (flips happen in combat.ts transactionally)', () => {
    const effects = VURMOX?.effects as { kind: string; hearts?: number };
    expect(effects.kind).toBe('monster-drop');
    expect(JSON.stringify(effects)).not.toContain('shard');
  });

  it('costs red + keys at or above ashen-tyrant (the prior ceiling) — climactic tuning', () => {
    const vurmoxRed = VURMOX?.cost.red ?? 0;
    const vurmoxKeys = VURMOX?.cost.keys ?? 0;
    const ashenTyrant = KID_CARDS.find((c) => c.id === 'ashen-tyrant');
    const kingRed = ashenTyrant?.cost.red ?? 0;
    expect(vurmoxRed).toBeGreaterThanOrEqual(kingRed);
    expect(vurmoxKeys).toBeGreaterThanOrEqual(1);
  });
});

// REQ-32 (u-9a) retired the canSpawnRegionBoss gate — Vurmox is always
// engageable once Gilded Cage is the active zone. Selector coverage
// for currentWildBossForZone / currentRegionBossForZone (including the
// Sentinel → Silver Chimera FIFO queue) lives in src/rules/zones.test.ts.

// ---------------------------------------------------------------------------
// (e) Wild boss defeats grant fairies + do NOT flip shards.
// ---------------------------------------------------------------------------

describe('u-6c-bosses Sentinel / Silver Chimera defeats grant fairies, no shard flips (e)', () => {
  it('Sentinel defeat grants a freshly minted wisp to the defeater', () => {
    const sentinel = { ...(SENTINEL as Card) };
    const s = makeState({ field: [sentinel] });
    const next = fightMonster(s, 0, 'sentinel');
    expect(next.players[0].items).toHaveLength(1);
    expect(baseIdOf(next.players[0].items[0])).toBe('wisp');
    // Fresh id, not the shared "wisp" template id.
    expect(next.players[0].items[0].id).toMatch(/^wisp-wild-boss-sentinel-\d+$/);
  });

  it('Silver Chimera defeat grants a freshly minted wisp to the defeater', () => {
    const chimera = { ...(SILVER_CHIMERA as Card) };
    const s = makeState({ field: [chimera] });
    const next = fightMonster(s, 0, 'silver-chimera');
    expect(next.players[0].items).toHaveLength(1);
    expect(baseIdOf(next.players[0].items[0])).toBe('wisp');
    expect(next.players[0].items[0].id).toMatch(/^wisp-wild-boss-silver-chimera-\d+$/);
  });

  it('NEITHER wild-boss defeat flips any sharedEmbertide flag', () => {
    const sentinel = { ...(SENTINEL as Card) };
    const chimera = { ...(SILVER_CHIMERA as Card) };
    let s = makeState({ field: [sentinel, chimera] });
    s = fightMonster(s, 0, 'sentinel');
    expect(s.sharedEmbertide).toEqual({ wisdom: false, courage: false, power: false });
    s = fightMonster(s, 0, 'silver-chimera');
    expect(s.sharedEmbertide).toEqual({ wisdom: false, courage: false, power: false });
    // currentZone stayed at gilded-cage (no advance from wild-boss kill).
    expect(s.currentZone).toBe('gilded-cage');
  });

  it('defeat appends each wild-boss id to defeatedBossIds exactly once', () => {
    const sentinel = { ...(SENTINEL as Card) };
    const chimera = { ...(SILVER_CHIMERA as Card) };
    let s = makeState({ field: [sentinel, chimera] });
    s = fightMonster(s, 0, 'sentinel');
    expect(s.defeatedBossIds).toEqual(['sentinel']);
    s = fightMonster(s, 0, 'silver-chimera');
    expect(s.defeatedBossIds).toEqual(['sentinel', 'silver-chimera']);
  });
});

// ---------------------------------------------------------------------------
// (f) Vurmox defeat flips BOTH Power AND Courage in the same transaction.
// ---------------------------------------------------------------------------

describe('u-6c-bosses Cagewright Vurmox defeat dual shard flip (f)', () => {
  it('flips sharedEmbertide.power = true AND sharedEmbertide.courage = true in a single state transition', () => {
    const vurmox = { ...(VURMOX as Card) };
    const s = makeState({
      field: [vurmox],
      // Typical narrative flow: wild bosses are already cleared. Post-
      // REQ-32 the region slot is always engageable, so this pre-seed
      // is no longer required — kept here for scene-consistency with
      // the end-game state.
      defeatedBossIds: ['sentinel', 'silver-chimera'],
      currentZone: 'gilded-cage',
      // gdd.1 (v2.1): pre-Vurmox zoneHistory now includes Tidehold.
      zoneHistory: ['sylvani', 'emberpeak', 'maren', 'hollow-shrine', 'dune-sanctum'],
      sharedEmbertide: { wisdom: false, courage: false, power: false },
    });
    const next = fightMonster(s, 0, 'cagewright-vurmox');
    // Power flip fires from combat.ts's POWER_SHARD_GRANTER_ID check.
    expect(next.sharedEmbertide.power).toBe(true);
    // Courage flip fires from u-5b's checkCourageUnlock inside advanceZone
    // (terminal-zone clearance completes the 3-zone sequence in history).
    expect(next.sharedEmbertide.courage).toBe(true);
    // Wisdom stays false — Vurmox grants Power + Courage, not Wisdom.
    expect(next.sharedEmbertide.wisdom).toBe(false);
    // zoneHistory includes the terminal zone (u-5b amendment to advanceZone).
    expect(next.zoneHistory).toEqual([
      'sylvani',
      'emberpeak',
      'maren',
      'hollow-shrine',
      'dune-sanctum',
      'gilded-cage',
    ]);
    // currentZone stays at terminal (no successor).
    expect(next.currentZone).toBe('gilded-cage');
    // Vurmox id recorded in defeatedBossIds.
    expect(next.defeatedBossIds).toContain('cagewright-vurmox');
  });

  it('is idempotent: the Power flip does not regress on a second Vurmox-id defeat path', () => {
    // Contrived: re-invoke applyBossDefeatHooks by defeating a second
    // Vurmox copy from supply (fresh field entry with a -2 id suffix that
    // still resolves back to 'cagewright-vurmox' via baseIdOf).
    const vurmox = { ...(VURMOX as Card) };
    const s = makeState({
      field: [vurmox],
      defeatedBossIds: ['sentinel', 'silver-chimera'],
      currentZone: 'gilded-cage',
      // gdd.1 (v2.1): pre-Vurmox zoneHistory now includes Tidehold.
      zoneHistory: ['sylvani', 'emberpeak', 'maren', 'hollow-shrine', 'dune-sanctum'],
    });
    const mid = fightMonster(s, 0, 'cagewright-vurmox');
    expect(mid.sharedEmbertide.power).toBe(true);
    // Second Vurmox copy with suffixed id + baseId pointer (mirrors the
    // supply-duplication pattern in cards.ts).
    const duplicate: Card & { baseId: string } = {
      ...(VURMOX as Card),
      id: 'cagewright-vurmox-2',
      baseId: 'cagewright-vurmox',
    };
    // Re-stock the defeater's red/keys so the second fightMonster call
    // doesn't throw on affordability — this test isolates the shard
    // idempotency path, not the economy.
    const restocked = {
      ...mid,
      players: mid.players.map((p, i) => (i === 0 ? { ...p, red: 30, keys: 5 } : p)),
      field: [duplicate],
    };
    const afterSecond = fightMonster(restocked, 0, 'cagewright-vurmox-2');
    // Flag still true — idempotent.
    expect(afterSecond.sharedEmbertide.power).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (g) Vurmox defeat with Wisdom already granted → full 3/3 co-op victory.
// ---------------------------------------------------------------------------

describe('u-6c-bosses Vurmox defeat with Wisdom pre-flipped = full 3/3 sharedEmbertide (g)', () => {
  it('ends with sharedEmbertide = { wisdom: true, courage: true, power: true } (co-op victory end-state)', () => {
    const vurmox = { ...(VURMOX as Card) };
    const s = makeState({
      field: [vurmox],
      defeatedBossIds: ['sentinel', 'silver-chimera'],
      currentZone: 'gilded-cage',
      // gdd.1 (v2.1): pre-Vurmox zoneHistory now includes Tidehold.
      zoneHistory: ['sylvani', 'emberpeak', 'maren', 'hollow-shrine', 'dune-sanctum'],
      // Wisdom would be flipped by an earlier Princess Crystal free
      // (u-2e). We simulate that prerequisite here so the assertion
      // proves the Vurmox defeat completes the shared pool.
      sharedEmbertide: { wisdom: true, courage: false, power: false },
    });
    const next = fightMonster(s, 0, 'cagewright-vurmox');
    expect(next.sharedEmbertide).toEqual({
      wisdom: true,
      courage: true,
      power: true,
    });
  });
});
