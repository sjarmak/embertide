/**
 * Eye-archetype exposed-window bonus-damage coverage
 * (embertide-z45d, sub of lhlo). Companion to the 3986 resolver:
 * 3986 makes the boss FLIP to exposed{bonus:1} on schedule; this
 * suite covers the consumer side — player→boss damage reads the
 * `BossStateExposed.bonus` field and stacks it onto the played
 * card's damage scalar.
 *
 * Helper is archetype-agnostic: it reads `boss.stateTags` for an
 * `exposed` tag regardless of `boss.archetype`. Any future archetype
 * that exposes a vulnerability window via the same tag will pick up
 * bonus consumption for free.
 */

import { describe, it, expect } from 'vitest';
import type { Card } from '../types/card';
import type {
  BossAttackPattern,
  BossStateTag,
  CombatBoss,
  CombatEntryContext,
  CombatState,
} from '../types/combat';
import { combatTurnReducer, exposedBonusFor, type CombatTurnState } from './combatEngine';
import { makeKidPlayer } from '../testing/stateFixtures';

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

const ENTRY_CTX: CombatEntryContext = {
  bossCardId: 'craghorn',
  combatEntryTurn: 4,
  attackerPlayerIds: ['p0'],
  engagementSource: 'fightMonster',
  entrySource: 'field',
};

const NO_OP_PATTERN: BossAttackPattern = {
  damagePerTurn: 0,
  targeting: 'player-hp',
  onDefeatEffect: { kind: 'wisp-drop' },
};

function makeBoss(
  args: {
    hp?: number;
    stateTags?: readonly BossStateTag[];
    archetype?: CombatBoss['archetype'];
  } = {},
): CombatBoss {
  return {
    hp: args.hp ?? 14,
    hpMax: 14,
    attackPattern: NO_OP_PATTERN,
    sourceCardId: 'craghorn',
    archetype: args.archetype,
    stateTags: args.stateTags,
  };
}

function makeCombat(boss: CombatBoss, hand: readonly Card[]): CombatState {
  return {
    boss,
    combatDeck: [],
    combatHand: hand,
    combatDiscard: [],
    battlefield: [],
    turnIndex: 0,
    activeActor: 'players',
    entryContext: ENTRY_CTX,
    combatLog: [],
    playsThisTurn: 0,
    bossStunTurns: 0,
    tideGaugeSnapshot: 0,
    echoQueue: null,
  };
}

function makeTurnState(combat: CombatState): CombatTurnState {
  return {
    combat,
    players: [makeKidPlayer({ id: 'p0', hp: 10 })],
    terminal: null,
    playsThisTurn: 0,
  };
}

function makeAttackCard(id: string, damage: number): Card {
  return {
    id,
    role: 'item',
    cost: { red: 0 },
    effects: { kind: 'gain', red: 0 },
    itemKind: 'item-active',
    cooldownTurns: 0,
    lastUsedTurn: null,
    combatEffect: { kind: 'combat-attack', damage },
  };
}

function makeStunCard(id: string, damage: number, stunTurns: number): Card {
  return {
    id,
    role: 'item',
    cost: { red: 0 },
    effects: { kind: 'gain', red: 0 },
    itemKind: 'item-active',
    cooldownTurns: 0,
    lastUsedTurn: null,
    combatEffect: { kind: 'combat-attack-stun', damage, stunTurns },
  };
}

function makeMultishotCard(id: string, damage: number, shots: number): Card {
  return {
    id,
    role: 'item',
    cost: { red: 0 },
    effects: { kind: 'gain', red: 0 },
    itemKind: 'item-active',
    cooldownTurns: 0,
    lastUsedTurn: null,
    combatEffect: { kind: 'combat-multishot', damage, shots },
  };
}

// ---------------------------------------------------------------------------
// Unit — exposedBonusFor pure helper.
// ---------------------------------------------------------------------------

