/**
 * Tidewraith tentacle-grab dynamic resolver coverage (embertide-gdd.1.2).
 *
 * Reflects the bossAttackResolver discriminator architecture introduced
 * in gdd.1.2 (per the gdd.2.4 spec). Tests:
 *
 *   (a) `tidewraithTentacleGrabDpt` — the curve clamp(2, 2 + floor(g/2), 5)
 *       evaluates correctly at low / mid / high tideGauge
 *   (b) Boss-turn dispatch — when tidewraith's pattern enters the engine
 *       with `bossAttackResolver: 'tidewraith-tentacle-grab'`, the dpt
 *       used at boss-resolve time matches the dynamic curve, NOT the
 *       static `damagePerTurn` field
 *   (c) Chain-discard side effect — at the high-tide threshold the
 *       resolver removes 1 card from each non-downed attacker's hand
 *       and appends it to the discard pile
 *   (d) Telegraph log — the resolver writes a `Tidewraith gathers the
 *       tide... will hit for N` entry into `combat.combatLog` on every
 *       fire
 *   (e) No-op-when-no-snapshot — a boss-turn fired without a tideGauge
 *       snapshot uses the base dpt 2 and skips the chain-discard
 *
 * The resolver-discriminator dispatch is exercised through the public
 * `combatTurnReducer` so the wiring is covered end-to-end.
 */

import { describe, it, expect } from 'vitest';
import type { Card } from '../types/card';
import type {
  BossAttackPattern,
  CombatBoss,
  CombatEntryContext,
  CombatState,
} from '../types/combat';
import type { KidPlayer } from '../store/types';
import {
  combatTurnReducer,
  tidewraithTentacleGrabDpt,
  TIDEWRAITH_TENTACLE_GRAB_BASE_DPT,
  TIDEWRAITH_TENTACLE_GRAB_MAX_DPT,
  TIDEWRAITH_TENTACLE_GRAB_HIGH_TIDE_THRESHOLD,
  TIDEWRAITH_LOG_TELEGRAPH_PREFIX,
  TIDEWRAITH_LOG_WILL_HIT,
  TIDEWRAITH_LOG_TENTACLES_DRAG,
  type CombatTurnState,
} from './combatEngine';
import { makeKidPlayer } from '../testing/stateFixtures';

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer => makeKidPlayer(overrides);

const ENTRY_CTX: CombatEntryContext = {
  bossCardId: 'tidewraith',
  combatEntryTurn: 4,
  attackerPlayerIds: ['p0', 'p1'],
  engagementSource: 'fightMonster',
  entrySource: 'field',
};

const TIDEWRAITH_PATTERN: BossAttackPattern = {
  damagePerTurn: 3,
  targeting: 'battlefield-then-player',
  onDefeatEffect: { kind: 'none' },
  bossAttackResolver: 'tidewraith-tentacle-grab',
};

