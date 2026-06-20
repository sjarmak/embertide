/**
 * Phantom Vurmox volley resolver coverage (embertide-nlr8, sub of
 * lhlo + 4hr1). Asserts the 2-step ball-volley dispatch keyed off
 * `boss.stateTags`'s sequence tag `currentIndex`:
 *
 *   (a) 'ball-volley-charge' (currentIndex=0): telegraph turn, 0
 *       damage + forecast log naming the upcoming fire value.
 *   (b) 'ball-volley-fire' (currentIndex=1): payoff turn, base dpt + 1
 *       routed via the spec's 'battlefield-then-player' targeting +
 *       cackling-volley flavor log.
 *   (c) Wrap-around: from currentIndex=1, after the resolver fires the
 *       j0ik archetype-tick advances back to 0; next BOSS_RESOLVE
 *       fires charge again.
 *   (d) Defensive defaults: no sequence stateTag / unknown step name
 *       falls back to pattern.damagePerTurn (legacy parity).
 */

import { describe, it, expect } from 'vitest';
import type {
  BossAttackPattern,
  BossStateSequence,
  CombatBoss,
  CombatEntryContext,
  CombatState,
} from '../types/combat';
import type { KidPlayer } from '../store/types';
import {
  combatTurnReducer,
  PHANTOM_VURMOX_VOLLEY_FIRE_BONUS,
  PHANTOM_VURMOX_LOG_CHARGE,
  PHANTOM_VURMOX_LOG_VOLLEY,
  type CombatTurnState,
} from './combatEngine';
import { makeKidPlayer } from '../testing/stateFixtures';

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer => makeKidPlayer(overrides);

const ENTRY_CTX: CombatEntryContext = {
  bossCardId: 'phantom-vurmox',
  combatEntryTurn: 7,
  attackerPlayerIds: ['p0', 'p1'],
  engagementSource: 'fightMonster',
  entrySource: 'wild-boss-slot',
};

const PG_PATTERN: BossAttackPattern = {
  damagePerTurn: 3,
  targeting: 'battlefield-then-player',
  onDefeatEffect: { kind: 'wisp-drop' },
  bossAttackResolver: 'phantom-vurmox-volley',
};

function makeSeqTag(currentIndex: number): BossStateSequence {
  return {
    kind: 'sequence',
    steps: ['ball-volley-charge', 'ball-volley-fire'],
    currentIndex,
  };
}

