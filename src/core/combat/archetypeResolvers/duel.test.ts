/**
 * Unit tests for the Duel-archetype resolver + Adaptive penalty
 * (embertide-lhlo.14, sub of lhlo).
 *
 * Four test concerns:
 *   1. `applyDuelArchetypeTick` — registry peg; always returns the same
 *      reference for duel bosses (no end-of-boss-turn tick needed).
 *   2. `applyDuelAdaptivePenalty` — core Adaptive mechanic: the SECOND
 *      play of the same `CombatEffect.kind` in one turn is reduced by
 *      `adaptive.penalty`; the first play is unaffected; different-kind
 *      second plays are unaffected.
 *   3. Tracker reset — the tracker is cleared at `reducePlayerPass`
 *      so the next turn starts clean.
 *   4. Colosseum end-to-end — `COLOSSEUM_BONEREAVER_T1` (penalty:1) and
 *      `COLOSSEUM_CHIMERA_T2` (penalty:2) exercise the penalty path.
 *   5. Zone-gating regression — a zone duel boss without allowlist
 *      activation takes vanilla boss.hp damage (no Adaptive penalty).
 */

import { describe, expect, it } from 'vitest';
import type { CombatBoss } from '../../../types/combat';
import type { CombatEffect } from '../../../types/combatEffect';
import { COLOSSEUM_BONEREAVER_T1 } from '../../../data/colosseum/tier1';
import { COLOSSEUM_CHIMERA_T2 } from '../../../data/colosseum/tier2';
import { ZONE_BOSS_SPECS } from '../../../data/zones/bossSpecs';
import { KEYWORD_VOCABULARY_ZONE_ALLOWLIST } from '../../../store/combatBootstrap';
import { applyDuelArchetypeTick, applyDuelAdaptivePenalty } from './duel';
import { applyArchetypeTick } from './index';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeDuelBoss(penalty: number): CombatBoss {
  return {
    hp: 20,
    hpMax: 20,
    attackPattern: {
      damagePerTurn: 3,
      targeting: 'player-hp',
      onDefeatEffect: { kind: 'wisp-drop' },
    },
    sourceCardId: 'bonereaver',
    archetype: 'duel',
    stateTags: [{ kind: 'adaptive', penalty }],
  };
}

function makePlainBoss(): CombatBoss {
  return {
    hp: 20,
    hpMax: 20,
    attackPattern: {
      damagePerTurn: 3,
      targeting: 'player-hp',
      onDefeatEffect: { kind: 'wisp-drop' },
    },
    sourceCardId: 'craghorn',
  };
}

const ATTACK_EFFECT: CombatEffect = { kind: 'combat-attack', damage: 5 };
const STUN_EFFECT: CombatEffect = { kind: 'combat-attack-stun', damage: 4, stunTurns: 1 };
const MULTISHOT_EFFECT: CombatEffect = { kind: 'combat-multishot', damage: 2, shots: 3 };
const DRAW_EFFECT: CombatEffect = { kind: 'combat-draw', count: 2 };
const HEAL_EFFECT: CombatEffect = { kind: 'combat-heal', amount: 3 };
const ABSORB_EFFECT: CombatEffect = { kind: 'combat-absorb', hp: 5 };
const WEAKEN_EFFECT: CombatEffect = { kind: 'combat-weaken', amount: 2 };
const VULNERABLE_EFFECT: CombatEffect = { kind: 'combat-vulnerable', amount: 1 };

// ---------------------------------------------------------------------------
// 1. applyDuelArchetypeTick — registry peg, always same-reference no-op
// ---------------------------------------------------------------------------

describe('applyDuelArchetypeTick — non-Duel no-op cases', () => {
  it('returns identical boss when archetype is undefined (legacy fixture)', () => {
    const legacy = makePlainBoss();
    expect(applyDuelArchetypeTick(legacy)).toBe(legacy);
  });

  it('returns identical boss when archetype is non-duel (e.g. eye)', () => {
    const eye: CombatBoss = {
      hp: 14,
      hpMax: 14,
      attackPattern: {
        damagePerTurn: 2,
        targeting: 'player-hp',
        onDefeatEffect: { kind: 'wisp-drop' },
      },
      sourceCardId: 'craghorn',
      archetype: 'eye',
      stateTags: [
        { kind: 'guarded', until: 'cycle-trigger' },
        { kind: 'cycle', counter: 0, threshold: 2, trigger: 'flip-to-exposed' },
      ],
    };
    expect(applyDuelArchetypeTick(eye)).toBe(eye);
  });
});

