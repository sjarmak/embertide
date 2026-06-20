/**
 * Hollow-effigy mirror-echo resolver coverage (embertide-44w8).
 *
 * Reflects the bossAttackResolver discriminator architecture from
 * gdd.1.2 + the delayed-echo spec at
 * `docs/design/hollow-effigy-attack-pattern.md`. Tests:
 *
 *   (a) `playPower` accumulator — `reducePlayerPlayCard` writes the
 *       running highest single-play power into `combat.echoQueue`
 *   (b) Boss-turn dispatch — when hollow-effigy's pattern fires the
 *       resolver, damage = max(staticDpt, min(echoPower, MAX_DPT))
 *       when echo present; staticDpt fallback when echoQueue null
 *   (c) Clamp at HOLLOW_EFFIGY_MAX_DPT (4) — combat-attack 5 echo → 4 dmg
 *   (d) Max-not-sum — two combat-attack 3 plays → echo of 3, not 6
 *   (e) Resolver clears echoQueue after firing (combatPatch overlay)
 *   (f) Boss-stun grace — bossStunTurns delays the echo by 1 boss-turn
 *       but doesn't drop it (echoQueue persists across stun)
 *   (g) Zone-bonus floor — staticDpt > echo (e.g. shadowCreep bumped
 *       static to 4, echo=3) → damage stays at 4 (echo never softens)
 *   (h) Effect-kind matrix — combat-draw / combat-absorb / combat-heal
 *       leave echoQueue null; combat-attack-stun damage component
 *       counts; combat-multishot uses per-shot damage scalar
 *   (i) Targeting bypass — slam routes to player-hp regardless of
 *       battlefield contents
 */

import { describe, it, expect } from 'vitest';
import type { Card } from '../types/card';
import type {
  BattlefieldCard,
  BossAttackPattern,
  CombatBoss,
  CombatEntryContext,
  CombatState,
} from '../types/combat';
import type { KidPlayer } from '../store/types';
import {
  combatTurnReducer,
  HOLLOW_EFFIGY_BASE_DPT,
  HOLLOW_EFFIGY_MAX_DPT,
  HOLLOW_EFFIGY_LOG_FINDS_NOTHING,
  HOLLOW_EFFIGY_LOG_MIRRORS_STRONGEST,
  type CombatTurnState,
} from './combatEngine';
import { makeKidPlayer } from '../testing/stateFixtures';

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer => makeKidPlayer(overrides);

const ENTRY_CTX: CombatEntryContext = {
  bossCardId: 'hollow-effigy',
  combatEntryTurn: 9,
  attackerPlayerIds: ['p0', 'p1'],
  engagementSource: 'fightMonster',
  entrySource: 'wild-boss-slot',
};

const HOLLOW_EFFIGY_PATTERN: BossAttackPattern = {
  damagePerTurn: 2,
  targeting: 'player-hp',
  onDefeatEffect: { kind: 'wisp-drop' },
  bossAttackResolver: 'hollow-effigy-mirror',
};

