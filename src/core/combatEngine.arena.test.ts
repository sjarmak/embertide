/**
 * Arena Effect + Hazard coverage (embertide-lhlo.26, sub of lhlo).
 *
 * The colosseum's identity primitive has two halves, both exercised
 * here:
 *
 *   - **Arena Effect** — a global damage modifier read at BOTH damage
 *     directions (`arenaDamageModifier`): player→boss in
 *     `applyPlayerEffect` and boss→player in `reduceBossResolve`.
 *   - **Hazard** — an end-of-boss-turn effect (`applyArenaHazards`)
 *     that fires once per boss-turn for `remainingTurns` turns.
 *
 * Pure-helper tests pin the read/tick semantics directly; integration
 * tests drive the real `combatTurnReducer` so the wiring at the damage
 * sites and the end-of-turn pass is covered end-to-end.
 */

import { describe, it, expect } from 'vitest';
import type { Card } from '../types/card';
import type {
  ArenaState,
  BossAttackPattern,
  CombatBoss,
  CombatEntryContext,
  CombatState,
} from '../types/combat';
import {
  applyArenaHazards,
  arenaDamageModifier,
  combatTurnReducer,
  type CombatTurnState,
} from './combatEngine';
import { makeKidPlayer } from '../testing/stateFixtures';
import { COLOSSEUM_CRAGHORN_T1 } from '../data/colosseum/tier1';
import { COLOSSEUM_CRAGHORN_ARENA } from '../data/colosseum/arenas';

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

const ENTRY_CTX: CombatEntryContext = {
  bossCardId: 'craghorn',
  combatEntryTurn: 4,
  attackerPlayerIds: ['p0'],
  engagementSource: 'fightMonster',
  entrySource: 'colosseum-slot',
};