describe('applyDuelArchetypeTick — duel tick is a same-reference no-op', () => {
  it('returns the SAME reference for a duel boss (no end-of-turn state change)', () => {
    const boss = makeDuelBoss(1);
    expect(applyDuelArchetypeTick(boss)).toBe(boss);
  });

  it('ARCHETYPE_RESOLVERS has a duel entry and applyArchetypeTick dispatches it', () => {
    const boss = makeDuelBoss(2);
    // applyArchetypeTick must find the 'duel' resolver and call it
    // (which is a same-reference no-op for duel).
    const result = applyArchetypeTick(boss);
    expect(result).toBe(boss);
  });
});

// ---------------------------------------------------------------------------
// 2. applyDuelAdaptivePenalty — Adaptive mechanic
// ---------------------------------------------------------------------------

describe('applyDuelAdaptivePenalty — no-op for non-duel bosses', () => {
  it('returns null for a boss without duel archetype', () => {
    const boss = makePlainBoss();
    const result = applyDuelAdaptivePenalty(boss, ATTACK_EFFECT, undefined);
    expect(result).toBeNull();
  });

  it('returns null for an eye-archetype boss', () => {
    const eye: CombatBoss = {
      hp: 14,
      hpMax: 14,
      attackPattern: {
        damagePerTurn: 2,
        targeting: 'player-hp',
        onDefeatEffect: { kind: 'wisp-drop' },
      },
      sourceCardId: 'craghorn',
      archetype: 'eye',
      stateTags: [{ kind: 'cycle', counter: 0, threshold: 2, trigger: 'flip-to-exposed' }],
    };
    expect(applyDuelAdaptivePenalty(eye, ATTACK_EFFECT, undefined)).toBeNull();
  });
});

describe('applyDuelAdaptivePenalty — first play of a kind is always unaffected', () => {
  it('first combat-attack play passes through at full damage', () => {
    const boss = makeDuelBoss(2);
    const result = applyDuelAdaptivePenalty(boss, ATTACK_EFFECT, undefined);
    expect(result).not.toBeNull();
    expect(result!.effect).toEqual(ATTACK_EFFECT); // same value
    expect(result!.effect.kind).toBe('combat-attack');
    if (result!.effect.kind !== 'combat-attack') throw new Error('expected combat-attack');
    expect(result!.effect.damage).toBe(5); // unchanged
  });

  it('first combat-attack-stun play passes through at full damage', () => {
    const boss = makeDuelBoss(1);
    const result = applyDuelAdaptivePenalty(boss, STUN_EFFECT, undefined);
    expect(result).not.toBeNull();
    expect(result!.effect.kind).toBe('combat-attack-stun');
    if (result!.effect.kind !== 'combat-attack-stun') throw new Error('expected stun');
    expect(result!.effect.damage).toBe(4); // unchanged
  });

  it('first play adds the kind to the tracker', () => {
    const boss = makeDuelBoss(1);
    const result = applyDuelAdaptivePenalty(boss, ATTACK_EFFECT, undefined);
    expect(result).not.toBeNull();
    expect(result!.nextTracker.has('combat-attack')).toBe(true);
    expect(result!.nextTracker.size).toBe(1);
  });
});

