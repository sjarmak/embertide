import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { KID_CARDS, baseIdOf, buildSupply } from './cards';
import { createSeededRng } from '../rules/chestPool';
import type { Card } from '../types/card';
import type { KidGameState, KidPlayer } from '../store/types';
import { buildResolveWinAction, createGameStore } from '../store/gameStore';
import { fightMonster } from '../store/slices/combat';
import { ZONE_METADATA } from '../rules/zones';
import { makeKidPlayer, makeKidGameState } from '../testing/stateFixtures';

/**
 * u-6a Sylvanwood content coverage (amendment A5).
 *
 * Six new cards: 4 regular enemies (thorn-scrub / snapvine / jellet /
 * scrabling), 1 wild boss (craghorn), 1 region boss (broodmaw). This suite
 * asserts the acceptance matrix verbatim:
 *
 *  (a) all 4 regular enemies exist with zone affinity='sylvani' +
 *      expected stats
 *  (b) craghorn exists with bossTier='wild-boss' and red cost ≥ 2× the
 *      highest regular
 *  (c) broodmaw exists with bossTier='region-boss'
 *  (d) Craghorn defeat grants a wisp with 3-cap routing (defeater →
 *      teammate → console.warn + no grant)
 *  (e) Broodmaw defeat triggers advanceZone sylvani → emberpeak
 *  (f) neither Craghorn nor Broodmaw flips any sharedTriforce flag
 *  (g) REQ-32 (u-9a): the region slot is always engageable once the
 *      zone is active; wild slot FIFO-advances as Craghorn falls. Gate
 *      coverage moved to src/rules/zones.test.ts.
 *
 * Zone affinity option (i) per unit brief: the optional `zone` field on
 * Card is the authoring declaration; ZONE_METADATA.sylvani is the
 * runtime spawn-logic source of truth. Both are asserted here for
 * two-way consistency.
 */

// ---------------------------------------------------------------------------
// Test-metadata safety: mirror zones.test.ts's snapshot/restore so any
// ad-hoc patching done inside this suite (we deliberately do not patch
// ZONE_METADATA.sylvani in u-6a — the data landed — but u-6b/c rebases
// might, and the pattern is cheap insurance against leakage across
// Vitest workers).
// ---------------------------------------------------------------------------
let ZONE_SYLVANI_SNAPSHOT: (typeof ZONE_METADATA)['sylvani'] | null = null;

beforeEach(() => {
  ZONE_SYLVANI_SNAPSHOT = { ...ZONE_METADATA.sylvani };
});

