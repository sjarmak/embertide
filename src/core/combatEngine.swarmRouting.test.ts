/**
 * Integration coverage for the Swarm-archetype damage router as wired
 * into `applyPlayerEffect` (embertide-ki0o, sub of lhlo + 4hr1).
 *
 * Verifies the full Palegrasp (T2) combat scenario end-to-end:
 *  - Player attacks land on the first non-defeated finger.
 *  - Once all fingers are downed, attacks land on the central head.
 *  - WIN (`terminal: 'win'`) fires only after every finger is defeated
 *    AND the head HP drops to 0.
 *  - Multishot per-shot routing handles minion-down + spillover-to-head
 *    boundary correctly without rotating into the head while fingers
 *    still stand.
 *
 * Companion to `src/core/combat/swarmRouting.test.ts`, which covers the
 * pure helper unit cases.
 */

import { describe, expect, it } from 'vitest';
import type { Card } from '../types/card';
import type {
  BossAttackPattern,
  BossLayer,
  BossStateSwarm,
  CombatBoss,
  CombatEntryContext,
  CombatState,
} from '../types/combat';
import { combatTurnReducer, type CombatTurnState } from './combatEngine';
import { makeKidPlayer } from '../testing/stateFixtures';

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

const ENTRY_CTX: CombatEntryContext = {
  bossCardId: 'palegrasp',
  combatEntryTurn: 4,
  attackerPlayerIds: ['p0'],
  engagementSource: 'fightMonster',
  entrySource: 'field',
};

const BATTLEFIELD_PATTERN: BossAttackPattern = {
  damagePerTurn: 0,
  targeting: 'battlefield-then-player',
  onDefeatEffect: { kind: 'wisp-drop' },
};

function makeMinion(id: string, hp = 4): BossLayer {
  return { id, name: `Grasping Finger ${id}`, hp, hpMax: 4, defeated: false };
}