describe('applyDuelAdaptivePenalty — second play of same kind is penalized', () => {
  it('second combat-attack: damage reduced by penalty (penalty=1)', () => {
    const boss = makeDuelBoss(1);
    // Simulate first play having already occurred.
    const seenAfterFirst = new Set<CombatEffect['kind']>(['combat-attack']);
    const result = applyDuelAdaptivePenalty(boss, ATTACK_EFFECT, seenAfterFirst);
    expect(result).not.toBeNull();
    expect(result!.effect.kind).toBe('combat-attack');
    if (result!.effect.kind !== 'combat-attack') throw new Error('expected combat-attack');
    expect(result!.effect.damage).toBe(4); // 5 - 1
  });

  it('second combat-attack: damage reduced by penalty (penalty=2)', () => {
    const boss = makeDuelBoss(2);
    const seenAfterFirst = new Set<CombatEffect['kind']>(['combat-attack']);
    const result = applyDuelAdaptivePenalty(boss, ATTACK_EFFECT, seenAfterFirst);
    expect(result).not.toBeNull();
    if (result!.effect.kind !== 'combat-attack') throw new Error('expected combat-attack');
    expect(result!.effect.damage).toBe(3); // 5 - 2
  });

  it('second combat-attack-stun: damage reduced by penalty, stunTurns unchanged', () => {
    const boss = makeDuelBoss(2);
    const seen = new Set<CombatEffect['kind']>(['combat-attack-stun']);
    const result = applyDuelAdaptivePenalty(boss, STUN_EFFECT, seen);
    expect(result).not.toBeNull();
    if (result!.effect.kind !== 'combat-attack-stun') throw new Error('expected stun');
    expect(result!.effect.damage).toBe(2); // 4 - 2
    expect(result!.effect.stunTurns).toBe(1); // unchanged
  });

  it('second combat-multishot: damage per shot reduced by penalty, shots unchanged', () => {
    const boss = makeDuelBoss(1);
    const seen = new Set<CombatEffect['kind']>(['combat-multishot']);
    const result = applyDuelAdaptivePenalty(boss, MULTISHOT_EFFECT, seen);
    expect(result).not.toBeNull();
    if (result!.effect.kind !== 'combat-multishot') throw new Error('expected multishot');
    expect(result!.effect.damage).toBe(1); // 2 - 1
    expect(result!.effect.shots).toBe(3); // unchanged
  });

  it('damage is clamped at 0 when penalty >= damage', () => {
    const boss = makeDuelBoss(10); // penalty larger than damage
    const seen = new Set<CombatEffect['kind']>(['combat-attack']);
    const result = applyDuelAdaptivePenalty(boss, { kind: 'combat-attack', damage: 3 }, seen);
    expect(result).not.toBeNull();
    if (result!.effect.kind !== 'combat-attack') throw new Error('expected combat-attack');
    expect(result!.effect.damage).toBe(0); // clamped
  });
});

describe('applyDuelAdaptivePenalty — different-kind second card is unaffected', () => {
  it('second play of a DIFFERENT kind passes through at full damage', () => {
    const boss = makeDuelBoss(2);
    // First play was combat-attack; second play is combat-multishot (different kind).
    const seenAfterAttack = new Set<CombatEffect['kind']>(['combat-attack']);
    const result = applyDuelAdaptivePenalty(boss, MULTISHOT_EFFECT, seenAfterAttack);
    expect(result).not.toBeNull();
    if (result!.effect.kind !== 'combat-multishot') throw new Error('expected multishot');
    expect(result!.effect.damage).toBe(2); // unchanged — different kind, no penalty
  });

  it('tracker grows to include both kinds after two different-kind plays', () => {
    const boss = makeDuelBoss(2);
    const seenAfterAttack = new Set<CombatEffect['kind']>(['combat-attack']);
    const result = applyDuelAdaptivePenalty(boss, MULTISHOT_EFFECT, seenAfterAttack);
    expect(result).not.toBeNull();
    expect(result!.nextTracker.has('combat-attack')).toBe(true);
    expect(result!.nextTracker.has('combat-multishot')).toBe(true);
    expect(result!.nextTracker.size).toBe(2);
  });
});

describe('applyDuelAdaptivePenalty — non-damage effects recorded but not penalized', () => {
  it('second combat-draw: effect unchanged (no damage field to reduce)', () => {
    const boss = makeDuelBoss(3);
    const seen = new Set<CombatEffect['kind']>(['combat-draw']);
    const result = applyDuelAdaptivePenalty(boss, DRAW_EFFECT, seen);
    expect(result).not.toBeNull();
    expect(result!.effect).toEqual(DRAW_EFFECT); // unchanged
  });

  it('second combat-heal: effect unchanged', () => {
    const boss = makeDuelBoss(3);
    const seen = new Set<CombatEffect['kind']>(['combat-heal']);
    const result = applyDuelAdaptivePenalty(boss, HEAL_EFFECT, seen);
    expect(result).not.toBeNull();
    expect(result!.effect).toEqual(HEAL_EFFECT);
  });

  it('second combat-absorb: effect unchanged', () => {
    const boss = makeDuelBoss(3);
    const seen = new Set<CombatEffect['kind']>(['combat-absorb']);
    const result = applyDuelAdaptivePenalty(boss, ABSORB_EFFECT, seen);
    expect(result).not.toBeNull();
    expect(result!.effect).toEqual(ABSORB_EFFECT);
  });

  it('second combat-weaken: effect unchanged', () => {
    const boss = makeDuelBoss(2);
    const seen = new Set<CombatEffect['kind']>(['combat-weaken']);
    const result = applyDuelAdaptivePenalty(boss, WEAKEN_EFFECT, seen);
    expect(result).not.toBeNull();
    expect(result!.effect).toEqual(WEAKEN_EFFECT);
  });

  it('second combat-vulnerable: effect unchanged', () => {
    const boss = makeDuelBoss(2);
    const seen = new Set<CombatEffect['kind']>(['combat-vulnerable']);
    const result = applyDuelAdaptivePenalty(boss, VULNERABLE_EFFECT, seen);
    expect(result).not.toBeNull();
    expect(result!.effect).toEqual(VULNERABLE_EFFECT);
  });

  it('non-damage effect is still added to the tracker', () => {
    const boss = makeDuelBoss(1);
    const result = applyDuelAdaptivePenalty(boss, DRAW_EFFECT, undefined);
    expect(result).not.toBeNull();
    expect(result!.nextTracker.has('combat-draw')).toBe(true);
  });
});