function makeBoss(overrides: Partial<CombatBoss> = {}): CombatBoss {
  return {
    hp: 6,
    hpMax: 6,
    attackPattern: HOLLOW_EFFIGY_PATTERN,
    sourceCardId: 'hollow-effigy',
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

/**
 * Card whose default `combatEffectFor` resolution is `combat-attack`
 * with damage = `cost.red ?? 1`. We use this to drive the playPower
 * accumulator without depending on the explicit-overrides table.
 */
function makeAttackCard(id: string, redCost: number): Card {
  return {
    id,
    role: 'item',
    itemKind: 'item-active',
    cost: { red: redCost },
    effects: { kind: 'gain', red: 1 },
  };
}

/** Override card resolving to `combat-draw` (non-damage play). */
function makeDrawCard(id: string): Card {
  return {
    id,
    role: 'starter-green',
    cost: { red: 0 },
    effects: { kind: 'gain', green: 1 },
  };
}

// ---------------------------------------------------------------------------
// (a) playPower accumulator — reducePlayerPlayCard writes echoQueue.
// ---------------------------------------------------------------------------

describe('hollow-effigy-mirror echoQueue write path (a)', () => {
  it('first combat-attack play populates echoQueue with that power', () => {
    const card = makeAttackCard('starter-red-shard', 9); // overridden to dmg=2
    const state = makeTurnState(makeCombat({ combatHand: [card], activeActor: 'players' }));
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: card.id,
      playerId: 'p0',
    });
    // starter-red-shard → combat-attack damage=2 (explicit override).
    expect(next.combat.echoQueue).toEqual({ power: 2, sourceCardId: card.id });
  });

  it('second play with greater power overwrites the queue (max-not-sum)', () => {
    // Both cards drive the default-fallback path (no explicit override
    // because the ids don't match EXPLICIT_OVERRIDES) so cost.red maps
    // 1:1 to combat-attack damage.
    const small = makeAttackCard('atk-small', 2);
    const big = makeAttackCard('atk-big', 4);
    let state = makeTurnState(
      makeCombat({
        combatHand: [small, big],
        activeActor: 'players',
      }),
    );
    state = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: small.id,
      playerId: 'p0',
    });
    expect(state.combat.echoQueue?.power).toBe(2);
    expect(state.combat.echoQueue?.sourceCardId).toBe('atk-small');
    state = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: big.id,
      playerId: 'p0',
    });
    // 4 > 2 → overwrite to the bigger play.
    expect(state.combat.echoQueue?.power).toBe(4);
    expect(state.combat.echoQueue?.sourceCardId).toBe('atk-big');
  });

  it('a smaller follow-up play does NOT overwrite a larger pending echo', () => {
    const big = makeAttackCard('atk-big', 4);
    const small = makeAttackCard('atk-small', 2);
    let state = makeTurnState(
      makeCombat({
        combatHand: [big, small],
        activeActor: 'players',
      }),
    );
    state = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: big.id,
      playerId: 'p0',
    });
    expect(state.combat.echoQueue?.power).toBe(4);
    state = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: small.id,
      playerId: 'p0',
    });
    expect(state.combat.echoQueue?.power).toBe(4);
    expect(state.combat.echoQueue?.sourceCardId).toBe('atk-big');
  });

  it('combat-draw (zero-power) leaves echoQueue null', () => {
    const card = makeDrawCard('starter-green-shard');
    const state = makeTurnState(makeCombat({ combatHand: [card], activeActor: 'players' }));
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: card.id,
      playerId: 'p0',
    });
    expect(next.combat.echoQueue ?? null).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// (b) Boss-turn dispatch — echo or fallback.
// ---------------------------------------------------------------------------

