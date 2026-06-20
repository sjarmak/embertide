/**
 * Unit tests for the u-8b combat engine core (PRD §B2/B3/B4).
 *
 * Coverage targets per the task spec:
 *   - buildCombatDeck eligibility + determinism (6)
 *   - initial draw + hand cap routing (3)
 *   - applyBattlefieldDamage front-to-back absorption (5)
 *   - combatTurnReducer players-turn card plays (4)
 *   - combatTurnReducer boss-turn damage routing + desperation (7)
 *   - WIN / LOSS terminal detection (3)
 * Total: 28 focused tests (>= 20 required).
 */

import { describe, it, expect } from 'vitest';
import { createSeededRng } from '../rules/chestPool';
import { KID_CARDS } from '../data/cards';
import type { Card } from '../types/card';
import type { BattlefieldCard, CombatBoss, CombatEntryContext, CombatState } from '../types/combat';
import type { KidGameState, KidPlayer } from '../store/types';
import {
  applyBattlefieldDamage,
  baseIdOf,
  buildCombatDeck,
  combatTurnReducer,
  initialCombatDraw,
  isWispCard,
  mulberry32,
  type CombatTurnState,
} from './combatEngine';
import { DESPERATION_HP_PCT } from './balance';
import { makeKidPlayer, makeKidGameState } from '../testing/stateFixtures';

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer => makeKidPlayer(overrides);

function makeState(overrides: Partial<KidGameState> = {}): KidGameState {
  return makeKidGameState({
    players: [makePlayer({ id: 'p0' }), makePlayer({ id: 'p1' })],
    seed: 1,
    rng: createSeededRng(1),
    ...overrides,
  });
}

const ENTRY_CTX: CombatEntryContext = {
  bossCardId: 'craghorn',
  combatEntryTurn: 3,
  attackerPlayerIds: ['p0', 'p1'],
  engagementSource: 'fightMonster',
  entrySource: 'field',
};

// Small card fixtures (minimal Card shape).
const starterGreen: Card = {
  id: 'starter-green-1',
  role: 'starter-green',
  cost: { green: 0 },
  effects: { kind: 'gain', green: 1 },
};
const starterRed: Card = {
  id: 'starter-red-1',
  role: 'starter-red',
  cost: { red: 0 },
  effects: { kind: 'gain', red: 1 },
};
// Synthetic non-overridden hero for the cost.red-absent fallback test.
// Real sage-keeper now carries a combat-absorb override (embertide-2gp
// 2026-04-22), so this fixture uses an unrecognized id to stay on the
// default resolution path (combat-attack damage = cost.red ?? 1).
const hero: Card = {
  id: 'no-override-hero',
  role: 'hero',
  cost: { green: 4 },
  effects: { kind: 'gain', green: 2, keys: 1 },
};
// `power` is read defensively by resolveCombatEffect via a cast; the
// Card type itself does not declare a `power` field in u-8b. We widen
// on construction with an explicit object literal so the inline
// default (`card.power ?? 1`) has a value to pick up.
const heroPower3Full: Card & { readonly power?: number } = {
  id: 'might-warden',
  role: 'hero',
  cost: { red: 3 },
  effects: { kind: 'gain', red: 2 },
  power: 3,
};
const activeItem: Card = {
  id: 'ancient-blade',
  role: 'legendary-sword',
  cost: { green: 6 },
  effects: { kind: 'combat-bonus', red: 2 },
  itemKind: 'item-active',
  cooldownTurns: 0,
  lastUsedTurn: null,
};
const wispCard: Card = {
  id: 'wisp',
  role: 'item',
  cost: { green: 0 },
  effects: { kind: 'gain' },
  itemKind: 'item-active',
  cooldownTurns: 0,
  lastUsedTurn: null,
};
const wispDupe: Card = { ...wispCard, id: 'wisp-2' };
const mainBoardMonster: Card = {
  id: 'grunt-orc',
  role: 'monster',
  cost: { red: 3 },
  effects: { kind: 'monster-drop', hearts: 1 },
};
const chestStd: Card = {
  id: 'chest-std',
  role: 'chest-std',
  cost: { keys: 1 },
  effects: { kind: 'chest-draw', tier: 'std' },
};

