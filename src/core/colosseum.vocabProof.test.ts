/**
 * kw.colosseum-vocab-proof (A3) — end-to-end vocabulary proof.
 *
 * THE A3 PROOF BOSS IS **PHANTOM VURMOX** (Colosseum tier 2,
 * `COLOSSEUM_PHANTOM_VURMOX_T2` in src/data/colosseum/tier2.ts). It exercises
 * the broadest applicable slice of the new keyword vocabulary in a single
 * shipped spec:
 *
 *   - Archetype tick — `sequence`: a 2-step ball-volley whose `currentIndex`
 *     advances (mod 2) at the end of every boss-turn (lhlo, applySequence-
 *     ArchetypeTick) and is read by the `phantom-vurmox-volley` resolver to
 *     alternate a 0-damage charge turn and a `damagePerTurn + 1` fire turn.
 *   - State tags — the `sequence` stateTag carries the live step pointer.
 *   - Phase thresholds (lhlo.17) — three remix-only transitions at 75 % / 50 %
 *     / 25 % HP that re-point `attackPattern` (→ aoe, → dmg 4, → dmg 5) and
 *     never introduce a new mechanic.
 *   - Combat keywords (lhlo.23 + heirloom stun) — Stun / Weaken / Vulnerable /
 *     Multiattack played AGAINST the boss behave per docs/design/keyword-
 *     glossary.md.
 *
 * (Item-check, Layered and Duel do NOT apply to a sequence boss, so they are
 * not asserted here — they have their own resolver unit tests. The bead AC is
 * "each applicable keyword … whichever apply".)
 *
 * This test IS the proof artifact: it drives Phantom Vurmox through a full
 * fight via the real `combatTurnReducer` state machine (no resolver internals
 * are called directly) and fails loudly if any one keyword mechanic regresses.
 */

import { describe, it, expect } from 'vitest';
import type { Card } from '../types/card';
import type { CombatBoss, CombatEntryContext, CombatState } from '../types/combat';
import { combatTurnReducer, type CombatTurnState } from './combatEngine';
import { makeKidPlayer } from '../testing/stateFixtures';
import { COLOSSEUM_PHANTOM_VURMOX_T2 } from '../data/colosseum/tier2';

// ---------------------------------------------------------------------------
// Fixtures — a colosseum-slot fight against the Phantom Vurmox proof boss.
// ---------------------------------------------------------------------------

const ENTRY_CTX: CombatEntryContext = {
  bossCardId: 'phantom-vurmox',
  combatEntryTurn: 1,
  attackerPlayerIds: ['p0'],
  engagementSource: 'fightMonster',
  entrySource: 'colosseum-slot',
};

/** Fresh deep copy of the shipped spec so per-test hp / step overrides never
 * leak across tests (the reducers are immutable, but the spec object is a
 * shared module constant). */
function makeBoss(overrides: Partial<CombatBoss> = {}): CombatBoss {
  return { ...structuredClone(COLOSSEUM_PHANTOM_VURMOX_T2), ...overrides };
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
    players: [makeKidPlayer({ id: 'p0', hp: 60 })],
    terminal: null,
    playsThisTurn: 0,
    ...overrides,
  };
}

function play(state: CombatTurnState, card: Card): CombatTurnState {
  return combatTurnReducer(state, { type: 'PLAYER_PLAY_CARD', cardId: card.id, playerId: 'p0' });
}
function pass(state: CombatTurnState): CombatTurnState {
  return combatTurnReducer(state, { type: 'PLAYER_PASS' });
}
function bossResolve(state: CombatTurnState): CombatTurnState {
  return combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
}

/** Sequence-step pointer the resolver dispatches on. */
function seqIndex(boss: CombatBoss): number {
  const tag = boss.stateTags?.find((t) => t.kind === 'sequence');
  if (!tag || tag.kind !== 'sequence') throw new Error('boss has no sequence stateTag');
  return tag.currentIndex;
}

function attackCard(id: string, damage: number): Card {
  return {
    id,
    role: 'hero',
    cost: { red: 0 },
    effects: { kind: 'gain', red: 0 },
    combatEffect: { kind: 'combat-attack', damage },
  };
}
const weakenCard: Card = {
  id: 'vp-weaken',
  role: 'hero',
  cost: { green: 0 },
  effects: { kind: 'gain', red: 0 },
  combatEffect: { kind: 'combat-weaken', amount: 2 },
};
const vulnerableCard: Card = {
  id: 'vp-vulnerable',
  role: 'hero',
  cost: { green: 0 },
  effects: { kind: 'gain', red: 0 },
  combatEffect: { kind: 'combat-vulnerable', amount: 3 },
};
const stunCard: Card = {
  id: 'vp-stun',
  role: 'hero',
  cost: { green: 0 },
  effects: { kind: 'gain', red: 0 },
  combatEffect: { kind: 'combat-attack-stun', damage: 2, stunTurns: 1 },
};
const multishotCard: Card = {
  id: 'vp-multishot',
  role: 'hero',
  cost: { green: 0 },
  effects: { kind: 'gain', red: 0 },
  combatEffect: { kind: 'combat-multishot', damage: 2, shots: 3 },
};

