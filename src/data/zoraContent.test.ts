import { describe, it, expect } from 'vitest';
import { KID_CARDS, MAREN_BOSSES, MAREN_REGULARS } from './cards';
import type { Card } from '../types/card';
import type { KidGameState, KidPlayer } from '../store/types';
import { ZONE_METADATA, ZONE_ORDER, nextZone } from '../rules/zones';
import { advanceZone, incrementTideGauge, TIDE_GAUGE_MAX } from '../store/slices/zones';
import { createSeededRng } from '../rules/chestPool';
import { BOSS_ATTACK_PATTERNS, BOSS_HP } from './bossAttackPatterns';
import { makeKidPlayer, makeKidGameState } from '../testing/stateFixtures';

/**
 * gdd.1 Tidehold content coverage (v2.1 zone 3 — substrate ship).
 *
 * Six new cards: 4 regulars (maren-warrior / reefblade / frost-jellet /
 * fangfish), 1 wild boss (maelstrom), 1 region boss (tidewraith). This
 * suite asserts the acceptance matrix verbatim plus the tide-gauge
 * substrate (state field + increment + reset on zone advance).
 *
 *  (a) all 4 regulars + 2 bosses exist with zone='maren' + expected stats
 *  (b) ZONE_METADATA.maren wires the roster + ZONE_ORDER splices maren
 *      between emberpeak and gilded-cage
 *  (c) BOSS_ATTACK_PATTERNS + BOSS_HP carry maelstrom + tidewraith entries
 *  (d) tidewraith defeat advances 'maren' → 'gilded-cage' (and resets
 *      tideGauge to 0 on the boundary crossing)
 *  (e) Courage-unlock gate now requires maren in zoneHistory (along with
 *      sylvani, emberpeak, gilded-cage) — single-zone advance
 *      doesn't flip Courage
 *  (f) tide-gauge: increments only in Maren, clamps at TIDE_GAUGE_MAX,
 *      resets to 0 on advanceZone-driven zone change
 */

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer => makeKidPlayer(overrides);

