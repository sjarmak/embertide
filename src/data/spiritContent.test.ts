import { describe, it, expect } from 'vitest';
import { KID_CARDS, SPIRIT_BOSSES, SPIRIT_REGULARS } from './cards';
import type { Card } from '../types/card';
import type { KidGameState, KidPlayer } from '../store/types';
import { ZONE_METADATA, ZONE_ORDER, nextZone } from '../rules/zones';
import {
  advanceZone,
  incrementSandstormCounter,
  SANDSTORM_COUNTER_MAX,
} from '../store/slices/zones';
import { createSeededRng } from '../rules/chestPool';
import { BOSS_ATTACK_PATTERNS, BOSS_HP } from './bossAttackPatterns';
import { enterCombatAction } from '../store/gameStore';
import { makeKidPlayer, makeKidGameState } from '../testing/stateFixtures';

/**
 * gdd.3 Dune Sanctum content coverage (v2.1 zone 5 — substrate ship).
 *
 * Six new cards: 4 regulars (duneweed / sandwyrm / sunbleached-reaver / scuttlespine),
 * 1 wild boss (iron-sentinel), 1 region boss (hextwins). This suite
 * mirrors shadowContent.test.ts one-for-one — same acceptance matrix
 * substituted for dune-sanctum content + the sandstorm-counter
 * substrate (state field + increment + reset on zone advance).
 *
 *  (a) all 4 regulars + 2 bosses exist with zone='dune-sanctum' + expected stats
 *  (b) ZONE_METADATA['dune-sanctum'] wires the roster + ZONE_ORDER
 *      splices dune-sanctum between hollow-shrine and gilded-cage
 *  (c) BOSS_ATTACK_PATTERNS + BOSS_HP carry iron-sentinel + hextwins entries
 *  (d) hextwins defeat advances 'dune-sanctum' → 'gilded-cage'
 *      (and resets sandstormCounter to 0 on the boundary crossing)
 *  (e) Courage-unlock gate now requires dune-sanctum in zoneHistory
 *      alongside sylvani / emberpeak / maren / hollow-shrine / gilded-cage
 *  (f) sandstorm-counter: increments only in dune-sanctum, clamps at
 *      SANDSTORM_COUNTER_MAX, resets to 0 on advanceZone-driven zone change
 *  (g) sandstorm-counter consumer: enterCombatAction snapshots state
 *      onto the boss attack pattern's damagePerTurn at combat-entry
 */

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer => makeKidPlayer(overrides);