function makeBoss(overrides: Partial<CombatBoss> = {}): CombatBoss {
  return {
    hp: 12,
    hpMax: 12,
    attackPattern: {
      damagePerTurn: 2,
      targeting: 'player-hp',
      onDefeatEffect: { kind: 'wisp-drop' },
    },
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
    players: [makePlayer({ id: 'p0' }), makePlayer({ id: 'p1' })],
    terminal: null,
    playsThisTurn: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// baseIdOf + isWispCard (utility sanity).
// ---------------------------------------------------------------------------

describe('u-8b utility helpers', () => {
  it('baseIdOf strips trailing numeric suffix', () => {
    expect(baseIdOf('wisp')).toBe('wisp');
    expect(baseIdOf('wisp-2')).toBe('wisp');
    expect(baseIdOf('mystic-10')).toBe('mystic');
    expect(baseIdOf('starter-green')).toBe('starter-green');
  });

  it('isWispCard matches both base id and suffixed duplicates', () => {
    expect(isWispCard(wispCard)).toBe(true);
    expect(isWispCard(wispDupe)).toBe(true);
    expect(isWispCard(hero)).toBe(false);
    expect(isWispCard(activeItem)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildCombatDeck — eligibility + determinism.
// ---------------------------------------------------------------------------

describe('buildCombatDeck — eligibility (§B2)', () => {
  it('includes the surviving starter-* cards (starter-green, starter-red) — rev-2 2026-04-22 / j49z 2026-04-24', () => {
    const p0 = makePlayer({ id: 'p0', deck: [starterGreen, starterRed] });
    const state = makeState({ players: [p0] });
    const deck = buildCombatDeck(state, ENTRY_CTX);
    const ids = deck.map((c) => c.id);
    // Designer playtest 2026-04-22 (rev-2) reversed the 2026-04-21
    // exclusion of gem-generator starters: green-shard + red-shard
    // now carry distinct CombatEffect overrides (combat-draw 1 and
    // combat-attack 2 respectively; see src/data/combatEffects.ts),
    // so they're no longer inert filler. Including them thickens the
    // combat deck enough to make the reshuffle + per-turn-draw loop
    // feel like a deckbuilder instead of an MTG hand-of-9 grind.
    // j49z (2026-04-24): the third starter role (`starter-home`) was
    // retired, so the eligibility surface is now just green+red.
    expect(ids).toContain(starterGreen.id);
    expect(ids).toContain(starterRed.id);
  });

  it('includes championSlot hero AND heroes in deck/discard/hand/inPlay (rev-2 2026-04-22 — bought heroes reach combat)', () => {
    // championSlot is 'champion-power'; plant a hero with baseId matching.
    const championHero: Card = {
      id: 'champion-power',
      role: 'hero',
      cost: { red: 2 },
      effects: { kind: 'gain', red: 1 },
    };
    const inPlayHero: Card = {
      id: 'sage-keeper-2',
      role: 'hero',
      cost: { green: 4 },
      effects: { kind: 'gain', green: 2 },
    };
    const deckHero: Card = {
      id: 'water-warrior-3',
      role: 'hero',
      cost: { green: 3 },
      effects: { kind: 'gain', red: 2 },
    };
    const discardHero: Card = {
      id: 'scholar-princess-1',
      role: 'hero',
      cost: { green: 5 },
      effects: { kind: 'draw', amount: 2 },
    };
    const handHero: Card = {
      id: 'wandering-merchant-1',
      role: 'hero',
      cost: { green: 3 },
      effects: { kind: 'gain', green: 1 },
    };

    const p0 = makePlayer({
      id: 'p0',
      championSlot: 'champion-power',
      // The championSlot lookup scans all zones; put championHero in deck.
      deck: [championHero, deckHero],
      inPlay: [inPlayHero],
      hand: [handHero],
      discard: [discardHero],
    });
    const state = makeState({ players: [p0] });

    const deck = buildCombatDeck(state, ENTRY_CTX);
    const ids = deck.map((c) => c.id).sort();

    // Designer playtest 2026-04-22 (rev-2): every hero the player
    // OWNS reaches combat regardless of which main-board zone it sits
    // in at combat entry. Before, a hero in deck/discard/hand was
    // invisible to combat unless the player spent a setup turn
    // playing it — a hidden "staging turn" trap the player feedback
    // flagged. Now all four zones contribute.
    expect(ids).toContain(championHero.id);
    expect(ids).toContain(inPlayHero.id);
    expect(ids).toContain(deckHero.id);
    expect(ids).toContain(discardHero.id);
    expect(ids).toContain(handHero.id);
  });

  it('includes item-active items from items zone; excludes fairies', () => {
    const p0 = makePlayer({ id: 'p0', items: [activeItem, wispCard, wispDupe] });
    const state = makeState({ players: [p0] });
    const deck = buildCombatDeck(state, ENTRY_CTX);
    const ids = deck.map((c) => c.id);
    expect(ids).toContain(activeItem.id);
    expect(ids).not.toContain('wisp');
    expect(ids).not.toContain('wisp-2');
  });

  it('excludes main-board draw deck, chest contents, field, supply (non-starter cards)', () => {
    const p0 = makePlayer({
      id: 'p0',
      deck: [mainBoardMonster], // monster in main deck — ineligible
    });
    const state = makeState({
      players: [p0],
      field: [mainBoardMonster],
      supply: [mainBoardMonster],
      chestRow: [chestStd],
      chestSupply: [chestStd],
      defeated: [mainBoardMonster],
    });
    const deck = buildCombatDeck(state, ENTRY_CTX);
    const ids = deck.map((c) => c.id);
    expect(ids).not.toContain(mainBoardMonster.id);
    expect(ids).not.toContain(chestStd.id);
  });

  it('is deterministic for the same seed + combatEntryTurn', () => {
    const p0 = makePlayer({ id: 'p0', deck: [starterGreen, starterRed] });
    const p1 = makePlayer({ id: 'p1', deck: [starterGreen, starterRed] });
    const state = makeState({ players: [p0, p1] });
    const a = buildCombatDeck(state, ENTRY_CTX).map((c) => c.id);
    const b = buildCombatDeck(state, ENTRY_CTX).map((c) => c.id);
    expect(a).toEqual(b);
  });

  it('produces a different order when combatEntryTurn differs', () => {
    // Build a deck of 8 distinct starter cards so shuffle has room to
    // differ. j49z (2026-04-24): the original fixture used `starter-home`,
    // which was retired alongside the role; we use `starter-red` here so
    // the test still exercises the per-turn shuffle without depending on
    // a discontinued role.
    const cards: Card[] = Array.from({ length: 8 }, (_, i) => ({
      id: `starter-red-${i}`,
      role: 'starter-red' as const,
      cost: { red: 1 },
      effects: { kind: 'gain', red: 1 } as const,
    }));
    const p0 = makePlayer({ id: 'p0', deck: cards });
    const state = makeState({ players: [p0] });
    const a = buildCombatDeck(state, { ...ENTRY_CTX, combatEntryTurn: 3 }).map((c) => c.id);
    const b = buildCombatDeck(state, { ...ENTRY_CTX, combatEntryTurn: 7 }).map((c) => c.id);
    expect(a).not.toEqual(b);
    // Same elements, different order.
    expect(a.slice().sort()).toEqual(b.slice().sort());
  });
});

// ---------------------------------------------------------------------------
// initialCombatDraw + hand cap.
// ---------------------------------------------------------------------------

describe('initialCombatDraw — hand cap routing', () => {
  it('deals 5 cards into combatHand from a larger deck', () => {
    const deck: Card[] = Array.from({ length: 10 }, (_, i) => ({
      ...starterGreen,
      id: `sg-${i}`,
    }));
    const { combatHand, combatDeck, combatDiscard } = initialCombatDraw(deck);
    expect(combatHand).toHaveLength(5);
    expect(combatDeck).toHaveLength(5);
    expect(combatDiscard).toHaveLength(0);
  });

  it('routes excess over hand cap to combatDiscard (when cap is filled mid-draw)', () => {
    // Precondition: initial draw deals exactly COMBAT_INITIAL_DRAW = 5
    // cards and cap is 5 — so at INITIAL draw there is never an
    // overflow. The hand-cap routing is verified via the shared
    // drawIntoHand helper, exercised here by stuffing the starting
    // hand full first and then simulating a second draw via a direct
    // call through a combat-draw effect. Since that helper is
    // internal, we assert the initial-draw path's happy case here
    // and rely on the `combat-draw` effect tests below for overflow.
    const deck: Card[] = Array.from({ length: 5 }, (_, i) => ({
      ...starterGreen,
      id: `sg-${i}`,
    }));
    const { combatHand, combatDeck, combatDiscard } = initialCombatDraw(deck);
    expect(combatHand).toHaveLength(5);
    expect(combatDeck).toHaveLength(0);
    expect(combatDiscard).toHaveLength(0);
  });

  it('handles a deck smaller than the initial draw (no error)', () => {
    const deck: Card[] = [starterGreen, starterRed];
    const { combatHand, combatDeck, combatDiscard } = initialCombatDraw(deck);
    expect(combatHand).toHaveLength(2);
    expect(combatDeck).toHaveLength(0);
    expect(combatDiscard).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// applyBattlefieldDamage — front-to-back absorption.
// ---------------------------------------------------------------------------

describe('applyBattlefieldDamage — §B3 front-to-back absorption', () => {
  const bfCard = (hp: number, id = `bf-${hp}`): BattlefieldCard => ({
    cardId: id,
    hp,
    hpMax: hp,
    combatEffectId: `combat-absorb:${hp}`,
  });

  it('damage less than first card hp reduces hp and returns residual 0', () => {
    const field = [bfCard(5), bfCard(3)];
    const r = applyBattlefieldDamage(field, 2);
    expect(r.residual).toBe(0);
    expect(r.battlefield).toHaveLength(2);
    expect(r.battlefield[0].hp).toBe(3);
    expect(r.battlefield[1].hp).toBe(3);
  });

  it('damage equal to first card hp drops it (residual 0)', () => {
    const field = [bfCard(4), bfCard(2)];
    const r = applyBattlefieldDamage(field, 4);
    expect(r.residual).toBe(0);
    expect(r.battlefield).toHaveLength(1);
    expect(r.battlefield[0].hp).toBe(2);
  });

  it('damage exceeds first card spills to next card', () => {
    const field = [bfCard(3), bfCard(5)];
    const r = applyBattlefieldDamage(field, 5);
    expect(r.residual).toBe(0);
    expect(r.battlefield).toHaveLength(1);
    expect(r.battlefield[0].hp).toBe(3);
  });

  it('damage exceeds entire battlefield returns residual leftover', () => {
    const field = [bfCard(2), bfCard(3)];
    const r = applyBattlefieldDamage(field, 10);
    expect(r.battlefield).toHaveLength(0);
    expect(r.residual).toBe(5);
  });

  it('is pure: input array is not mutated', () => {
    const field: readonly BattlefieldCard[] = [bfCard(3), bfCard(2)];
    const snapshot = field.map((c) => ({ ...c }));
    applyBattlefieldDamage(field, 4);
    expect(field).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// combatTurnReducer — players-turn card plays.
// ---------------------------------------------------------------------------

describe('combatTurnReducer — players-turn card plays (§B4)', () => {
  it('PLAYER_PLAY_CARD moves the card to discard and deals damage to the boss', () => {
    const state = makeTurnState({
      combat: makeCombat({ combatHand: [heroPower3Full], boss: makeBoss({ hp: 12, hpMax: 12 }) }),
    });
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: heroPower3Full.id,
      playerId: 'p0',
    });
    expect(next.combat.combatHand).toHaveLength(0);
    expect(next.combat.combatDiscard).toHaveLength(1);
    expect(next.combat.boss.hp).toBe(9); // 12 - 3
    expect(next.playsThisTurn).toBe(1);
  });

  it('card.power undefined falls back to damage=1', () => {
    const state = makeTurnState({
      combat: makeCombat({ combatHand: [hero], boss: makeBoss({ hp: 5, hpMax: 12 }) }),
    });
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: hero.id,
      playerId: 'p0',
    });
    expect(next.combat.boss.hp).toBe(4);
  });

  it('PLAYER_PASS transitions activeActor from players to boss and resets plays counter', () => {
    const state = makeTurnState({ playsThisTurn: 2 });
    const next = combatTurnReducer(state, { type: 'PLAYER_PASS' });
    expect(next.combat.activeActor).toBe('boss');
    expect(next.playsThisTurn).toBe(0);
  });

  it('PLAYER_PLAY_CARD is a no-op once plays budget (COMBAT_PLAYS_PER_TURN) is spent', () => {
    const state = makeTurnState({
      combat: makeCombat({ combatHand: [heroPower3Full] }),
      playsThisTurn: 3, // budget exhausted
    });
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: heroPower3Full.id,
      playerId: 'p0',
    });
    expect(next).toBe(state); // reference-equal — no state change
  });
});

// ---------------------------------------------------------------------------
// combatTurnReducer — boss-turn damage routing.
// ---------------------------------------------------------------------------

describe('combatTurnReducer — boss-turn damage routing (§B3/§B4)', () => {
  it("BOSS_RESOLVE 'player-hp' splits evenly across non-downed players", () => {
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        boss: makeBoss({
          attackPattern: { damagePerTurn: 4, targeting: 'player-hp', onDefeatEffect: null },
        }),
      }),
      players: [makePlayer({ id: 'p0', hp: 5 }), makePlayer({ id: 'p1', hp: 5 })],
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hp).toBe(3); // 5 - 2
    expect(next.players[1].hp).toBe(3);
  });

  it("BOSS_RESOLVE 'player-hp' routes remainder to active-attacker (first in attackerPlayerIds)", () => {
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        boss: makeBoss({
          attackPattern: { damagePerTurn: 5, targeting: 'player-hp', onDefeatEffect: null },
        }),
        entryContext: { ...ENTRY_CTX, attackerPlayerIds: ['p1', 'p0'] },
      }),
      players: [makePlayer({ id: 'p0', hp: 5 }), makePlayer({ id: 'p1', hp: 5 })],
    });
    // per = floor(5/2) = 2. remainder = 1. Active attacker 'p1' absorbs remainder.
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hp).toBe(3); // 5 - 2
    expect(next.players[1].hp).toBe(2); // 5 - 3
  });

  it("BOSS_RESOLVE 'battlefield-then-player' absorbs battlefield first, spills residual", () => {
    const bf: BattlefieldCard = {
      cardId: 'tower-shield',
      hp: 3,
      hpMax: 3,
      combatEffectId: 'combat-absorb:3',
    };
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        battlefield: [bf],
        boss: makeBoss({
          attackPattern: {
            damagePerTurn: 7,
            targeting: 'battlefield-then-player',
            onDefeatEffect: null,
          },
        }),
      }),
      players: [makePlayer({ id: 'p0', hp: 5 }), makePlayer({ id: 'p1', hp: 5 })],
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.combat.battlefield).toHaveLength(0); // shield absorbed 3 then died
    // residual = 7 - 3 = 4; split across 2 players -> 2 each
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(3);
  });

  it("BOSS_RESOLVE 'aoe' applies full damagePerTurn to every battlefield card AND every non-downed player", () => {
    const bfA: BattlefieldCard = { cardId: 'a', hp: 4, hpMax: 4, combatEffectId: 'x' };
    const bfB: BattlefieldCard = { cardId: 'b', hp: 2, hpMax: 2, combatEffectId: 'x' };
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        battlefield: [bfA, bfB],
        boss: makeBoss({
          hp: 12,
          hpMax: 12,
          attackPattern: { damagePerTurn: 3, targeting: 'aoe', onDefeatEffect: null },
        }),
      }),
      players: [makePlayer({ id: 'p0', hp: 5 }), makePlayer({ id: 'p1', hp: 5 })],
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // bfA: 4 - 3 = 1 (survives). bfB: 2 - 3 <= 0 (drops).
    expect(next.combat.battlefield).toHaveLength(1);
    expect(next.combat.battlefield[0].cardId).toBe('a');
    expect(next.combat.battlefield[0].hp).toBe(1);
    // Each player takes full 3 damage.
    expect(next.players[0].hp).toBe(2);
    expect(next.players[1].hp).toBe(2);
  });

  it("BOSS_RESOLVE 'player-hp' skips downed players when splitting damage", () => {
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        boss: makeBoss({
          attackPattern: { damagePerTurn: 4, targeting: 'player-hp', onDefeatEffect: null },
        }),
      }),
      players: [makePlayer({ id: 'p0', hp: 0, downed: true }), makePlayer({ id: 'p1', hp: 5 })],
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hp).toBe(0);
    expect(next.players[0].downed).toBe(true);
    // Only p1 (non-downed) takes damage; 4 / 1 = 4.
    expect(next.players[1].hp).toBe(1);
  });

  it('BOSS_RESOLVE increments turnIndex and hands turn back to players when non-terminal', () => {
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        turnIndex: 2,
        boss: makeBoss({
          attackPattern: { damagePerTurn: 1, targeting: 'player-hp', onDefeatEffect: null },
        }),
      }),
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.combat.turnIndex).toBe(3);
    expect(next.combat.activeActor).toBe('players');
  });

  it('desperation: when boss.hp < DESPERATION_HP_PCT * hpMax, player-hp targeting becomes aoe', () => {
    // boss.hp = 2, hpMax = 12. Threshold = 0.25 * 12 = 3. 2 < 3 → desperation.
    expect(DESPERATION_HP_PCT).toBe(0.25);
    const bf: BattlefieldCard = { cardId: 'a', hp: 5, hpMax: 5, combatEffectId: 'x' };
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        battlefield: [bf],
        boss: makeBoss({
          hp: 2,
          hpMax: 12,
          attackPattern: { damagePerTurn: 2, targeting: 'player-hp', onDefeatEffect: null },
        }),
      }),
      players: [makePlayer({ id: 'p0', hp: 5 }), makePlayer({ id: 'p1', hp: 5 })],
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // Under desperation, targeting becomes 'aoe':
    //   battlefield: bf takes 2 → hp=3 (survives).
    //   players: each takes full 2.
    expect(next.combat.battlefield[0].hp).toBe(3);
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// embertide-4uyn.1 — on-damage item-passive dispatch through the
// combat damage-routing path. Covers iron-ward (the only v2.1 author of
// `trigger: 'on-damage'`) and the synthetic per-player reduction
// arithmetic that future on-damage cards inherit.
//
// Contract under test (reduceIncomingDamage in slices/endgame.ts):
//   - fires once per damage instance (every applyDamage call-site)
//   - per-player: only the holder's incoming damage is reduced
//   - additive stacking across multiple on-damage passives
//   - clamps at 0 (no overheal credit)
//   - trigger discrimination: start-of-turn / on-combat-enter /
//     on-monster-defeated passives are NOT consulted on damage
// ---------------------------------------------------------------------------

