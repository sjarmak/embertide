/**
 * Eye-archetype end-of-boss-turn dispatch coverage
 * (embertide-3986, sub of lhlo). Companion to the colocated unit
 * tests in `combat/archetypeResolvers/eye.test.ts` — those exercise
 * the pure tag-transform; this file proves the WIRING into
 * `reduceBossResolve` fires at the right time and flows through both
 * the normal-resolve branch and the stun-skip branch.
 */

import { describe, it, expect } from 'vitest';
import type {
  BossAttackPattern,
  BossStateTag,
  CombatBoss,
  CombatEntryContext,
  CombatState,
} from '../types/combat';
import type { KidPlayer } from '../store/types';
import {
  combatTurnReducer,
  EYE_EXPOSED_BONUS,
  EYE_REVERT_GUARDED_UNTIL,
  type CombatTurnState,
} from './combatEngine';
import { makeKidPlayer } from '../testing/stateFixtures';

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

const ENTRY_CTX: CombatEntryContext = {
  bossCardId: 'craghorn',
  combatEntryTurn: 4,
  attackerPlayerIds: ['p0', 'p1'],
  engagementSource: 'fightMonster',
  entrySource: 'field',
};

const CRAGHORN_PATTERN: BossAttackPattern = {
  damagePerTurn: 2,
  targeting: 'player-hp',
  onDefeatEffect: { kind: 'wisp-drop' },
};

function makeEyeBoss(threshold: number, counter = 0): CombatBoss {
  return {
    hp: 14,
    hpMax: 14,
    attackPattern: CRAGHORN_PATTERN,
    sourceCardId: 'craghorn',
    archetype: 'eye',
    stateTags: [
      { kind: 'guarded', until: 'cycle-trigger' },
      { kind: 'cycle', counter, threshold, trigger: 'flip-to-exposed' },
    ],
  };
}

function makeLegacyBoss(): CombatBoss {
  return {
    hp: 14,
    hpMax: 14,
    attackPattern: CRAGHORN_PATTERN,
    sourceCardId: 'broodmaw',
  };
}

function makeCombat(boss: CombatBoss, overrides: Partial<CombatState> = {}): CombatState {
  return {
    boss,
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
  players: readonly KidPlayer[] = [
    makeKidPlayer({ id: 'p0', hp: 10 }),
    makeKidPlayer({ id: 'p1', hp: 10 }),
  ],
): CombatTurnState {
  return { combat, players, terminal: null, playsThisTurn: 0 };
}

function tickBossTurn(state: CombatTurnState): CombatTurnState {
  const ticked = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
  if (ticked.terminal !== null) return ticked;
  return {
    ...ticked,
    combat: { ...ticked.combat, activeActor: 'boss' },
  };
}

function tagKinds(boss: CombatBoss): readonly BossStateTag['kind'][] {
  return (boss.stateTags ?? []).map((t) => t.kind);
}

// ---------------------------------------------------------------------------
// Wiring — normal-resolve branch.
// ---------------------------------------------------------------------------

describe('Eye-archetype end-of-boss-turn dispatch (3986)', () => {
  it('Craghorn cadence (threshold=2) round-trips guarded → guarded(c=1) → exposed → guarded across three boss-turns', () => {
    let state = makeTurnState(makeCombat(makeEyeBoss(2)));

    state = tickBossTurn(state);
    expect(tagKinds(state.combat.boss)).toEqual(['guarded', 'cycle']);
    const cycleAfterTurn1 = state.combat.boss.stateTags?.[1];
    if (cycleAfterTurn1?.kind !== 'cycle') throw new Error('expected cycle');
    expect(cycleAfterTurn1.counter).toBe(1);

    state = tickBossTurn(state);
    expect(tagKinds(state.combat.boss)).toEqual(['exposed', 'cycle']);
    const exposedTag = state.combat.boss.stateTags?.[0];
    if (exposedTag?.kind !== 'exposed') throw new Error('expected exposed');
    expect(exposedTag.bonus).toBe(EYE_EXPOSED_BONUS);

    state = tickBossTurn(state);
    expect(tagKinds(state.combat.boss)).toEqual(['guarded', 'cycle']);
    const guardedTag = state.combat.boss.stateTags?.[0];
    if (guardedTag?.kind !== 'guarded') throw new Error('expected guarded');
    expect(guardedTag.until).toBe(EYE_REVERT_GUARDED_UNTIL);
  });

  it('Coilworm cadence (threshold=1) flips on the first boss-turn and reverts on the second', () => {
    let state = makeTurnState(makeCombat(makeEyeBoss(1)));

    state = tickBossTurn(state);
    expect(tagKinds(state.combat.boss)).toEqual(['exposed', 'cycle']);

    state = tickBossTurn(state);
    expect(tagKinds(state.combat.boss)).toEqual(['guarded', 'cycle']);
  });

  it('legacy boss (no archetype) passes through reduceBossResolve unchanged', () => {
    const legacy = makeLegacyBoss();
    const state = makeTurnState(makeCombat(legacy));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });

    expect(next.combat.boss.archetype).toBeUndefined();
    expect(next.combat.boss.stateTags).toBeUndefined();
  });

  it('boss-turn still advances turnIndex and flips activeActor while ticking the archetype', () => {
    const state = makeTurnState(makeCombat(makeEyeBoss(2)));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });

    expect(next.combat.turnIndex).toBe(state.combat.turnIndex + 1);
    expect(next.combat.activeActor).toBe('players');
  });
});

// ---------------------------------------------------------------------------
// Wiring — stun-skip branch.
// ---------------------------------------------------------------------------

describe('Eye-archetype tick fires on the stunned boss-turn (3986)', () => {
  it('archetype tick fires while bossStunTurns > 0 (stun consumes the boss-turn but the cycle still advances)', () => {
    const state = makeTurnState(makeCombat(makeEyeBoss(2), { bossStunTurns: 1 }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });

    expect(next.combat.bossStunTurns).toBe(0);
    expect(next.combat.activeActor).toBe('players');

    const cycle = next.combat.boss.stateTags?.[1];
    if (cycle?.kind !== 'cycle') throw new Error('expected cycle tag');
    expect(cycle.counter).toBe(1);
    expect(next.combat.boss.stateTags?.[0].kind).toBe('guarded');
  });

  it('two stunned boss-turns at threshold=2 trip the flip on the second stun-tick', () => {
    let state = makeTurnState(makeCombat(makeEyeBoss(2), { bossStunTurns: 2 }));

    state = tickBossTurn(state);
    expect(state.combat.boss.stateTags?.[0].kind).toBe('guarded');
    expect(state.combat.bossStunTurns).toBe(1);

    state = tickBossTurn(state);
    expect(state.combat.boss.stateTags?.[0].kind).toBe('exposed');
    expect(state.combat.bossStunTurns).toBe(0);
  });
});