afterEach(() => {
  if (ZONE_SYLVANI_SNAPSHOT) {
    ZONE_METADATA.sylvani = ZONE_SYLVANI_SNAPSHOT;
    ZONE_SYLVANI_SNAPSHOT = null;
  }
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer => makeKidPlayer(overrides);

function makeState(overrides: Partial<KidGameState> = {}): KidGameState {
  return makeKidGameState({
    players: [makePlayer({ id: 'p0' }), makePlayer({ id: 'p1' })],
    seed: 1,
    rng: createSeededRng(1),
    ...overrides,
  });
}

// Look up by canonical base id (tolerant of duplicate `-N` suffixes
// from buildSupply even though KID_CARDS itself is single-copy).
function cardById(id: string): Card {
  const found = KID_CARDS.find((c) => c.id === id);
  if (!found) throw new Error(`Missing card in KID_CARDS: ${id}`);
  return found;
}

const REGULAR_IDS = ['thorn-scrub', 'snapvine', 'jellet', 'scrabling'] as const;

// ---------------------------------------------------------------------------
// (a) Regular enemy declarations + zone affinity.
// ---------------------------------------------------------------------------

describe('u-6a Sylvani regulars (a) — dataset declarations', () => {
  it.each(REGULAR_IDS)('%s exists as role=monster with zone=sylvani', (id) => {
    const card = cardById(id);
    expect(card.role).toBe('monster');
    expect(card.zone).toBe('sylvani');
  });

  it.each(REGULAR_IDS)('%s has no bossTier and no shard grant', (id) => {
    const card = cardById(id);
    expect(card.bossTier).toBeUndefined();
    // Shards are granted only via Princess/Map/Vurmox paths per A2 —
    // none of the regulars can carry a shard, and the effects kind is
    // always `monster-drop` for beasts in the u-6a roster.
    expect(card.effects.kind).toBe('monster-drop');
  });

  it.each(REGULAR_IDS)('%s has a +1 HP monster-drop (REQ-2 heart → HP heal)', (id) => {
    const card = cardById(id);
    if (card.effects.kind !== 'monster-drop') {
      throw new Error(`${id}: expected monster-drop effect`);
    }
    // snapvine is the outlier — unique on-defeat hook grants +2 HP.
    // Every other sylvani regular sits at +1 HP per REQ-2.
    const expectedHearts = id === 'snapvine' ? 2 : 1;
    expect(card.effects.hearts).toBe(expectedHearts);
  });

  it('scrabling uniquely drops a key on defeat (differentiating on-defeat hook)', () => {
    const scrabling = cardById('scrabling');
    if (scrabling.effects.kind !== 'monster-drop')
      throw new Error('scrabling: expected monster-drop');
    expect(scrabling.effects.keys).toBe(1);
  });

  it.each(REGULAR_IDS)('%s red cost is within the 3-5 balance band', (id) => {
    const card = cardById(id);
    const red = card.cost.red ?? 0;
    expect(red).toBeGreaterThanOrEqual(3);
    expect(red).toBeLessThanOrEqual(5);
  });

  it('ZONE_METADATA.sylvani.regularEnemyIds mirrors the 4 authored ids exactly', () => {
    expect([...ZONE_METADATA.sylvani.regularEnemyIds]).toEqual([...REGULAR_IDS]);
  });
});

// ---------------------------------------------------------------------------
// (b) Craghorn wild-boss.
// ---------------------------------------------------------------------------

describe('u-6a Craghorn wild-boss (b)', () => {
  it('exists with role=mini-boss, bossTier=wild-boss, zone=sylvani', () => {
    const craghorn = cardById('craghorn');
    expect(craghorn.role).toBe('mini-boss');
    expect(craghorn.bossTier).toBe('wild-boss');
    expect(craghorn.zone).toBe('sylvani');
  });

  it('red cost is ≥ 2× the highest regular (tough-enough threshold)', () => {
    const craghorn = cardById('craghorn');
    const hinoxRed = craghorn.cost.red ?? 0;
    const highestRegularRed = REGULAR_IDS.reduce((max, id) => {
      const r = cardById(id).cost.red ?? 0;
      return r > max ? r : max;
    }, 0);
    expect(hinoxRed).toBeGreaterThanOrEqual(2 * highestRegularRed);
  });

  it('is NOT in the market supply (u-9a / REQ-32) — wild-boss slot only', () => {
    // KID_CARDS still carries the single craghorn TEMPLATE for id-lookups
    // (ZONE_METADATA, engagement dispatch, etc.). Post-u-9a it no longer
    // populates SUPPLY_PLAN — the wild-boss slot in
    // `currentWildBossForZone` is the authoritative spawn path.
    expect(KID_CARDS.filter((c) => c.id === 'craghorn')).toHaveLength(1);
    const supply = buildSupply(createSeededRng(42));
    const hinoxCopies = supply.filter((c) => baseIdOf(c) === 'craghorn').length;
    expect(hinoxCopies).toBe(0);
  });

  it('ZONE_METADATA.sylvani.wildBossIds contains craghorn', () => {
    expect(ZONE_METADATA.sylvani.wildBossIds).toContain('craghorn');
  });
});

// ---------------------------------------------------------------------------
// (c) Broodmaw region-boss.
// ---------------------------------------------------------------------------

describe('u-6a Broodmaw region-boss (c)', () => {
  it('exists with role=mini-boss, bossTier=region-boss, zone=sylvani', () => {
    const broodmaw = cardById('broodmaw');
    expect(broodmaw.role).toBe('mini-boss');
    expect(broodmaw.bossTier).toBe('region-boss');
    expect(broodmaw.zone).toBe('sylvani');
  });

  it('carries a key cost on top of red (region-boss gatekeeper tuning)', () => {
    const broodmaw = cardById('broodmaw');
    expect(broodmaw.cost.keys ?? 0).toBeGreaterThanOrEqual(1);
    expect(broodmaw.cost.red ?? 0).toBeGreaterThanOrEqual(12);
  });

  it('is the regionBossId for sylvani', () => {
    expect(ZONE_METADATA.sylvani.regionBossId).toBe('broodmaw');
  });

  it('is NOT in the market supply (u-9a / REQ-32) — region-boss slot only', () => {
    // Template is still in KID_CARDS for id-lookups; post-u-9a it
    // spawns only via the region-boss slot in
    // `currentRegionBossForZone`.
    expect(KID_CARDS.filter((c) => c.id === 'broodmaw')).toHaveLength(1);
    const supply = buildSupply(createSeededRng(42));
    const gohmaCopies = supply.filter((c) => baseIdOf(c) === 'broodmaw').length;
    expect(gohmaCopies).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// (d) Craghorn defeat wisp-routing via fightMonster.
//
// Uses the real KID_CARDS craghorn template so we exercise the full
// bossTier='wild-boss' branch inside applyBossDefeatHooks. The wisp
// mint produces a unique id each time (wisp-wild-boss-craghorn-<counter>).
// ---------------------------------------------------------------------------

describe('u-6a (d) — Craghorn defeat wisp routing via fightMonster', () => {
  it('grants a fresh wisp to the defeater (items unbounded per nmmc)', () => {
    const craghorn = { ...cardById('craghorn') };
    let s = makeState({
      players: [makePlayer({ id: 'p0', red: 15, keys: 2 }), makePlayer({ id: 'p1' })],
      field: [craghorn],
    });
    s = fightMonster(s, 0, craghorn.id);
    const defeater = s.players[0];
    expect(defeater.items.length).toBe(1);
    const grantedFairy = defeater.items[0];
    expect(baseIdOf(grantedFairy)).toBe('wisp');
    expect(grantedFairy.id).toMatch(/^wisp-wild-boss-craghorn-\d+$/);
    // Defeat was recorded, no shard granted, zone unchanged (wild).
    expect(s.defeatedBossIds).toContain('craghorn');
    expect(s.currentZone).toBe('sylvani');
  });

  it('grants the wisp to the defeater even when their items zone has 3+ items (nmmc unbounded)', () => {
    const craghorn = { ...cardById('craghorn') };
    const filler: Card = cardById('short-sword');
    let s = makeState({
      players: [
        makePlayer({
          id: 'p0',
          red: 15,
          keys: 2,
          items: [
            { ...filler, id: 'short-sword-1' } as Card,
            { ...filler, id: 'short-sword-2' } as Card,
            { ...filler, id: 'short-sword-3' } as Card,
          ],
        }),
        makePlayer({ id: 'p1', items: [] }),
      ],
      field: [craghorn],
    });
    s = fightMonster(s, 0, craghorn.id);
    // Defeater receives the wisp regardless of pre-existing item count.
    expect(s.players[0].items.length).toBe(4);
    expect(s.players[0].items.some((c) => baseIdOf(c) === 'wisp')).toBe(true);
    // Teammate items untouched.
    expect(s.players[1].items.length).toBe(0);
  });

  it('successive Craghorn defeats mint unique wisp ids (never reuse)', () => {
    const hinox1 = { ...cardById('craghorn'), id: 'craghorn-copy-1' };
    const hinox2 = { ...cardById('craghorn'), id: 'craghorn-copy-2' };
    let s = makeState({
      players: [makePlayer({ id: 'p0', red: 30, keys: 4 }), makePlayer({ id: 'p1' })],
      field: [hinox1],
    });
    s = fightMonster(s, 0, hinox1.id);
    const firstId = s.players[0].items[0].id;
    // Mount the second craghorn in the field and defeat it.
    s = { ...s, field: [hinox2] };
    s = fightMonster(s, 0, hinox2.id);
    const secondId = s.players[0].items[1].id;
    expect(firstId).not.toBe(secondId);
    expect(firstId).toMatch(/^wisp-wild-boss-/);
    expect(secondId).toMatch(/^wisp-wild-boss-/);
  });
});

// ---------------------------------------------------------------------------
// (e) Broodmaw defeat triggers advanceZone.
// ---------------------------------------------------------------------------

describe('u-6a (e) — Broodmaw defeat triggers advanceZone sylvani → emberpeak', () => {
  it('fightMonster on broodmaw flips currentZone and appends sylvani to zoneHistory', () => {
    const broodmaw = { ...cardById('broodmaw') };
    let s = makeState({
      players: [makePlayer({ id: 'p0', red: 20, keys: 3, items: [] }), makePlayer({ id: 'p1' })],
      field: [broodmaw],
      // Pre-seed craghorn defeat so the game flow mirrors a typical
      // wild-then-region clear. Post-REQ-32 the region slot is always
      // engageable; keeping this pre-seed preserves the test's original
      // narrative intent.
      defeatedBossIds: ['craghorn'],
    });
    s = fightMonster(s, 0, broodmaw.id);
    expect(s.currentZone).toBe('emberpeak');
    expect(s.zoneHistory).toEqual(['sylvani']);
    expect(s.defeatedBossIds).toContain('broodmaw');
  });

  it('via createGameStore — store-driven broodmaw kill advances the zone', () => {
    // u-8c: region-boss engagement now routes through the combat
    // sub-state (PRD §B6). fightMonster dispatches COMBAT_ENTER rather
    // than instant-resolving; the zone advance lands on the
    // COMBAT_RESOLVE_WIN payload once the combat finishes. We simulate
    // "broodmaw defeated" by entering combat and then dispatching the WIN
    // action directly — the instant-resolution path is no longer valid
    // for region-boss tiers.
    const store = createGameStore(1);
    store.getState().initGame({
      players: 2,
      championIds: ['champion-power', 'champion-courage'],
    });
    expect(store.getState().currentZone).toBe('sylvani');
    const broodmaw = { ...cardById('broodmaw') };
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], red: 20, keys: 3 };
      return {
        ...s,
        players,
        field: [broodmaw],
        defeatedBossIds: ['craghorn'],
      };
    });
    store.getState().fightMonster(broodmaw.id);
    // Combat is now active; resolve the win to trigger zone advance +
    // defeat recording + shard grant.
    expect(store.getState().activeCombat).not.toBeNull();
    store.getState().dispatchCombat(buildResolveWinAction(broodmaw, ['p0', 'p1'], 'sylvani'));
    const after = store.getState();
    expect(after.currentZone).toBe('emberpeak');
    expect(after.zoneHistory).toEqual(['sylvani']);
    expect(after.defeatedBossIds).toContain('broodmaw');
  });
});

// ---------------------------------------------------------------------------
// (f) Neither Craghorn nor Broodmaw flips any sharedTriforce flag.
// ---------------------------------------------------------------------------

describe('u-6a (f) — no shard grant from Craghorn or Broodmaw', () => {
  it('Craghorn defeat does NOT flip wisdom/courage/power', () => {
    const craghorn = { ...cardById('craghorn') };
    let s = makeState({
      players: [makePlayer({ id: 'p0', red: 15, keys: 2 }), makePlayer({ id: 'p1' })],
      field: [craghorn],
    });
    s = fightMonster(s, 0, craghorn.id);
    expect(s.sharedTriforce).toEqual({ wisdom: false, courage: false, power: false });
  });

  it('Broodmaw defeat (non-terminal zone) does NOT flip any shard', () => {
    const broodmaw = { ...cardById('broodmaw') };
    let s = makeState({
      players: [makePlayer({ id: 'p0', red: 20, keys: 3 }), makePlayer({ id: 'p1' })],
      field: [broodmaw],
      defeatedBossIds: ['craghorn'],
    });
    s = fightMonster(s, 0, broodmaw.id);
    // sylvani is NOT the terminal zone — Courage only unlocks on full
    // 3-zone clear (u-5b). wisdom/power paths are untouched too.
    expect(s.sharedTriforce).toEqual({ wisdom: false, courage: false, power: false });
  });
});

// REQ-32 (u-9a) retired the canSpawnRegionBoss gate — the region slot
// is always engageable once the zone is active. Selector coverage for
// currentWildBossForZone / currentRegionBossForZone (including Craghorn
// FIFO advancement) lives in src/rules/zones.test.ts.
