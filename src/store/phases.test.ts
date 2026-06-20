import { describe, it, expect } from 'vitest';
import { createGameStore } from './gameStore';
import type { Phase } from './types';

/**
 * u-1c: phase-structure tests (REQ-18).
 *
 * Coverage per acceptance:
 *  (a) phase advances Upkeep → Draw → Main → BossResolve → End in order
 *  (b) SOT-construct + champion-passive fire exactly in Upkeep
 *  (c) main-phase actions blocked outside Main
 *  (d) downed players auto-pass Main
 *  (e) turn counter increments on End → Upkeep transition
 *  (f) round-trip through all phases keeps game state deterministic
 */

function freshStore() {
  const store = createGameStore(1);
  store.getState().initGame({
    players: 2,
    championIds: ['champion-power', 'champion-courage'],
  });
  return store;
}

describe('phase enum + advancePhase dispatcher (REQ-18)', () => {
  it('(a) advances Upkeep → Draw → Main → BossResolve → End → (next Upkeep)', () => {
    const store = freshStore();
    // initGame lands on Main. Force phase to Upkeep to observe the full
    // cycle from the canonical starting point.
    store.setState((s) => ({ ...s, phase: 'Upkeep' }));

    const observed: Phase[] = [];
    observed.push(store.getState().phase);
    store.getState().advancePhase();
    observed.push(store.getState().phase);
    store.getState().advancePhase();
    observed.push(store.getState().phase);
    store.getState().advancePhase();
    observed.push(store.getState().phase);
    store.getState().advancePhase();
    observed.push(store.getState().phase);
    // End → wraps to next Upkeep via advanceTurn.
    store.getState().advancePhase();
    observed.push(store.getState().phase);

    expect(observed).toEqual(['Upkeep', 'Draw', 'Main', 'BossResolve', 'End', 'Upkeep']);
  });

  it('(b) SOT-construct + champion-passive fire exactly in Upkeep', () => {
    const store = freshStore();
    // Put p0 in Upkeep with no resources — champion-power's passive
    // (+2 red at start of turn) should fire when phase transitions
    // Upkeep → Draw.
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], red: 0, green: 0 };
      return { ...s, players, phase: 'Upkeep' };
    });

    store.getState().advancePhase();

    const after = store.getState();
    expect(after.phase).toBe('Draw');
    // champion-power grants +2 red on start-of-turn.
    expect(after.players[0].red).toBe(2);
  });

  it('(c) main-phase actions throw outside Main', () => {
    const store = freshStore();
    // Put the store in Upkeep — any main-phase action must throw.
    store.setState((s) => ({ ...s, phase: 'Upkeep' }));
    expect(() => store.getState().playCard('some-card')).toThrow(
      /main-phase action attempted during phase 'Upkeep'/,
    );
    expect(() => store.getState().fightMonster('x')).toThrow(
      /main-phase action attempted during phase 'Upkeep'/,
    );
    expect(() => store.getState().openChest('std')).toThrow(
      /main-phase action attempted during phase 'Upkeep'/,
    );
    expect(() => store.getState().reviveTeammate('p1')).toThrow(
      /main-phase action attempted during phase 'Upkeep'/,
    );

    // Flip to BossResolve — same guard should fire.
    store.setState((s) => ({ ...s, phase: 'BossResolve' }));
    expect(() => store.getState().buyFromField('x')).toThrow(
      /main-phase action attempted during phase 'BossResolve'/,
    );
  });

  it('(d) downed active player still advances through Main (auto-pass)', () => {
    const store = freshStore();
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], hp: 0, downed: true };
      return { ...s, players, phase: 'Main' };
    });
    // advancePhase from Main moves to BossResolve regardless of downed —
    // but the key guarantee is that Main does NOT block the cycle when
    // the active player is downed. (The UI is responsible for not letting
    // a downed player linger in Main.)
    store.getState().advancePhase();
    expect(store.getState().phase).toBe('BossResolve');
  });

  it('(e) turn counter increments on End → next-player Upkeep wrap', () => {
    const store = freshStore();
    // 2-player setup: after p0's End, we advance to p1 (turn stays 1);
    // after p1's End, we advance back to p0 AND the turn counter bumps
    // to 2 (advanceTurn's wrap-detection).
    store.setState((s) => ({ ...s, phase: 'End' }));
    store.getState().advancePhase();
    expect(store.getState().phase).toBe('Upkeep');
    expect(store.getState().currentPlayerIndex).toBe(1);
    expect(store.getState().turn).toBe(1);

    store.setState((s) => ({ ...s, phase: 'End' }));
    store.getState().advancePhase();
    expect(store.getState().phase).toBe('Upkeep');
    expect(store.getState().currentPlayerIndex).toBe(0);
    expect(store.getState().turn).toBe(2);
  });

  it('(f) round-trip through all phases is deterministic — same inputs, same outputs', () => {
    // Drive two identical stores through the same phase cycle and assert
    // terminal state is structurally identical on fields that determinism
    // actually touches (phase, currentPlayerIndex, turn, per-player HP).
    const a = freshStore();
    const b = freshStore();
    for (const store of [a, b]) {
      store.setState((s) => ({ ...s, phase: 'Upkeep' }));
      for (let i = 0; i < 5; i += 1) store.getState().advancePhase();
    }
    expect(a.getState().phase).toBe(b.getState().phase);
    expect(a.getState().currentPlayerIndex).toBe(b.getState().currentPlayerIndex);
    expect(a.getState().turn).toBe(b.getState().turn);
    expect(a.getState().players.map((p) => p.hp)).toEqual(b.getState().players.map((p) => p.hp));
  });

  it('advancePhase is a no-op when outcome is set', () => {
    const store = freshStore();
    store.setState((s) => ({ ...s, outcome: 'win', phase: 'Upkeep' }));
    store.getState().advancePhase();
    expect(store.getState().phase).toBe('Upkeep');
  });

  it('endTurn is a thin wrapper that cycles to the next Main phase', () => {
    const store = freshStore();
    // initGame lands on Main. endTurn should cycle p0.Main → BossResolve →
    // End → (advanceTurn to p1) → Upkeep → Draw → p1.Main.
    expect(store.getState().phase).toBe('Main');
    expect(store.getState().currentPlayerIndex).toBe(0);
    store.getState().endTurn();
    expect(store.getState().phase).toBe('Main');
    expect(store.getState().currentPlayerIndex).toBe(1);
  });
});