describe('applyDuelAdaptivePenalty — immutability', () => {
  it('original seenKinds set is not mutated', () => {
    const boss = makeDuelBoss(2);
    const seen = new Set<CombatEffect['kind']>(['combat-attack']);
    const sizeBefore = seen.size;
    applyDuelAdaptivePenalty(boss, MULTISHOT_EFFECT, seen);
    // Original set must be unchanged.
    expect(seen.size).toBe(sizeBefore);
    expect(seen.has('combat-multishot')).toBe(false);
  });

  it('nextTracker is a new set distinct from the input', () => {
    const boss = makeDuelBoss(1);
    const seen = new Set<CombatEffect['kind']>(['combat-attack']);
    const result = applyDuelAdaptivePenalty(boss, MULTISHOT_EFFECT, seen);
    expect(result).not.toBeNull();
    expect(result!.nextTracker).not.toBe(seen);
  });
});

// ---------------------------------------------------------------------------
// 3. Tracker-reset — reducePlayerPass resets the tracker
// ---------------------------------------------------------------------------

import type { BossAttackPattern, CombatEntryContext, CombatState } from '../../../types/combat';
import type { CombatTurnState } from '../types';
import { combatTurnReducer } from '../../../core/combatEngine';
import type { Card } from '../../../types/card';
import { makeKidPlayer } from '../../../testing/stateFixtures';

const ENTRY_CTX: CombatEntryContext = {
  bossCardId: 'bonereaver',
  combatEntryTurn: 1,
  attackerPlayerIds: ['p0'],
  engagementSource: 'fightMonster',
  entrySource: 'field',
};

const BOSS_PATTERN: BossAttackPattern = {
  damagePerTurn: 2,
  targeting: 'player-hp',
  onDefeatEffect: { kind: 'wisp-drop' },
};

/** Minimal Card fixture that produces a `combat-attack` effect. */
function makeAttackCard(id: string, damage: number): Card {
  return {
    id,
    role: 'starter-red',
    cost: { red: damage },
    effects: { kind: 'shard', red: damage },
    combatEffect: { kind: 'combat-attack', damage },
  };
}

function makeCombatState(
  boss: CombatBoss,
  hand: readonly Card[] = [],
  overrides: Partial<CombatState> = {},
): CombatState {
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
    ...overrides,
  };
}

function makeTurnState(
  combat: CombatState,
  adaptiveTurnTracker?: ReadonlySet<CombatEffect['kind']>,
): CombatTurnState {
  return {
    combat,
    players: [makeKidPlayer({ id: 'p0', hp: 10 })],
    terminal: null,
    playsThisTurn: 0,
    adaptiveTurnTracker,
  };
}

describe('adaptiveTurnTracker — reset on PLAYER_PASS', () => {
  it('tracker present before pass is cleared after PLAYER_PASS', () => {
    const boss = makeDuelBoss(1);
    const seenSomething = new Set<CombatEffect['kind']>(['combat-attack']);
    const state = makeTurnState(makeCombatState(boss, []), seenSomething);
    const afterPass = combatTurnReducer(state, { type: 'PLAYER_PASS' });
    expect(afterPass.adaptiveTurnTracker).toBeUndefined();
  });

  it('tracker is also reset after BOSS_RESOLVE (EOT cleanup)', () => {
    const boss = makeDuelBoss(1);
    const seenSomething = new Set<CombatEffect['kind']>(['combat-attack']);
    const state = makeTurnState(makeCombatState(boss, [], { activeActor: 'boss' }), seenSomething);
    const afterBoss = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(afterBoss.adaptiveTurnTracker).toBeUndefined();
  });
});