/** Boss that deals a fixed flat amount per turn and never flips state. */
function makeBoss(damagePerTurn: number, hp = 30): CombatBoss {
  const pattern: BossAttackPattern = {
    damagePerTurn,
    targeting: 'player-hp',
    onDefeatEffect: { kind: 'wisp-drop' },
  };
  return { hp, hpMax: 30, attackPattern: pattern, sourceCardId: 'craghorn' };
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

function makeCombat(args: {
  boss: CombatBoss;
  arena?: ArenaState;
  hand?: readonly Card[];
  activeActor?: 'players' | 'boss';
}): CombatState {
  return {
    boss: args.boss,
    combatDeck: [],
    combatHand: args.hand ?? [],
    combatDiscard: [],
    battlefield: [],
    turnIndex: 0,
    activeActor: args.activeActor ?? 'players',
    entryContext: ENTRY_CTX,
    combatLog: [],
    playsThisTurn: 0,
    bossStunTurns: 0,
    tideGaugeSnapshot: 0,
    echoQueue: null,
    ...(args.arena !== undefined ? { arena: args.arena } : {}),
  };
}

function makeTurnState(combat: CombatState, playerHp = 20): CombatTurnState {
  return {
    combat,
    players: [makeKidPlayer({ id: 'p0', hp: playerHp })],
    terminal: null,
    playsThisTurn: 0,
  };
}

const PLUS_ONE_EFFECT: ArenaState = {
  name: 'Quaking Coliseum',
  effects: [{ kind: 'global-damage-modifier', amount: 1, label: '+1 to all attacks' }],
  hazards: [],
};

// ---------------------------------------------------------------------------
// Unit — arenaDamageModifier pure helper.
// ---------------------------------------------------------------------------

describe('arenaDamageModifier — pure helper', () => {
  it('returns 0 when the combat carries no arena', () => {
    expect(arenaDamageModifier(makeCombat({ boss: makeBoss(0) }))).toBe(0);
  });

  it('returns 0 when the arena declares no effects', () => {
    const arena: ArenaState = { name: 'Empty', effects: [], hazards: [] };
    expect(arenaDamageModifier(makeCombat({ boss: makeBoss(0), arena }))).toBe(0);
  });

  it('sums global-damage-modifier amounts (including negative)', () => {
    const arena: ArenaState = {
      name: 'Mixed',
      effects: [
        { kind: 'global-damage-modifier', amount: 2, label: 'a' },
        { kind: 'global-damage-modifier', amount: -1, label: 'b' },
      ],
      hazards: [],
    };
    expect(arenaDamageModifier(makeCombat({ boss: makeBoss(0), arena }))).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Unit — applyArenaHazards pure helper.
// ---------------------------------------------------------------------------

describe('applyArenaHazards — pure helper', () => {
  it('is a no-op when there is no arena', () => {
    const players = [makeKidPlayer({ id: 'p0', hp: 10 })];
    const result = applyArenaHazards(undefined, players);
    expect(result.arena).toBeUndefined();
    expect(result.players).toBe(players);
    expect(result.logs).toEqual([]);
  });

  it('is a no-op when the arena has no hazards', () => {
    const arena: ArenaState = { name: 'No hazards', effects: [], hazards: [] };
    const players = [makeKidPlayer({ id: 'p0', hp: 10 })];
    const result = applyArenaHazards(arena, players);
    expect(result.players).toBe(players);
    expect(result.logs).toEqual([]);
  });

  it('fires the hazard once and decrements remainingTurns', () => {
    const arena: ArenaState = {
      name: 'Rubble',
      effects: [],
      hazards: [{ kind: 'eot-damage', amount: 2, remainingTurns: 3, label: 'Falling Rubble' }],
    };
    const players = [makeKidPlayer({ id: 'p0', hp: 10 })];
    const result = applyArenaHazards(arena, players);
    expect(result.players[0].hp).toBe(8);
    expect(result.arena?.hazards).toEqual([
      { kind: 'eot-damage', amount: 2, remainingTurns: 2, label: 'Falling Rubble' },
    ]);
    expect(result.logs).toEqual(['Falling Rubble: 2 damage to all heroes.']);
  });

  it('fires exactly N times for remainingTurns=N, then prunes the hazard', () => {
    let arena: ArenaState | undefined = {
      name: 'Rubble',
      effects: [],
      hazards: [{ kind: 'eot-damage', amount: 1, remainingTurns: 3, label: 'Rubble' }],
    };
    let players: readonly ReturnType<typeof makeKidPlayer>[] = [
      makeKidPlayer({ id: 'p0', hp: 10 }),
    ];

    const hpTrail: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const result = applyArenaHazards(arena, players);
      arena = result.arena;
      players = result.players;
      hpTrail.push(players[0].hp);
    }

    // 3 ticks of 1 damage (10→9→8→7), then the hazard is spent and the
    // last two ticks are no-ops.
    expect(hpTrail).toEqual([9, 8, 7, 7, 7]);
    expect(arena?.hazards).toEqual([]);
  });

  it('damages every non-downed player on each tick', () => {
    const arena: ArenaState = {
      name: 'Rubble',
      effects: [],
      hazards: [{ kind: 'eot-damage', amount: 1, remainingTurns: 1, label: 'Rubble' }],
    };
    const players = [makeKidPlayer({ id: 'p0', hp: 10 }), makeKidPlayer({ id: 'p1', hp: 8 })];
    const result = applyArenaHazards(arena, players);
    expect(result.players.map((p) => p.hp)).toEqual([9, 7]);
  });

  it('treats a non-positive hazard amount as an inert tick (no damage, no log)', () => {
    const arena: ArenaState = {
      name: 'Malformed',
      effects: [],
      hazards: [{ kind: 'eot-damage', amount: 0, remainingTurns: 2, label: 'Nothing' }],
    };
    const players = [makeKidPlayer({ id: 'p0', hp: 10 })];
    const result = applyArenaHazards(arena, players);
    expect(result.players[0].hp).toBe(10);
    expect(result.logs).toEqual([]);
    // The duration still counts down so a malformed hazard can't linger.
    expect(result.arena?.hazards).toEqual([
      { kind: 'eot-damage', amount: 0, remainingTurns: 1, label: 'Nothing' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Integration — global modifier visible to BOTH damage directions.
// ---------------------------------------------------------------------------

describe('arena global modifier — visible to both player and boss damage', () => {
  it('stacks onto player→boss attack damage', () => {
    const card = makeAttackCard('attack-3', 3);
    const combat = makeCombat({ boss: makeBoss(0), arena: PLUS_ONE_EFFECT, hand: [card] });
    const next = combatTurnReducer(makeTurnState(combat), {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'attack-3',
      playerId: 'p0',
    });
    // 30 - (3 played + 1 arena) = 26.
    expect(next.combat.boss.hp).toBe(26);
  });

  it('without an arena the same card deals only its printed damage', () => {
    const card = makeAttackCard('attack-3', 3);
    const combat = makeCombat({ boss: makeBoss(0), hand: [card] });
    const next = combatTurnReducer(makeTurnState(combat), {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'attack-3',
      playerId: 'p0',
    });
    expect(next.combat.boss.hp).toBe(27);
  });

  it('stacks onto boss→player attack damage', () => {
    const combat = makeCombat({
      boss: makeBoss(2),
      arena: PLUS_ONE_EFFECT,
      activeActor: 'boss',
    });
    const next = combatTurnReducer(makeTurnState(combat, 20), { type: 'BOSS_RESOLVE' });
    // 20 - (2 dpt + 1 arena) = 17.
    expect(next.players[0].hp).toBe(17);
  });

  it('clamps a net-negative arena so the boss attack can never heal a player', () => {
    const dampening: ArenaState = {
      name: 'Lull',
      effects: [{ kind: 'global-damage-modifier', amount: -5, label: 'lull' }],
      hazards: [],
    };
    const combat = makeCombat({ boss: makeBoss(2), arena: dampening, activeActor: 'boss' });
    const next = combatTurnReducer(makeTurnState(combat, 20), { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hp).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Integration — hazard fires once per EOT for the duration.
// ---------------------------------------------------------------------------

describe('arena hazard — fires once per boss-turn EOT', () => {
  /** Drive a single boss-turn, flipping the actor back to 'boss' first. */
  function bossTurn(state: CombatTurnState): CombatTurnState {
    const boss: CombatState = { ...state.combat, activeActor: 'boss' };
    return combatTurnReducer({ ...state, combat: boss, terminal: null }, { type: 'BOSS_RESOLVE' });
  }

  it('ticks exactly N times across N boss-turns, then subsides', () => {
    const arena: ArenaState = {
      name: 'Rubble Pit',
      effects: [],
      hazards: [{ kind: 'eot-damage', amount: 1, remainingTurns: 3, label: 'Falling Rubble' }],
    };
    // damagePerTurn 0 isolates the hazard as the only source of damage.
    let state = makeTurnState(makeCombat({ boss: makeBoss(0), arena, activeActor: 'boss' }), 20);

    const hpTrail: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      state = bossTurn(state);
      hpTrail.push(state.players[0].hp);
    }

    // 3 hazard ticks (20→19→18→17), then the hazard is spent.
    expect(hpTrail).toEqual([19, 18, 17, 17]);
    expect(state.combat.arena?.hazards).toEqual([]);
  });

  it('writes a combat-log line on each hazard tick', () => {
    const arena: ArenaState = {
      name: 'Rubble Pit',
      effects: [],
      hazards: [{ kind: 'eot-damage', amount: 1, remainingTurns: 1, label: 'Falling Rubble' }],
    };
    const state = makeTurnState(makeCombat({ boss: makeBoss(0), arena, activeActor: 'boss' }), 20);
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.combat.combatLog).toContain('Falling Rubble: 1 damage to all heroes.');
  });

  it('flags terminal LOSS when a hazard downs the last player (normal branch)', () => {
    const arena: ArenaState = {
      name: 'Rubble Pit',
      effects: [],
      hazards: [{ kind: 'eot-damage', amount: 2, remainingTurns: 1, label: 'Rubble' }],
    };
    // Boss deals 0 directly; the hazard alone takes the last 2 HP.
    const combat = makeCombat({ boss: makeBoss(0), arena, activeActor: 'boss' });
    const next = combatTurnReducer(makeTurnState(combat, 2), { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hp).toBe(0);
    expect(next.terminal).toBe('loss');
    expect(next.combat.activeActor).toBe('boss');
  });

  it('flags terminal LOSS when a hazard downs the last player on a stun turn', () => {
    const arena: ArenaState = {
      name: 'Rubble Pit',
      effects: [],
      hazards: [{ kind: 'eot-damage', amount: 2, remainingTurns: 1, label: 'Rubble' }],
    };
    const combat: CombatState = {
      ...makeCombat({ boss: makeBoss(5), arena, activeActor: 'boss' }),
      bossStunTurns: 1,
    };
    // Boss attack is skipped by the stun, but the hazard still bites — and
    // it lands the killing blow, so the stun branch must flag LOSS.
    const next = combatTurnReducer(makeTurnState(combat, 2), { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hp).toBe(0);
    expect(next.terminal).toBe('loss');
    expect(next.combat.activeActor).toBe('boss');
    expect(next.combat.bossStunTurns).toBe(0);
  });

  it('ticks the hazard even on a boss-stun turn', () => {
    const arena: ArenaState = {
      name: 'Rubble Pit',
      effects: [],
      hazards: [{ kind: 'eot-damage', amount: 2, remainingTurns: 2, label: 'Rubble' }],
    };
    const combat: CombatState = {
      ...makeCombat({ boss: makeBoss(5), arena, activeActor: 'boss' }),
      bossStunTurns: 1,
    };
    const next = combatTurnReducer(makeTurnState(combat, 20), { type: 'BOSS_RESOLVE' });
    // Boss attack skipped by the stun, but the hazard still bites for 2.
    expect(next.players[0].hp).toBe(18);
    expect(next.combat.bossStunTurns).toBe(0);
    expect(next.combat.arena?.hazards).toEqual([
      { kind: 'eot-damage', amount: 2, remainingTurns: 1, label: 'Rubble' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Integration — the wired Tier-1 Craghorn colosseum slot.
// ---------------------------------------------------------------------------

describe('wired Craghorn colosseum slot (lhlo.26 proof)', () => {
  it('applies both halves of the wired arena in a single boss-turn', () => {
    // Real shipped data: Craghorn tier-1 boss (dpt 2, battlefield-then-player)
    // under the Quaking Coliseum arena (+1 global, Falling Rubble 1/turn×3).
    const combat = makeCombat({
      boss: COLOSSEUM_CRAGHORN_T1,
      arena: COLOSSEUM_CRAGHORN_ARENA,
      activeActor: 'boss',
    });
    const next = combatTurnReducer(makeTurnState(combat, 20), { type: 'BOSS_RESOLVE' });
    // dpt 2 + arena +1 = 3 boss damage, plus 1 Falling Rubble = 4 total.
    expect(next.players[0].hp).toBe(16);
    // The wired hazard ticked down 3 → 2.
    expect(next.combat.arena?.hazards).toEqual([
      { kind: 'eot-damage', amount: 1, remainingTurns: 2, label: 'Falling Rubble' },
    ]);
  });

  it('boosts a player attack on the wired Craghorn slot by the arena effect', () => {
    const card = makeAttackCard('attack-3', 3);
    const combat = makeCombat({
      boss: COLOSSEUM_CRAGHORN_T1,
      arena: COLOSSEUM_CRAGHORN_ARENA,
      hand: [card],
    });
    const next = combatTurnReducer(makeTurnState(combat, 20), {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'attack-3',
      playerId: 'p0',
    });
    // Craghorn starts at 14 hp; 14 - (3 played + 1 arena) = 10. Craghorn is
    // still guarded (cycle threshold 2 not yet tripped) so no exposed
    // bonus stacks on this first play.
    expect(next.combat.boss.hp).toBe(10);
  });
});