describe('exposedBonusFor — pure helper', () => {
  it('returns 0 when boss has no stateTags', () => {
    expect(exposedBonusFor(makeBoss())).toBe(0);
  });

  it('returns 0 when stateTags is empty', () => {
    expect(exposedBonusFor(makeBoss({ stateTags: [] }))).toBe(0);
  });

  it('returns 0 when stateTags carries no exposed tag', () => {
    const boss = makeBoss({
      stateTags: [
        { kind: 'guarded', until: 'cycle-trigger' },
        { kind: 'cycle', counter: 0, threshold: 2, trigger: 'flip-to-exposed' },
      ],
    });
    expect(exposedBonusFor(boss)).toBe(0);
  });

  it('returns the bonus when an exposed tag is present', () => {
    const boss = makeBoss({
      stateTags: [
        { kind: 'exposed', bonus: 2 },
        { kind: 'cycle', counter: 0, threshold: 2, trigger: 'flip-to-exposed' },
      ],
    });
    expect(exposedBonusFor(boss)).toBe(2);
  });

  it('returns 0 when an exposed tag is present but has no bonus field (defensive)', () => {
    const boss = makeBoss({
      stateTags: [{ kind: 'exposed' }],
    });
    expect(exposedBonusFor(boss)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Integration — combat-attack consumes exposed bonus.
// ---------------------------------------------------------------------------

describe('combat-attack — exposed bonus consumption', () => {
  it('guarded boss takes only the played damage scalar', () => {
    const card = makeAttackCard('plain-attack', 3);
    const boss = makeBoss({
      hp: 10,
      stateTags: [
        { kind: 'guarded', until: 'cycle-trigger' },
        { kind: 'cycle', counter: 0, threshold: 2, trigger: 'flip-to-exposed' },
      ],
    });
    const state = makeTurnState(makeCombat(boss, [card]));
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'plain-attack',
      playerId: 'p0',
    });
    expect(next.combat.boss.hp).toBe(10 - 3);
  });

  it('exposed{bonus:1} boss takes damage + 1', () => {
    const card = makeAttackCard('plain-attack', 3);
    const boss = makeBoss({
      hp: 10,
      stateTags: [
        { kind: 'exposed', bonus: 1 },
        { kind: 'cycle', counter: 0, threshold: 2, trigger: 'flip-to-exposed' },
      ],
    });
    const state = makeTurnState(makeCombat(boss, [card]));
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'plain-attack',
      playerId: 'p0',
    });
    expect(next.combat.boss.hp).toBe(10 - (3 + 1));
  });

  it('exposed{bonus:2} stacks the larger bonus', () => {
    const card = makeAttackCard('plain-attack', 3);
    const boss = makeBoss({
      hp: 10,
      stateTags: [{ kind: 'exposed', bonus: 2 }],
    });
    const state = makeTurnState(makeCombat(boss, [card]));
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'plain-attack',
      playerId: 'p0',
    });
    expect(next.combat.boss.hp).toBe(10 - (3 + 2));
  });

  it('damage clamps at 0 even when bonus is large', () => {
    const card = makeAttackCard('plain-attack', 5);
    const boss = makeBoss({
      hp: 4,
      stateTags: [{ kind: 'exposed', bonus: 10 }],
    });
    const state = makeTurnState(makeCombat(boss, [card]));
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'plain-attack',
      playerId: 'p0',
    });
    expect(next.combat.boss.hp).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Integration — combat-attack-stun consumes exposed bonus AND still stuns.
// ---------------------------------------------------------------------------

describe('combat-attack-stun — exposed bonus consumption', () => {
  it('exposed boss takes damage + bonus AND bossStunTurns still accumulates', () => {
    const card = makeStunCard('craghorn-tusk-fixture', 4, 1);
    const boss = makeBoss({
      hp: 10,
      stateTags: [{ kind: 'exposed', bonus: 1 }],
    });
    const state = makeTurnState(makeCombat(boss, [card]));
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'craghorn-tusk-fixture',
      playerId: 'p0',
    });
    expect(next.combat.boss.hp).toBe(10 - (4 + 1));
    expect(next.combat.bossStunTurns).toBe(1);
  });

  it('guarded boss takes only the played damage; stun still accumulates', () => {
    const card = makeStunCard('craghorn-tusk-fixture', 4, 1);
    const boss = makeBoss({
      hp: 10,
      stateTags: [{ kind: 'guarded', until: 'cycle-trigger' }],
    });
    const state = makeTurnState(makeCombat(boss, [card]));
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'craghorn-tusk-fixture',
      playerId: 'p0',
    });
    expect(next.combat.boss.hp).toBe(10 - 4);
    expect(next.combat.bossStunTurns).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Integration — combat-multishot stacks bonus PER shot.
// ---------------------------------------------------------------------------

describe('combat-multishot — exposed bonus stacks per-shot', () => {
  it('exposed{bonus:1} multishot damage=2 shots=3 deals 3 × (2 + 1) = 9', () => {
    const card = makeMultishotCard('volley', 2, 3);
    const boss = makeBoss({
      hp: 20,
      stateTags: [{ kind: 'exposed', bonus: 1 }],
    });
    const state = makeTurnState(makeCombat(boss, [card]));
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'volley',
      playerId: 'p0',
    });
    expect(next.combat.boss.hp).toBe(20 - 9);
  });

  it('guarded multishot damage=2 shots=3 deals 3 × 2 = 6', () => {
    const card = makeMultishotCard('volley', 2, 3);
    const boss = makeBoss({
      hp: 20,
      stateTags: [{ kind: 'guarded', until: 'cycle-trigger' }],
    });
    const state = makeTurnState(makeCombat(boss, [card]));
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'volley',
      playerId: 'p0',
    });
    expect(next.combat.boss.hp).toBe(20 - 6);
  });

  it('multishot stops early when boss.hp reaches 0 (no negative hp from leftover shots)', () => {
    const card = makeMultishotCard('volley', 3, 5);
    const boss = makeBoss({
      hp: 6,
      stateTags: [{ kind: 'exposed', bonus: 1 }],
    });
    const state = makeTurnState(makeCombat(boss, [card]));
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'volley',
      playerId: 'p0',
    });
    expect(next.combat.boss.hp).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Integration — full Craghorn cycle through reduceBossResolve.