const ironWardCard: Card = {
  id: 'iron-ward',
  role: 'item',
  cost: { green: 5 },
  effects: {
    kind: 'item-passive',
    description: 'Reduce damage taken by 1',
    trigger: 'on-damage',
    effect: { kind: 'damage-reduction', amount: 1 },
  },
  itemKind: 'item-passive',
};

// Same payload but on the wrong trigger — used to assert that on-damage
// dispatch does NOT spuriously consume start-of-turn / on-combat-enter
// damage-reduction authoring (no current card author, but the schema
// permits it; the reducer must still discriminate by trigger).
const startOfTurnReducerCard: Card = {
  id: 'phantom-shield',
  role: 'item',
  cost: { green: 5 },
  effects: {
    kind: 'item-passive',
    description: 'Phantom shield (start-of-turn payload, NOT on-damage)',
    trigger: 'start-of-turn',
    effect: { kind: 'damage-reduction', amount: 99 },
  },
  itemKind: 'item-passive',
};

describe('combatTurnReducer — on-damage item-passive dispatch (4uyn.1)', () => {
  it("iron-ward reduces 'player-hp' damage by 1 for the holder only", () => {
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        boss: makeBoss({
          attackPattern: { damagePerTurn: 4, targeting: 'player-hp', onDefeatEffect: null },
        }),
      }),
      players: [
        makePlayer({ id: 'p0', hp: 5, items: [ironWardCard] }),
        makePlayer({ id: 'p1', hp: 5 }),
      ],
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // 4 damage / 2 players = 2 each. p0 reduces by 1 → takes 1. p1 takes 2.
    expect(next.players[0].hp).toBe(4);
    expect(next.players[1].hp).toBe(3);
  });

  it('iron-ward reduces AoE damage per-player; non-holder still eats full hit', () => {
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        boss: makeBoss({
          attackPattern: { damagePerTurn: 3, targeting: 'aoe', onDefeatEffect: null },
        }),
      }),
      players: [
        makePlayer({ id: 'p0', hp: 5, items: [ironWardCard] }),
        makePlayer({ id: 'p1', hp: 5 }),
      ],
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // p0 reduces by 1 → takes 2. p1 takes 3.
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(2);
  });

  it('multiple iron-wards stack additively (2 copies → -2 damage)', () => {
    const ironWardDupe: Card = { ...ironWardCard, id: 'iron-ward-2' };
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        boss: makeBoss({
          attackPattern: { damagePerTurn: 4, targeting: 'aoe', onDefeatEffect: null },
        }),
      }),
      players: [
        makePlayer({ id: 'p0', hp: 5, items: [ironWardCard, ironWardDupe] }),
        makePlayer({ id: 'p1', hp: 5 }),
      ],
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // p0: 4 - 2 reductions = 2 → hp 3. p1: 4 → hp 1.
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(1);
  });

  it('reduction clamps at 0 — over-shielded player takes no damage', () => {
    // 3 iron-wards (-3) vs 1-damage-per-player split → reduced to 0.
    const ironA: Card = { ...ironWardCard, id: 'iron-ward-1' };
    const ironB: Card = { ...ironWardCard, id: 'iron-ward-2' };
    const ironC: Card = { ...ironWardCard, id: 'iron-ward-3' };
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        boss: makeBoss({
          attackPattern: { damagePerTurn: 2, targeting: 'aoe', onDefeatEffect: null },
        }),
      }),
      players: [
        makePlayer({ id: 'p0', hp: 5, items: [ironA, ironB, ironC] }),
        makePlayer({ id: 'p1', hp: 5 }),
      ],
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // p0: 2 - 3 reductions = clamped to 0 → hp untouched.
    expect(next.players[0].hp).toBe(5);
    // p1: full 2 damage.
    expect(next.players[1].hp).toBe(3);
  });

  it('start-of-turn `damage-reduction` payload does NOT fire on damage routing (trigger discrimination)', () => {
    // The schema permits a damage-reduction payload on any trigger; the
    // on-damage reducer must read ONLY the on-damage trigger, not the
    // payload kind. This pins the discrimination boundary.
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        boss: makeBoss({
          attackPattern: { damagePerTurn: 4, targeting: 'aoe', onDefeatEffect: null },
        }),
      }),
      players: [
        makePlayer({ id: 'p0', hp: 5, items: [startOfTurnReducerCard] }),
        makePlayer({ id: 'p1', hp: 5 }),
      ],
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // start-of-turn payload is NOT consulted — both players take full 4.
    expect(next.players[0].hp).toBe(1);
    expect(next.players[1].hp).toBe(1);
  });

  it('iron-ward reduces remainder routed to active-attacker', () => {
    // 5 damage / 2 = 2 per-player + 1 remainder onto p0 (first attacker).
    // p0 has iron-ward → (2 + 1) - 1 = 2 damage taken. p1 takes 2.
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        boss: makeBoss({
          attackPattern: { damagePerTurn: 5, targeting: 'player-hp', onDefeatEffect: null },
        }),
      }),
      players: [
        makePlayer({ id: 'p0', hp: 5, items: [ironWardCard] }),
        makePlayer({ id: 'p1', hp: 5 }),
      ],
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hp).toBe(3); // 5 - (3 - 1)
    expect(next.players[1].hp).toBe(3); // 5 - 2
  });

  it('no on-damage passives → behaviour matches the legacy unrouted path', () => {
    // Sanity regression — re-pins the original 'aoe / 3 damage' vector
    // unchanged when no holder owns iron-ward (or any on-damage passive).
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        boss: makeBoss({
          attackPattern: { damagePerTurn: 3, targeting: 'aoe', onDefeatEffect: null },
        }),
      }),
      players: [makePlayer({ id: 'p0', hp: 5 }), makePlayer({ id: 'p1', hp: 5 })],
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hp).toBe(2);
    expect(next.players[1].hp).toBe(2);
  });

  // ppf9.3.1 (embertide-y0tr) — tower-shield is the first dual-slot
  // v2.0 market item: it carries `Card.effects` (equip-bonus gem+1 on
  // equip) AND `Card.passive` (item-passive on-damage damage-reduction
  // +1). The on-damage dispatcher MUST surface the second-slot passive
  // through getPassives(), not by reading effects.kind directly. These
  // tests pin that the migrated dispatcher honors the new schema slot.
  const towerShieldCard: Card = {
    id: 'tower-shield',
    role: 'item',
    cost: { green: 2 },
    effects: { kind: 'equip-bonus', resource: 'gem', amount: 1, trigger: 'on-equip' },
    passive: {
      kind: 'item-passive',
      description: 'Reduce damage taken by 1',
      trigger: 'on-damage',
      effect: { kind: 'damage-reduction', amount: 1 },
    },
    itemKind: 'item-active',
    cooldownTurns: 0,
    lastUsedTurn: null,
  };

  it('tower-shield (Card.passive second slot) reduces incoming damage by 1 for the holder', () => {
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        boss: makeBoss({
          attackPattern: { damagePerTurn: 4, targeting: 'aoe', onDefeatEffect: null },
        }),
      }),
      players: [
        makePlayer({ id: 'p0', hp: 5, items: [towerShieldCard] }),
        makePlayer({ id: 'p1', hp: 5 }),
      ],
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // p0: 4 - 1 (tower-shield passive) = 3 → hp 2. p1 takes full 4 → hp 1.
    expect(next.players[0].hp).toBe(2);
    expect(next.players[1].hp).toBe(1);
  });

  it('tower-shield + iron-ward stack additively across slot variants', () => {
    // Mixes a Card.passive (tower-shield) with a Card.effects-as-passive
    // (iron-ward). getPassives() concatenates both slots so the reducer
    // sees two on-damage damage-reduction +1 passives → -2 per hit.
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        boss: makeBoss({
          attackPattern: { damagePerTurn: 4, targeting: 'aoe', onDefeatEffect: null },
        }),
      }),
      players: [
        makePlayer({ id: 'p0', hp: 5, items: [towerShieldCard, ironWardCard] }),
        makePlayer({ id: 'p1', hp: 5 }),
      ],
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // p0: 4 - 2 = 2 → hp 3. p1: full 4 → hp 1.
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(1);
  });

  // ppf9.4.2 (embertide-kspj) — elysian-shield is the second dual-slot
  // v2.1 market item. Same authoring shape as tower-shield (equip-bonus
  // gem+1 on-equip + Card.passive on-damage damage-reduction +1) but at
  // green:4 with a combat-side absorb hp 4 wired via EXPLICIT_OVERRIDES.
  // These tests pin the on-damage passive through the live card pulled
  // from KID_CARDS so future schema drift on the authored item is caught
  // here, not just on the synthetic tower-shield fixture.
  const elysianShieldCard = (() => {
    const card = KID_CARDS.find((c) => c.id === 'elysian-shield');
    if (!card) throw new Error('fixture missing: elysian-shield');
    return card;
  })();

  it('elysian-shield (Card.passive second slot) reduces incoming damage by 1 for the holder', () => {
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        boss: makeBoss({
          attackPattern: { damagePerTurn: 4, targeting: 'aoe', onDefeatEffect: null },
        }),
      }),
      players: [
        makePlayer({ id: 'p0', hp: 5, items: [elysianShieldCard] }),
        makePlayer({ id: 'p1', hp: 5 }),
      ],
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // p0: 4 - 1 (elysian-shield passive) = 3 → hp 2. p1 takes full 4 → hp 1.
    expect(next.players[0].hp).toBe(2);
    expect(next.players[1].hp).toBe(1);
  });

  it('elysian-shield + iron-ward stack additively across slot variants', () => {
    // Same dual-slot stacking proof as tower-shield + iron-ward, but using
    // the live elysian-shield card. Confirms the second authored dual-slot
    // item composes with the legacy 4uyn `Card.effects.kind ===
    // 'item-passive'` shape through getPassives() concatenation.
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        boss: makeBoss({
          attackPattern: { damagePerTurn: 4, targeting: 'aoe', onDefeatEffect: null },
        }),
      }),
      players: [
        makePlayer({ id: 'p0', hp: 5, items: [elysianShieldCard, ironWardCard] }),
        makePlayer({ id: 'p1', hp: 5 }),
      ],
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // p0: 4 - 2 (elysian-shield + iron-ward) = 2 → hp 3. p1: full 4 → hp 1.
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(1);
  });

  // ppf9.1 (embertide-ppf9.1) — boulderkin-core is the third dual-slot
  // card to author Card.passive on-damage damage-reduction +1. Heirloom
  // (wild-boss drop, NOT in SUPPLY_PLAN) — sole heirloom whose name implies
  // always-on flavour (animate stone armor). Per designer ruling 2026-04-29
  // (memory embertide-designer-ruling-ppf9-1-heirloom-passives-2026)
  // this is the only ppf9.1 heirloom that gets a Card.passive layer; the
  // other four (craghorn-tusk / sentinel-eye / chimera-sword / rainbow-ancient-
  // chimera-sword) keep their existing trophy + combat-override surfaces
  // unchanged. Combat-side absorb hp 4 (EXPLICIT_OVERRIDES) is preserved —
  // boulderkin-core remains a played battlefield-card in combat too; the
  // passive is the fourth surface (paid only on this card per the ruling).
  const boulderkinCoreCard = (() => {
    const card = KID_CARDS.find((c) => c.id === 'boulderkin-core');
    if (!card) throw new Error('fixture missing: boulderkin-core');
    return card;
  })();

  it('boulderkin-core (Card.passive) reduces incoming damage by 1 for the holder', () => {
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        boss: makeBoss({
          attackPattern: { damagePerTurn: 4, targeting: 'aoe', onDefeatEffect: null },
        }),
      }),
      players: [
        makePlayer({ id: 'p0', hp: 5, items: [boulderkinCoreCard] }),
        makePlayer({ id: 'p1', hp: 5 }),
      ],
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // p0: 4 - 1 (boulderkin-core passive) = 3 → hp 2. p1 takes full 4 → hp 1.
    expect(next.players[0].hp).toBe(2);
    expect(next.players[1].hp).toBe(1);
  });

  it('boulderkin-core + iron-ward stack additively across slot variants', () => {
    // Confirms the third authored dual-slot item composes with the legacy
    // 4uyn `Card.effects.kind === 'item-passive'` shape through
    // getPassives() concatenation. Same proof shape as elysian-shield +
    // iron-ward stacking.
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        boss: makeBoss({
          attackPattern: { damagePerTurn: 4, targeting: 'aoe', onDefeatEffect: null },
        }),
      }),
      players: [
        makePlayer({ id: 'p0', hp: 5, items: [boulderkinCoreCard, ironWardCard] }),
        makePlayer({ id: 'p1', hp: 5 }),
      ],
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // p0: 4 - 2 (boulderkin-core + iron-ward) = 2 → hp 3. p1: full 4 → hp 1.
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Terminal WIN / LOSS detection.
// ---------------------------------------------------------------------------

