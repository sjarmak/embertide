/**
 * Trinity Aurogax heads resolver coverage (embertide-nlr8, sub of
 * lhlo + 4hr1). Asserts the 3-step head rotation dispatch keyed off
 * `boss.stateTags`'s sequence tag `currentIndex`:
 *
 *   (a) 'gloom-head' (currentIndex=0): base dpt routed via the spec's
 *       'battlefield-then-player' targeting + gloom-flavor log.
 *   (b) 'umbra-head' (currentIndex=1): base dpt + ancient-arrow
 *       flavor log.
 *   (c) 'auren-head' (currentIndex=2): base dpt + auren sacred-
 *       machinery flavor log.
 *   (d) Wrap-around: after auren-head fires, archetype tick wraps
 *       currentIndex back to 0.
 *   (e) Defensive defaults: no sequence stateTag / unknown step name
 *       falls back to pattern.damagePerTurn (legacy parity).
 *
 * NOTE: Per-head TARGETING variance (gloom-head wanting
 * battlefield-then-player vs umbra-head wanting player-hp single-
 * target vs auren-head wanting AoE) is intentionally NOT modeled in
 * this resolver. The bossTurn reducer reads effectiveTargeting BEFORE
 * the resolver fires, so per-step targeting overrides require either
 * a combatPatch overlay path or a reducer change. Per the plan-phase
 * decision (option c), v1 ships per-step damage + log flavor only,
 * keeping the spec's 'battlefield-then-player' uniform across heads.
 * Per-head targeting variance is queued as a follow-up bead.
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
  TRINITY_AUROGAX_LOG_GLOOM,
  TRINITY_AUROGAX_LOG_UMBRA,
  TRINITY_AUROGAX_LOG_ANCIENT,
  TRINITY_AUROGAX_LOG_AUREN,
  type CombatTurnState,
} from './combatEngine';
import { makeKidPlayer } from '../testing/stateFixtures';

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer => makeKidPlayer(overrides);

const ENTRY_CTX: CombatEntryContext = {
  bossCardId: 'trinity-aurogax',
  combatEntryTurn: 19,
  attackerPlayerIds: ['p0', 'p1'],
  engagementSource: 'fightMonster',
  entrySource: 'wild-boss-slot',
};

const TG_PATTERN: BossAttackPattern = {
  damagePerTurn: 4,
  targeting: 'battlefield-then-player',
  onDefeatEffect: { kind: 'wisp-drop' },
  bossAttackResolver: 'trinity-aurogax-heads',
};

function makeSeqTag(currentIndex: number): BossStateSequence {
  return {
    kind: 'sequence',
    steps: ['gloom-head', 'umbra-head', 'auren-head'],
    currentIndex,
  };
}

function makeBoss(overrides: Partial<CombatBoss> = {}): CombatBoss {
  return {
    hp: 60,
    hpMax: 60,
    attackPattern: TG_PATTERN,
    sourceCardId: 'trinity-aurogax',
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
// (a) gloom-head step.
// ---------------------------------------------------------------------------

describe('trinity-aurogax-heads gloom-head step (a)', () => {
  it('currentIndex=0 deals base dpt routed battlefield-then-player', () => {
    const state = makeTurnState(makeCombat());
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // 4 dmg / 2 = 2 each
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(3);
  });

  it('logs a gloom-flavor entry', () => {
    const state = makeTurnState(makeCombat());
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const log = next.combat.combatLog ?? [];
    expect(log.some((entry) => entry.toLowerCase().includes(TRINITY_AUROGAX_LOG_GLOOM))).toBe(true);
  });

  it('archetype tick advances pointer from 0 to 1', () => {
    const state = makeTurnState(makeCombat());
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const tag = next.combat.boss.stateTags?.[0];
    if (tag?.kind !== 'sequence') throw new Error('expected sequence tag');
    expect(tag.currentIndex).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// (b) umbra-head step.
// ---------------------------------------------------------------------------

describe('trinity-aurogax-heads umbra-head step (b)', () => {
  it('currentIndex=1 deals base dpt', () => {
    const boss = makeBoss({ stateTags: [makeSeqTag(1)] });
    const state = makeTurnState(makeCombat({ boss }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(3);
  });

  it('logs an ancient-arrow / umbra-flavor entry', () => {
    const boss = makeBoss({ stateTags: [makeSeqTag(1)] });
    const state = makeTurnState(makeCombat({ boss }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const log = next.combat.combatLog ?? [];
    expect(
      log.some(
        (entry) =>
          entry.toLowerCase().includes(TRINITY_AUROGAX_LOG_UMBRA) ||
          entry.toLowerCase().includes(TRINITY_AUROGAX_LOG_ANCIENT),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (c) auren-head step.
// ---------------------------------------------------------------------------

describe('trinity-aurogax-heads auren-head step (c)', () => {
  it('currentIndex=2 deals base dpt', () => {
    const boss = makeBoss({ stateTags: [makeSeqTag(2)] });
    const state = makeTurnState(makeCombat({ boss }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(3);
  });

  it('logs a auren sacred-machinery flavor entry', () => {
    const boss = makeBoss({ stateTags: [makeSeqTag(2)] });
    const state = makeTurnState(makeCombat({ boss }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const log = next.combat.combatLog ?? [];
    expect(log.some((entry) => entry.toLowerCase().includes(TRINITY_AUROGAX_LOG_AUREN))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (d) Wrap-around at currentIndex = steps.length - 1.
// ---------------------------------------------------------------------------

describe('trinity-aurogax-heads wrap-around (d)', () => {
  it('after auren-head (currentIndex=2), tick wraps pointer back to 0', () => {
    const boss = makeBoss({ stateTags: [makeSeqTag(2)] });
    const state = makeTurnState(makeCombat({ boss }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const tag = next.combat.boss.stateTags?.[0];
    if (tag?.kind !== 'sequence') throw new Error('expected sequence tag');
    expect(tag.currentIndex).toBe(0);
  });

  it('three consecutive boss-turns trace gloom -> umbra -> auren', () => {
    let state = makeTurnState(makeCombat());
    // Turn 1: gloom
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    let log = state.combat.combatLog ?? [];
    expect(log.some((e) => e.toLowerCase().includes(TRINITY_AUROGAX_LOG_GLOOM))).toBe(true);
    state = { ...state, combat: { ...state.combat, activeActor: 'boss' } };
    // Turn 2: umbra
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    log = state.combat.combatLog ?? [];
    expect(
      log.some(
        (e) =>
          e.toLowerCase().includes(TRINITY_AUROGAX_LOG_UMBRA) ||
          e.toLowerCase().includes(TRINITY_AUROGAX_LOG_ANCIENT),
      ),
    ).toBe(true);
    state = { ...state, combat: { ...state.combat, activeActor: 'boss' } };
    // Turn 3: auren
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    log = state.combat.combatLog ?? [];
    expect(log.some((e) => e.toLowerCase().includes(TRINITY_AUROGAX_LOG_AUREN))).toBe(true);
    // Pointer wrapped back to gloom for next round
    const tag = state.combat.boss.stateTags?.[0];
    if (tag?.kind !== 'sequence') throw new Error('expected sequence tag');
    expect(tag.currentIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// (e) Defensive defaults.
// ---------------------------------------------------------------------------

describe('trinity-aurogax-heads defensive defaults (e)', () => {
  it('boss with no stateTags falls back to pattern.damagePerTurn', () => {
    const boss = makeBoss({ stateTags: undefined });
    const state = makeTurnState(makeCombat({ boss }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // 4 dmg / 2 = 2 each
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(3);
  });

  it('unknown step name falls back to pattern.damagePerTurn', () => {
    const boss = makeBoss({
      stateTags: [{ kind: 'sequence', steps: ['mystery-head'], currentIndex: 0 }],
    });
    const state = makeTurnState(makeCombat({ boss }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// (f) Log-fragment constant contract (embertide-x5vq).
// ---------------------------------------------------------------------------
// Pins the rendered resolver log to the exported TRINITY_AUROGAX_LOG_*
// constants. If a future flavor pass rephrases the source string and
// removes the fragment from the rendered output WITHOUT updating the
// constant, this test fails loudly.

describe('trinity-aurogax-heads log-fragment contract (f)', () => {
  it('gloom-head log entry contains TRINITY_AUROGAX_LOG_GLOOM (case-insensitive)', () => {
    const state = makeTurnState(makeCombat());
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const entry = (next.combat.combatLog ?? []).find((e) => e.startsWith('Trinity Aurogax'));
    expect(entry).toBeDefined();
    expect(entry?.toLowerCase()).toContain(TRINITY_AUROGAX_LOG_GLOOM);
  });

  it('umbra-head log entry contains both TRINITY_AUROGAX_LOG_UMBRA and TRINITY_AUROGAX_LOG_ANCIENT', () => {
    const boss = makeBoss({ stateTags: [makeSeqTag(1)] });
    const state = makeTurnState(makeCombat({ boss }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const entry = (next.combat.combatLog ?? []).find((e) => e.startsWith('Trinity Aurogax'));
    expect(entry).toBeDefined();
    expect(entry?.toLowerCase()).toContain(TRINITY_AUROGAX_LOG_UMBRA);
    expect(entry?.toLowerCase()).toContain(TRINITY_AUROGAX_LOG_ANCIENT);
  });

  it('auren-head log entry contains TRINITY_AUROGAX_LOG_AUREN', () => {
    const boss = makeBoss({ stateTags: [makeSeqTag(2)] });
    const state = makeTurnState(makeCombat({ boss }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const entry = (next.combat.combatLog ?? []).find((e) => e.startsWith('Trinity Aurogax'));
    expect(entry).toBeDefined();
    expect(entry?.toLowerCase()).toContain(TRINITY_AUROGAX_LOG_AUREN);
  });
});
