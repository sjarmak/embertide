/**
 * Smoke tests for the v2.1 Combat schema (u-8a).
 *
 * These tests are TYPE-ORIENTED — they prove that each exported type
 * accepts a structurally-correct literal and that the discriminated
 * unions (`CombatEffect`, `CombatOnDefeatEffect`, `CombatAction`) are
 * exhaustive under `never`-checked switches. Runtime behaviour lands
 * in u-8b; nothing in this file exercises a reducer.
 */
import { describe, expect, it } from 'vitest';
import type {
  BattlefieldCard,
  BossAttackPattern,
  CombatBoss,
  CombatEffect,
  CombatEffectKind,
  CombatEntryContext,
  CombatOnDefeatEffect,
  CombatState,
} from './combat';
import type { Card } from './card';
import type {
  CombatAction,
  CombatEnterAction,
  CombatResolveLossAction,
  CombatResolveWinAction,
} from '../store/gameStore';
import type { KidGameState } from '../store/types';

// Narrow exhaustiveness helper (compile-time check). If a new `kind`
// is added to CombatEffect without updating consumer switches, the
// `_exhaustive: never` assignment fails to compile.
function effectKind(e: CombatEffect): CombatEffectKind {
  switch (e.kind) {
    case 'combat-attack':
      return e.kind;
    case 'combat-absorb':
      return e.kind;
    case 'combat-heal':
      return e.kind;
    case 'combat-draw':
      return e.kind;
    case 'combat-multishot':
      return e.kind;
    case 'combat-attack-stun':
      return e.kind;
    case 'combat-weaken':
      return e.kind;
    case 'combat-vulnerable':
      return e.kind;
    default: {
      const _exhaustive: never = e;
      return _exhaustive;
    }
  }
}

function onDefeatKind(e: CombatOnDefeatEffect): CombatOnDefeatEffect['kind'] {
  switch (e.kind) {
    case 'wisp-drop':
      return e.kind;
    case 'shard-grant':
      return e.kind;
    case 'none':
      return e.kind;
    default: {
      const _exhaustive: never = e;
      return _exhaustive;
    }
  }
}

function actionType(a: CombatAction): CombatAction['type'] {
  switch (a.type) {
    case 'COMBAT_ENTER':
      return a.type;
    case 'COMBAT_RESOLVE_WIN':
      return a.type;
    case 'COMBAT_RESOLVE_LOSS':
      return a.type;
    default: {
      const _exhaustive: never = a;
      return _exhaustive;
    }
  }
}

describe('u-8a combat schema — type-level smoke tests', () => {
  it('accepts a fully-populated CombatState literal', () => {
    const entryContext: CombatEntryContext = {
      bossCardId: 'craghorn',
      combatEntryTurn: 3,
      attackerPlayerIds: ['p0', 'p1'],
      engagementSource: 'fightMonster',
      entrySource: 'field',
    };

    const pattern: BossAttackPattern = {
      damagePerTurn: 2,
      targeting: 'player-hp',
      onDefeatEffect: { kind: 'wisp-drop' },
    };

    const boss: CombatBoss = {
      hp: 12,
      hpMax: 12,
      attackPattern: pattern,
      sourceCardId: 'craghorn',
    };

    const battlefieldCard: BattlefieldCard = {
      cardId: 'tower-shield',
      hp: 3,
      hpMax: 3,
      combatEffectId: 'combat-absorb:3',
    };

    const combatDeck: readonly Card[] = [];

    const state: CombatState = {
      boss,
      combatDeck,
      combatHand: [],
      combatDiscard: [],
      battlefield: [battlefieldCard],
      turnIndex: 0,
      activeActor: 'players',
      entryContext,
    };

    expect(state.boss.hp).toBe(12);
    expect(state.activeActor).toBe('players');
    expect(state.battlefield).toHaveLength(1);
  });

  it('CombatEffect union is exhaustive and each kind narrows', () => {
    const effects: readonly CombatEffect[] = [
      { kind: 'combat-attack', damage: 4 },
      { kind: 'combat-absorb', hp: 3 },
      { kind: 'combat-heal', amount: 2 },
      { kind: 'combat-draw', count: 1 },
      { kind: 'combat-multishot', damage: 2, shots: 3 },
    ];
    const kinds = effects.map(effectKind);
    expect(kinds).toEqual([
      'combat-attack',
      'combat-absorb',
      'combat-heal',
      'combat-draw',
      'combat-multishot',
    ]);
  });

  it('CombatOnDefeatEffect union supports wisp, shard-grant, and none', () => {
    const variants: readonly CombatOnDefeatEffect[] = [
      { kind: 'wisp-drop' },
      { kind: 'shard-grant', shards: ['power', 'courage', 'wisdom'] },
      { kind: 'none' },
    ];
    expect(variants.map(onDefeatKind)).toEqual(['wisp-drop', 'shard-grant', 'none']);
  });

  it('CombatAction union carries all three v2.1 discriminants', () => {
    const enter: CombatEnterAction = {
      type: 'COMBAT_ENTER',
      context: {
        bossCardId: 'vurmox',
        combatEntryTurn: 11,
        attackerPlayerIds: ['p0'],
        engagementSource: 'fightMonster',
        entrySource: 'field',
      },
      boss: {
        hp: 20,
        hpMax: 20,
        attackPattern: {
          damagePerTurn: 3,
          targeting: 'battlefield-then-player',
          onDefeatEffect: { kind: 'shard-grant', shards: ['power'] },
        },
        sourceCardId: 'vurmox',
      },
      combatDeck: [],
    };
    const win: CombatResolveWinAction = {
      type: 'COMBAT_RESOLVE_WIN',
      heartsToAttackers: { p0: 1, p1: 0 },
      wispDropTarget: null,
      shardGrants: ['power'],
      zoneAdvance: true,
      bossKey: null,
    };
    const loss: CombatResolveLossAction = { type: 'COMBAT_RESOLVE_LOSS' };

    const actions: readonly CombatAction[] = [enter, win, loss];
    expect(actions.map(actionType)).toEqual([
      'COMBAT_ENTER',
      'COMBAT_RESOLVE_WIN',
      'COMBAT_RESOLVE_LOSS',
    ]);
  });

  it('KidGameState.activeCombat accepts null and a valid CombatState', () => {
    // The purpose of this test is the compile-time check; we only
    // assert that the two literal shapes are assignable to the field.
    const noCombat: Pick<KidGameState, 'activeCombat'> = {
      activeCombat: null,
    };
    const inCombat: Pick<KidGameState, 'activeCombat'> = {
      activeCombat: {
        boss: {
          hp: 1,
          hpMax: 1,
          attackPattern: {
            damagePerTurn: 1,
            targeting: 'aoe',
            onDefeatEffect: null,
          },
          sourceCardId: 'boulderkin',
        },
        combatDeck: [],
        combatHand: [],
        combatDiscard: [],
        battlefield: [],
        turnIndex: 0,
        activeActor: 'boss',
        entryContext: {
          bossCardId: 'boulderkin',
          combatEntryTurn: 1,
          attackerPlayerIds: ['p0'],
          engagementSource: 'defeatAlwaysAvailableMonster',
          entrySource: 'field',
        },
      },
    };
    expect(noCombat.activeCombat).toBeNull();
    expect(inCombat.activeCombat).not.toBeNull();
  });
});
