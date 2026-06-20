/**
 * Hextwins fire/ice resolver coverage (embertide-jghb).
 *
 * Asserts the 3-turn fire/ice/fire cycle keyed off
 * `combat.turnIndex % 3`:
 *
 *   (a) Fire turns (phases 0 and 2) deal pattern.damagePerTurn through
 *       'battlefield-then-player' targeting
 *   (b) Ice turn (phase 1) deals 0 damage and discards 1 hand-card
 *       from each non-downed attacker's main-board hand
 *   (c) 3-turn cycle wrap: turnIndex 0/1/2 ↔ fire/ice/fire; turnIndex
 *       3 wraps back to fire
 *   (d) Sandstorm-counter adder propagation — fire damage scales with
 *       the bumped pattern.damagePerTurn (set at combat-entry by
 *       `enterCombatAction`)
 *   (e) Ice freeze edge cases: empty hand → no-op; downed player
 *       skipped; oldest-in-hand stays put (drop is end-of-hand)
 */

import { describe, it, expect } from 'vitest';
import type { Card } from '../types/card';
import type {
  BossAttackPattern,
  CombatBoss,
  CombatEntryContext,
  CombatState,
} from '../types/combat';
import type { KidPlayer } from '../store/types';
import {
  combatTurnReducer,
  HEXTWINS_LOG_FIRE_HITS,
  HEXTWINS_LOG_ICE_FREEZES,
  type CombatTurnState,
} from './combatEngine';
import { makeKidPlayer } from '../testing/stateFixtures';

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer => makeKidPlayer(overrides);

const ENTRY_CTX: CombatEntryContext = {
  bossCardId: 'hextwins',
  combatEntryTurn: 12,
  attackerPlayerIds: ['p0', 'p1'],
  engagementSource: 'fightMonster',
  entrySource: 'region-boss-slot',
};

const HEXTWINS_PATTERN: BossAttackPattern = {
  damagePerTurn: 2,
  targeting: 'battlefield-then-player',
  onDefeatEffect: { kind: 'none' },
  bossAttackResolver: 'hextwins-fire-ice',
};

function makeBoss(overrides: Partial<CombatBoss> = {}): CombatBoss {
  return {
    hp: 10,
    hpMax: 10,
    attackPattern: HEXTWINS_PATTERN,
    sourceCardId: 'hextwins',
    ...overrides,
  };
}

function makeCombat(overrides: Partial<CombatState> = {}): CombatState {
  return {
    boss: makeBoss(),
    combatDeck: [],
    combatHand: [],
    combatDiscard: [],
    battlefield: [],
    turnIndex: 0,
    activeActor: 'boss',
    entryContext: ENTRY_CTX,
    combatLog: [],
    playsThisTurn: 0,
    bossStunTurns: 0,
    tideGaugeSnapshot: 0,
    echoQueue: null,
    ...overrides,
  };
}

function makeFiller(id: string): Card {
  return {
    id,
    role: 'starter-red',
    cost: { red: 1 },
    effects: { kind: 'gain', red: 1 },
  };
}

function makeTurnState(
  combat: CombatState,
  players: readonly KidPlayer[] = [makePlayer({ id: 'p0' }), makePlayer({ id: 'p1' })],
): CombatTurnState {
  return {
    combat,
    players,
    terminal: null,
    playsThisTurn: 0,
  };
}

// ---------------------------------------------------------------------------
// (a) Fire turns deal pattern dpt.
// ---------------------------------------------------------------------------

describe('hextwins-fire-ice fire turns (a)', () => {
  it('turnIndex=0 (first fire) deals pattern.damagePerTurn split across attackers', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 0 }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // 2 dmg / 2 live = 1 each, no remainder.
    expect(next.players[0].hp).toBe(4);
    expect(next.players[1].hp).toBe(4);
  });

  it('turnIndex=2 (second fire) also deals pattern.damagePerTurn', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 2 }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hp).toBe(4);
    expect(next.players[1].hp).toBe(4);
  });

  it('logs a "fire blast" entry naming the dpt on every fire turn', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 0, combatLog: [] }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const log = next.combat.combatLog ?? [];
    expect(log.some((entry) => entry.includes(HEXTWINS_LOG_FIRE_HITS) && entry.includes('2'))).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// (b) Ice turn — 0 damage + freeze.