describe('adaptiveTurnTracker — accumulates correctly within a turn', () => {
  it('first attack is unpenalized and tracker records the kind', () => {
    const boss = makeDuelBoss(2);
    const card = makeAttackCard('red-1', 4);
    const state = makeTurnState(makeCombatState(boss, [card]));

    const after = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'red-1',
      playerId: 'p0',
    });
    // Boss took 4 damage (no penalty on first play).
    expect(state.combat.boss.hp - after.combat.boss.hp).toBe(4);
    // Tracker now includes combat-attack.
    expect(after.adaptiveTurnTracker?.has('combat-attack')).toBe(true);
  });

  it('second attack of the same kind is penalized by adaptive.penalty', () => {
    const boss = makeDuelBoss(2); // penalty = 2
    const card1 = makeAttackCard('red-1', 4);
    const card2 = makeAttackCard('red-2', 4);
    const state = makeTurnState(makeCombatState(boss, [card1, card2]));

    // First play: unpenalized, boss takes 4 damage.
    const after1 = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'red-1',
      playerId: 'p0',
    });
    expect(state.combat.boss.hp - after1.combat.boss.hp).toBe(4);

    // Second play: penalized by 2, boss takes 4-2=2 damage.
    const after2 = combatTurnReducer(after1, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'red-2',
      playerId: 'p0',
    });
    expect(after1.combat.boss.hp - after2.combat.boss.hp).toBe(2);
  });

  it('after PLAYER_PASS the tracker resets and next turn first play is unpenalized again', () => {
    const boss = makeDuelBoss(2);
    const card1 = makeAttackCard('red-1', 4);
    const card2 = makeAttackCard('red-2', 4);
    const state = makeTurnState(makeCombatState(boss, [card1, card2]));

    // Turn 1: play attack (first play, unpenalized).
    const after1 = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'red-1',
      playerId: 'p0',
    });
    // Pass + boss resolves to end the turn.
    const afterPass = combatTurnReducer(after1, { type: 'PLAYER_PASS' });
    const afterBoss = combatTurnReducer(afterPass, { type: 'BOSS_RESOLVE' });

    // Tracker must be cleared at the start of turn 2.
    expect(afterBoss.adaptiveTurnTracker).toBeUndefined();

    // Turn 2: play card2 (same kind — combat-attack — but fresh turn,
    // so tracker is empty and no penalty applies).
    // Note: we need to put card2 in hand for the second turn. Build
    // a synthetic state reflecting the reset combat hand.
    const turn2State: CombatTurnState = {
      ...afterBoss,
      combat: {
        ...afterBoss.combat,
        combatHand: [card2],
        activeActor: 'players',
      },
    };
    const after2 = combatTurnReducer(turn2State, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'red-2',
      playerId: 'p0',
    });
    // No penalty — fresh turn, first play of combat-attack.
    expect(turn2State.combat.boss.hp - after2.combat.boss.hp).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// 4. Colosseum end-to-end — COLOSSEUM_BONEREAVER_T1 and COLOSSEUM_CHIMERA_T2
// ---------------------------------------------------------------------------

describe('COLOSSEUM_BONEREAVER_T1 (penalty:1) — end-to-end Adaptive penalty', () => {
  it('COLOSSEUM_BONEREAVER_T1 has archetype duel and adaptive penalty=1', () => {
    expect(COLOSSEUM_BONEREAVER_T1.archetype).toBe('duel');
    const adaptiveTag = COLOSSEUM_BONEREAVER_T1.stateTags?.find((t) => t.kind === 'adaptive');
    if (!adaptiveTag || adaptiveTag.kind !== 'adaptive') throw new Error('expected adaptive tag');
    expect(adaptiveTag.penalty).toBe(1);
  });

  it('applyArchetypeTick returns same reference (no-op) for Bonereaver T1', () => {
    const result = applyArchetypeTick(COLOSSEUM_BONEREAVER_T1);
    expect(result).toBe(COLOSSEUM_BONEREAVER_T1);
  });

  it('first attack against Bonereaver T1 is unpenalized', () => {
    const card = makeAttackCard('red-1', 5);
    const state = makeTurnState(makeCombatState(COLOSSEUM_BONEREAVER_T1, [card]));
    const after = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'red-1',
      playerId: 'p0',
    });
    expect(COLOSSEUM_BONEREAVER_T1.hp - after.combat.boss.hp).toBe(5);
  });

  it('second attack of same kind against Bonereaver T1 is reduced by 1', () => {
    const card1 = makeAttackCard('red-1', 5);
    const card2 = makeAttackCard('red-2', 5);
    const state = makeTurnState(makeCombatState(COLOSSEUM_BONEREAVER_T1, [card1, card2]));
    const after1 = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'red-1',
      playerId: 'p0',
    });
    const after2 = combatTurnReducer(after1, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'red-2',
      playerId: 'p0',
    });
    // First play: 5 damage; second play: 5-1=4 damage.
    expect(COLOSSEUM_BONEREAVER_T1.hp - after1.combat.boss.hp).toBe(5);
    expect(after1.combat.boss.hp - after2.combat.boss.hp).toBe(4);
  });
});

