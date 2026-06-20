/**
 * Knell drum-telegraph resolver coverage (embertide-x1qg).
 *
 * Asserts the 2-turn telegraph/slam cycle keyed off
 * `combat.turnIndex % 2`:
 *
 *   (a) Telegraph turn (turnIndex even): 0 damage; combat-log
 *       forecasts the incoming slam value
 *   (b) Slam turn (turnIndex odd): full pattern.damagePerTurn lands
 *       to player-hp (battlefield is bypassed by the static targeting
 *       flip)
 *   (c) Cycle alternation across consecutive boss-turns
 *   (d) Shadow-creep adder propagation — when `enterCombatAction`
 *       bumps pattern.damagePerTurn by `state.shadowCreep`, the
 *       resolver consumes the bumped value verbatim on slam turns
 *       (and forecasts the bumped value on telegraph turns)
 *   (e) Targeting bypass — slam damage routes to player-hp regardless
 *       of any battlefield cards present
 */

import { describe, it, expect } from 'vitest';
import type { Card } from '../types/card';
import type {
  BattlefieldCard,
  BossAttackPattern,
  CombatBoss,
  CombatEntryContext,
  CombatState,
} from '../types/combat';
import type { KidPlayer } from '../store/types';
import {
  combatTurnReducer,
  KNELL_LOG_TELEGRAPH,
  KNELL_LOG_SLAM,
  type CombatTurnState,
} from './combatEngine';
import { makeKidPlayer } from '../testing/stateFixtures';

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer => makeKidPlayer(overrides);

const ENTRY_CTX: CombatEntryContext = {
  bossCardId: 'knell',
  combatEntryTurn: 8,
  attackerPlayerIds: ['p0', 'p1'],
  engagementSource: 'fightMonster',
  entrySource: 'region-boss-slot',
};

const KNELL_PATTERN: BossAttackPattern = {
  damagePerTurn: 3,
  targeting: 'player-hp',
  onDefeatEffect: { kind: 'none' },
  bossAttackResolver: 'knell-drum',
};

function makeBoss(overrides: Partial<CombatBoss> = {}): CombatBoss {
  return {
    hp: 17,
    hpMax: 17,
    attackPattern: KNELL_PATTERN,
    sourceCardId: 'knell',
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
// (a) Telegraph turn — 0 damage + forecast log.
// ---------------------------------------------------------------------------

describe('knell-drum telegraph turn (a)', () => {
  it('turnIndex=0 deals 0 damage to all players', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 0 }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hp).toBe(5);
    expect(next.players[1].hp).toBe(5);
  });

  it('logs a "drum-slam coming for N" forecast that names the slam dpt', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 0, combatLog: [] }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const log = next.combat.combatLog ?? [];
    expect(
      log.some((entry) => entry.includes(KNELL_LOG_TELEGRAPH) && entry.includes('3')),
    ).toBe(true);
  });

  it('advances turnIndex AND flips activeActor back to players', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 0 }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.combat.turnIndex).toBe(1);
    expect(next.combat.activeActor).toBe('players');
  });
});

// ---------------------------------------------------------------------------
// (b) Slam turn — full pattern dpt to player-hp.
// ---------------------------------------------------------------------------

describe('knell-drum slam turn (b)', () => {
  it('turnIndex=1 deals pattern.damagePerTurn split across non-downed players', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 1 }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // 3 damage / 2 live = 1 each + remainder 1 to active attacker (p0).
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(4);
  });

  it('logs a "Knell slams" entry naming the slam dpt', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 1, combatLog: [] }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const log = next.combat.combatLog ?? [];
    expect(log.some((entry) => entry.includes(KNELL_LOG_SLAM) && entry.includes('3'))).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// (c) Cycle alternation across consecutive boss-turns.
// ---------------------------------------------------------------------------