function makeState(overrides: Partial<KidGameState> = {}): KidGameState {
  return makeKidGameState({
    players: [makePlayer({ id: 'p0' }), makePlayer({ id: 'p1' })],
    seed: 1,
    rng: createSeededRng(1),
    currentZone: 'maren',
    zoneHistory: ['sylvani', 'emberpeak'],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// (a) Card existence + zone affinity + bossTier shape.
// ---------------------------------------------------------------------------

describe('gdd.1 Maren content — card existence + zone affinity (a)', () => {
  it('exports 4 regulars in MAREN_REGULARS with zone="maren" and role="monster"', () => {
    const ids = MAREN_REGULARS.map((c) => c.id);
    expect(ids).toEqual(['maren-warrior', 'reefblade', 'frost-jellet', 'fangfish']);
    for (const card of MAREN_REGULARS) {
      expect(card.zone, `${card.id}: zone must be 'maren'`).toBe('maren');
      expect(card.role, `${card.id}: role must be 'monster'`).toBe('monster');
      expect(card.bossTier).toBeUndefined();
    }
  });

  it('exports 2 bosses in MAREN_BOSSES with zone="maren" and bossTier set', () => {
    const ids = MAREN_BOSSES.map((c) => c.id);
    expect(ids).toEqual(['maelstrom', 'tidewraith']);
    const maelstrom = MAREN_BOSSES.find((c) => c.id === 'maelstrom')!;
    expect(maelstrom.zone).toBe('maren');
    expect(maelstrom.bossTier).toBe('wild-boss');
    const tidewraith = MAREN_BOSSES.find((c) => c.id === 'tidewraith')!;
    expect(tidewraith.zone).toBe('maren');
    expect(tidewraith.bossTier).toBe('region-boss');
  });

  it('all 6 cards are present in KID_CARDS (by-id lookup resolves)', () => {
    const ids = ['maren-warrior', 'reefblade', 'frost-jellet', 'fangfish', 'maelstrom', 'tidewraith'];
    for (const id of ids) {
      const card = KID_CARDS.find((c) => c.id === id);
      expect(card, `${id} missing from KID_CARDS`).toBeDefined();
    }
  });

  it('regulars carry monster-drop effect with at least +1 hp baseline', () => {
    for (const card of MAREN_REGULARS) {
      expect(card.effects.kind).toBe('monster-drop');
      if (card.effects.kind === 'monster-drop') {
        expect(card.effects.hearts ?? 0).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('maelstrom cost.red ≥ 2× the highest regular cost.red (wild-tier scale)', () => {
    const highestRegularRed = Math.max(...MAREN_REGULARS.map((c) => c.cost.red ?? 0));
    const maelstrom = MAREN_BOSSES.find((c) => c.id === 'maelstrom')!;
    expect(maelstrom.cost.red ?? 0).toBeGreaterThanOrEqual(2 * highestRegularRed);
  });
});

// ---------------------------------------------------------------------------
// (b) ZONE_METADATA + ZONE_ORDER consistency.
// ---------------------------------------------------------------------------

describe('gdd.1 Maren — ZONE_METADATA + ZONE_ORDER consistency (b)', () => {
  it('ZONE_ORDER splices maren between emberpeak and gilded-cage', () => {
    expect(ZONE_ORDER).toEqual([
      'sylvani',
      'emberpeak',
      'maren',
      'hollow-shrine',
      'dune-sanctum',
      'gilded-cage',
    ]);
  });

  it('ZONE_METADATA.maren wires the roster matching the card definitions', () => {
    const meta = ZONE_METADATA.maren;
    expect(meta.id).toBe('maren');
    expect(meta.displayName).toBe("Tidehold");
    expect(meta.themeHint.length).toBeGreaterThan(0);
    expect(meta.regularEnemyIds).toEqual([
      'maren-warrior',
      'reefblade',
      'frost-jellet',
      'fangfish',
    ]);
    expect(meta.wildBossIds).toEqual(['maelstrom']);
    expect(meta.regionBossId).toBe('tidewraith');
  });

  it('nextZone walks maren → hollow-shrine', () => {
    expect(nextZone('emberpeak')).toBe('maren');
    // gdd.2: Hollow Shrine spliced between maren and gilded-cage.
    // Maren's nextZone now points at hollow-shrine, not directly at
    // the terminal Gilded Cage.
    expect(nextZone('maren')).toBe('hollow-shrine');
  });
});

// ---------------------------------------------------------------------------
// (c) bossAttackPatterns + BOSS_HP entries.
// ---------------------------------------------------------------------------

describe('gdd.1 Maren — boss attack patterns + HP (c)', () => {
  it('maelstrom and tidewraith each have a BossAttackPattern entry', () => {
    expect(BOSS_ATTACK_PATTERNS['maelstrom']).toBeDefined();
    expect(BOSS_ATTACK_PATTERNS['tidewraith']).toBeDefined();
    expect(BOSS_ATTACK_PATTERNS['maelstrom'].damagePerTurn).toBeGreaterThan(0);
    expect(BOSS_ATTACK_PATTERNS['tidewraith'].damagePerTurn).toBeGreaterThan(0);
  });

  it('maelstrom and tidewraith each have a BOSS_HP entry', () => {
    expect(BOSS_HP['maelstrom']).toBeGreaterThan(0);
    expect(BOSS_HP['tidewraith']).toBeGreaterThan(0);
  });

  it('tidewraith HP sits in the region-boss band (>= wild bosses, no higher than the existing region max)', () => {
    expect(BOSS_HP['tidewraith']).toBeGreaterThanOrEqual(BOSS_HP['maelstrom']);
    // Existing region-boss max in v2.0 is broodmaw=18 / ashen-tyrant=19
    // / vurmox=20. Tidewraith sits no higher.
    expect(BOSS_HP['tidewraith']).toBeLessThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// (d) tidewraith defeat advances maren → gilded-cage. Tested through the
// pure advanceZone helper (combat-side hook coverage lives in the
// existing zone-advance integration test for ashen-tyrant /
// applyBossDefeatHooks; the tidewraith defeat path runs through the same
// region-boss branch and is structurally identical to ashen-tyrant).
// ---------------------------------------------------------------------------

describe('gdd.1 Maren — tidewraith defeat advances zone (d)', () => {
  it('advanceZone from currentZone="maren" lands at "hollow-shrine" (gdd.2 splice)', () => {
    const s = makeState({ currentZone: 'maren', zoneHistory: ['sylvani', 'emberpeak'] });
    const next = advanceZone(s);
    // gdd.2: Hollow Shrine spliced between maren and gilded-cage.
    // tidewraith's defeat now hands off into hollow-shrine rather than
    // jumping directly to the terminal zone.
    expect(next.currentZone).toBe('hollow-shrine');
    expect(next.zoneHistory).toEqual(['sylvani', 'emberpeak', 'maren']);
  });
});

// ---------------------------------------------------------------------------
// (e) Courage gate: maren is REQUIRED in history before terminal advance
// flips Courage. Single-step advance from maren does NOT flip Courage —
// the player still needs the gilded-cage terminal advance.
// ---------------------------------------------------------------------------

describe('gdd.1 Maren — Courage gate extension (e)', () => {
  it('advance into maren without gilded-cage in history leaves Courage false', () => {
    let s = makeState({ currentZone: 'emberpeak', zoneHistory: ['sylvani'] });
    s = advanceZone(s); // → maren
    expect(s.currentZone).toBe('maren');
    expect(s.sharedTriforce.courage).toBe(false);
  });

  it('full 6-zone clearance flips Courage in the terminal-advance transaction (gdd.3 chain)', () => {
    let s = makeState({ currentZone: 'sylvani', zoneHistory: [] });
    s = advanceZone(s); // → emberpeak
    s = advanceZone(s); // → maren
    s = advanceZone(s); // → hollow-shrine
    s = advanceZone(s); // → dune-sanctum
    s = advanceZone(s); // → gilded-cage
    s = advanceZone(s); // terminal append
    expect(s.zoneHistory).toEqual([
      'sylvani',
      'emberpeak',
      'maren',
      'hollow-shrine',
      'dune-sanctum',
      'gilded-cage',
    ]);
    expect(s.sharedTriforce.courage).toBe(true);
  });

  it('advancing sylvani + emberpeak + maren + hollow-shrine + dune-sanctum WITHOUT terminal advance leaves Courage false', () => {
    let s = makeState({ currentZone: 'sylvani', zoneHistory: [] });
    s = advanceZone(s); // → emberpeak
    s = advanceZone(s); // → maren
    s = advanceZone(s); // → hollow-shrine
    s = advanceZone(s); // → dune-sanctum
    s = advanceZone(s); // → gilded-cage
    expect(s.currentZone).toBe('gilded-cage');
    // zoneHistory has the five cleared zones but NOT the terminal yet.
    expect(s.zoneHistory).toEqual([
      'sylvani',
      'emberpeak',
      'maren',
      'hollow-shrine',
      'dune-sanctum',
    ]);
    expect(s.sharedTriforce.courage).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// (f) tide-gauge slice substrate.
// ---------------------------------------------------------------------------

describe('gdd.1 Maren — tide-gauge slice substrate (f)', () => {
  it('initial tideGauge value on a fresh state is 0', () => {
    const s = makeState({ currentZone: 'sylvani' });
    expect(s.tideGauge).toBe(0);
  });

  it('incrementTideGauge is a no-op outside Maren (returns input reference unchanged)', () => {
    const s = makeState({ currentZone: 'sylvani', tideGauge: 0 });
    expect(incrementTideGauge(s)).toBe(s);
    const sDM = makeState({ currentZone: 'emberpeak', tideGauge: 0 });
    expect(incrementTideGauge(sDM)).toBe(sDM);
    const sToT = makeState({ currentZone: 'gilded-cage', tideGauge: 0 });
    expect(incrementTideGauge(sToT)).toBe(sToT);
  });

  it('incrementTideGauge bumps by 1 while currentZone === "maren"', () => {
    let s = makeState({ currentZone: 'maren', tideGauge: 0 });
    s = incrementTideGauge(s);
    expect(s.tideGauge).toBe(1);
    s = incrementTideGauge(s);
    expect(s.tideGauge).toBe(2);
    s = incrementTideGauge(s);
    expect(s.tideGauge).toBe(3);
  });

  it(`clamps at TIDE_GAUGE_MAX (${TIDE_GAUGE_MAX})`, () => {
    let s = makeState({ currentZone: 'maren', tideGauge: 0 });
    for (let i = 0; i < 10; i += 1) {
      s = incrementTideGauge(s);
    }
    expect(s.tideGauge).toBe(TIDE_GAUGE_MAX);
  });

  it('incrementTideGauge is identity at the cap (no new state allocation)', () => {
    const s = makeState({ currentZone: 'maren', tideGauge: TIDE_GAUGE_MAX });
    expect(incrementTideGauge(s)).toBe(s);
  });

  it('advanceZone resets tideGauge to 0 when currentZone changes', () => {
    const s = makeState({
      currentZone: 'maren',
      zoneHistory: ['sylvani', 'emberpeak'],
      tideGauge: 3,
    });
    const next = advanceZone(s);
    // gdd.2: maren's nextZone is now hollow-shrine (was gilded-cage
    // pre-splice). Tide-gauge reset semantics are unchanged — any
    // boundary crossing zeros the gauge.
    expect(next.currentZone).toBe('hollow-shrine');
    expect(next.tideGauge).toBe(0);
  });

  it('advanceZone preserves tideGauge on the terminal idempotent re-call', () => {
    // Already at terminal + already in history → identity return; the
    // tideGauge stays at whatever it was (irrelevant in practice — the
    // only path that reaches this branch is post-region-boss-defeat
    // outside of Maren, so tideGauge should already be 0 — but the
    // idempotent contract must not zero a non-zero value out either).
    const s = makeState({
      currentZone: 'gilded-cage',
      zoneHistory: [
        'sylvani',
        'emberpeak',
        'maren',
        'hollow-shrine',
        'dune-sanctum',
        'gilded-cage',
      ],
      tideGauge: 0,
      shadowCreep: 0,
      sandstormCounter: 0,
      skullfishFieldWatchlist: [],
    });
    const next = advanceZone(s);
    expect(next).toBe(s);
  });
});

// ---------------------------------------------------------------------------
// Card-list export consistency.
// ---------------------------------------------------------------------------

describe('gdd.1 Maren — supply-plan inclusion sanity', () => {
  it("regulars carry zone='maren' affinity (authoring tag — runtime spawn reads ZONE_METADATA.maren.regularEnemyIds)", () => {
    for (const id of ZONE_METADATA.maren.regularEnemyIds) {
      const card = KID_CARDS.find((c) => c.id === id);
      expect(card, `${id} missing from KID_CARDS`).toBeDefined();
      expect((card as Card).zone).toBe('maren');
    }
  });

  it('wild + region bosses are in KID_CARDS and carry zone="maren"', () => {
    for (const id of [...ZONE_METADATA.maren.wildBossIds, ZONE_METADATA.maren.regionBossId]) {
      if (id === null) continue;
      const card = KID_CARDS.find((c) => c.id === id);
      expect(card, `${id} missing from KID_CARDS`).toBeDefined();
      expect((card as Card).zone).toBe('maren');
    }
  });
});