describe('COLOSSEUM_CHIMERA_T2 (penalty:2) — end-to-end Adaptive penalty', () => {
  it('COLOSSEUM_CHIMERA_T2 has archetype duel and adaptive penalty=2', () => {
    expect(COLOSSEUM_CHIMERA_T2.archetype).toBe('duel');
    const adaptiveTag = COLOSSEUM_CHIMERA_T2.stateTags?.find((t) => t.kind === 'adaptive');
    if (!adaptiveTag || adaptiveTag.kind !== 'adaptive') throw new Error('expected adaptive tag');
    expect(adaptiveTag.penalty).toBe(2);
  });

  it('second attack of same kind against Chimera T2 is reduced by 2', () => {
    const card1 = makeAttackCard('red-1', 6);
    const card2 = makeAttackCard('red-2', 6);
    const state = makeTurnState(makeCombatState(COLOSSEUM_CHIMERA_T2, [card1, card2]));
    const after1 = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'red-1',
      playerId: 'p0',
    });
    const after2 = combatTurnReducer(after1, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'red-2',
      playerId: 'p0',
    });
    expect(COLOSSEUM_CHIMERA_T2.hp - after1.combat.boss.hp).toBe(6);
    expect(after1.combat.boss.hp - after2.combat.boss.hp).toBe(4); // 6 - 2
  });
});

// ---------------------------------------------------------------------------
// 5. Zone-gating regression — zone duel boss without allowlist activation
// ---------------------------------------------------------------------------

describe('zone-gating regression — duel zone boss without allowlist activation', () => {
  it('hollow-effigy has a duel spec in ZONE_BOSS_SPECS', () => {
    const spec = ZONE_BOSS_SPECS['hollow-effigy'];
    expect(spec.archetype).toBe('duel');
    const adaptiveTag = spec.stateTags[0];
    if (adaptiveTag.kind !== 'adaptive') throw new Error('expected adaptive tag');
    expect(adaptiveTag.penalty).toBe(2);
  });

  it('silver-chimera has a duel spec with penalty=3', () => {
    const spec = ZONE_BOSS_SPECS['silver-chimera'];
    expect(spec.archetype).toBe('duel');
    const adaptiveTag = spec.stateTags[0];
    if (adaptiveTag.kind !== 'adaptive') throw new Error('expected adaptive tag');
    expect(adaptiveTag.penalty).toBe(3);
  });

  it('unactivated zone boss (no archetype) returns null from applyDuelAdaptivePenalty (no penalty)', () => {
    // Simulate a zone duel boss that has NOT been activated via
    // KEYWORD_VOCABULARY_ZONE_ALLOWLIST — enterCombatAction did NOT
    // merge the ZONE_BOSS_SPECS spec, so the boss has no
    // archetype:'duel' and no stateTags.
    const unactivated: CombatBoss = {
      hp: 20,
      hpMax: 20,
      attackPattern: BOSS_PATTERN,
      sourceCardId: 'hollow-effigy',
      // No archetype, no stateTags — zone boss before allowlist activation.
    };

    // applyDuelAdaptivePenalty must return null (fast no-op) because
    // archetype !== 'duel'.
    const result = applyDuelAdaptivePenalty(unactivated, ATTACK_EFFECT, undefined);
    expect(result).toBeNull();
  });

  it('the production KEYWORD_VOCABULARY_ZONE_ALLOWLIST is empty — zone activation is off by default', () => {
    expect(KEYWORD_VOCABULARY_ZONE_ALLOWLIST.size).toBe(0);
  });
});