// ---------------------------------------------------------------------------

describe('kw.colosseum-vocab-proof (A3) — Phantom Vurmox full-fight integration', () => {
  it('Phantom Vurmox ships a complete spec exercising the broad vocabulary', () => {
    const boss = makeBoss();
    expect(boss.sourceCardId).toBe('phantom-vurmox');
    expect(boss.archetype).toBe('sequence');
    expect(boss.attackPattern.bossAttackResolver).toBe('phantom-vurmox-volley');
    // state tags: a 2-step sequence starting at index 0.
    const seq = boss.stateTags?.find((t) => t.kind === 'sequence');
    expect(seq?.kind).toBe('sequence');
    if (seq?.kind === 'sequence') {
      expect(seq.steps).toEqual(['ball-volley-charge', 'ball-volley-fire']);
      expect(seq.currentIndex).toBe(0);
    }
    // three phase thresholds at 75 / 50 / 25 %.
    expect(boss.phaseThresholds?.map((p) => p.atHpFraction)).toEqual([0.75, 0.5, 0.25]);
  });

  it('sequence archetype tick advances the step pointer each boss-turn (0 → 1 → 0)', () => {
    let state = makeTurnState();
    expect(seqIndex(state.combat.boss)).toBe(0);

    state = pass(state);
    state = bossResolve(state); // tick: 0 → 1
    expect(seqIndex(state.combat.boss)).toBe(1);
    expect(state.combat.activeActor).toBe('players');

    state = pass(state);
    state = bossResolve(state); // tick: 1 → 0 (mod 2)
    expect(seqIndex(state.combat.boss)).toBe(0);
  });

  it('resolver reads the step: charge turn deals 0, fire turn deals damagePerTurn + 1', () => {
    // currentIndex 0 = 'ball-volley-charge' → telegraph, 0 damage.
    let state = makeTurnState({ combat: makeCombat({ activeActor: 'boss', turnIndex: 1 }) });
    state = bossResolve(state);
    expect(state.players[0].hp).toBe(60); // charge: no damage

    // currentIndex 1 = 'ball-volley-fire' → damagePerTurn(3) + 1 = 4.
    state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        turnIndex: 1,
        boss: makeBoss({
          stateTags: [
            {
              kind: 'sequence',
              steps: ['ball-volley-charge', 'ball-volley-fire'],
              currentIndex: 1,
            },
          ],
        }),
      }),
    });
    state = bossResolve(state);
    expect(state.players[0].hp).toBe(56); // 60 - 4
  });

  it('phase thresholds fire once each and remix ONLY attackPattern (75% → aoe, 50% → dmg 4, 25% → dmg 5)', () => {
    // Start with big attack cards in hand; whittle hp across each threshold.
    let state = makeTurnState({
      combat: makeCombat({
        combatHand: [attackCard('a1', 6), attackCard('a2', 6), attackCard('a3', 5)],
      }),
    });
    expect(state.combat.boss.attackPattern.targeting).toBe('battlefield-then-player');
    expect(state.combat.boss.crossedPhaseThresholds).toBeUndefined();

    // 22 → 16 (≤ 16.5 = 75%). Boss-turn fires the phase step.
    state = play(state, attackCard('a1', 6));
    expect(state.combat.boss.hp).toBe(16);
    state = pass(state);
    state = bossResolve(state);
    expect(state.combat.boss.crossedPhaseThresholds).toContain(0.75);
    expect(state.combat.boss.attackPattern.targeting).toBe('aoe');
    expect(state.combat.boss.attackPattern.damagePerTurn).toBe(3); // 75% only re-targets

    // 16 → 10 (≤ 11 = 50%).
    state = play(state, attackCard('a2', 6));
    expect(state.combat.boss.hp).toBe(10);
    state = pass(state);
    state = bossResolve(state);
    expect(state.combat.boss.crossedPhaseThresholds).toContain(0.5);
    expect(state.combat.boss.attackPattern.damagePerTurn).toBe(4);
    expect(state.combat.boss.attackPattern.targeting).toBe('aoe'); // carried from 75%

    // 10 → 5 (≤ 5.5 = 25%).
    state = play(state, attackCard('a3', 5));
    expect(state.combat.boss.hp).toBe(5);
    state = pass(state);
    state = bossResolve(state);
    expect([...(state.combat.boss.crossedPhaseThresholds ?? [])].sort((a, b) => a - b)).toEqual([
      0.25, 0.5, 0.75,
    ]);
    expect(state.combat.boss.attackPattern.damagePerTurn).toBe(5);

    // Sequence stateTag survives the phase remixes (phases touch attackPattern only).
    expect(state.combat.boss.stateTags?.some((t) => t.kind === 'sequence')).toBe(true);
  });

  it('Stun skips the boss attack for one boss-turn (combat-attack-stun)', () => {
    let state = makeTurnState({ combat: makeCombat({ combatHand: [stunCard] }) });
    const startHp = state.combat.boss.hp;

    state = play(state, stunCard);
    expect(state.combat.bossStunTurns).toBe(1);
    expect(state.combat.boss.hp).toBe(startHp - 2); // the +2 attack lands

    state = pass(state);
    // Make the boss-turn a FIRE turn so it WOULD deal damage if not stunned.
    state = {
      ...state,
      combat: {
        ...state.combat,
        boss: {
          ...state.combat.boss,
          stateTags: [
            {
              kind: 'sequence',
              steps: ['ball-volley-charge', 'ball-volley-fire'],
              currentIndex: 1,
            },
          ],
        },
      },
    };
    state = bossResolve(state);
    expect(state.players[0].hp).toBe(60); // attack skipped despite fire step
    expect(state.combat.bossStunTurns).toBe(0); // decremented
    expect(state.combat.activeActor).toBe('players');
  });

  it('Weaken reduces the boss’s resolved damage on its next turn (combat-weaken)', () => {
    // Boss on a FIRE turn (dpt 3 → 4 damage). Weaken 2 → 2 damage.
    let state = makeTurnState({
      combat: makeCombat({
        combatHand: [weakenCard],
        boss: makeBoss({
          stateTags: [
            {
              kind: 'sequence',
              steps: ['ball-volley-charge', 'ball-volley-fire'],
              currentIndex: 1,
            },
          ],
        }),
      }),
    });
    state = play(state, weakenCard);
    expect(state.combat.bossWeakenStacks).toBe(2);

    state = pass(state);
    state = bossResolve(state);
    // 4 (fire) - 2 (weaken) = 2 to the single attacker.
    expect(state.players[0].hp).toBe(58);
    expect(state.combat.bossWeakenStacks).toBe(0); // consumed
  });

  it('Vulnerable adds bonus damage to a follow-up attack on the boss (combat-vulnerable)', () => {
    let state = makeTurnState({
      combat: makeCombat({ combatHand: [vulnerableCard, attackCard('vp-atk', 3)] }),
    });
    const startHp = state.combat.boss.hp;

    state = play(state, vulnerableCard);
    expect(state.combat.vulnerableBonus).toBe(3);
    expect(state.combat.boss.hp).toBe(startHp); // vulnerable does no direct damage

    state = play(state, attackCard('vp-atk', 3));
    expect(state.combat.boss.hp).toBe(startHp - 6); // 3 attack + 3 vulnerable
  });

  it('Multiattack hits the boss `shots` times (combat-multishot)', () => {
    let state = makeTurnState({ combat: makeCombat({ combatHand: [multishotCard] }) });
    const startHp = state.combat.boss.hp;
    state = play(state, multishotCard);
    // 3 independent volleys of 2 → 6 total to the boss (no battlefield/layers).
    expect(state.combat.boss.hp).toBe(startHp - 6);
  });

  it('scripted full fight: keywords + phases combine to defeat the boss', () => {
    // A single driven fight that strings the vocabulary together and ends in
    // a player win — the integrated regression guard for A3.
    let state = makeTurnState({
      combat: makeCombat({
        combatHand: [
          vulnerableCard, // +3 vulnerability
          attackCard('f1', 8), // 8 + 3 = 11 → 22 → 11 (crosses 75%)
          stunCard, // 2 dmg + stun → 11 → 9
        ],
      }),
    });

    state = play(state, vulnerableCard);
    state = play(state, attackCard('f1', 8));
    expect(state.combat.boss.hp).toBe(11);
    // stun card: 2 attack + the still-active 3 vulnerability = 5 → 11 - 5 = 6.
    state = play(state, stunCard);
    expect(state.combat.boss.hp).toBe(6);
    expect(state.combat.bossStunTurns).toBe(1);

    // Boss-turn: stunned → no damage to players; phase 75% has been crossed.
    state = pass(state);
    state = bossResolve(state);
    expect(state.players[0].hp).toBe(60); // stun held the line
    expect(state.combat.boss.crossedPhaseThresholds).toContain(0.75);

    // Finish the boss off next players-turn.
    state = {
      ...state,
      combat: { ...state.combat, combatHand: [attackCard('f2', 9)] },
    };
    state = play(state, attackCard('f2', 9));
    expect(state.combat.boss.hp).toBeLessThanOrEqual(0);
    expect(state.terminal).toBe('win');
  });
});
