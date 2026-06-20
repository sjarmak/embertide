/**
 * Engine state-machine tests for the combat-weaken and combat-vulnerable
 * keywords (embertide-lhlo.23).
 *
 * Keyword contracts (keyword-glossary §WEAKEN / §VULNERABLE):
 *   - Weaken X: boss's NEXT attack deals X less damage (consumed on
 *     that one boss-turn, then cleared).
 *   - Vulnerable X: boss takes X more damage from ALL player→boss
 *     attack sources until END OF TURN, then cleared.
 *
 * Test coverage:
 *   1. Weaken card increments bossWeakenStacks.
 *   2. BOSS_RESOLVE subtracts bossWeakenStacks from boss damage then
 *      clears the counter (damage reduced on the weakened turn, normal
 *      on the NEXT turn).
 *   3. Multiple Weaken plays stack additively.
 *   4. Vulnerable card increments vulnerableBonus.
 *   5. A subsequent combat-attack in the SAME players-turn deals bonus
 *      damage equal to vulnerableBonus.
 *   6. BOSS_RESOLVE clears vulnerableBonus (EOT), so the next
 *      players-turn starts with no vulnerability bonus.
 *   7. Multiple Vulnerable plays stack additively.
 *   8. Both keywords clear on a stun-skip boss-turn as well.
 *   9. card exercising weaken end-to-end: curse-charm in combat deck.
 *  10. card exercising vulnerable end-to-end: shadow-veil in combat deck.
 */

import { describe, it, expect } from 'vitest';
import type { Card } from '../types/card';
import type { CombatBoss, CombatEntryContext, CombatState } from '../types/combat';
import type { KidPlayer } from '../store/types';
import { combatTurnReducer, type CombatTurnState } from './combatEngine';
import { makeKidPlayer } from '../testing/stateFixtures';

// ---------------------------------------------------------------------------
// Shared fixtures.
// ---------------------------------------------------------------------------

const ENTRY_CTX: CombatEntryContext = {
  bossCardId: 'craghorn',
  combatEntryTurn: 1,
  attackerPlayerIds: ['p0', 'p1'],
  engagementSource: 'fightMonster',
  entrySource: 'field',
};

function makePlayer(overrides: Partial<KidPlayer> = {}): KidPlayer {
  return makeKidPlayer({ id: 'p0', ...overrides });
}

function makeBoss(overrides: Partial<CombatBoss> = {}): CombatBoss {
  return {
    hp: 20,
    hpMax: 20,
    attackPattern: { damagePerTurn: 4, targeting: 'player-hp', onDefeatEffect: null },
    sourceCardId: 'craghorn',
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
    activeActor: 'players',
    entryContext: ENTRY_CTX,
    ...overrides,
  };
}

function makeTurnState(overrides: Partial<CombatTurnState> = {}): CombatTurnState {
  return {
    combat: makeCombat(),
    players: [makePlayer({ id: 'p0', hp: 10 }), makePlayer({ id: 'p1', hp: 10 })],
    terminal: null,
    playsThisTurn: 0,
    ...overrides,
  };
}

// Weaken card fixture: curse-charm with in-card combat effect so
// combatEffectFor resolves via the in-card branch.
const curseCharm: Card = {
  id: 'curse-charm',
  role: 'hero',
  cost: { green: 4 },
  effects: { kind: 'gain', red: 1 },
  combatEffect: { kind: 'combat-weaken', amount: 2 },
};

// Vulnerable card fixture: shadow-veil with in-card combat effect.
const shadowVeil: Card = {
  id: 'shadow-veil',
  role: 'hero',
  cost: { green: 4 },
  effects: { kind: 'gain', green: 1 },
  combatEffect: { kind: 'combat-vulnerable', amount: 3 },
};

// Plain attack card for combo testing.
const attackCard: Card = {
  id: 'test-attack',
  role: 'hero',
  cost: { red: 3 },
  effects: { kind: 'gain', red: 2 },
  combatEffect: { kind: 'combat-attack', damage: 3 },
};