// ---------------------------------------------------------------------------

describe('Eye archetype end-to-end: Craghorn cycle + exposed-window bonus', () => {
  it('attack landed during the exposed window deals more damage than the same attack during the guarded window', () => {
    const card = makeAttackCard('plain-attack', 3);
    const initialBoss: CombatBoss = {
      hp: 30,
      hpMax: 30,
      attackPattern: NO_OP_PATTERN,
      sourceCardId: 'craghorn',
      archetype: 'eye',
      stateTags: [
        { kind: 'guarded', until: 'cycle-trigger' },
        { kind: 'cycle', counter: 0, threshold: 2, trigger: 'flip-to-exposed' },
      ],
    };

    let state: CombatTurnState = {
      combat: { ...makeCombat(initialBoss, [card]), activeActor: 'players' },
      players: [makeKidPlayer({ id: 'p0', hp: 10 })],
      terminal: null,
      playsThisTurn: 0,
    };

    const guardedHpBefore = state.combat.boss.hp;
    state = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'plain-attack',
      playerId: 'p0',
    });
    const guardedDelta = guardedHpBefore - state.combat.boss.hp;
    expect(guardedDelta).toBe(3);

    state = {
      ...state,
      combat: {
        ...state.combat,
        activeActor: 'boss',
        combatHand: [card],
      },
    };
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });

    state = {
      ...state,
      combat: { ...state.combat, activeActor: 'boss' },
    };
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });

    expect(state.combat.boss.stateTags?.[0].kind).toBe('exposed');

    state = {
      ...state,
      combat: { ...state.combat, activeActor: 'players' },
    };
    const exposedHpBefore = state.combat.boss.hp;
    state = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'plain-attack',
      playerId: 'p0',
    });
    const exposedDelta = exposedHpBefore - state.combat.boss.hp;
    expect(exposedDelta).toBe(3 + 1);

    expect(exposedDelta).toBeGreaterThan(guardedDelta);
  });
});