function makePalegrasp(
  args: {
    hp?: number;
    minions?: readonly BossLayer[];
  } = {},
): CombatBoss {
  const swarmTag: BossStateSwarm = {
    kind: 'swarm',
    minions: args.minions ?? [
      makeMinion('finger-1'),
      makeMinion('finger-2'),
      makeMinion('finger-3'),
    ],
  };
  return {
    hp: args.hp ?? 12,
    hpMax: 12,
    attackPattern: BATTLEFIELD_PATTERN,
    sourceCardId: 'palegrasp',
    archetype: 'swarm',
    stateTags: [swarmTag],
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

function getSwarmMinions(boss: CombatBoss): readonly BossLayer[] {
  const tag = boss.stateTags?.find((t) => t.kind === 'swarm');
  if (!tag || tag.kind !== 'swarm') {
    throw new Error('expected swarm tag');
  }
  return tag.minions;
}

// ---------------------------------------------------------------------------
// combat-attack — single-target routing through a Palegrasp boss.
// ---------------------------------------------------------------------------

describe('Palegrasp combat — combat-attack routes through swarm minions (A2)', () => {
  it('A4a: a 3-damage attack damages finger-1 only; head HP untouched', () => {
    const card = makeAttackCard('attack-3', 3);
    const state = makeTurnState(makeCombat(makePalegrasp(), [card]));
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'attack-3',
      playerId: 'p0',
    });
    expect(next.combat.boss.hp).toBe(12);
    const minions = getSwarmMinions(next.combat.boss);
    expect(minions[0].hp).toBe(1);
    expect(minions[0].defeated).toBe(false);
    expect(minions[1].hp).toBe(4);
    expect(minions[2].hp).toBe(4);
  });

  it('A4b: a 4-damage attack downs finger-1; residual is wasted (no spillover)', () => {
    const card = makeAttackCard('attack-4', 4);
    const state = makeTurnState(makeCombat(makePalegrasp(), [card]));
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'attack-4',
      playerId: 'p0',
    });
    expect(next.combat.boss.hp).toBe(12);
    const minions = getSwarmMinions(next.combat.boss);
    expect(minions[0].defeated).toBe(true);
    expect(minions[1].hp).toBe(4);
  });

  it('A3 + A5: full Palegrasp walkthrough — fingers fall, then head; WIN fires only on full clear', () => {
    // Six plays of 4-damage attacks: 3 to clear the fingers (each finger
    // 4 hp → no spillover), then 3 to drop the central head (12 hp).
    // COMBAT_PLAYS_PER_TURN caps each players-turn at 3 plays, so we
    // bracket the burst with PLAYER_PASS / BOSS_RESOLVE to flip back to
    // players-turn after the boss attacks.
    const card1 = makeAttackCard('a1', 4);
    const card2 = makeAttackCard('a2', 4);
    const card3 = makeAttackCard('a3', 4);
    const card4 = makeAttackCard('a4', 4); // partial head
    const card5 = makeAttackCard('a5', 4); // partial head
    const card6 = makeAttackCard('a6', 4); // finishing head

    // Player needs enough HP to survive 1 Palegrasp boss-turn
    // (battlefield-then-player @ dpt=3 → 7hp left, no LOSS).
    const combat = makeCombat(makePalegrasp(), [card1, card2, card3, card4, card5, card6]);
    let s: CombatTurnState = {
      combat,
      players: [makeKidPlayer({ id: 'p0', hp: 14 })],
      terminal: null,
      playsThisTurn: 0,
    };

    // Turn 1, play 1 — Finger 1 down.
    s = combatTurnReducer(s, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'a1',
      playerId: 'p0',
    });
    expect(s.terminal).toBeNull();
    expect(s.combat.boss.hp).toBe(12);
    expect(getSwarmMinions(s.combat.boss)[0].defeated).toBe(true);
    expect(getSwarmMinions(s.combat.boss)[1].defeated).toBe(false);

    // Turn 1, play 2 — Finger 2 down.
    s = combatTurnReducer(s, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'a2',
      playerId: 'p0',
    });
    expect(s.terminal).toBeNull();
    expect(s.combat.boss.hp).toBe(12);
    expect(getSwarmMinions(s.combat.boss)[1].defeated).toBe(true);
    expect(getSwarmMinions(s.combat.boss)[2].defeated).toBe(false);

    // Turn 1, play 3 — Finger 3 down. All minions defeated; head still 12.
    s = combatTurnReducer(s, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'a3',
      playerId: 'p0',
    });
    expect(s.terminal).toBeNull();
    expect(s.combat.boss.hp).toBe(12);
    expect(getSwarmMinions(s.combat.boss).every((m) => m.defeated)).toBe(true);

    // End players-turn → boss-turn → flip back to players-turn so we can
    // burn 3 more plays into the head.
    s = combatTurnReducer(s, { type: 'PLAYER_PASS' });
    s = combatTurnReducer(s, { type: 'BOSS_RESOLVE' });
    expect(s.terminal).toBeNull();
    expect(s.combat.activeActor).toBe('players');

    // Turn 2, play 1 — Head 12 → 8.
    s = combatTurnReducer(s, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'a4',
      playerId: 'p0',
    });
    expect(s.terminal).toBeNull();
    expect(s.combat.boss.hp).toBe(8);

    // Turn 2, play 2 — Head 8 → 4.
    s = combatTurnReducer(s, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'a5',
      playerId: 'p0',
    });
    expect(s.terminal).toBeNull();
    expect(s.combat.boss.hp).toBe(4);

    // Turn 2, play 3 — Head 4 → 0; WIN fires.
    s = combatTurnReducer(s, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'a6',
      playerId: 'p0',
    });
    expect(s.terminal).toBe('win');
    expect(s.combat.boss.hp).toBe(0);
  });

  it('A3: WIN does NOT fire when minions absorb all damage (head still standing)', () => {
    const card = makeAttackCard('attack-12', 12); // overkill on finger-1 only
    const state = makeTurnState(makeCombat(makePalegrasp(), [card]));
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'attack-12',
      playerId: 'p0',
    });
    expect(next.terminal).toBeNull();
    expect(next.combat.boss.hp).toBe(12);
    const minions = getSwarmMinions(next.combat.boss);
    expect(minions[0].defeated).toBe(true);
    expect(minions[1].defeated).toBe(false);
    expect(minions[2].defeated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// combat-attack-stun — stuns boss AND routes damage through swarm.
// ---------------------------------------------------------------------------

describe('Palegrasp combat — combat-attack-stun routes damage through swarm AND stuns (A2)', () => {
  it('damage hits the first finger; bossStunTurns still accumulates', () => {
    const card = makeStunCard('stun-3', 3, 1);
    const state = makeTurnState(makeCombat(makePalegrasp(), [card]));
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'stun-3',
      playerId: 'p0',
    });
    expect(next.combat.boss.hp).toBe(12);
    expect(getSwarmMinions(next.combat.boss)[0].hp).toBe(1);
    expect(next.combat.bossStunTurns).toBe(1);
  });

  it('damage hits boss.hp once all fingers are down', () => {
    const allDown: readonly BossLayer[] = [
      { id: 'finger-1', name: 'f1', hp: 0, hpMax: 4, defeated: true },
      { id: 'finger-2', name: 'f2', hp: 0, hpMax: 4, defeated: true },
      { id: 'finger-3', name: 'f3', hp: 0, hpMax: 4, defeated: true },
    ];
    const card = makeStunCard('stun-5', 5, 1);
    const state = makeTurnState(makeCombat(makePalegrasp({ hp: 12, minions: allDown }), [card]));
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'stun-5',
      playerId: 'p0',
    });
    expect(next.combat.boss.hp).toBe(7);
    expect(next.combat.bossStunTurns).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// combat-multishot — per-shot routing through swarm minions.
// ---------------------------------------------------------------------------

describe('Palegrasp combat — combat-multishot per-shot routes through swarm (A2)', () => {
  it('per-shot retarget: shot 1 chips finger-1 (4→2), shot 2 downs finger-1 (2→0), shot 3 routes to finger-2 (4→2); finger-3 + head untouched', () => {
    const card = makeMultishotCard('multi-2x3', 2, 3);
    const state = makeTurnState(makeCombat(makePalegrasp(), [card]));
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'multi-2x3',
      playerId: 'p0',
    });
    // Shot 1 → finger-1 hp 4→2. Shot 2 → finger-1 hp 2→0 (downed).
    // Shot 3 → finger-2 (next non-defeated) hp 4→2. Single-target rule:
    // each shot is its own attack and re-targets the first non-defeated
    // minion.
    expect(next.combat.boss.hp).toBe(12);
    const minions = getSwarmMinions(next.combat.boss);
    expect(minions[0].hp).toBe(0);
    expect(minions[0].defeated).toBe(true);
    expect(minions[1].hp).toBe(2);
    expect(minions[1].defeated).toBe(false);
    expect(minions[2].hp).toBe(4);
  });

  it('multishot continues into head once minions are all down (early-out fires only on win)', () => {
    const oneFingerLeft: readonly BossLayer[] = [
      { id: 'finger-1', name: 'f1', hp: 0, hpMax: 4, defeated: true },
      { id: 'finger-2', name: 'f2', hp: 0, hpMax: 4, defeated: true },
      { id: 'finger-3', name: 'f3', hp: 4, hpMax: 4, defeated: false },
    ];
    const card = makeMultishotCard('multi-4x4', 4, 4);
    const state = makeTurnState(
      makeCombat(makePalegrasp({ hp: 12, minions: oneFingerLeft }), [card]),
    );
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'multi-4x4',
      playerId: 'p0',
    });
    // Shot 1 → finger-3 hp 4→0 (downed). Shots 2-4 → head 12→8→4→0.
    expect(next.combat.boss.hp).toBe(0);
    expect(next.terminal).toBe('win');
  });
});