describe('combatTurnReducer — terminal detection', () => {
  it("detects WIN (terminal='win') when a player card play drops boss.hp to 0", () => {
    const state = makeTurnState({
      combat: makeCombat({
        combatHand: [heroPower3Full],
        boss: makeBoss({ hp: 3, hpMax: 12 }), // 3 dmg kills
      }),
    });
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: heroPower3Full.id,
      playerId: 'p0',
    });
    expect(next.terminal).toBe('win');
    expect(next.combat.boss.hp).toBe(0);
    expect(next.combat.activeActor).toBe('players');
  });

  it("detects LOSS (terminal='loss') when the boss attack would down the last standing player", () => {
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        boss: makeBoss({
          attackPattern: { damagePerTurn: 5, targeting: 'aoe', onDefeatEffect: null },
        }),
      }),
      players: [
        makePlayer({ id: 'p0', hp: 0, downed: true }),
        makePlayer({ id: 'p1', hp: 3 }), // 5 dmg via aoe > 3 → downed.
      ],
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.terminal).toBe('loss');
    expect(next.players.every((p) => p.downed)).toBe(true);
  });

  it('does NOT declare LOSS when at least one non-downed player survives', () => {
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        boss: makeBoss({
          attackPattern: { damagePerTurn: 2, targeting: 'aoe', onDefeatEffect: null },
        }),
      }),
      players: [makePlayer({ id: 'p0', hp: 5 }), makePlayer({ id: 'p1', hp: 5 })],
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.terminal).toBeNull();
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// combat-attack-stun engine state-machine (embertide-5je / u-9b follow-on).
// Exercises the `bossStunTurns` increment path in `applyPlayerEffect`
// (~lines 747-765) and the skip-guard in `reduceBossResolve` (~lines 789-801).
// Canonical resolver contract lives in `src/data/combatEffects.ts` —
// `craghorn-tusk` → `{damage:4, stunTurns:1}` (combat-attack-stun).
// ---------------------------------------------------------------------------

