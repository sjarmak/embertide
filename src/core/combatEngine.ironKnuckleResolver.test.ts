/**
 * Iron-sentinel stagger resolver coverage (embertide-2iyv).
 *
 * Asserts the 3-turn wind-up / heavy-swing / stagger cycle keyed off
 * `combat.turnIndex % 3`:
 *
 *   (a) Wind-up turn (phase 0): pattern.damagePerTurn + forecast log
 *       naming the upcoming burst value
 *   (b) Heavy-swing turn (phase 1): pattern.damagePerTurn +
 *       IRON_SENTINEL_BURST_BONUS — the telegraphed big-hit
 *   (c) Stagger turn (phase 2): 0 damage with armor-cracks log
 *   (d) Cycle wrap across turnIndex 3+
 *   (e) Sandstorm-counter adder propagation — both wind-up and burst
 *       scale with the bumped pattern.damagePerTurn
 */

import { describe, it, expect } from 'vitest';
import type {
  BossAttackPattern,
  CombatBoss,
  CombatEntryContext,
  CombatState,
} from '../types/combat';
import type { KidPlayer } from '../store/types';
import {
  combatTurnReducer,
  IRON_SENTINEL_BURST_BONUS,
  IRON_SENTINEL_LOG_WINDUP,
  IRON_SENTINEL_LOG_HEAVY_SWING,
  IRON_SENTINEL_LOG_STAGGERED,
  IRON_SENTINEL_LOG_ARMOR_CRACKS,
  type CombatTurnState,
} from './combatEngine';
import { makeKidPlayer } from '../testing/stateFixtures';

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer => makeKidPlayer(overrides);

const ENTRY_CTX: CombatEntryContext = {
  bossCardId: 'iron-sentinel',
  combatEntryTurn: 11,
  attackerPlayerIds: ['p0', 'p1'],
  engagementSource: 'fightMonster',
  entrySource: 'wild-boss-slot',
};

const IRON_SENTINEL_PATTERN: BossAttackPattern = {
  damagePerTurn: 2,
  targeting: 'player-hp',
  onDefeatEffect: { kind: 'wisp-drop' },
  bossAttackResolver: 'iron-sentinel-stagger',
};

function makeBoss(overrides: Partial<CombatBoss> = {}): CombatBoss {
  return {
    hp: 6,
    hpMax: 6,
    attackPattern: IRON_SENTINEL_PATTERN,
    sourceCardId: 'iron-sentinel',
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
// (a) Wind-up turn — base dpt + forecast log.
// ---------------------------------------------------------------------------

describe('iron-sentinel-stagger wind-up (a)', () => {
  it('turnIndex=0 deals pattern.damagePerTurn split across attackers', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 0 }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // 2 dmg / 2 live = 1 each.
    expect(next.players[0].hp).toBe(4);
    expect(next.players[1].hp).toBe(4);
  });

  it('forecast log names the upcoming burst value (dpt + bonus)', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 0, combatLog: [] }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const log = next.combat.combatLog ?? [];
    const expected = 2 + IRON_SENTINEL_BURST_BONUS;
    expect(
      log.some((entry) => entry.includes(IRON_SENTINEL_LOG_WINDUP) && entry.includes(`${expected}`)),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (b) Heavy-swing turn — base dpt + bonus.
// ---------------------------------------------------------------------------

describe('iron-sentinel-stagger heavy-swing (b)', () => {
  it('turnIndex=1 deals pattern.damagePerTurn + IRON_SENTINEL_BURST_BONUS', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 1 }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // burst = 2 + 1 = 3 / 2 live = 1 each + remainder 1 to p0.
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(4);
  });

  it('logs a "heavy swing connects" entry naming the burst value', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 1, combatLog: [] }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const log = next.combat.combatLog ?? [];
    const burst = 2 + IRON_SENTINEL_BURST_BONUS;
    expect(
      log.some(
        (entry) => entry.includes(IRON_SENTINEL_LOG_HEAVY_SWING) && entry.includes(`${burst}`),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (c) Stagger turn — 0 damage + armor-cracks log.
// ---------------------------------------------------------------------------

describe('iron-sentinel-stagger stagger (c)', () => {
  it('turnIndex=2 deals 0 damage to all players', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 2 }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hp).toBe(5);
    expect(next.players[1].hp).toBe(5);
  });

  it('logs an "armor cracks" entry', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 2, combatLog: [] }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const log = next.combat.combatLog ?? [];
    expect(log.some((entry) => entry.includes(IRON_SENTINEL_LOG_STAGGERED))).toBe(true);
    expect(log.some((entry) => entry.includes(IRON_SENTINEL_LOG_ARMOR_CRACKS))).toBe(true);
  });

  it('advances turnIndex AND flips activeActor back to players', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 2 }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.combat.turnIndex).toBe(3);
    expect(next.combat.activeActor).toBe('players');
  });
});

