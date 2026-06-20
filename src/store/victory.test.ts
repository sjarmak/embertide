import { describe, it, expect } from 'vitest';
import { createSeededRng } from '../rules/chestPool';
import { KID_CARDS, baseIdOf } from '../data/cards';
import { createGameStore, applyDamage } from './gameStore';
import { checkCoopVictory, EMBERTIDE_PIECES_TO_WIN } from './slices/endgame';
import { fightMonster } from './slices/combat';
import type { KidGameState, KidPlayer, SharedEmbertide } from './types';
import { makeKidPlayer, makeKidGameState } from '../testing/stateFixtures';

// ---------------------------------------------------------------------------
// Minimal fixtures. These don't depend on initGame so each test can craft
// the exact shared-pool / per-player shape it needs.
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

const SPEAR_ORC = KID_CARDS.find((c) => c.id === 'spear-orc')!; // red cost 4
const GRUNT_ORC = KID_CARDS.find((c) => c.id === 'grunt-orc')!; // red cost 3

describe('v2 co-op victory (amendment A2) — checkCoopVictory', () => {
  it('sentinel: EMBERTIDE_PIECES_TO_WIN is exported as 3', () => {
    expect(EMBERTIDE_PIECES_TO_WIN).toBe(3);
  });

  it('(a) sharedEmbertide with all 3 paths complete → outcome === "win"', () => {
    const state = makeState({
      sharedEmbertide: { wisdom: true, courage: true, power: true },
    });
    const next = checkCoopVictory(state);
    expect(next.outcome).toBe('win');
  });

  it('(b) 5 HP with no shards granted is NOT a victory (v1 hearts=5 rule is gone)', () => {
    const state = makeState({
      players: [
        makePlayer({ id: 'p0', hp: 5, hpMax: 5 }),
        makePlayer({ id: 'p1', hp: 5, hpMax: 5 }),
      ],
      sharedEmbertide: { wisdom: false, courage: false, power: false },
    });
    const next = checkCoopVictory(state);
    expect(next.outcome).toBeNull();
  });

  it('partial shard pool (2 of 3) is not a victory', () => {
    const partials: SharedEmbertide[] = [
      { wisdom: true, courage: true, power: false },
      { wisdom: true, courage: false, power: true },
      { wisdom: false, courage: true, power: true },
    ];
    for (const sharedEmbertide of partials) {
      const state = makeState({ sharedEmbertide });
      expect(checkCoopVictory(state).outcome).toBeNull();
    }
  });

  it('is a no-op when outcome is already resolved', () => {
    const state = makeState({
      sharedEmbertide: { wisdom: true, courage: true, power: true },
      outcome: 'loss',
    });
    const next = checkCoopVictory(state);
    expect(next.outcome).toBe('loss');
  });
});

describe('v2 combat: HP heals instead of additive hearts, no shard grants', () => {
  it('(c) defeating three 2-power beasts yields HP heals clamped at hpMax and 0 shards', () => {
    // Set up a player with hpMax=5 but currently at 2 HP so we can observe
    // three +1 heals land (2 → 3 → 4 → 5, then further heals are capped).
    let state = makeState({
      players: [
        makePlayer({
          id: 'p0',
          hp: 2,
          hpMax: 5,
          red: 20,
        }),
        makePlayer({ id: 'p1' }),
      ],
      // Use three distinct copies of a simple beast (grunt-orc drops 1 heart
      // in v1 schema → 1 HP heal in v2). We stage them as field cards in
      // sequence.
      field: [
        { ...GRUNT_ORC, id: 'grunt-orc-a' },
        { ...GRUNT_ORC, id: 'grunt-orc-b' },
        { ...GRUNT_ORC, id: 'grunt-orc-c' },
      ],
    });

    state = fightMonster(state, 0, 'grunt-orc-a');
    expect(state.players[0].hp).toBe(3);
    state = fightMonster(state, 0, 'grunt-orc-b');
    expect(state.players[0].hp).toBe(4);
    state = fightMonster(state, 0, 'grunt-orc-c');
    // 3rd kill lifts hp to 5 (hpMax). A hypothetical 4th would stay at 5.
    expect(state.players[0].hp).toBe(5);

    // Critical invariant: beasts never grant shards in v2 (amendment A2).
    expect(state.sharedEmbertide.wisdom).toBe(false);
    expect(state.sharedEmbertide.courage).toBe(false);
    expect(state.sharedEmbertide.power).toBe(false);
  });

  it('heart reward at full hp grows hp + hpMax up to HP_CAP (vital-ember pass 2026-04-22)', () => {
    // Previously asserted "no overflow" — heart drops at full hp were
    // silently discarded, which masked rewards from the player. The
    // vital-ember pass grows hp + hpMax by the drop amount up to
    // HP_CAP (10) so kills stay rewarding at full health.
    const state = makeState({
      players: [makePlayer({ id: 'p0', hp: 5, hpMax: 5, red: 20 }), makePlayer({ id: 'p1' })],
      field: [SPEAR_ORC],
    });
    const next = fightMonster(state, 0, SPEAR_ORC.id);
    // spear-orc drops 1 heart → grow hp + hpMax by 1 each.
    expect(next.players[0].hp).toBe(6);
    expect(next.players[0].hpMax).toBe(6);
  });
});