// ---------------------------------------------------------------------------
// Integration: swarm-routing + exposed-bonus through the production dispatch
// (embertide-n5ij — wave-up over the helper-level 4hr1.11 test).
// ---------------------------------------------------------------------------
//
// 4hr1.11 (in `src/core/combat/swarmRouting.test.ts`) asserts the helper
// composition `effect.damage + exposedBonusFor(boss)` → `routeSwarmAttack`
// is correct. That test calls `routeSwarmAttack` directly and so cannot
// detect divergences if `applyPlayerEffect`'s `combat-attack` branch ever
// changes the order (e.g. routes first, then adds the bonus only on the
// non-swarm path) — the bonus would silently disappear for swarm bosses
// while every helper-level test stays green.
//
// This test sits one level UP: it drives `combatTurnReducer` →
// `reducePlayerPlayCard` → `applyPlayerEffect('combat-attack')` →
// `applySingleTargetBossDamage`, proving the production dispatch wires
// the bonus through the swarm wrapper. Designer note from 4hr1.11
// reviewer: a Swarm boss + `exposed` tag is synthetically paired (the
// data layer ships exposed only on Eye archetypes) — the point is to
// exercise the dispatch path, not to mirror data-layer reality.
describe('combatTurnReducer — combat-attack dispatch composes exposed bonus through swarm router (embertide-n5ij)', () => {
  it('finger-1 absorbs baseDamage + exposed.bonus in one routed hit', () => {
    const baseDamage = 4;
    const bonus = 1;
    const card = makeAttackCard('attack-base', baseDamage);

    // Synthetic boss: Palegrasp swarm + manually injected `exposed`
    // tag. Drives the `applyPlayerEffect` 'combat-attack' branch
    // (which composes `effect.damage + exposedBonusFor(boss)` and
    // hands the total to `applySingleTargetBossDamage`).
    const swarmTag: BossStateSwarm = {
      kind: 'swarm',
      minions: [makeMinion('finger-1', 6), makeMinion('finger-2'), makeMinion('finger-3')],
    };
    const boss: CombatBoss = {
      hp: 12,
      hpMax: 12,
      attackPattern: BATTLEFIELD_PATTERN,
      sourceCardId: 'palegrasp',
      archetype: 'swarm',
      stateTags: [swarmTag, { kind: 'exposed', bonus }],
    };

    const state = makeTurnState(makeCombat(boss, [card]));
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: 'attack-base',
      playerId: 'p0',
    });

    // baseDamage (4) + bonus (1) = 5 routes onto finger-1 (first
    // non-defeated minion). Head untouched; finger-2 / finger-3
    // untouched (no spillover).
    const minions = getSwarmMinions(next.combat.boss);
    expect(minions[0].id).toBe('finger-1');
    expect(minions[0].hp).toBe(6 - (baseDamage + bonus));
    expect(minions[0].defeated).toBe(false);
    expect(minions[1].hp).toBe(4);
    expect(minions[2].hp).toBe(4);
    expect(next.combat.boss.hp).toBe(12);
  });
});