// ---------------------------------------------------------------------------
// combat-weaken: accumulation, consumption, clearing.
// ---------------------------------------------------------------------------

describe('combat-weaken — engine state machine', () => {
  it('PLAYER_PLAY_CARD on a weaken card increments bossWeakenStacks by amount', () => {
    const state = makeTurnState({
      combat: makeCombat({
        combatHand: [curseCharm],
        bossWeakenStacks: 0,
      }),
    });
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: curseCharm.id,
      playerId: 'p0',
    });
    expect(next.combat.bossWeakenStacks).toBe(2);
    expect(next.combat.combatHand).toHaveLength(0);
    expect(next.combat.combatDiscard).toHaveLength(1);
    expect(next.playsThisTurn).toBe(1);
    // Weaken is purely a debuff — boss HP is NOT reduced.
    expect(next.combat.boss.hp).toBe(20);
  });

  it('BOSS_RESOLVE subtracts bossWeakenStacks from boss damage and clears it', () => {
    // Boss deals 4 per turn; Weaken 2 reduces that to 2.
    // Two players at hp=10, player-hp targeting splits evenly: each takes 1.
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        turnIndex: 1,
        bossWeakenStacks: 2,
        boss: makeBoss({
          attackPattern: { damagePerTurn: 4, targeting: 'player-hp', onDefeatEffect: null },
        }),
      }),
      players: [makePlayer({ id: 'p0', hp: 10 }), makePlayer({ id: 'p1', hp: 10 })],
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });

    // 4 - 2 = 2 effective damage; split evenly → 1 per player.
    expect(next.players[0].hp).toBe(9);
    expect(next.players[1].hp).toBe(9);
    // Counter consumed and cleared.
    expect(next.combat.bossWeakenStacks).toBe(0);
    // Turn advanced.
    expect(next.combat.turnIndex).toBe(2);
  });

  it('Weaken is consumed after ONE boss-turn: the NEXT BOSS_RESOLVE attacks at full damage', () => {
    // Prime bossWeakenStacks=2, advance one boss-turn (weakened), then another (full).
    let state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        turnIndex: 0,
        bossWeakenStacks: 2,
        boss: makeBoss({
          attackPattern: { damagePerTurn: 4, targeting: 'player-hp', onDefeatEffect: null },
        }),
      }),
      players: [makePlayer({ id: 'p0', hp: 10 }), makePlayer({ id: 'p1', hp: 10 })],
    });

    // Weakened boss-turn: damage = 4 - 2 = 2, split → 1 each.
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(state.players[0].hp).toBe(9);
    expect(state.players[1].hp).toBe(9);
    expect(state.combat.bossWeakenStacks).toBe(0);
    expect(state.combat.activeActor).toBe('players');

    // Simulate players-turn PASS.
    state = combatTurnReducer(state, { type: 'PLAYER_PASS' });

    // Normal boss-turn: damage = 4, split → 2 each.
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(state.players[0].hp).toBe(7);
    expect(state.players[1].hp).toBe(7);
    expect(state.combat.bossWeakenStacks).toBe(0);
  });

  it('multiple Weaken plays stack additively (bossWeakenStacks is purely additive)', () => {
    const curseCharmB: Card = { ...curseCharm, id: 'curse-charm-2' };
    const state = makeTurnState({
      combat: makeCombat({
        combatHand: [curseCharm, curseCharmB],
        bossWeakenStacks: 0,
      }),
    });
    const afterFirst = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: curseCharm.id,
      playerId: 'p0',
    });
    expect(afterFirst.combat.bossWeakenStacks).toBe(2);

    const afterSecond = combatTurnReducer(afterFirst, {
      type: 'PLAYER_PLAY_CARD',
      cardId: curseCharmB.id,
      playerId: 'p0',
    });
    expect(afterSecond.combat.bossWeakenStacks).toBe(4); // additive
  });

  it('Weaken clamps boss damage to 0 (over-weaken cannot heal boss or players)', () => {
    // Boss deals 2, Weaken 5 — net damage should be 0, not negative.
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        bossWeakenStacks: 5,
        boss: makeBoss({
          attackPattern: { damagePerTurn: 2, targeting: 'player-hp', onDefeatEffect: null },
        }),
      }),
      players: [makePlayer({ id: 'p0', hp: 10 }), makePlayer({ id: 'p1', hp: 10 })],
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // Clamped at 0 → no damage dealt.
    expect(next.players[0].hp).toBe(10);
    expect(next.players[1].hp).toBe(10);
    expect(next.combat.bossWeakenStacks).toBe(0);
  });

  it('curse-charm end-to-end: played from hand, BOSS_RESOLVE sees reduced damage', () => {
    // Full flow: curse-charm in hand, play it, PASS, BOSS_RESOLVE.
    let state = makeTurnState({
      combat: makeCombat({
        combatHand: [curseCharm],
        boss: makeBoss({
          attackPattern: { damagePerTurn: 6, targeting: 'player-hp', onDefeatEffect: null },
        }),
      }),
      players: [makePlayer({ id: 'p0', hp: 10 }), makePlayer({ id: 'p1', hp: 10 })],
    });

    // Play curse-charm (weaken 2).
    state = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: curseCharm.id,
      playerId: 'p0',
    });
    expect(state.combat.bossWeakenStacks).toBe(2);
    expect(state.combat.boss.hp).toBe(20); // no damage from weaken

    // Pass to boss.
    state = combatTurnReducer(state, { type: 'PLAYER_PASS' });
    expect(state.combat.activeActor).toBe('boss');

    // BOSS_RESOLVE: 6 - 2 = 4 damage, split evenly → 2 each.
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(state.players[0].hp).toBe(8);
    expect(state.players[1].hp).toBe(8);
    expect(state.combat.bossWeakenStacks).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// combat-vulnerable: accumulation, attack-site stacking, clearing.