describe('knell-drum cycle alternation (c)', () => {
  it('two consecutive boss-turns deal 0 then full dpt (telegraph → slam)', () => {
    let state = makeTurnState(makeCombat({ turnIndex: 0 }));
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(state.players[0].hp).toBe(5); // telegraph
    state = { ...state, combat: { ...state.combat, activeActor: 'boss' } };
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // 3 damage / 2 live = 1 each + 1 remainder to p0.
    expect(state.players[0].hp).toBe(3);
    expect(state.players[1].hp).toBe(4);
  });

  it('three consecutive boss-turns trace 0 → full → 0 (cycle wraps)', () => {
    let state = makeTurnState(makeCombat({ turnIndex: 0 }));
    for (let i = 0; i < 3; i += 1) {
      state = { ...state, combat: { ...state.combat, activeActor: 'boss' } };
      state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    }
    // turn 0: telegraph 0 dmg, turn 1: slam 3 dmg, turn 2: telegraph 0 dmg.
    // Total: 1 dmg per non-attacker, 2 dmg per attacker.
    expect(state.players[0].hp).toBe(3);
    expect(state.players[1].hp).toBe(4);
    expect(state.combat.turnIndex).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// (d) Shadow-creep adder propagation.
// ---------------------------------------------------------------------------

describe('knell-drum + shadow-creep flat-adder (d)', () => {
  it('slam dpt scales with pattern.damagePerTurn (the bumped value from enterCombatAction)', () => {
    const bumpedPattern: BossAttackPattern = {
      ...KNELL_PATTERN,
      damagePerTurn: 5, // base 3 + shadowCreep 2
    };
    const boss = makeBoss({ attackPattern: bumpedPattern });
    const state = makeTurnState(makeCombat({ turnIndex: 1, boss }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // 5 dmg / 2 live = 2 each + 1 remainder → p0=2, p1=3.
    expect(next.players[0].hp).toBe(2);
    expect(next.players[1].hp).toBe(3);
  });

  it('telegraph forecasts the bumped slam dpt', () => {
    const bumpedPattern: BossAttackPattern = {
      ...KNELL_PATTERN,
      damagePerTurn: 6,
    };
    const boss = makeBoss({ attackPattern: bumpedPattern });
    const state = makeTurnState(makeCombat({ turnIndex: 0, boss, combatLog: [] }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const log = next.combat.combatLog ?? [];
    expect(
      log.some((entry) => entry.includes(KNELL_LOG_TELEGRAPH) && entry.includes('6')),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (e) Targeting bypass — slam reaches player-hp directly.
// ---------------------------------------------------------------------------

describe('knell-drum targeting bypass (e)', () => {
  it('slam damage skips battlefield front-line absorbs (player-hp targeting)', () => {
    const filler: Card = {
      id: 'absorb-filler',
      role: 'item',
      itemKind: 'item-active',
      cost: { red: 1 },
      effects: { kind: 'gain', red: 1 },
    };
    const battlefield: readonly BattlefieldCard[] = [
      { cardId: filler.id, hp: 99, hpMax: 99, combatEffectId: 'combat-absorb:99' },
    ];
    const state = makeTurnState(makeCombat({ turnIndex: 1, battlefield }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // Battlefield is untouched (player-hp targeting bypasses it).
    expect(next.combat.battlefield).toHaveLength(1);
    expect(next.combat.battlefield[0].hp).toBe(99);
    // Players still take damage.
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(4);
  });

  it('telegraph turn does not write any combatPatch overlay (idempotent state)', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 0 }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.combat.echoQueue ?? null).toBe(null);
    expect(next.combat.tideGaugeSnapshot ?? 0).toBe(0);
    expect(next.combat.bossStunTurns ?? 0).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// (f) Log-fragment constant contract (embertide-x5vq).
// ---------------------------------------------------------------------------
// Pins the rendered resolver log to the exported KNELL_LOG_*
// constants. If a future flavor pass rephrases the source string and
// removes the fragment from the rendered output WITHOUT updating the
// constant, this test fails loudly.

describe('knell-drum log-fragment contract (f)', () => {
  it('telegraph log entry contains KNELL_LOG_TELEGRAPH', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 0, combatLog: [] }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const log = next.combat.combatLog ?? [];
    const entry = log.find((e) => e.includes('Knell'));
    expect(entry).toBeDefined();
    expect(entry).toContain(KNELL_LOG_TELEGRAPH);
  });

  it('slam log entry contains KNELL_LOG_SLAM', () => {
    const state = makeTurnState(makeCombat({ turnIndex: 1, combatLog: [] }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const log = next.combat.combatLog ?? [];
    const entry = log.find((e) => e.includes('Knell'));
    expect(entry).toBeDefined();
    expect(entry).toContain(KNELL_LOG_SLAM);
  });
});