// ---------------------------------------------------------------------------

describe('hextwins-fire-ice ice turn (b)', () => {
  it('turnIndex=1 deals 0 damage to all players', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 1 }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hp).toBe(5);
    expect(next.players[1].hp).toBe(5);
  });

  it('discards 1 hand-card from each non-downed attacker', () => {
    const players: readonly KidPlayer[] = [
      makePlayer({ id: 'p0', hand: [makeFiller('a'), makeFiller('b')] }),
      makePlayer({ id: 'p1', hand: [makeFiller('c'), makeFiller('d')] }),
    ];
    const state = makeTurnState(makeCombat({ turnIndex: 1 }), players);
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hand).toHaveLength(1);
    expect(next.players[1].hand).toHaveLength(1);
    // Drop is end-of-hand: oldest stays.
    expect(next.players[0].hand[0].id).toBe('a');
    expect(next.players[1].hand[0].id).toBe('c');
    // Dropped card lands in discard.
    expect(next.players[0].discard).toHaveLength(1);
    expect(next.players[0].discard[0].id).toBe('b');
    expect(next.players[1].discard[0].id).toBe('d');
  });

  it('logs an "ice freezes a card" entry', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 1, combatLog: [] }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const log = next.combat.combatLog ?? [];
    expect(log.some((entry) => entry.includes(HEXTWINS_LOG_ICE_FREEZES))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (c) 3-turn cycle wrap.
// ---------------------------------------------------------------------------

describe('hextwins-fire-ice 3-turn cycle (c)', () => {
  it('three consecutive boss-turns trace fire / ice / fire', () => {
    const players: readonly KidPlayer[] = [
      makePlayer({ id: 'p0', hand: [makeFiller('a')] }),
      makePlayer({ id: 'p1', hand: [makeFiller('b')] }),
    ];
    let state = makeTurnState(makeCombat({ turnIndex: 0 }), players);
    // Fire 1: 2 dmg / 2 live = 1 each.
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(state.players[0].hp).toBe(4);
    expect(state.players[1].hp).toBe(4);
    // Ice: 0 dmg, hand-discard.
    state = { ...state, combat: { ...state.combat, activeActor: 'boss' } };
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(state.players[0].hp).toBe(4);
    expect(state.players[0].hand).toHaveLength(0);
    expect(state.players[1].hand).toHaveLength(0);
    // Fire 2: another 2 dmg / 2 = 1 each.
    state = { ...state, combat: { ...state.combat, activeActor: 'boss' } };
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(state.players[0].hp).toBe(3);
    expect(state.players[1].hp).toBe(3);
    expect(state.combat.turnIndex).toBe(3);
  });

  it('turnIndex=3 wraps back to fire (cycle %3 === 0)', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 3 }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hp).toBe(4);
    const log = next.combat.combatLog ?? [];
    expect(log.some((entry) => entry.includes(HEXTWINS_LOG_FIRE_HITS))).toBe(true);
  });

  it('turnIndex=4 maps to ice (cycle %3 === 1)', () => {
    const players: readonly KidPlayer[] = [
      makePlayer({ id: 'p0', hand: [makeFiller('z')] }),
      makePlayer({ id: 'p1', hand: [makeFiller('y')] }),
    ];
    const state = makeTurnState(makeCombat({ turnIndex: 4 }), players);
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hp).toBe(5);
    expect(next.players[0].hand).toHaveLength(0);
    expect(next.players[0].discard[0].id).toBe('z');
  });
});

// ---------------------------------------------------------------------------
// (d) Sandstorm-counter adder propagation.
// ---------------------------------------------------------------------------