function makeState(overrides: Partial<KidGameState> = {}): KidGameState {
  return makeKidGameState({
    players: [makePlayer({ id: 'p0' }), makePlayer({ id: 'p1' })],
    seed: 1,
    rng: createSeededRng(1),
    currentZone: 'dune-sanctum',
    zoneHistory: ['sylvani', 'emberpeak', 'maren', 'hollow-shrine'],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// (a) Card existence + zone affinity + bossTier shape.
// ---------------------------------------------------------------------------

describe('gdd.3 Spirit content — card existence + zone affinity (a)', () => {
  it('exports 4 regulars in SPIRIT_REGULARS with zone="dune-sanctum" and role="monster"', () => {
    const ids = SPIRIT_REGULARS.map((c) => c.id);
    expect(ids).toEqual(['duneweed', 'sandwyrm', 'sunbleached-reaver', 'scuttlespine']);
    for (const card of SPIRIT_REGULARS) {
      expect(card.zone, `${card.id}: zone must be 'dune-sanctum'`).toBe('dune-sanctum');
      expect(card.role, `${card.id}: role must be 'monster'`).toBe('monster');
      expect(card.bossTier).toBeUndefined();
    }
  });

  it('exports 2 bosses in SPIRIT_BOSSES with zone="dune-sanctum" and bossTier set', () => {
    const ids = SPIRIT_BOSSES.map((c) => c.id);
    expect(ids).toEqual(['iron-sentinel', 'hextwins']);
    const ironSentinel = SPIRIT_BOSSES.find((c) => c.id === 'iron-sentinel')!;
    expect(ironSentinel.zone).toBe('dune-sanctum');
    expect(ironSentinel.bossTier).toBe('wild-boss');
    const hextwins = SPIRIT_BOSSES.find((c) => c.id === 'hextwins')!;
    expect(hextwins.zone).toBe('dune-sanctum');
    expect(hextwins.bossTier).toBe('region-boss');
  });

  it('all 6 cards are present in KID_CARDS (by-id lookup resolves)', () => {
    const ids = ['duneweed', 'sandwyrm', 'sunbleached-reaver', 'scuttlespine', 'iron-sentinel', 'hextwins'];
    for (const id of ids) {
      const card = KID_CARDS.find((c) => c.id === id);
      expect(card, `${id} missing from KID_CARDS`).toBeDefined();
    }
  });

  it('regulars carry monster-drop effect with at least +1 hp baseline', () => {
    for (const card of SPIRIT_REGULARS) {
      expect(card.effects.kind).toBe('monster-drop');
      if (card.effects.kind === 'monster-drop') {
        expect(card.effects.hearts ?? 0).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('iron-sentinel cost.red >= 2x the highest regular cost.red (wild-tier scale)', () => {
    const highestRegularRed = Math.max(...SPIRIT_REGULARS.map((c) => c.cost.red ?? 0));
    const ironSentinel = SPIRIT_BOSSES.find((c) => c.id === 'iron-sentinel')!;
    expect(ironSentinel.cost.red ?? 0).toBeGreaterThanOrEqual(2 * highestRegularRed);
  });
});

// ---------------------------------------------------------------------------
// (b) ZONE_METADATA + ZONE_ORDER consistency.
// ---------------------------------------------------------------------------

describe('gdd.3 Spirit — ZONE_METADATA + ZONE_ORDER consistency (b)', () => {
  it('ZONE_ORDER splices dune-sanctum between hollow-shrine and gilded-cage', () => {
    expect(ZONE_ORDER).toEqual([
      'sylvani',
      'emberpeak',
      'maren',
      'hollow-shrine',
      'dune-sanctum',
      'gilded-cage',
    ]);
  });

  it('ZONE_METADATA["dune-sanctum"] wires the roster matching the card definitions', () => {
    const meta = ZONE_METADATA['dune-sanctum'];
    expect(meta.id).toBe('dune-sanctum');
    expect(meta.displayName).toBe('Dune Sanctum');
    expect(meta.themeHint.length).toBeGreaterThan(0);
    expect(meta.regularEnemyIds).toEqual(['duneweed', 'sandwyrm', 'sunbleached-reaver', 'scuttlespine']);
    expect(meta.wildBossIds).toEqual(['iron-sentinel']);
    expect(meta.regionBossId).toBe('hextwins');
  });

  it('nextZone walks dune-sanctum → gilded-cage', () => {
    expect(nextZone('hollow-shrine')).toBe('dune-sanctum');
    expect(nextZone('dune-sanctum')).toBe('gilded-cage');
  });
});

// ---------------------------------------------------------------------------
// (c) bossAttackPatterns + BOSS_HP entries.
// ---------------------------------------------------------------------------

describe('gdd.3 Spirit — boss attack patterns + HP (c)', () => {
  it('iron-sentinel and hextwins each have a BossAttackPattern entry', () => {
    expect(BOSS_ATTACK_PATTERNS['iron-sentinel']).toBeDefined();
    expect(BOSS_ATTACK_PATTERNS['hextwins']).toBeDefined();
    expect(BOSS_ATTACK_PATTERNS['iron-sentinel'].damagePerTurn).toBeGreaterThan(0);
    expect(BOSS_ATTACK_PATTERNS['hextwins'].damagePerTurn).toBeGreaterThan(0);
  });

  it('iron-sentinel uses player-hp targeting (heavy-swing vanilla fallback)', () => {
    expect(BOSS_ATTACK_PATTERNS['iron-sentinel'].targeting).toBe('player-hp');
  });

  it('iron-sentinel drops a wisp on defeat (wild-boss taxonomy)', () => {
    const onDefeat = BOSS_ATTACK_PATTERNS['iron-sentinel'].onDefeatEffect;
    expect(onDefeat?.kind).toBe('wisp-drop');
  });

  it('iron-sentinel and hextwins each have a BOSS_HP entry', () => {
    expect(BOSS_HP['iron-sentinel']).toBeGreaterThan(0);
    expect(BOSS_HP['hextwins']).toBeGreaterThan(0);
  });

  it('hextwins HP sits in the region-boss band (no higher than vurmox=20)', () => {
    expect(BOSS_HP['hextwins']).toBeGreaterThanOrEqual(BOSS_HP['iron-sentinel']);
    expect(BOSS_HP['hextwins']).toBeLessThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// (d) hextwins defeat advances dune-sanctum → gilded-cage.
// ---------------------------------------------------------------------------

describe('gdd.3 Spirit — hextwins defeat advances zone (d)', () => {
  it('advanceZone from currentZone="dune-sanctum" lands at "gilded-cage"', () => {
    const s = makeState({
      currentZone: 'dune-sanctum',
      zoneHistory: ['sylvani', 'emberpeak', 'maren', 'hollow-shrine'],
    });
    const next = advanceZone(s);
    expect(next.currentZone).toBe('gilded-cage');
    expect(next.zoneHistory).toEqual([
      'sylvani',
      'emberpeak',
      'maren',
      'hollow-shrine',
      'dune-sanctum',
    ]);
  });
});

// ---------------------------------------------------------------------------
// (e) Courage gate: dune-sanctum is REQUIRED in history before terminal
// advance flips Courage. Single-step advance from dune-sanctum does NOT
// flip Courage — the player still needs the gilded-cage terminal advance.
// ---------------------------------------------------------------------------

describe('gdd.3 Spirit — Courage gate extension (e)', () => {
  it('advance into dune-sanctum without gilded-cage in history leaves Courage false', () => {
    let s = makeState({
      currentZone: 'hollow-shrine',
      zoneHistory: ['sylvani', 'emberpeak', 'maren'],
    });
    s = advanceZone(s); // → dune-sanctum
    expect(s.currentZone).toBe('dune-sanctum');
    expect(s.sharedTriforce.courage).toBe(false);
  });

  it('full 6-zone clearance flips Courage in the terminal-advance transaction', () => {
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
});

// ---------------------------------------------------------------------------
// (f) sandstorm-counter slice substrate. Mirrors shadow-creep (gdd.2)
// one-for-one.
// ---------------------------------------------------------------------------

describe('gdd.3 Spirit — sandstorm-counter slice substrate (f)', () => {
  it('initial sandstormCounter is 0 (per EMPTY_STATE seed)', () => {
    const s = makeState();
    expect(s.sandstormCounter).toBe(0);
  });

  it('incrementSandstormCounter is a no-op outside dune-sanctum (returns input reference unchanged)', () => {
    const sK = makeState({ currentZone: 'sylvani', sandstormCounter: 0 });
    expect(incrementSandstormCounter(sK)).toBe(sK);
    const sDM = makeState({ currentZone: 'emberpeak', sandstormCounter: 0 });
    expect(incrementSandstormCounter(sDM)).toBe(sDM);
    const sZ = makeState({ currentZone: 'maren', sandstormCounter: 0 });
    expect(incrementSandstormCounter(sZ)).toBe(sZ);
    const sShadow = makeState({ currentZone: 'hollow-shrine', sandstormCounter: 0 });
    expect(incrementSandstormCounter(sShadow)).toBe(sShadow);
    const sToT = makeState({ currentZone: 'gilded-cage', sandstormCounter: 0 });
    expect(incrementSandstormCounter(sToT)).toBe(sToT);
  });

  it('incrementSandstormCounter bumps by 1 while currentZone === "dune-sanctum"', () => {
    let s = makeState({ currentZone: 'dune-sanctum', sandstormCounter: 0 });
    s = incrementSandstormCounter(s);
    expect(s.sandstormCounter).toBe(1);
    s = incrementSandstormCounter(s);
    expect(s.sandstormCounter).toBe(2);
    s = incrementSandstormCounter(s);
    expect(s.sandstormCounter).toBe(3);
  });

  it(`clamps at SANDSTORM_COUNTER_MAX (${SANDSTORM_COUNTER_MAX})`, () => {
    let s = makeState({ currentZone: 'dune-sanctum', sandstormCounter: 0 });
    for (let i = 0; i < 10; i += 1) {
      s = incrementSandstormCounter(s);
    }
    expect(s.sandstormCounter).toBe(SANDSTORM_COUNTER_MAX);
  });

  it('incrementSandstormCounter is identity at the cap (no new state allocation)', () => {
    const s = makeState({
      currentZone: 'dune-sanctum',
      sandstormCounter: SANDSTORM_COUNTER_MAX,
    });
    expect(incrementSandstormCounter(s)).toBe(s);
  });

  it('advanceZone resets sandstormCounter to 0 when currentZone changes', () => {
    const s = makeState({
      currentZone: 'dune-sanctum',
      zoneHistory: ['sylvani', 'emberpeak', 'maren', 'hollow-shrine'],
      sandstormCounter: 2,
    });
    const next = advanceZone(s);
    // dune-sanctum's nextZone is the terminal gilded-cage. Reset
    // semantics fire on every boundary crossing.
    expect(next.currentZone).toBe('gilded-cage');
    expect(next.sandstormCounter).toBe(0);
  });

  it('advanceZone preserves sandstormCounter on the terminal idempotent re-call', () => {
    // Already at terminal + already in history → identity return; the
    // gauge stays at whatever it was. (In practice always 0 outside
    // dune-sanctum, but the idempotent contract must not mutate.)
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
      sandstormCounter: 0,
    });
    const next = advanceZone(s);
    expect(next).toBe(s);
    expect(next.sandstormCounter).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// (g) sandstorm-counter CONSUMER: enterCombatAction snapshots
// state.sandstormCounter onto the boss attack pattern's damagePerTurn at
// combat-entry time. Mirrors the shadow-creep flat-adder semantics.
// ---------------------------------------------------------------------------

describe('gdd.3 Spirit — sandstorm-counter adder at combat-entry (g)', () => {
  function findBossCard(id: string): Card {
    const card = KID_CARDS.find((c) => c.id === id);
    expect(card, `${id} missing from KID_CARDS`).toBeDefined();
    return card!;
  }

  it('outside dune-sanctum, enterCombatAction leaves boss damagePerTurn untouched (uses canonical pattern)', () => {
    const s = makeState({ currentZone: 'sylvani', sandstormCounter: 0 });
    const boss = findBossCard('iron-sentinel');
    const action = enterCombatAction(s, { kind: 'card', card: boss }, 'fightMonster');
    expect(action.boss.attackPattern.damagePerTurn).toBe(
      BOSS_ATTACK_PATTERNS['iron-sentinel'].damagePerTurn,
    );
  });

  it('inside dune-sanctum with sandstormCounter=0, enterCombatAction leaves damagePerTurn untouched', () => {
    const s = makeState({ currentZone: 'dune-sanctum', sandstormCounter: 0 });
    const boss = findBossCard('hextwins');
    const action = enterCombatAction(s, { kind: 'card', card: boss }, 'fightMonster');
    expect(action.boss.attackPattern.damagePerTurn).toBe(
      BOSS_ATTACK_PATTERNS['hextwins'].damagePerTurn,
    );
  });

  it('inside dune-sanctum with sandstormCounter>0, enterCombatAction bumps damagePerTurn by sandstormCounter (clone, not mutate)', () => {
    const s = makeState({ currentZone: 'dune-sanctum', sandstormCounter: 2 });
    const boss = findBossCard('iron-sentinel');
    const baseDpt = BOSS_ATTACK_PATTERNS['iron-sentinel'].damagePerTurn;
    const action = enterCombatAction(s, { kind: 'card', card: boss }, 'fightMonster');
    expect(action.boss.attackPattern.damagePerTurn).toBe(baseDpt + 2);
    // Canonical pattern in BOSS_ATTACK_PATTERNS is unchanged (clone, not mutate).
    expect(BOSS_ATTACK_PATTERNS['iron-sentinel'].damagePerTurn).toBe(baseDpt);
  });

  it('sandstorm-counter adder applies uniformly to wild AND region bosses inside dune-sanctum', () => {
    const s = makeState({
      currentZone: 'dune-sanctum',
      sandstormCounter: SANDSTORM_COUNTER_MAX,
    });
    const wild = findBossCard('iron-sentinel');
    const region = findBossCard('hextwins');
    const wildBase = BOSS_ATTACK_PATTERNS['iron-sentinel'].damagePerTurn;
    const regionBase = BOSS_ATTACK_PATTERNS['hextwins'].damagePerTurn;
    const wildAction = enterCombatAction(s, { kind: 'card', card: wild }, 'fightMonster');
    const regionAction = enterCombatAction(s, { kind: 'card', card: region }, 'fightMonster');
    expect(wildAction.boss.attackPattern.damagePerTurn).toBe(wildBase + SANDSTORM_COUNTER_MAX);
    expect(regionAction.boss.attackPattern.damagePerTurn).toBe(regionBase + SANDSTORM_COUNTER_MAX);
  });

  it('sandstorm-counter adder does NOT apply when entering combat in a different zone (cross-zone safety)', () => {
    // Defensive: if sandstormCounter is somehow non-zero outside
    // dune-sanctum (which should be impossible — advanceZone resets it
    // on every boundary crossing), the consumer's currentZone guard
    // still prevents the bump from leaking into other zones.
    const s = makeState({ currentZone: 'maren', sandstormCounter: 3 });
    const boss = findBossCard('maelstrom');
    const action = enterCombatAction(s, { kind: 'card', card: boss }, 'fightMonster');
    expect(action.boss.attackPattern.damagePerTurn).toBe(
      BOSS_ATTACK_PATTERNS['maelstrom'].damagePerTurn,
    );
  });
});