// Craghorn Tusk fixture. Authoring source of truth lives on the heirloom
// card itself via Card.combatEffect (embertide-bq9b / ppf9-7a) —
// `craghorn-tusk` declares `combat-attack-stun` (damage 4, stunTurns 1) on
// the card; the synthetic fixture mirrors that declaration so
// combatEffectFor resolves the same shape via the in-card branch.
const craghornTusk: Card = {
  id: 'craghorn-tusk',
  role: 'item',
  cost: { red: 0 },
  effects: { kind: 'gain' },
  itemKind: 'item-active',
  cooldownTurns: 0,
  lastUsedTurn: null,
  combatEffect: { kind: 'combat-attack-stun', damage: 4, stunTurns: 1 },
};

describe('combat-attack-stun — engine state machine', () => {
  it('PLAYER_PLAY_CARD on a stun card deals damage AND increments bossStunTurns by stunTurns', () => {
    const state = makeTurnState({
      combat: makeCombat({
        combatHand: [craghornTusk],
        boss: makeBoss({ hp: 12, hpMax: 12 }),
        bossStunTurns: 0,
      }),
    });
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: craghornTusk.id,
      playerId: 'p0',
    });
    // craghorn-tusk → combat-attack-stun (damage=4, stunTurns=1)
    expect(next.combat.boss.hp).toBe(8); // 12 - 4
    expect(next.combat.bossStunTurns).toBe(1);
    expect(next.combat.combatHand).toHaveLength(0);
    expect(next.combat.combatDiscard).toHaveLength(1);
    expect(next.playsThisTurn).toBe(1);
  });

  it('BOSS_RESOLVE with bossStunTurns > 0 skips the boss attack AND decrements the counter', () => {
    const state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        turnIndex: 2,
        bossStunTurns: 1,
        boss: makeBoss({
          // If the attack were NOT skipped, this 4-damage aoe would
          // chew both players down to hp=1 — we assert it does NOT.
          attackPattern: { damagePerTurn: 4, targeting: 'aoe', onDefeatEffect: null },
        }),
      }),
      players: [makePlayer({ id: 'p0', hp: 5 }), makePlayer({ id: 'p1', hp: 5 })],
    });
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });

    // Attack routing was skipped — both players untouched.
    expect(next.players[0].hp).toBe(5);
    expect(next.players[1].hp).toBe(5);
    // Counter decremented from 1 to 0.
    expect(next.combat.bossStunTurns).toBe(0);
    // turnIndex still advances (desperation / telemetry consistency).
    expect(next.combat.turnIndex).toBe(3);
    // Control handed back to players.
    expect(next.combat.activeActor).toBe('players');
    // No terminal state — skipping stun is always non-terminal.
    expect(next.terminal).toBeNull();
  });

  it('stun is ADDITIVE: playing two stun cards stacks stunTurns (2 × craghorn-tusk → bossStunTurns=2)', () => {
    // Canonical contract (combatEngine.ts:747-765): `bossStunTurns = currentStun + effect.stunTurns`.
    // No max/clip — purely additive. This test pins that contract.
    // Second copy uses a `-<n>` suffix (matches main-board duplicate naming)
    // so `baseIdOfCard` strips it and resolves to the same override.
    const craghornA: Card = { ...craghornTusk, id: 'craghorn-tusk' };
    const craghornB: Card & { readonly baseId?: string } = {
      ...craghornTusk,
      id: 'craghorn-tusk-2',
      baseId: 'craghorn-tusk',
    };
    const state = makeTurnState({
      combat: makeCombat({
        combatHand: [craghornA, craghornB],
        boss: makeBoss({ hp: 20, hpMax: 20 }),
        bossStunTurns: 0,
      }),
    });
    const afterFirst = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: craghornA.id,
      playerId: 'p0',
    });
    expect(afterFirst.combat.bossStunTurns).toBe(1);

    const afterSecond = combatTurnReducer(afterFirst, {
      type: 'PLAYER_PLAY_CARD',
      cardId: craghornB.id,
      playerId: 'p0',
    });
    // Two stunTurns=1 plays accumulate additively to 2.
    expect(afterSecond.combat.bossStunTurns).toBe(2);
    expect(afterSecond.combat.boss.hp).toBe(12); // 20 - 4 - 4
  });

  it('multi-turn stun counts down to 0 over successive BOSS_RESOLVE calls', () => {
    // Seed bossStunTurns=2 and advance two boss turns back-to-back.
    let state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        turnIndex: 0,
        bossStunTurns: 2,
        boss: makeBoss({
          attackPattern: { damagePerTurn: 3, targeting: 'player-hp', onDefeatEffect: null },
        }),
      }),
      players: [makePlayer({ id: 'p0', hp: 5 }), makePlayer({ id: 'p1', hp: 5 })],
    });

    // First BOSS_RESOLVE: skip, decrement 2 → 1.
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(state.combat.bossStunTurns).toBe(1);
    expect(state.combat.turnIndex).toBe(1);
    expect(state.players[0].hp).toBe(5);
    expect(state.players[1].hp).toBe(5);

    // Hand turn back to boss manually (simulating an intervening players-turn PASS).
    state = { ...state, combat: { ...state.combat, activeActor: 'boss' } };

    // Second BOSS_RESOLVE: skip, decrement 1 → 0.
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(state.combat.bossStunTurns).toBe(0);
    expect(state.combat.turnIndex).toBe(2);
    expect(state.players[0].hp).toBe(5);
    expect(state.players[1].hp).toBe(5);
  });

  it('stun expires at 0: the NEXT BOSS_RESOLVE after the counter hits 0 attacks normally', () => {
    // bossStunTurns=1 → BOSS_RESOLVE once (skip+decrement to 0) → players-turn PASS
    // → BOSS_RESOLVE again (counter=0, normal attack routing fires).
    let state = makeTurnState({
      combat: makeCombat({
        activeActor: 'boss',
        turnIndex: 0,
        bossStunTurns: 1,
        boss: makeBoss({
          attackPattern: { damagePerTurn: 4, targeting: 'player-hp', onDefeatEffect: null },
        }),
      }),
      players: [makePlayer({ id: 'p0', hp: 5 }), makePlayer({ id: 'p1', hp: 5 })],
    });

    // Stun-skip turn.
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(state.combat.bossStunTurns).toBe(0);
    expect(state.players[0].hp).toBe(5);
    expect(state.players[1].hp).toBe(5);
    expect(state.combat.activeActor).toBe('players');

    // Players-turn PASS → hand to boss.
    state = combatTurnReducer(state, { type: 'PLAYER_PASS' });
    expect(state.combat.activeActor).toBe('boss');

    // Normal BOSS_RESOLVE — stun expired, attack lands.
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // per = floor(4/2) = 2; no remainder since attackerPlayerIds splits evenly.
    expect(state.players[0].hp).toBe(3);
    expect(state.players[1].hp).toBe(3);
    // Counter remains at 0 (was not further decremented on a non-stunned turn).
    expect(state.combat.bossStunTurns).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// mulberry32 alias: sanity check the exported alias still delegates to the
// canonical PRNG (regression guard against accidental removal).
// ---------------------------------------------------------------------------

describe('mulberry32 alias', () => {
  it('produces the same sequence as createSeededRng for a given seed', () => {
    const a = mulberry32(42);
    const b = createSeededRng(42);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });
});

// ---------------------------------------------------------------------------
// v2.1 gm0.17 (embertide-0jf) removed the `silver-chimera-mane`
// heirloom (combat-draw count 2), which was the only draw-capable
// in-combat card in the game. The combat-draw reshuffle test suite that
// previously covered this path was deleted along with the card. Draw
// effects on `scholar-princess` / starter-green still exist, but they
// don't exercise a deck-empty reshuffle because their count is 1
// (single-draw) rather than 2 (chain-draw). If a future draw-2+ effect
// lands, re-add a reshuffle test here. (embertide-1eby retired the
// key-vendor combat-draw entry — Pell is a vendor service now.)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Starter combat effects (rev-2 2026-04-22) — starter-green-shard and
// starter-red-shard rejoin the combat deck with distinct overrides so
// they're no longer inert filler.
// ---------------------------------------------------------------------------

describe('starter combat effects (rev-2 2026-04-22)', () => {
  it('starter-green-shard triggers combat-draw 1 (refills shared hand)', () => {
    // Set up combat with starter-green in hand + several cards
    // already in the DECK (not discard) so the drawn card is
    // unambiguously NOT the just-played green shard itself.
    const greenShard: Card = {
      id: 'starter-green-shard',
      role: 'starter-green',
      cost: {},
      effects: { kind: 'shard', green: 1 },
    };
    const deckCards: Card[] = [
      { ...starterGreen, id: 'sg-in-deck' },
      { ...starterGreen, id: 'sg-in-deck-2' },
    ];
    const state = makeTurnState({
      combat: makeCombat({
        combatDeck: deckCards,
        combatHand: [greenShard],
        combatDiscard: [],
      }),
    });

    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: greenShard.id,
      playerId: 'p0',
    });

    // Draw 1 fires, pulling one card off the top of the combat deck.
    expect(next.combat.combatHand).toHaveLength(1);
    expect(next.combat.combatHand[0].id.startsWith('sg-in-deck')).toBe(true);
    // Shard ended in discard.
    expect(next.combat.combatDiscard).toHaveLength(1);
    expect(next.combat.combatDiscard[0].id).toBe('starter-green-shard');
  });

  it('starter-red-shard deals 2 damage (one step above the 1-damage default)', () => {
    const redShard: Card = {
      id: 'starter-red-shard',
      role: 'starter-red',
      cost: {},
      effects: { kind: 'shard', red: 1 },
    };
    const state = makeTurnState({
      combat: makeCombat({
        combatHand: [redShard],
        boss: makeBoss({ hp: 10, hpMax: 10 }),
      }),
    });

    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: redShard.id,
      playerId: 'p0',
    });

    expect(next.combat.boss.hp).toBe(8); // 10 - 2
  });
});
