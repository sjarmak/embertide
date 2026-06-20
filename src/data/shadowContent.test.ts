import { describe, it, expect } from 'vitest';
import { KID_CARDS, SHADOW_BOSSES, SHADOW_REGULARS } from './cards';
import type { Card } from '../types/card';
import type { KidGameState, KidPlayer } from '../store/types';
import { ZONE_METADATA, ZONE_ORDER, nextZone } from '../rules/zones';
import { advanceZone, incrementShadowCreep, SHADOW_CREEP_MAX } from '../store/slices/zones';
import { createSeededRng } from '../rules/chestPool';
import { BOSS_ATTACK_PATTERNS, BOSS_HP } from './bossAttackPatterns';
import { enterCombatAction } from '../store/gameStore';
import { makeKidPlayer, makeKidGameState } from '../testing/stateFixtures';

/**
 * gdd.2 Hollow Shrine content coverage (v2.1 zone 4 — substrate ship).
 *
 * Six new cards: 4 regulars (willowisp / graspling / bonelet / duskwing),
 * 1 wild boss (hollow-effigy), 1 region boss (knell). This suite
 * mirrors marenContent.test.ts one-for-one — same acceptance matrix
 * substituted for hollow-shrine content + the shadow-creep substrate
 * (state field + increment + reset on zone advance).
 *
 *  (a) all 4 regulars + 2 bosses exist with zone='hollow-shrine' + expected stats
 *  (b) ZONE_METADATA['hollow-shrine'] wires the roster + ZONE_ORDER
 *      splices hollow-shrine between maren and gilded-cage
 *  (c) BOSS_ATTACK_PATTERNS + BOSS_HP carry hollow-effigy + knell entries
 *  (d) knell defeat advances 'hollow-shrine' → 'gilded-cage'
 *      (and resets shadowCreep to 0 on the boundary crossing)
 *  (e) Courage-unlock gate now requires hollow-shrine in zoneHistory
 *      alongside sylvani / emberpeak / maren / gilded-cage
 *  (f) shadow-creep: increments only in hollow-shrine, clamps at
 *      SHADOW_CREEP_MAX, resets to 0 on advanceZone-driven zone change
 */

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer => makeKidPlayer(overrides);