// ---------------------------------------------------------------------------

describe('combat-vulnerable — engine state machine', () => {
  it('PLAYER_PLAY_CARD on a vulnerable card increments vulnerableBonus by amount', () => {
    const state = makeTurnState({
      combat: makeCombat({
        combatHand: [shadowVeil],
        vulnerableBonus: 0,
      }),
    });
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: shadowVeil.id,
      playerId: 'p0',
    });
    expect(next.combat.vulnerableBonus).toBe(3);
    expect(next.combat.combatHand).toHaveLength(0);
    expect(next.combat.combatDiscard).toHaveLength(1);
    expect(next.playsThisTurn).toBe(1);
    // Vulnerable is a debuff buff — no direct damage to boss.
    expect(next.combat.boss.hp).toBe(20);
  });

  it('a combat-attack played AFTER vulnerable deals base + vulnerableBonus damage', () => {
    // shadow-veil (vulnerable 3) then attack 3 → should deal 6 to boss.
    const state = makeTurnState({
      combat: makeCombat({
        combatHand: [shadowVeil, attackCard],
        boss: makeBoss({ hp: 20, hpMax: 20 }),
        vulnerableBonus: 0,
      }),
    });
    // Play vulnerable first.
    const afterVeil = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: shadowVeil.id,
      playerId: 'p0',
    });
    expect(afterVeil.combat.vulnerableBonus).toBe(3);
    expect(afterVeil.combat.boss.hp).toBe(20);

    // Play attack card: 3 damage + 3 vulnerable = 6 total.
    const afterAttack = combatTurnReducer(afterVeil, {
      type: 'PLAYER_PLAY_CARD',
      cardId: attackCard.id,
      playerId: 'p0',
    });
    expect(afterAttack.combat.boss.hp).toBe(14); // 20 - 6
    // vulnerable still in effect for this turn.
    expect(afterAttack.combat.vulnerableBonus).toBe(3);
  });

  it('BOSS_RESOLVE clears vulnerableBonus (EOT), next players-turn is normal', () => {
    // Prime vulnerableBonus = 3, then BOSS_RESOLVE, then play an attack
    // on the next turn — expect normal (non-boosted) damage.
    let state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        vulnerableBonus: 3,
        boss: makeBoss({
          attackPattern: { damagePerTurn: 2, targeting: 'player-hp', onDefeatEffect: null },
          hp: 20,
          hpMax: 20,
        }),
      }),
      players: [makePlayer({ id: 'p0', hp: 10 }), makePlayer({ id: 'p1', hp: 10 })],
    });

    // BOSS_RESOLVE clears vulnerableBonus.
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(state.combat.vulnerableBonus).toBe(0);
    expect(state.combat.activeActor).toBe('players');

    // Play an attack next turn — should deal only base damage (no vulnerable).
    state = {
      ...state,
      combat: {
        ...state.combat,
        combatHand: [attackCard],
      },
    };
    const afterAttack = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: attackCard.id,
      playerId: 'p0',
    });
    // 3 damage only (no leftover vulnerable).
    expect(afterAttack.combat.boss.hp).toBe(17); // 20 - 3
  });

  it('multiple Vulnerable plays stack additively', () => {
    const shadowVeilB: Card = { ...shadowVeil, id: 'shadow-veil-2' };
    const state = makeTurnState({
      combat: makeCombat({
        combatHand: [shadowVeil, shadowVeilB],
        vulnerableBonus: 0,
      }),
    });
    const afterFirst = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: shadowVeil.id,
      playerId: 'p0',
    });
    expect(afterFirst.combat.vulnerableBonus).toBe(3);

    const afterSecond = combatTurnReducer(afterFirst, {
      type: 'PLAYER_PLAY_CARD',
      cardId: shadowVeilB.id,
      playerId: 'p0',
    });
    expect(afterSecond.combat.vulnerableBonus).toBe(6); // additive
  });

  it('shadow-veil end-to-end: vulnerable + follow-up attack, then EOT clears', () => {
    // Full flow: shadow-veil + attack card in hand, play both, PASS, BOSS_RESOLVE.
    let state = makeTurnState({
      combat: makeCombat({
        combatHand: [shadowVeil, attackCard],
        boss: makeBoss({
          hp: 20,
          hpMax: 20,
          attackPattern: { damagePerTurn: 4, targeting: 'player-hp', onDefeatEffect: null },
        }),
      }),
      players: [makePlayer({ id: 'p0', hp: 10 }), makePlayer({ id: 'p1', hp: 10 })],
    });

    // Play shadow-veil (vulnerable 3) — no direct damage.
    state = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: shadowVeil.id,
      playerId: 'p0',
    });
    expect(state.combat.vulnerableBonus).toBe(3);
    expect(state.combat.boss.hp).toBe(20);

    // Play attack card: 3 + 3 vulnerable = 6.
    state = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: attackCard.id,
      playerId: 'p0',
    });
    expect(state.combat.boss.hp).toBe(14); // 20 - 6

    // Pass to boss.
    state = combatTurnReducer(state, { type: 'PLAYER_PASS' });

    // BOSS_RESOLVE: 4 damage, split → 2 each. vulnerable is cleared.
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(state.players[0].hp).toBe(8);
    expect(state.players[1].hp).toBe(8);
    expect(state.combat.vulnerableBonus).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Both keywords clear on a stun-skip boss-turn.
// ---------------------------------------------------------------------------

describe('weaken + vulnerable: clear on stun-skip boss-turn', () => {
  it('both counters are cleared even when the boss is stunned and does not attack', () => {
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        bossStunTurns: 1,
        bossWeakenStacks: 2,
        vulnerableBonus: 3,
        boss: makeBoss({
          attackPattern: { damagePerTurn: 10, targeting: 'player-hp', onDefeatEffect: null },
        }),
      }),
      players: [makePlayer({ id: 'p0', hp: 10 }), makePlayer({ id: 'p1', hp: 10 })],
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });

    // Stun-skip: boss did NOT attack → HP unchanged.
    expect(next.players[0].hp).toBe(10);
    expect(next.players[1].hp).toBe(10);
    // Counters cleared at EOT even on a stun-skip.
    expect(next.combat.bossWeakenStacks).toBe(0);
    expect(next.combat.vulnerableBonus).toBe(0);
    // Stun decremented.
    expect(next.combat.bossStunTurns).toBe(0);
  });
});