describe('v2 downed state (amendment A3)', () => {
  it('(d) a player with hp=0 gets downed=true set after a damaging action', () => {
    const p = makePlayer({ id: 'p0', hp: 1, hpMax: 5 });
    const damaged = applyDamage(p, 1);
    expect(damaged.hp).toBe(0);
    expect(damaged.downed).toBe(true);
    // Fresh incident — revivedThisIncident reset to false.
    expect(damaged.revivedThisIncident).toBe(false);
  });

  it('damage clamps at 0 — no negative HP', () => {
    const p = makePlayer({ id: 'p0', hp: 2, hpMax: 5 });
    const damaged = applyDamage(p, 99);
    expect(damaged.hp).toBe(0);
    expect(damaged.downed).toBe(true);
  });

  it('a damaging transition to 0 resets revivedThisIncident for a NEW incident', () => {
    // Previous incident: teammate-revive was consumed.
    const p = makePlayer({
      id: 'p0',
      hp: 1,
      hpMax: 5,
      downed: false,
      revivedThisIncident: true,
    });
    const damaged = applyDamage(p, 1);
    expect(damaged.downed).toBe(true);
    // New incident budget: revivedThisIncident cleared.
    expect(damaged.revivedThisIncident).toBe(false);
  });

  it('damage that does NOT drop to 0 leaves downed / revivedThisIncident untouched', () => {
    const p = makePlayer({
      id: 'p0',
      hp: 5,
      hpMax: 5,
      downed: false,
      revivedThisIncident: true,
    });
    const damaged = applyDamage(p, 2);
    expect(damaged.hp).toBe(3);
    expect(damaged.downed).toBe(false);
    expect(damaged.revivedThisIncident).toBe(true);
  });
});

describe('v2 shared loss (amendment A3)', () => {
  function runPostDamageCheck(state: KidGameState): KidGameState {
    // Post-damage loss check is engaged during endTurn in gameStore.
    // The unit test operates at a lower level: we import the store's
    // private helper indirectly by walking the public endTurn path with
    // a 2-player setup and asserting outcome. A lightweight direct
    // replica of the check-logic is also exercised below.
    if (state.outcome !== null) return state;
    if (state.players.length < 2) return state;
    const allDowned = state.players.every((p) => p.downed);
    if (!allDowned) return state;
    const allRevivedAlready = state.players.every((p) => p.revivedThisIncident);
    if (!allRevivedAlready) return state;
    const anyWisp = state.players.some((p) => p.items.some((c) => baseIdOf(c) === 'wisp'));
    if (anyWisp) return state;
    return { ...state, outcome: 'loss' };
  }

  it('(e) both players downed AND both revivedThisIncident AND no wisp → outcome === "loss"', () => {
    const state = makeState({
      players: [
        makePlayer({
          id: 'p0',
          hp: 0,
          hpMax: 5,
          downed: true,
          revivedThisIncident: true,
          items: [],
        }),
        makePlayer({
          id: 'p1',
          hp: 0,
          hpMax: 5,
          downed: true,
          revivedThisIncident: true,
          items: [],
        }),
      ],
    });
    const next = runPostDamageCheck(state);
    expect(next.outcome).toBe('loss');
  });

  it('both downed but one still has a fresh revive budget → NOT a loss', () => {
    const state = makeState({
      players: [
        makePlayer({
          id: 'p0',
          hp: 0,
          hpMax: 5,
          downed: true,
          revivedThisIncident: false,
        }),
        makePlayer({
          id: 'p1',
          hp: 0,
          hpMax: 5,
          downed: true,
          revivedThisIncident: true,
        }),
      ],
    });
    const next = runPostDamageCheck(state);
    expect(next.outcome).toBeNull();
  });

  it('endTurn wires the post-damage loss check end-to-end', () => {
    // Drive the real store through a scenario where both players are
    // downed with no revive budget remaining — endTurn should land on
    // outcome='loss'.
    const store = createGameStore(1);
    store.getState().initGame({
      players: 2,
      championIds: ['champion-power', 'champion-courage'],
    });

    store.setState((s) => {
      const players = s.players.slice();
      players[0] = {
        ...players[0],
        hp: 0,
        downed: true,
        revivedThisIncident: true,
        items: [],
      };
      players[1] = {
        ...players[1],
        hp: 0,
        downed: true,
        revivedThisIncident: true,
        items: [],
      };
      return { ...s, players };
    });

    store.getState().endTurn();
    expect(store.getState().outcome).toBe('loss');
  });
});

describe('reviveTeammate surface (u-1d implements; surface test here)', () => {
  it('throws when the target is not downed (full behavior in reviveMechanics.test.ts)', () => {
    // Surface sanity check: u-1d has landed the revive implementation;
    // detailed behavior is in reviveMechanics.test.ts. Keep one assertion
    // at this layer to catch accidental-surface-removal regressions.
    const store = createGameStore(1);
    store.getState().initGame({
      players: 2,
      championIds: ['champion-power', 'champion-courage'],
    });
    expect(() => store.getState().reviveTeammate('p1')).toThrow(/not downed/i);
  });
});