function makeBoss(): CombatBoss {
  return {
    hp: 16,
    hpMax: 16,
    attackPattern: TIDEWRAITH_PATTERN,
    sourceCardId: 'tidewraith',
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

function makeFiller(id: string, costRed = 1): Card {
  return {
    id,
    role: 'starter-red',
    cost: { red: costRed },
    effects: { kind: 'gain', red: 1 },
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
// (a) tidewraithTentacleGrabDpt curve.
// ---------------------------------------------------------------------------

describe('tidewraithTentacleGrabDpt curve (a)', () => {
  it(`base dpt is ${TIDEWRAITH_TENTACLE_GRAB_BASE_DPT} at tideGauge=0`, () => {
    expect(tidewraithTentacleGrabDpt(0)).toBe(TIDEWRAITH_TENTACLE_GRAB_BASE_DPT);
  });

  it('still 2 at tideGauge=1 (half-tick increments via floor)', () => {
    expect(tidewraithTentacleGrabDpt(1)).toBe(2);
  });

  it('bumps to 3 at tideGauge=2', () => {
    expect(tidewraithTentacleGrabDpt(2)).toBe(3);
  });

  it('still 3 at tideGauge=3', () => {
    expect(tidewraithTentacleGrabDpt(3)).toBe(3);
  });

  it(`bumps to 4 at the high-tide threshold (tideGauge=${TIDEWRAITH_TENTACLE_GRAB_HIGH_TIDE_THRESHOLD})`, () => {
    expect(tidewraithTentacleGrabDpt(TIDEWRAITH_TENTACLE_GRAB_HIGH_TIDE_THRESHOLD)).toBe(4);
  });

  it(`clamps at MAX_DPT (${TIDEWRAITH_TENTACLE_GRAB_MAX_DPT}) for very high tideGauge`, () => {
    expect(tidewraithTentacleGrabDpt(8)).toBe(TIDEWRAITH_TENTACLE_GRAB_MAX_DPT);
    expect(tidewraithTentacleGrabDpt(100)).toBe(TIDEWRAITH_TENTACLE_GRAB_MAX_DPT);
  });

  it('clamps at base for negative / fractional inputs (defensive)', () => {
    expect(tidewraithTentacleGrabDpt(-5)).toBe(TIDEWRAITH_TENTACLE_GRAB_BASE_DPT);
    expect(tidewraithTentacleGrabDpt(0.5)).toBe(TIDEWRAITH_TENTACLE_GRAB_BASE_DPT);
  });
});

// ---------------------------------------------------------------------------
// (b) Boss-turn dispatch through the resolver.
// ---------------------------------------------------------------------------

describe('combatTurnReducer — tidewraith-tentacle-grab dispatch (b)', () => {
  it('low tideGauge (snapshot=0) deals 2 damage on the boss-turn', () => {
    const state = makeTurnState(makeCombat({ tideGaugeSnapshot: 0 }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // 2 damage / 2 live players = 1 each, no remainder.
    expect(next.players[0].hp).toBe(4);
    expect(next.players[1].hp).toBe(4);
  });

  it('mid tideGauge (snapshot=2) deals 3 damage on the boss-turn', () => {
    const state = makeTurnState(makeCombat({ tideGaugeSnapshot: 2 }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // 3 damage / 2 live players = 1 each + remainder 1 to active attacker (p0).
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(4);
  });

  it(`high tideGauge (snapshot=${TIDEWRAITH_TENTACLE_GRAB_HIGH_TIDE_THRESHOLD}) deals 4 damage`, () => {
    const state = makeTurnState(
      makeCombat({ tideGaugeSnapshot: TIDEWRAITH_TENTACLE_GRAB_HIGH_TIDE_THRESHOLD }),
    );
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // 4 damage / 2 live = 2 each.
    expect(next.players[0].hp).toBe(3);
    expect(next.players[1].hp).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// (c) Chain-discard side effect at high-tide threshold.
// ---------------------------------------------------------------------------

describe('tidewraith chain-discard side effect (c)', () => {
  it('does NOT discard hand cards below the high-tide threshold', () => {
    const handCard = makeFiller('starter-red-1');
    const players: readonly KidPlayer[] = [
      makePlayer({ id: 'p0', hand: [handCard] }),
      makePlayer({ id: 'p1', hand: [makeFiller('starter-red-2')] }),
    ];
    const state = makeTurnState(makeCombat({ tideGaugeSnapshot: 3 }), players);
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hand).toHaveLength(1);
    expect(next.players[1].hand).toHaveLength(1);
    expect(next.players[0].discard).toHaveLength(0);
    expect(next.players[1].discard).toHaveLength(0);
  });

  it(`discards 1 hand-card per attacker at tideGauge >= ${TIDEWRAITH_TENTACLE_GRAB_HIGH_TIDE_THRESHOLD}`, () => {
    const players: readonly KidPlayer[] = [
      makePlayer({ id: 'p0', hand: [makeFiller('a'), makeFiller('b')] }),
      makePlayer({ id: 'p1', hand: [makeFiller('c'), makeFiller('d')] }),
    ];
    const state = makeTurnState(
      makeCombat({ tideGaugeSnapshot: TIDEWRAITH_TENTACLE_GRAB_HIGH_TIDE_THRESHOLD }),
      players,
    );
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hand).toHaveLength(1);
    expect(next.players[1].hand).toHaveLength(1);
    expect(next.players[0].discard).toHaveLength(1);
    expect(next.players[1].discard).toHaveLength(1);
    // The dropped card is the most-recently-drawn (last-in-first-discarded).
    expect(next.players[0].discard[0].id).toBe('b');
    expect(next.players[1].discard[0].id).toBe('d');
  });

  it('does not discard from a downed player (chain-grab only fires on standing attackers)', () => {
    const players: readonly KidPlayer[] = [
      makePlayer({ id: 'p0', downed: true, hand: [makeFiller('a')] }),
      makePlayer({ id: 'p1', hand: [makeFiller('b')] }),
    ];
    const state = makeTurnState(
      makeCombat({ tideGaugeSnapshot: TIDEWRAITH_TENTACLE_GRAB_HIGH_TIDE_THRESHOLD }),
      players,
    );
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hand).toHaveLength(1); // downed → untouched
    expect(next.players[0].discard).toHaveLength(0);
    expect(next.players[1].hand).toHaveLength(0);
    expect(next.players[1].discard).toHaveLength(1);
  });

  it('is idempotent against an already-empty hand (no NaN, no crash)', () => {
    const players: readonly KidPlayer[] = [
      makePlayer({ id: 'p0', hand: [] }),
      makePlayer({ id: 'p1', hand: [] }),
    ];
    const state = makeTurnState(
      makeCombat({ tideGaugeSnapshot: TIDEWRAITH_TENTACLE_GRAB_HIGH_TIDE_THRESHOLD }),
      players,
    );
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.players[0].hand).toHaveLength(0);
    expect(next.players[0].discard).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// (d) Telegraph log entry.
// ---------------------------------------------------------------------------

describe('tidewraith telegraph log (d)', () => {
  it('writes a "Tidewraith gathers the tide..." entry on every fire', () => {
    const state = makeTurnState(makeCombat({ tideGaugeSnapshot: 2, combatLog: [] }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const log = next.combat.combatLog ?? [];
    expect(log.some((entry) => entry.startsWith(TIDEWRAITH_LOG_TELEGRAPH_PREFIX))).toBe(true);
    // Damage figure is rendered into the entry.
    expect(log.some((entry) => entry.includes(TIDEWRAITH_LOG_WILL_HIT) && entry.includes('3'))).toBe(
      true,
    );
  });

  it('also writes a chain-discard entry on the high-tide fire', () => {
    const players: readonly KidPlayer[] = [
      makePlayer({ id: 'p0', hand: [makeFiller('a')] }),
      makePlayer({ id: 'p1', hand: [makeFiller('b')] }),
    ];
    const state = makeTurnState(
      makeCombat({
        tideGaugeSnapshot: TIDEWRAITH_TENTACLE_GRAB_HIGH_TIDE_THRESHOLD,
        combatLog: [],
      }),
      players,
    );
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const log = next.combat.combatLog ?? [];
    expect(log.some((entry) => entry.includes(TIDEWRAITH_LOG_TENTACLES_DRAG))).toBe(true);
  });

  it('preserves prior combatLog entries (append-only)', () => {
    const state = makeTurnState(
      makeCombat({ tideGaugeSnapshot: 0, combatLog: ['p0 played starter-red'] }),
    );
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const log = next.combat.combatLog ?? [];
    expect(log[0]).toBe('p0 played starter-red');
    expect(log.length).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// (e) No-op when no tideGauge progress.
// ---------------------------------------------------------------------------

describe('tidewraith — no-snapshot fallback (e)', () => {
  it('a combat constructed without tideGaugeSnapshot defaults to base dpt 2', () => {
    // Build a combat without setting tideGaugeSnapshot at all (mirrors a
    // pre-gdd.1.2 mock that omits the field).
    const minimalCombat: CombatState = {
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
    };
    const state = makeTurnState(minimalCombat);
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    // 2 damage / 2 live = 1 each (snapshot defaults to 0 → base dpt 2).
    expect(next.players[0].hp).toBe(4);
    expect(next.players[1].hp).toBe(4);
    // No chain-discard at zero gauge.
    expect(next.players[0].hand).toHaveLength(0);
    expect(next.players[0].discard).toHaveLength(0);
  });

  it('echoQueue stays null on a tidewraith boss-turn (resolver does not write to it)', () => {
    const state = makeTurnState(makeCombat({ tideGaugeSnapshot: 2, echoQueue: null }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    expect(next.combat.echoQueue ?? null).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// (f) Log-fragment constant contract (embertide-x5vq).
// ---------------------------------------------------------------------------
// Pins the rendered resolver log to the exported TIDEWRAITH_LOG_*
// constants. If a future flavor pass rephrases the source string and
// removes the fragment from the rendered output WITHOUT updating the
// constant, this test fails loudly.

describe('tidewraith-tentacle-grab log-fragment contract (f)', () => {
  it('telegraph log entry starts with TIDEWRAITH_LOG_TELEGRAPH_PREFIX and contains TIDEWRAITH_LOG_WILL_HIT', () => {
    const state = makeTurnState(makeCombat({ tideGaugeSnapshot: 2, combatLog: [] }));
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const entry = (next.combat.combatLog ?? []).find((e) =>
      e.startsWith(TIDEWRAITH_LOG_TELEGRAPH_PREFIX),
    );
    expect(entry).toBeDefined();
    expect(entry).toContain(TIDEWRAITH_LOG_WILL_HIT);
  });

  it('high-tide chain-discard log contains TIDEWRAITH_LOG_TENTACLES_DRAG', () => {
    const players: readonly KidPlayer[] = [
      makePlayer({ id: 'p0', hand: [makeFiller('a')] }),
      makePlayer({ id: 'p1', hand: [makeFiller('b')] }),
    ];
    const state = makeTurnState(
      makeCombat({
        tideGaugeSnapshot: TIDEWRAITH_TENTACLE_GRAB_HIGH_TIDE_THRESHOLD,
        combatLog: [],
      }),
      players,
    );
    const next = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    const entry = (next.combat.combatLog ?? []).find((e) => e.startsWith("Tidewraith's"));
    expect(entry).toBeDefined();
    expect(entry).toContain(TIDEWRAITH_LOG_TENTACLES_DRAG);
  });
});
