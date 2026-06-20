/**
 * u-6b Emberpeak content test suite (amendment A5).
 *
 * Verifies the Emberpeak roster landed by u-6b:
 *   (a) all 4 regulars exist with zone='emberpeak' and expected stats
 *   (b) boulderkin exists with bossTier='wild-boss' and tougher cost
 *       (red ≥ 2× the highest regular's red cost)
 *   (c) ashen-tyrant exists with bossTier='region-boss'
 *   (d) Boulderkin defeat via fightMonster grants a wisp to the
 *       defeater; items are unbounded per nmmc so there is no
 *       cap-overflow path to teammate / silent-drop.
 *   (e) Ashen Tyrant defeat via fightMonster triggers advanceZone
 *       (emberpeak → gilded-cage)
 *   (f) Neither wild-boss nor region-boss defeat flips any sharedTriforce
 *   (g) REQ-32 (u-9a): the canSpawnRegionBoss gate is retired. Selector
 *       coverage (currentWildBossForZone / currentRegionBossForZone)
 *       lives in src/rules/zones.test.ts.
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
  makeKidPlayer({ red: 20, keys: 5, ...overrides });

function makeState(overrides: Partial<KidGameState> = {}): KidGameState {
  return makeKidGameState({
    players: [makePlayer({ id: 'p0' }), makePlayer({ id: 'p1' })],
    seed: 1,
    rng: createSeededRng(1),
    currentZone: 'emberpeak',
    zoneHistory: ['sylvani'],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Shared lookups (sanity-checked inside tests (a)-(c)).
// ---------------------------------------------------------------------------

const SAURIAN = KID_CARDS.find((c) => c.id === 'saurian');
const ASHJAW = KID_CARDS.find((c) => c.id === 'ashjaw');
const SKITTERMITE = KID_CARDS.find((c) => c.id === 'skittermite');
const RED_SQUIDLET = KID_CARDS.find((c) => c.id === 'red-squidlet');
const BOULDERKIN = KID_CARDS.find((c) => c.id === 'boulderkin');
const ASHEN_TYRANT = KID_CARDS.find((c) => c.id === 'ashen-tyrant');

const EMBERPEAK_REGULAR_IDS = ['saurian', 'ashjaw', 'skittermite', 'red-squidlet'] as const;

// ---------------------------------------------------------------------------
// console.warn spy lifecycle (one spy scope per describe block needing it).
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
// (a) 4 regulars present with correct affinity + stats.
// ---------------------------------------------------------------------------

describe('u-6b Emberpeak regulars (a)', () => {
  it('declares all 4 regular enemies — saurian, ashjaw, skittermite, red-squidlet', () => {
    expect(SAURIAN).toBeDefined();
    expect(ASHJAW).toBeDefined();
    expect(SKITTERMITE).toBeDefined();
    expect(RED_SQUIDLET).toBeDefined();
  });

  it('every regular carries zone="emberpeak" back-reference AND is listed in ZONE_METADATA regularEnemyIds', () => {
    const regulars = [SAURIAN, ASHJAW, SKITTERMITE, RED_SQUIDLET];
    for (const card of regulars) {
      expect(card?.zone).toBe('emberpeak');
    }
    // Authoritative source: ZONE_METADATA membership.
    for (const id of EMBERPEAK_REGULAR_IDS) {
      expect(ZONE_METADATA['emberpeak'].regularEnemyIds).toContain(id);
    }
  });

  it('every regular has role="monster" and NO bossTier (regulars are not tagged)', () => {
    const regulars = [SAURIAN, ASHJAW, SKITTERMITE, RED_SQUIDLET];
    for (const card of regulars) {
      expect(card?.role).toBe('monster');
      expect(card?.bossTier).toBeUndefined();
    }
  });

  it('every regular costs red 3-5 (PRD balance target for zone regulars)', () => {
    const regulars = [SAURIAN, ASHJAW, SKITTERMITE, RED_SQUIDLET];
    for (const card of regulars) {
      const red = card?.cost.red ?? 0;
      expect(red).toBeGreaterThanOrEqual(3);
      expect(red).toBeLessThanOrEqual(5);
    }
  });

  it('every regular uses monster-drop with hearts ≥ 1 (REQ-2: +1 HP heal) and NO shard grant', () => {
    const regulars = [SAURIAN, ASHJAW, SKITTERMITE, RED_SQUIDLET];
    for (const card of regulars) {
      const effects = card?.effects as { kind: string; hearts?: number };
      expect(effects.kind).toBe('monster-drop');
      expect(effects.hearts ?? 0).toBeGreaterThanOrEqual(1);
      // monster-drop carries no shard field — regulars never grant
      // shards per v2 amendment A2.
      expect(JSON.stringify(effects)).not.toContain('shard');
    }
  });

  it('skittermite uniquely drops a key on defeat (monster-drop.keys === 1)', () => {
    const skittermite = SKITTERMITE as Card & { effects: { kind: string; hearts?: number; keys?: number } };
    expect(skittermite.effects.kind).toBe('monster-drop');
    expect(skittermite.effects.keys).toBe(1);
    // Only skittermite among the 4 regulars drops a key.
    const others = [SAURIAN, ASHJAW, RED_SQUIDLET] as readonly (
      | (Card & { effects: { kind: string; keys?: number } })
      | undefined
    )[];
    for (const c of others) {
      expect(c?.effects.keys).toBeUndefined();
    }
  });

  it('ashjaw uniquely heals +2 HP on defeat (larger bite vs baseline hearts=1)', () => {
    const ashjaw = ASHJAW as Card & { effects: { kind: string; hearts: number } };
    expect(ashjaw.effects.hearts).toBe(2);
    // The others use the baseline hearts=1.
    const others = [SAURIAN, SKITTERMITE, RED_SQUIDLET] as readonly (
      | (Card & { effects: { kind: string; hearts: number } })
      | undefined
    )[];
    for (const c of others) {
      expect(c?.effects.hearts).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// (b) boulderkin (wild boss).
// ---------------------------------------------------------------------------

describe('u-6b boulderkin wild boss (b)', () => {
  it('exists with role="mini-boss", bossTier="wild-boss", zone="emberpeak"', () => {
    expect(BOULDERKIN).toBeDefined();
    expect(BOULDERKIN?.role).toBe('mini-boss');
    expect(BOULDERKIN?.bossTier).toBe('wild-boss');
    expect(BOULDERKIN?.zone).toBe('emberpeak');
  });

  it('is listed in ZONE_METADATA["emberpeak"].wildBossIds', () => {
    expect(ZONE_METADATA['emberpeak'].wildBossIds).toContain('boulderkin');
  });

  it('red cost is tougher than any regular — at least 2× the highest regular red cost', () => {
    const regularReds = [SAURIAN, ASHJAW, SKITTERMITE, RED_SQUIDLET].map((c) => c?.cost.red ?? 0);
    const highestRegularRed = Math.max(...regularReds);
    const stoneTalusRed = BOULDERKIN?.cost.red ?? 0;
    expect(stoneTalusRed).toBeGreaterThanOrEqual(highestRegularRed * 2);
    // Balance target 9-12.
    expect(stoneTalusRed).toBeGreaterThanOrEqual(9);
    expect(stoneTalusRed).toBeLessThanOrEqual(12);
  });

  it('does NOT declare a shard grant on its effects', () => {
    expect(JSON.stringify(BOULDERKIN?.effects)).not.toContain('shard');
  });
});

// ---------------------------------------------------------------------------
// (c) ashen-tyrant (region boss).
// ---------------------------------------------------------------------------

describe('u-6b ashen-tyrant region boss (c)', () => {
  it('exists with role="mini-boss", bossTier="region-boss", zone="emberpeak"', () => {
    expect(ASHEN_TYRANT).toBeDefined();
    expect(ASHEN_TYRANT?.role).toBe('mini-boss');
    expect(ASHEN_TYRANT?.bossTier).toBe('region-boss');
    expect(ASHEN_TYRANT?.zone).toBe('emberpeak');
  });

  it('is the regionBossId in ZONE_METADATA["emberpeak"]', () => {
    expect(ZONE_METADATA['emberpeak'].regionBossId).toBe('ashen-tyrant');
  });

  it('costs red 12-16 plus a key (balance target: gatekeeper ritual)', () => {
    const red = ASHEN_TYRANT?.cost.red ?? 0;
    expect(red).toBeGreaterThanOrEqual(12);
    expect(red).toBeLessThanOrEqual(16);
    expect(ASHEN_TYRANT?.cost.keys ?? 0).toBeGreaterThanOrEqual(1);
  });

  it('does NOT declare a shard grant on its effects', () => {
    expect(JSON.stringify(ASHEN_TYRANT?.effects)).not.toContain('shard');
  });
});

// ---------------------------------------------------------------------------
// (d) Boulderkin defeat → wisp drop with 3-cap routing.
// ---------------------------------------------------------------------------

function buildStoneTalusInField(
  overrides: Partial<KidGameState> = {},
  p0Overrides: Partial<KidPlayer> = {},
  p1Overrides: Partial<KidPlayer> = {},
): KidGameState {
  const talus = { ...(BOULDERKIN as Card) };
  return makeState({
    players: [makePlayer({ id: 'p0', ...p0Overrides }), makePlayer({ id: 'p1', ...p1Overrides })],
    field: [talus],
    ...overrides,
  });
}

describe('u-6b Boulderkin defeat grants a fresh wisp (d)', () => {
  it('(d.1) defeater with an empty items zone receives the wisp', () => {
    const state = buildStoneTalusInField({}, { red: 20, items: [] });
    const next = fightMonster(state, 0, 'boulderkin');
    expect(next.players[0].items).toHaveLength(1);
    expect(baseIdOf(next.players[0].items[0])).toBe('wisp');
    // Teammate untouched.
    expect(next.players[1].items).toHaveLength(0);
    // Fresh minted id, NOT the shared "wisp" template id.
    expect(next.players[0].items[0].id).not.toBe('wisp');
    expect(next.players[0].items[0].id).toMatch(/^wisp-wild-boss-boulderkin-\d+$/);
  });

  it('(d.2) defeater with 3 pre-existing items still receives the wisp (nmmc unbounded)', () => {
    const fillers: Card[] = [
      { ...(SAURIAN as Card), id: 'filler-a' },
      { ...(SAURIAN as Card), id: 'filler-b' },
      { ...(SAURIAN as Card), id: 'filler-c' },
    ];
    const state = buildStoneTalusInField({}, { red: 20, items: fillers }, { red: 0, items: [] });
    const next = fightMonster(state, 0, 'boulderkin');
    // Defeater receives the wisp on top of the 3 fillers (no cap).
    expect(next.players[0].items).toHaveLength(4);
    expect(next.players[0].items.some((c) => baseIdOf(c) === 'wisp')).toBe(true);
    // Teammate items untouched — drops route to defeater only.
    expect(next.players[1].items).toHaveLength(0);
  });

  it('Boulderkin defeat appends "boulderkin" to defeatedBossIds and does NOT advance the zone', () => {
    const state = buildStoneTalusInField();
    const next = fightMonster(state, 0, 'boulderkin');
    expect(next.defeatedBossIds).toContain('boulderkin');
    expect(next.currentZone).toBe('emberpeak');
    expect(next.zoneHistory).toEqual(['sylvani']);
  });
});

// ---------------------------------------------------------------------------
// (e) Ashen Tyrant defeat → advanceZone.
// ---------------------------------------------------------------------------

describe('u-6b Ashen Tyrant defeat triggers advanceZone (e)', () => {
  it('emberpeak → gilded-cage on region-boss kill (with boulderkin already defeated)', () => {
    const dodongoCard = { ...(ASHEN_TYRANT as Card) };
    const state = makeState({
      players: [makePlayer({ id: 'p0', red: 20, keys: 5 }), makePlayer({ id: 'p1' })],
      currentZone: 'emberpeak',
      zoneHistory: ['sylvani'],
      field: [dodongoCard],
      // Boulderkin already cleared — mirrors the typical wild-then-region
      // clear flow. Post-REQ-32 the region slot is always engageable;
      // keeping this pre-seed preserves the test's narrative intent.
      defeatedBossIds: ['boulderkin'],
    });
    const next = fightMonster(state, 0, 'ashen-tyrant');
    // gdd.1 (v2.1): ashen-tyrant defeat now advances to 'maren', not
    // straight to gilded-cage — Tidehold spliced between.
    expect(next.currentZone).toBe('maren');
    expect(next.zoneHistory).toEqual(['sylvani', 'emberpeak']);
    expect(next.defeatedBossIds).toContain('ashen-tyrant');
  });
});

// ---------------------------------------------------------------------------
// (f) sharedTriforce unchanged across either defeat.
// ---------------------------------------------------------------------------

describe('u-6b wild + region boss defeats do NOT flip any sharedTriforce flag (f)', () => {
  it('Boulderkin defeat leaves sharedTriforce {wisdom,courage,power}=false', () => {
    const state = buildStoneTalusInField();
    const next = fightMonster(state, 0, 'boulderkin');
    expect(next.sharedTriforce).toEqual({
      wisdom: false,
      courage: false,
      power: false,
    });
  });

  it('Ashen Tyrant defeat leaves sharedTriforce {wisdom,courage,power}=false (zone advances, no shard)', () => {
    const dodongoCard = { ...(ASHEN_TYRANT as Card) };
    const state = makeState({
      players: [makePlayer({ id: 'p0', red: 20, keys: 5 }), makePlayer({ id: 'p1' })],
      currentZone: 'emberpeak',
      zoneHistory: ['sylvani'],
      field: [dodongoCard],
      defeatedBossIds: ['boulderkin'],
    });
    const next = fightMonster(state, 0, 'ashen-tyrant');
    // gdd.1 (v2.1): ashen-tyrant defeat now advances to 'maren', not
    // straight to gilded-cage — Tidehold spliced between.
    expect(next.currentZone).toBe('maren');
    // But Embertide flags are still OFF — v2 shards never come from bosses.
    // Note: advancing into (not THROUGH) maren does NOT flip Courage —
    // the u-5b Courage unlock fires only when the full 4-zone sequence
    // is in zoneHistory. After this call:
    //   zoneHistory = ['sylvani', 'emberpeak']   ← maren + gilded-cage still missing
    expect(next.sharedTriforce.wisdom).toBe(false);
    expect(next.sharedTriforce.courage).toBe(false);
    expect(next.sharedTriforce.power).toBe(false);
  });
});

// REQ-32 (u-9a) retired the canSpawnRegionBoss gate — the region slot
// is always engageable once the zone is active. Selector coverage for
// currentWildBossForZone / currentRegionBossForZone (including the
// Boulderkin FIFO advance) lives in src/rules/zones.test.ts.