// ---------------------------------------------------------------------------
// (d) Cycle wrap.
// ---------------------------------------------------------------------------

describe('iron-sentinel-stagger 3-turn cycle wrap (d)', () => {
  it('three consecutive boss-turns trace wind-up / burst / stagger', () => {
    let state = makeTurnState(makeCombat({ turnIndex: 0 }));
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(state.players[0].hp).toBe(4); // wind-up
    state = { ...state, combat: { ...state.combat, activeActor: 'boss' } };
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(state.players[0].hp).toBe(2); // burst (3 dmg, +1 remainder hits p0)
    state = { ...state, combat: { ...state.combat, activeActor: 'boss' } };
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(state.players[0].hp).toBe(2); // stagger (0 dmg)
    expect(state.combat.turnIndex).toBe(3);
  });

  it('turnIndex=3 wraps back to wind-up (cycle %3 === 0)', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 3 }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // Same as turnIndex=0 wind-up: 2 dmg / 2 = 1 each.
    expect(next.players[0].hp).toBe(4);
    expect(next.players[1].hp).toBe(4);
  });

  it('turnIndex=4 maps to heavy-swing (cycle %3 === 1)', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 4 }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(4);
  });

  it('turnIndex=5 maps to stagger (cycle %3 === 2)', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 5 }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hp).toBe(5);
    expect(next.players[1].hp).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// (e) Sandstorm adder propagation.
// ---------------------------------------------------------------------------

describe('iron-sentinel-stagger + sandstorm flat-adder (e)', () => {
  it('wind-up dpt scales with pattern.damagePerTurn (bumped value)', () => {
    const bumped: BossAttackPattern = {
      ...IRON_SENTINEL_PATTERN,
      damagePerTurn: 4, // base 2 + sandstorm 2
    };
    const boss = makeBoss({ attackPattern: bumped });
    const state = makeTurnState(makeCombat({ turnIndex: 0, boss }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // 4 dmg / 2 live = 2 each.
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(3);
  });

  it('burst dpt scales as (bumped dpt + IRON_SENTINEL_BURST_BONUS)', () => {
    const bumped: BossAttackPattern = {
      ...IRON_SENTINEL_PATTERN,
      damagePerTurn: 4,
    };
    const boss = makeBoss({ attackPattern: bumped });
    const state = makeTurnState(makeCombat({ turnIndex: 1, boss }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // burst = 4 + 1 = 5 / 2 live = 2 each + 1 remainder to p0.
    expect(next.players[0].hp).toBe(2);
    expect(next.players[1].hp).toBe(3);
  });

  it('stagger turn deals 0 damage even when sandstorm dpt would otherwise dominate', () => {
    const bumped: BossAttackPattern = {
      ...IRON_SENTINEL_PATTERN,
      damagePerTurn: 6,
    };
    const boss = makeBoss({ attackPattern: bumped });
    const state = makeTurnState(makeCombat({ turnIndex: 2, boss }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hp).toBe(5);
    expect(next.players[1].hp).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// (f) Log-fragment constant contract (embertide-x5vq).
// ---------------------------------------------------------------------------
// Pins the rendered resolver log to the exported IRON_SENTINEL_LOG_*
// constants. If a future flavor pass rephrases the source string and
// removes the fragment from the rendered output WITHOUT updating the
// constant, this test fails loudly.

describe('iron-sentinel-stagger log-fragment contract (f)', () => {
  it('windup log entry contains IRON_SENTINEL_LOG_WINDUP', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 0, combatLog: [] }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const entry = (next.combat.combatLog ?? []).find((e) => e.startsWith('Iron-sentinel'));
    expect(entry).toBeDefined();
    expect(entry).toContain(IRON_SENTINEL_LOG_WINDUP);
  });

  it('heavy-swing log entry contains IRON_SENTINEL_LOG_HEAVY_SWING', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 1, combatLog: [] }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const entry = (next.combat.combatLog ?? []).find((e) => e.startsWith('Iron-sentinel'));
    expect(entry).toBeDefined();
    expect(entry).toContain(IRON_SENTINEL_LOG_HEAVY_SWING);
  });

  it('stagger log entry contains both STAGGERED and ARMOR_CRACKS fragments', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 2, combatLog: [] }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const entry = (next.combat.combatLog ?? []).find((e) => e.startsWith('Iron-sentinel'));
    expect(entry).toBeDefined();
    expect(entry).toContain(IRON_SENTINEL_LOG_STAGGERED);
    expect(entry).toContain(IRON_SENTINEL_LOG_ARMOR_CRACKS);
  });
});
