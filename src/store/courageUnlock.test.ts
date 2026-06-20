import { describe, it, expect } from 'vitest';
import { createSeededRng } from '../rules/chestPool';
import type { KidGameState, KidPlayer } from './types';
import { advanceZone, checkCourageUnlock } from './slices/zones';
import { makeKidPlayer, makeKidGameState } from '../testing/stateFixtures';

/**
 * u-5b acceptance coverage (Courage shard unlock gate, amendment A5/A2):
 *  (a) Courage starts false
 *  (b) clearing sylvani only — Courage stays false
 *  (c) clearing sylvani + emberpeak — Courage stays false
 *  (d) clearing all three zones — Courage flips true
 *  (e) idempotent on repeat call
 *
 * Additional invariants covered:
 *  - checkCourageUnlock is pure (no state mutation)
 *  - advanceZone wires checkCourageUnlock on every advance
 *  - Courage flip is single-shot — once true, further advances at the
 *    terminal zone do not re-fire side effects
 */

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer =>
  makeKidPlayer({
    championId: 'champion-courage',
    championSlot: 'champion-courage',
    ...overrides,
  });

function makeState(overrides: Partial<KidGameState> = {}): KidGameState {
  return makeKidGameState({
    players: [makePlayer({ id: 'p0' }), makePlayer({ id: 'p1' })],
    seed: 1,
    rng: createSeededRng(1),
    ...overrides,
  });
}

describe('checkCourageUnlock — gate predicate (u-5b)', () => {
  it('(a) returns false for a fresh game state — no zones cleared yet', () => {
    const s = makeState();
    expect(checkCourageUnlock(s)).toBe(false);
    expect(s.sharedTriforce.courage).toBe(false);
  });

  it('(b) returns false with only sylvani in history', () => {
    const s = makeState({
      currentZone: 'emberpeak',
      zoneHistory: ['sylvani'],
    });
    expect(checkCourageUnlock(s)).toBe(false);
  });

  it('(c) returns false with sylvani + emberpeak in history', () => {
    const s = makeState({
      currentZone: 'gilded-cage',
      zoneHistory: ['sylvani', 'emberpeak'],
    });
    expect(checkCourageUnlock(s)).toBe(false);
  });

  it('(d) returns true once all six zones are in history (gdd.3: 6-zone v2.1 chain)', () => {
    const s = makeState({
      currentZone: 'gilded-cage',
      zoneHistory: [
        'sylvani',
        'emberpeak',
        'maren',
        'hollow-shrine',
        'dune-sanctum',
        'gilded-cage',
      ],
    });
    expect(checkCourageUnlock(s)).toBe(true);
  });

  it('is insensitive to history order (set semantics)', () => {
    const s = makeState({
      currentZone: 'gilded-cage',
      // gdd.3: full v2.1 history is the 6-zone set; order doesn't matter.
      zoneHistory: [
        'gilded-cage',
        'dune-sanctum',
        'hollow-shrine',
        'maren',
        'sylvani',
        'emberpeak',
      ],
    });
    expect(checkCourageUnlock(s)).toBe(true);
  });

  it('is pure — does not mutate the input state', () => {
    const s = makeState({
      currentZone: 'gilded-cage',
      zoneHistory: [
        'sylvani',
        'emberpeak',
        'maren',
        'hollow-shrine',
        'dune-sanctum',
        'gilded-cage',
      ],
    });
    const beforeHistory = s.zoneHistory;
    const beforeTriforce = s.sharedTriforce;
    checkCourageUnlock(s);
    expect(s.zoneHistory).toBe(beforeHistory);
    expect(s.sharedTriforce).toBe(beforeTriforce);
    expect(s.sharedTriforce.courage).toBe(false);
  });
});