function makeState(overrides: Partial<KidGameState> = {}): KidGameState {
  return makeKidGameState({
    players: [makePlayer({ id: 'p0' }), makePlayer({ id: 'p1' })],
    seed: 1,
    rng: createSeededRng(1),
    currentZone: 'hollow-shrine',
    zoneHistory: ['sylvani', 'emberpeak', 'maren'],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// (a) Card existence + zone affinity + bossTier shape.
// ---------------------------------------------------------------------------

describe('gdd.2 Shadow content — card existence + zone affinity (a)', () => {
  it('exports 4 regulars in SHADOW_REGULARS with zone="hollow-shrine" and role="monster"', () => {
    const ids = SHADOW_REGULARS.map((c) => c.id);
    expect(ids).toEqual(['willowisp', 'graspling', 'bonelet', 'duskwing']);
    for (const card of SHADOW_REGULARS) {
      expect(card.zone, `${card.id}: zone must be 'hollow-shrine'`).toBe('hollow-shrine');
      expect(card.role, `${card.id}: role must be 'monster'`).toBe('monster');
      expect(card.bossTier).toBeUndefined();
    }
  });

  it('exports 2 bosses in SHADOW_BOSSES with zone="hollow-shrine" and bossTier set', () => {
    const ids = SHADOW_BOSSES.map((c) => c.id);
    expect(ids).toEqual(['hollow-effigy', 'knell']);
    const hollowEffigy = SHADOW_BOSSES.find((c) => c.id === 'hollow-effigy')!;
    expect(hollowEffigy.zone).toBe('hollow-shrine');
    expect(hollowEffigy.bossTier).toBe('wild-boss');
    const knell = SHADOW_BOSSES.find((c) => c.id === 'knell')!;
    expect(knell.zone).toBe('hollow-shrine');
    expect(knell.bossTier).toBe('region-boss');
  });

  it('all 6 cards are present in KID_CARDS (by-id lookup resolves)', () => {
    const ids = ['willowisp', 'graspling', 'bonelet', 'duskwing', 'hollow-effigy', 'knell'];
    for (const id of ids) {
      const card = KID_CARDS.find((c) => c.id === id);
      expect(card, `${id} missing from KID_CARDS`).toBeDefined();
    }
  });

  it('regulars carry monster-drop effect with at least +1 hp baseline', () => {
    for (const card of SHADOW_REGULARS) {
      expect(card.effects.kind).toBe('monster-drop');
      if (card.effects.kind === 'monster-drop') {
        expect(card.effects.hearts ?? 0).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('hollow-effigy cost.red ≥ 2× the highest regular cost.red (wild-tier scale)', () => {
    const highestRegularRed = Math.max(...SHADOW_REGULARS.map((c) => c.cost.red ?? 0));
    const hollowEffigy = SHADOW_BOSSES.find((c) => c.id === 'hollow-effigy')!;
    expect(hollowEffigy.cost.red ?? 0).toBeGreaterThanOrEqual(2 * highestRegularRed);
  });
});

// ---------------------------------------------------------------------------
// (b) ZONE_METADATA + ZONE_ORDER consistency.
// ---------------------------------------------------------------------------

describe('gdd.2 Shadow — ZONE_METADATA + ZONE_ORDER consistency (b)', () => {
  it('ZONE_ORDER splices hollow-shrine between maren and gilded-cage', () => {
    expect(ZONE_ORDER).toEqual([
      'sylvani',
      'emberpeak',
      'maren',
      'hollow-shrine',
      'dune-sanctum',
      'gilded-cage',
    ]);
  });

  it('ZONE_METADATA["hollow-shrine"] wires the roster matching the card definitions', () => {
    const meta = ZONE_METADATA['hollow-shrine'];
    expect(meta.id).toBe('hollow-shrine');
    expect(meta.displayName).toBe('Hollow Shrine');
    expect(meta.themeHint.length).toBeGreaterThan(0);
    expect(meta.regularEnemyIds).toEqual(['willowisp', 'graspling', 'bonelet', 'duskwing']);
    expect(meta.wildBossIds).toEqual(['hollow-effigy']);
    expect(meta.regionBossId).toBe('knell');
  });

  it('nextZone walks hollow-shrine → dune-sanctum', () => {
    expect(nextZone('maren')).toBe('hollow-shrine');
    // gdd.3: dune-sanctum spliced between hollow-shrine and gilded-cage.
    // Shadow's nextZone now points at dune-sanctum, not directly at
    // the terminal Gilded Cage.
    expect(nextZone('hollow-shrine')).toBe('dune-sanctum');
  });
});

// ---------------------------------------------------------------------------
// (c) bossAttackPatterns + BOSS_HP entries.
// ---------------------------------------------------------------------------

describe('gdd.2 Shadow — boss attack patterns + HP (c)', () => {
  it('hollow-effigy and knell each have a BossAttackPattern entry', () => {
    expect(BOSS_ATTACK_PATTERNS['hollow-effigy']).toBeDefined();
    expect(BOSS_ATTACK_PATTERNS['knell']).toBeDefined();
    expect(BOSS_ATTACK_PATTERNS['hollow-effigy'].damagePerTurn).toBeGreaterThan(0);
    expect(BOSS_ATTACK_PATTERNS['knell'].damagePerTurn).toBeGreaterThan(0);
  });

  it('hollow-effigy uses player-hp targeting (mirror skips defenses, gdd.2.4 spec)', () => {
    expect(BOSS_ATTACK_PATTERNS['hollow-effigy'].targeting).toBe('player-hp');
  });

  it('hollow-effigy drops a wisp on defeat (wild-boss taxonomy)', () => {
    const onDefeat = BOSS_ATTACK_PATTERNS['hollow-effigy'].onDefeatEffect;
    expect(onDefeat?.kind).toBe('wisp-drop');
  });

  it('hollow-effigy and knell each have a BOSS_HP entry', () => {
    expect(BOSS_HP['hollow-effigy']).toBeGreaterThan(0);
    expect(BOSS_HP['knell']).toBeGreaterThan(0);
  });

  it('knell HP sits in the region-boss band (no higher than vurmox=20)', () => {
    expect(BOSS_HP['knell']).toBeGreaterThanOrEqual(BOSS_HP['hollow-effigy']);
    expect(BOSS_HP['knell']).toBeLessThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// (d) knell defeat advances hollow-shrine → gilded-cage.
// ---------------------------------------------------------------------------

describe('gdd.2 Shadow — knell defeat advances zone (d)', () => {
  it('advanceZone from currentZone="hollow-shrine" lands at "dune-sanctum" (gdd.3 splice)', () => {
    const s = makeState({
      currentZone: 'hollow-shrine',
      zoneHistory: ['sylvani', 'emberpeak', 'maren'],
    });
    const next = advanceZone(s);
    // gdd.3: Dune Sanctum spliced between hollow-shrine and
    // gilded-cage. knell's defeat now hands off into
    // dune-sanctum rather than jumping directly to the terminal zone.
    expect(next.currentZone).toBe('dune-sanctum');
    expect(next.zoneHistory).toEqual(['sylvani', 'emberpeak', 'maren', 'hollow-shrine']);
  });
});

// ---------------------------------------------------------------------------
// (e) Courage gate: hollow-shrine is REQUIRED in history before terminal
// advance flips Courage. Single-step advance from hollow-shrine does NOT
// flip Courage — the player still needs the gilded-cage terminal advance.
// ---------------------------------------------------------------------------

describe('gdd.2 Shadow — Courage gate extension (e)', () => {
  it('advance into hollow-shrine without gilded-cage in history leaves Courage false', () => {
    let s = makeState({ currentZone: 'maren', zoneHistory: ['sylvani', 'emberpeak'] });
    s = advanceZone(s); // → hollow-shrine
    expect(s.currentZone).toBe('hollow-shrine');
    expect(s.sharedEmbertide.courage).toBe(false);
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
    expect(s.sharedEmbertide.courage).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (f) shadow-creep slice substrate. Mirrors tide-gauge (gdd.1) one-for-one.
// ---------------------------------------------------------------------------

describe('gdd.2 Shadow — shadow-creep slice substrate (f)', () => {
  it('initial shadowCreep is 0 (per EMPTY_STATE seed)', () => {
    const s = makeState();
    expect(s.shadowCreep).toBe(0);
  });

  it('incrementShadowCreep is a no-op outside hollow-shrine (returns input reference unchanged)', () => {
    const sK = makeState({ currentZone: 'sylvani', shadowCreep: 0 });
    expect(incrementShadowCreep(sK)).toBe(sK);
    const sDM = makeState({ currentZone: 'emberpeak', shadowCreep: 0 });
    expect(incrementShadowCreep(sDM)).toBe(sDM);
    const sZ = makeState({ currentZone: 'maren', shadowCreep: 0 });
    expect(incrementShadowCreep(sZ)).toBe(sZ);
    const sToT = makeState({ currentZone: 'gilded-cage', shadowCreep: 0 });
    expect(incrementShadowCreep(sToT)).toBe(sToT);
  });

  it('incrementShadowCreep bumps by 1 while currentZone === "hollow-shrine"', () => {
    let s = makeState({ currentZone: 'hollow-shrine', shadowCreep: 0 });
    s = incrementShadowCreep(s);
    expect(s.shadowCreep).toBe(1);
    s = incrementShadowCreep(s);
    expect(s.shadowCreep).toBe(2);
    s = incrementShadowCreep(s);
    expect(s.shadowCreep).toBe(3);
  });

  it(`clamps at SHADOW_CREEP_MAX (${SHADOW_CREEP_MAX})`, () => {
    let s = makeState({ currentZone: 'hollow-shrine', shadowCreep: 0 });
    for (let i = 0; i < 10; i += 1) {
      s = incrementShadowCreep(s);
    }
    expect(s.shadowCreep).toBe(SHADOW_CREEP_MAX);
  });

  it('incrementShadowCreep is identity at the cap (no new state allocation)', () => {
    const s = makeState({ currentZone: 'hollow-shrine', shadowCreep: SHADOW_CREEP_MAX });
    expect(incrementShadowCreep(s)).toBe(s);
  });

  it('advanceZone resets shadowCreep to 0 when currentZone changes', () => {
    const s = makeState({
      currentZone: 'hollow-shrine',
      zoneHistory: ['sylvani', 'emberpeak', 'maren'],
      shadowCreep: 2,
    });
    const next = advanceZone(s);
    // gdd.3: hollow-shrine's nextZone is now dune-sanctum (was
    // gilded-cage pre-splice). Reset semantics fire on every
    // boundary crossing.
    expect(next.currentZone).toBe('dune-sanctum');
    expect(next.shadowCreep).toBe(0);
  });

  it('advanceZone preserves shadowCreep on the terminal idempotent re-call', () => {
    // Already at terminal + already in history → identity return; the
    // gauge stays at whatever it was. (In practice always 0 outside
    // hollow-shrine, but the idempotent contract must not mutate.)
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
      shadowCreep: 0,
      sandstormCounter: 0,
      fangfishFieldWatchlist: [],
    });
    const next = advanceZone(s);
    expect(next).toBe(s);
    expect(next.shadowCreep).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// (g) shadow-creep CONSUMER: enterCombatAction snapshots state.shadowCreep
// onto the boss attack pattern's damagePerTurn at combat-entry time. Mirrors
// the gdd.2.3 designer-ruling memo's flat-adder semantics.
// ---------------------------------------------------------------------------

describe('gdd.2 Shadow — shadow-creep adder at combat-entry (g)', () => {
  function findBossCard(id: string): Card {
    const card = KID_CARDS.find((c) => c.id === id);
    expect(card, `${id} missing from KID_CARDS`).toBeDefined();
    return card!;
  }

  it('outside hollow-shrine, enterCombatAction leaves boss damagePerTurn untouched (uses canonical pattern)', () => {
    const s = makeState({ currentZone: 'sylvani', shadowCreep: 0 });
    const boss = findBossCard('hollow-effigy');
    const action = enterCombatAction(s, { kind: 'card', card: boss }, 'fightMonster');
    expect(action.boss.attackPattern.damagePerTurn).toBe(
      BOSS_ATTACK_PATTERNS['hollow-effigy'].damagePerTurn,
    );
  });

  it('inside hollow-shrine with shadowCreep=0, enterCombatAction leaves damagePerTurn untouched', () => {
    const s = makeState({ currentZone: 'hollow-shrine', shadowCreep: 0 });
    const boss = findBossCard('knell');
    const action = enterCombatAction(s, { kind: 'card', card: boss }, 'fightMonster');
    expect(action.boss.attackPattern.damagePerTurn).toBe(
      BOSS_ATTACK_PATTERNS['knell'].damagePerTurn,
    );
  });

  it('inside hollow-shrine with shadowCreep>0, enterCombatAction bumps damagePerTurn by shadowCreep (clone, not mutate)', () => {
    const s = makeState({ currentZone: 'hollow-shrine', shadowCreep: 2 });
    const boss = findBossCard('hollow-effigy');
    const baseDpt = BOSS_ATTACK_PATTERNS['hollow-effigy'].damagePerTurn;
    const action = enterCombatAction(s, { kind: 'card', card: boss }, 'fightMonster');
    expect(action.boss.attackPattern.damagePerTurn).toBe(baseDpt + 2);
    // Canonical pattern in BOSS_ATTACK_PATTERNS is unchanged (clone, not mutate).
    expect(BOSS_ATTACK_PATTERNS['hollow-effigy'].damagePerTurn).toBe(baseDpt);
  });

  it('shadow-creep adder applies uniformly to wild AND region bosses inside hollow-shrine', () => {
    const s = makeState({ currentZone: 'hollow-shrine', shadowCreep: SHADOW_CREEP_MAX });
    const wild = findBossCard('hollow-effigy');
    const region = findBossCard('knell');
    const wildBase = BOSS_ATTACK_PATTERNS['hollow-effigy'].damagePerTurn;
    const regionBase = BOSS_ATTACK_PATTERNS['knell'].damagePerTurn;
    const wildAction = enterCombatAction(s, { kind: 'card', card: wild }, 'fightMonster');
    const regionAction = enterCombatAction(s, { kind: 'card', card: region }, 'fightMonster');
    expect(wildAction.boss.attackPattern.damagePerTurn).toBe(wildBase + SHADOW_CREEP_MAX);
    expect(regionAction.boss.attackPattern.damagePerTurn).toBe(regionBase + SHADOW_CREEP_MAX);
  });

  it('shadow-creep adder does NOT apply when entering combat in a different zone (cross-zone safety)', () => {
    // Defensive: if shadowCreep is somehow non-zero outside hollow-shrine
    // (which should be impossible — advanceZone resets it on every
    // boundary crossing), the consumer's currentZone guard still
    // prevents the bump from leaking into other zones.
    const s = makeState({ currentZone: 'maren', shadowCreep: 3 });
    const boss = findBossCard('maelstrom');
    const action = enterCombatAction(s, { kind: 'card', card: boss }, 'fightMonster');
    expect(action.boss.attackPattern.damagePerTurn).toBe(
      BOSS_ATTACK_PATTERNS['maelstrom'].damagePerTurn,
    );
  });
});