describe('hextwins-fire-ice + sandstorm flat-adder (d)', () => {
  it('fire damage scales with pattern.damagePerTurn (the bumped value)', () => {
    const bumped: BossAttackPattern = {
      ...HEXTWINS_PATTERN,
      damagePerTurn: 4, // base 2 + sandstorm 2
    };
    const boss = makeBoss({ attackPattern: bumped });
    const state = makeTurnState(makeCombat({ turnIndex: 0, boss }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // 4 dmg / 2 live = 2 each.
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(3);
  });

  it('ice freeze fires regardless of sandstorm adder', () => {
    const bumped: BossAttackPattern = {
      ...HEXTWINS_PATTERN,
      damagePerTurn: 5, // sandstorm-pumped value
    };
    const boss = makeBoss({ attackPattern: bumped });
    const players: readonly KidPlayer[] = [
      makePlayer({ id: 'p0', hand: [makeFiller('a')] }),
      makePlayer({ id: 'p1', hand: [makeFiller('b')] }),
    ];
    const state = makeTurnState(makeCombat({ turnIndex: 1, boss }), players);
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // 0 damage on ice turn even with bumped dpt.
    expect(next.players[0].hp).toBe(5);
    expect(next.players[1].hp).toBe(5);
    // Hand still discards 1 each.
    expect(next.players[0].hand).toHaveLength(0);
    expect(next.players[1].hand).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// (e) Ice freeze edge cases.
// ---------------------------------------------------------------------------

describe('hextwins-fire-ice freeze edge cases (e)', () => {
  it('empty hand: no-op (no NaN / no crash)', () => {
    const players: readonly KidPlayer[] = [
      makePlayer({ id: 'p0', hand: [] }),
      makePlayer({ id: 'p1', hand: [] }),
    ];
    const state = makeTurnState(makeCombat({ turnIndex: 1 }), players);
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hand).toHaveLength(0);
    expect(next.players[0].discard).toHaveLength(0);
  });

  it('downed player is skipped (hand untouched)', () => {
    const players: readonly KidPlayer[] = [
      makePlayer({ id: 'p0', downed: true, hand: [makeFiller('a')] }),
      makePlayer({ id: 'p1', hand: [makeFiller('b')] }),
    ];
    const state = makeTurnState(makeCombat({ turnIndex: 1 }), players);
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hand).toHaveLength(1);
    expect(next.players[0].discard).toHaveLength(0);
    // Standing player still loses 1 card.
    expect(next.players[1].hand).toHaveLength(0);
    expect(next.players[1].discard).toHaveLength(1);
  });

  it('drop is end-of-hand (most-recently-drawn card discards first)', () => {
    const players: readonly KidPlayer[] = [
      makePlayer({
        id: 'p0',
        hand: [makeFiller('oldest'), makeFiller('middle'), makeFiller('newest')],
      }),
      makePlayer({ id: 'p1', hand: [] }),
    ];
    const state = makeTurnState(makeCombat({ turnIndex: 1 }), players);
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hand.map((c) => c.id)).toEqual(['oldest', 'middle']);
    expect(next.players[0].discard[0].id).toBe('newest');
  });
});

// ---------------------------------------------------------------------------
// (f) Log-fragment constant contract (embertide-x5vq).
// ---------------------------------------------------------------------------
// Pins the rendered resolver log to the exported HEXTWINS_LOG_*
// constants. If a future flavor pass rephrases the source string and
// removes the fragment from the rendered output WITHOUT updating the
// constant, this test fails loudly.

describe('hextwins-fire-ice log-fragment contract (f)', () => {
  it('fire log entry contains HEXTWINS_LOG_FIRE_HITS', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 0, combatLog: [] }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const entry = (next.combat.combatLog ?? []).find((e) => e.startsWith('Hextwins'));
    expect(entry).toBeDefined();
    expect(entry).toContain(HEXTWINS_LOG_FIRE_HITS);
  });

  it('ice log entry contains HEXTWINS_LOG_ICE_FREEZES', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 1, combatLog: [] }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const entry = (next.combat.combatLog ?? []).find((e) => e.startsWith('Hextwins'));
    expect(entry).toBeDefined();
    expect(entry).toContain(HEXTWINS_LOG_ICE_FREEZES);
  });
});