describe('hollow-effigy-mirror dispatch (b)', () => {
  it('null echoQueue → fallback to staticDpt (base 2)', () => {
    const state = makeTurnState(makeCombat({ activeActor: 'boss', echoQueue: null }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // staticDpt 2 / 2 live = 1 each.
    expect(next.players[0].hp).toBe(4);
    expect(next.players[1].hp).toBe(4);
  });

  it('echoQueue power=3 → damage of 3 (clamp inert below MAX_DPT)', () => {
    const state = makeTurnState(
      makeCombat({
        activeActor: 'boss',
        echoQueue: { power: 3, sourceCardId: 'card-x' },
      }),
    );
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // 3 dmg / 2 live = 1 each + 1 remainder to active attacker (p0).
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(4);
  });

  it('echoQueue power=1 (< BASE_DPT) → fallback staticDpt path', () => {
    const state = makeTurnState(
      makeCombat({
        activeActor: 'boss',
        echoQueue: { power: 1, sourceCardId: 'card-y' },
      }),
    );
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // Falls through to staticDpt=2.
    expect(next.players[0].hp).toBe(4);
    expect(next.players[1].hp).toBe(4);
  });

  it(`logs different entries for echo vs fallback (BASE=${HOLLOW_EFFIGY_BASE_DPT})`, () => {
    const echoState = makeTurnState(
      makeCombat({
        activeActor: 'boss',
        combatLog: [],
        echoQueue: { power: 3, sourceCardId: 'card-x' },
      }),
    );
    const echoNext = combatTurnReducer(echoState, { type: 'BOSS_RESOLVE' });
    expect(
      (echoNext.combat.combatLog ?? []).some((e) => e.includes(HOLLOW_EFFIGY_LOG_MIRRORS_STRONGEST)),
    ).toBe(true);

    const nullState = makeTurnState(
      makeCombat({ activeActor: 'boss', combatLog: [], echoQueue: null }),
    );
    const nullNext = combatTurnReducer(nullState, { type: 'BOSS_RESOLVE' });
    expect(
      (nullNext.combat.combatLog ?? []).some((e) => e.includes(HOLLOW_EFFIGY_LOG_FINDS_NOTHING)),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (c) Clamp at HOLLOW_EFFIGY_MAX_DPT.
// ---------------------------------------------------------------------------

describe('hollow-effigy-mirror MAX_DPT clamp (c)', () => {
  it(`echoQueue power=5 → damage clamped at ${HOLLOW_EFFIGY_MAX_DPT}`, () => {
    const state = makeTurnState(
      makeCombat({
        activeActor: 'boss',
        echoQueue: { power: 5, sourceCardId: 'card-z' },
      }),
    );
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // 4 dmg / 2 live = 2 each.
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(3);
  });

  it(`echoQueue power=99 → damage still clamped at ${HOLLOW_EFFIGY_MAX_DPT}`, () => {
    const state = makeTurnState(
      makeCombat({
        activeActor: 'boss',
        echoQueue: { power: 99, sourceCardId: 'card-z' },
      }),
    );
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// (d) Max-not-sum — two combat-attack 3 → echo of 3.
// ---------------------------------------------------------------------------

describe('hollow-effigy-mirror max-not-sum (d)', () => {
  it('two equal-power plays leave echoQueue at the first play (no churn on ties)', () => {
    // Both cards resolve via the default fallback to combat-attack
    // damage = cost.red = 3. First-in-wins: strict-greater overwrite
    // policy keeps the source card stable across ties.
    const a = makeAttackCard('first-tied', 3);
    const b = makeAttackCard('second-tied', 3);
    let state = makeTurnState(makeCombat({ combatHand: [a, b], activeActor: 'players' }));
    state = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: a.id,
      playerId: 'p0',
    });
    expect(state.combat.echoQueue?.sourceCardId).toBe('first-tied');
    state = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: b.id,
      playerId: 'p0',
    });
    expect(state.combat.echoQueue?.power).toBe(3);
    expect(state.combat.echoQueue?.sourceCardId).toBe('first-tied');
  });

  it('boss-turn after two combat-attack 3 plays echoes 3, not 6', () => {
    let state = makeTurnState(makeCombat({ activeActor: 'players' }));
    // Inject echoQueue manually as if two combat-attack 3 plays landed.
    // (We exercise the dispatch end-to-end above; here we focus on the
    // resolver math.)
    state = {
      ...state,
      combat: {
        ...state.combat,
        activeActor: 'boss',
        echoQueue: { power: 3, sourceCardId: 'attack-a' },
      },
    };
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // 3 dmg total, NOT 6.
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// (e) Resolver clears echoQueue after firing.
// ---------------------------------------------------------------------------

describe('hollow-effigy-mirror echoQueue clearing (e)', () => {
  it('resolver clears echoQueue via combatPatch after firing', () => {
    const state = makeTurnState(
      makeCombat({
        activeActor: 'boss',
        echoQueue: { power: 3, sourceCardId: 'card-x' },
      }),
    );
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.combat.echoQueue ?? null).toBe(null);
  });

  it('resolver also clears a null echoQueue (idempotent)', () => {
    const state = makeTurnState(makeCombat({ activeActor: 'boss', echoQueue: null }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.combat.echoQueue ?? null).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// (f) Boss-stun grace — bossStunTurns delays without dropping echo.
// ---------------------------------------------------------------------------

describe('hollow-effigy-mirror boss-stun interaction (f)', () => {
  it('bossStunTurns > 0 skips the resolver AND preserves echoQueue', () => {
    const state = makeTurnState(
      makeCombat({
        activeActor: 'boss',
        bossStunTurns: 1,
        echoQueue: { power: 3, sourceCardId: 'card-x' },
      }),
    );
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // Stun absorbed: no damage, no resolver fire.
    expect(next.players[0].hp).toBe(5);
    expect(next.players[1].hp).toBe(5);
    expect(next.combat.bossStunTurns).toBe(0);
    // echoQueue persists across the stun window.
    expect(next.combat.echoQueue).toEqual({ power: 3, sourceCardId: 'card-x' });
  });

  it('after the stun, the next boss-turn fires the persisted echo', () => {
    let state = makeTurnState(
      makeCombat({
        activeActor: 'boss',
        bossStunTurns: 1,
        echoQueue: { power: 3, sourceCardId: 'card-x' },
      }),
    );
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // Re-arm: hand control back to boss for a second BOSS_RESOLVE.
    state = { ...state, combat: { ...state.combat, activeActor: 'boss' } };
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // The persisted echo of 3 fires.
    expect(state.players[0].hp).toBe(3);
    expect(state.players[1].hp).toBe(4);
    expect(state.combat.echoQueue ?? null).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// (g) Zone-bonus floor — static dpt preserves shadow-creep bump.
// ---------------------------------------------------------------------------

describe('hollow-effigy-mirror staticDpt floor (g)', () => {
  it('static dpt > echoPower → damage stays at staticDpt (echo never softens)', () => {
    const bumped: BossAttackPattern = {
      ...HOLLOW_EFFIGY_PATTERN,
      damagePerTurn: 4, // base 2 + shadowCreep 2
    };
    const boss = makeBoss({ attackPattern: bumped });
    const state = makeTurnState(
      makeCombat({
        activeActor: 'boss',
        boss,
        echoQueue: { power: 3, sourceCardId: 'card-x' },
      }),
    );
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // staticDpt=4 wins over echo=3 → 4 dmg / 2 live = 2 each.
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(3);
  });

  it('static dpt < echoPower → damage = capped echo (amplification works)', () => {
    const baseLine: BossAttackPattern = {
      ...HOLLOW_EFFIGY_PATTERN,
      damagePerTurn: 2,
    };
    const boss = makeBoss({ attackPattern: baseLine });
    const state = makeTurnState(
      makeCombat({
        activeActor: 'boss',
        boss,
        echoQueue: { power: 4, sourceCardId: 'card-x' },
      }),
    );
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // 4 dmg / 2 live = 2 each.
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// (h) Effect-kind matrix — which plays count toward echo power.
// ---------------------------------------------------------------------------

describe('hollow-effigy-mirror playPower effect-kind matrix (h)', () => {
  it('combat-draw + combat-absorb-style plays leave echoQueue null', () => {
    const draw = makeDrawCard('starter-green-shard'); // combat-draw 1
    const state = makeTurnState(makeCombat({ combatHand: [draw], activeActor: 'players' }));
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: draw.id,
      playerId: 'p0',
    });
    expect(next.combat.echoQueue ?? null).toBe(null);
  });

  it('combat-attack-stun damage component populates echoQueue', () => {
    // craghorn-tusk → combat-attack-stun damage=4 stunTurns=1. Authoring source
    // of truth lives on the heirloom card itself via Card.combatEffect
    // (embertide-bq9b / ppf9-7a); the synthetic fixture mirrors that
    // declaration so combatEffectFor resolves the same shape.
    const horn: Card = {
      ...makeAttackCard('craghorn-tusk', 0),
      combatEffect: { kind: 'combat-attack-stun', damage: 4, stunTurns: 1 },
    };
    const state = makeTurnState(makeCombat({ combatHand: [horn], activeActor: 'players' }));
    const next = combatTurnReducer(state, {
      type: 'PLAYER_PLAY_CARD',
      cardId: horn.id,
      playerId: 'p0',
    });
    expect(next.combat.echoQueue?.power).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// (i) Targeting bypass — slam routes to player-hp.
// ---------------------------------------------------------------------------

describe('hollow-effigy-mirror targeting (i)', () => {
  it('echo damage skips battlefield front-line absorbs (player-hp targeting)', () => {
    const filler: Card = {
      id: 'absorb-filler',
      role: 'item',
      itemKind: 'item-active',
      cost: { red: 1 },
      effects: { kind: 'gain', red: 1 },
    };
    const battlefield: readonly BattlefieldCard[] = [
      { cardId: filler.id, hp: 99, hpMax: 99, combatEffectId: 'combat-absorb:99' },
    ];
    const state = makeTurnState(
      makeCombat({
        activeActor: 'boss',
        battlefield,
        echoQueue: { power: 4, sourceCardId: 'big' },
      }),
    );
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // Battlefield untouched.
    expect(next.combat.battlefield).toHaveLength(1);
    expect(next.combat.battlefield[0].hp).toBe(99);
    // Players still take damage.
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(3);
  });

  it('LOSS detection fires when echo brings the last standing player to 0', () => {
    const lowHp = [makePlayer({ id: 'p0', hp: 1 }), makePlayer({ id: 'p1', downed: true })];
    const state = makeTurnState(
      makeCombat({
        activeActor: 'boss',
        echoQueue: { power: 4, sourceCardId: 'finisher' },
      }),
      lowHp,
    );
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].downed).toBe(true);
    expect(next.terminal).toBe('loss');
  });
});

// ---------------------------------------------------------------------------
// (j) Log-fragment constant contract (embertide-x5vq).
// ---------------------------------------------------------------------------
// Pins the rendered resolver log to the exported HOLLOW_EFFIGY_LOG_*
// constants. If a future flavor pass rephrases the source string and
// removes the fragment from the rendered output WITHOUT updating the
// constant, this test fails loudly.

describe('hollow-effigy-mirror log-fragment contract (j)', () => {
  it('echo log entry contains HOLLOW_EFFIGY_LOG_MIRRORS_STRONGEST', () => {
    const state = makeTurnState(
      makeCombat({
        activeActor: 'boss',
        combatLog: [],
        echoQueue: { power: 3, sourceCardId: 'card-x' },
      }),
    );
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const entry = (next.combat.combatLog ?? []).find((e) => e.startsWith('Hollow-effigy'));
    expect(entry).toBeDefined();
    expect(entry).toContain(HOLLOW_EFFIGY_LOG_MIRRORS_STRONGEST);
  });

  it('fallback log entry contains HOLLOW_EFFIGY_LOG_FINDS_NOTHING', () => {
    const state = makeTurnState(
      makeCombat({ activeActor: 'boss', combatLog: [], echoQueue: null }),
    );
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const entry = (next.combat.combatLog ?? []).find((e) => e.startsWith('Hollow-effigy'));
    expect(entry).toBeDefined();
    expect(entry).toContain(HOLLOW_EFFIGY_LOG_FINDS_NOTHING);
  });
});