function makeBoss(overrides: Partial<CombatBoss> = {}): CombatBoss {
  return {
    hp: 22,
    hpMax: 22,
    attackPattern: PG_PATTERN,
    sourceCardId: 'phantom-vurmox',
    archetype: 'sequence',
    stateTags: [makeSeqTag(0)],
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
// (a) Charge step — telegraph turn.
// ---------------------------------------------------------------------------

describe('phantom-vurmox-volley charge step (a)', () => {
  it('currentIndex=0 deals 0 damage', () => {
    const state = makeTurnState(makeCombat());
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hp).toBe(5);
    expect(next.players[1].hp).toBe(5);
  });

  it('forecast log names the upcoming fire damage value', () => {
    const state = makeTurnState(makeCombat());
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const log = next.combat.combatLog ?? [];
    const expected = PG_PATTERN.damagePerTurn + PHANTOM_VURMOX_VOLLEY_FIRE_BONUS;
    expect(
      log.some(
        (entry) => entry.includes(PHANTOM_VURMOX_LOG_CHARGE) && entry.includes(`${expected}`),
      ),
    ).toBe(true);
  });

  it('archetype tick advances pointer to 1 after charge fires', () => {
    const state = makeTurnState(makeCombat());
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const tag = next.combat.boss.stateTags?.[0];
    if (tag?.kind !== 'sequence') throw new Error('expected sequence tag');
    expect(tag.currentIndex).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// (b) Fire step — payoff turn.
// ---------------------------------------------------------------------------

describe('phantom-vurmox-volley fire step (b)', () => {
  it('currentIndex=1 deals base dpt + bonus via battlefield-then-player', () => {
    const boss = makeBoss({ stateTags: [makeSeqTag(1)] });
    const state = makeTurnState(makeCombat({ boss }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // damage = 3 + 1 = 4, no battlefield, split 4/2 = 2 each
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(3);
  });

  it('logs a fire-volley entry naming the damage value', () => {
    const boss = makeBoss({ stateTags: [makeSeqTag(1)] });
    const state = makeTurnState(makeCombat({ boss }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const log = next.combat.combatLog ?? [];
    const dmg = PG_PATTERN.damagePerTurn + PHANTOM_VURMOX_VOLLEY_FIRE_BONUS;
    expect(
      log.some((entry) => entry.includes(PHANTOM_VURMOX_LOG_VOLLEY) && entry.includes(`${dmg}`)),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (c) Wrap-around at currentIndex=last.
// ---------------------------------------------------------------------------

describe('phantom-vurmox-volley wrap-around (c)', () => {
  it('after fire (last step), archetype tick wraps pointer to 0', () => {
    const boss = makeBoss({ stateTags: [makeSeqTag(1)] });
    const state = makeTurnState(makeCombat({ boss }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const tag = next.combat.boss.stateTags?.[0];
    if (tag?.kind !== 'sequence') throw new Error('expected sequence tag');
    expect(tag.currentIndex).toBe(0);
  });

  it('two consecutive boss-turns trace charge then fire', () => {
    let state = makeTurnState(makeCombat());
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(state.players[0].hp).toBe(5); // charge: 0 dmg
    state = { ...state, combat: { ...state.combat, activeActor: 'boss' } };
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(state.players[0].hp).toBe(3); // fire: 4/2 = 2 each
    expect(state.players[1].hp).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// (d) Defensive defaults — missing tag / unknown step.
// ---------------------------------------------------------------------------

describe('phantom-vurmox-volley defensive defaults (d)', () => {
  it('boss with no stateTags falls back to pattern.damagePerTurn', () => {
    const boss = makeBoss({ stateTags: undefined });
    const state = makeTurnState(makeCombat({ boss }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // 3 dmg / 2 = 1 each + remainder 1 to p0
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(4);
  });

  it('unknown step name falls back to pattern.damagePerTurn', () => {
    const boss = makeBoss({
      stateTags: [{ kind: 'sequence', steps: ['unknown-step'], currentIndex: 0 }],
    });
    const state = makeTurnState(makeCombat({ boss }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// (e) Log-fragment constant contract (embertide-x5vq).
// ---------------------------------------------------------------------------
// Pins the rendered resolver log to the exported PHANTOM_VURMOX_LOG_*
// constants. If a future flavor pass rephrases the source string and
// removes the fragment from the rendered output WITHOUT updating the
// constant, this test fails loudly — exactly the regression that bare
// .includes('charges') / .includes('volley') would silently mask.

describe('phantom-vurmox-volley log-fragment contract (e)', () => {
  it('charge log entry contains PHANTOM_VURMOX_LOG_CHARGE', () => {
    const state = makeTurnState(makeCombat());
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const log = next.combat.combatLog ?? [];
    const chargeEntry = log.find((entry) => entry.includes('Phantom Vurmox'));
    expect(chargeEntry).toBeDefined();
    expect(chargeEntry).toContain(PHANTOM_VURMOX_LOG_CHARGE);
  });

  it('fire log entry contains PHANTOM_VURMOX_LOG_VOLLEY', () => {
    const boss = makeBoss({ stateTags: [makeSeqTag(1)] });
    const state = makeTurnState(makeCombat({ boss }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const log = next.combat.combatLog ?? [];
    const fireEntry = log.find((entry) => entry.includes('Phantom Vurmox'));
    expect(fireEntry).toBeDefined();
    expect(fireEntry).toContain(PHANTOM_VURMOX_LOG_VOLLEY);
  });
});