describe('advanceZone → sharedTriforce.courage flip (u-5b)', () => {
  it('(a → b) advancing sylvani only leaves Courage false', () => {
    const s0 = makeState();
    expect(s0.sharedTriforce.courage).toBe(false);
    const s1 = advanceZone(s0);
    expect(s1.currentZone).toBe('emberpeak');
    expect(s1.zoneHistory).toEqual(['sylvani']);
    expect(s1.sharedTriforce.courage).toBe(false);
  });

  it('(c) advancing sylvani + emberpeak + maren + hollow-shrine + dune-sanctum leaves Courage false (gdd.3: 6-zone chain)', () => {
    let s = makeState();
    s = advanceZone(s); // sylvani → emberpeak
    s = advanceZone(s); // emberpeak → maren
    s = advanceZone(s); // maren → hollow-shrine
    s = advanceZone(s); // hollow-shrine → dune-sanctum
    s = advanceZone(s); // dune-sanctum → gilded-cage
    expect(s.currentZone).toBe('gilded-cage');
    expect(s.zoneHistory).toEqual([
      'sylvani',
      'emberpeak',
      'maren',
      'hollow-shrine',
      'dune-sanctum',
    ]);
    expect(s.sharedTriforce.courage).toBe(false);
  });

  it('(d) full 6-zone clearance flips Courage in the terminal-advance transaction (gdd.3)', () => {
    let s = makeState();
    s = advanceZone(s); // clears sylvani
    s = advanceZone(s); // clears emberpeak
    s = advanceZone(s); // clears maren
    s = advanceZone(s); // clears hollow-shrine
    s = advanceZone(s); // clears dune-sanctum
    s = advanceZone(s); // clears gilded-cage (terminal append)
    expect(s.currentZone).toBe('gilded-cage');
    expect(s.zoneHistory).toEqual([
      'sylvani',
      'emberpeak',
      'maren',
      'hollow-shrine',
      'dune-sanctum',
      'gilded-cage',
    ]);
    expect(s.sharedTriforce.courage).toBe(true);
    // Wisdom and Power remain untouched — u-5b grants Courage only.
    expect(s.sharedTriforce.wisdom).toBe(false);
    expect(s.sharedTriforce.power).toBe(false);
  });

  it('(e) repeat advanceZone at terminal post-unlock is a full no-op (idempotent)', () => {
    let s = makeState();
    s = advanceZone(s);
    s = advanceZone(s);
    s = advanceZone(s);
    s = advanceZone(s);
    s = advanceZone(s);
    const afterClear = advanceZone(s);
    expect(afterClear.sharedTriforce.courage).toBe(true);
    // Further calls at terminal return the same state object.
    const afterRepeat = advanceZone(afterClear);
    expect(afterRepeat).toBe(afterClear);
    expect(afterRepeat.zoneHistory).toEqual([
      'sylvani',
      'emberpeak',
      'maren',
      'hollow-shrine',
      'dune-sanctum',
      'gilded-cage',
    ]);
  });

  it('if Courage is already true (future-proofing vs v2.1 re-ordering), the check does not re-fire side effects', () => {
    const s = makeState({
      currentZone: 'gilded-cage',
      // gdd.3: pre-unlock history is the 5-zone-pre-terminal sequence.
      zoneHistory: ['sylvani', 'emberpeak', 'maren', 'hollow-shrine', 'dune-sanctum'],
      sharedTriforce: { wisdom: false, courage: true, power: false },
    });
    const next = advanceZone(s);
    // Terminal append still happens, but Courage stays true (no redundant flip).
    expect(next.zoneHistory).toEqual([
      'sylvani',
      'emberpeak',
      'maren',
      'hollow-shrine',
      'dune-sanctum',
      'gilded-cage',
    ]);
    expect(next.sharedTriforce.courage).toBe(true);
    // Re-calling at terminal is a full no-op.
    const next2 = advanceZone(next);
    expect(next2).toBe(next);
  });

  it('does not flip Courage when only a single zone has been cleared', () => {
    const s0 = makeState();
    const s1 = advanceZone(s0);
    expect(s1.sharedTriforce.courage).toBe(false);
    expect(checkCourageUnlock(s1)).toBe(false);
  });
});
