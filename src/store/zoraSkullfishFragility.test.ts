/**
 * Fangfish fragility-window coverage (embertide-gdd.1.2).
 *
 * Roster-memo contract: a fangfish that sits in `state.field` through
 * one full turn-end without being bought / fought auto-discards on the
 * next turn-end ("school of fish darts away" thematic). The watchlist
 * `state.skullfishFieldWatchlist` carries the per-card-id state across
 * the two end-phases.
 *
 *   (a) Watchlist starts empty + fragility scan is identity when no
 *       fangfish is in the field
 *   (b) First scan with a fangfish in the field populates the
 *       watchlist + leaves the card in the field (one turn of grace)
 *   (c) Second scan with the same fangfish still in the field
 *       discards it into `state.defeated` and clears the watchlist
 *   (d) Re-engagement: a fangfish bought / fought between scans
 *       leaves the field naturally; the next scan sees no fragile id
 *   (e) Multiple fangfish coexist independently — each gets its own
 *       one-turn grace window
 *   (f) Suffix-mint duplicates resolve correctly via baseId
 */

import { describe, it, expect } from 'vitest';
import type { Card } from '../types/card';
import type { KidGameState, KidPlayer } from './types';
import { applySkullfishFragility } from './slices/zones';
import { createSeededRng } from '../rules/chestPool';
import { makeKidPlayer, makeKidGameState } from '../testing/stateFixtures';

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer => makeKidPlayer(overrides);

function makeState(overrides: Partial<KidGameState> = {}): KidGameState {
  return makeKidGameState({
    players: [makePlayer({ id: 'p0' }), makePlayer({ id: 'p1' })],
    phase: 'End',
    seed: 1,
    rng: createSeededRng(1),
    currentZone: 'maren',
    zoneHistory: ['sylvani', 'emberpeak'],
    ...overrides,
  });
}

const baseSkullfish: Card = {
  id: 'fangfish',
  role: 'monster',
  cost: { red: 5 },
  effects: { kind: 'monster-drop', hearts: 2 },
  zone: 'maren',
};

const baseShellblade: Card = {
  id: 'reefblade',
  role: 'monster',
  cost: { red: 4 },
  effects: { kind: 'monster-drop', hearts: 1, gems: 1 },
  zone: 'maren',
};

describe('applySkullfishFragility — empty / no-fangfish path (a)', () => {
  it('returns input reference unchanged when field has no fangfish and watchlist is empty', () => {
    const s = makeState({ field: [baseShellblade] });
    expect(applySkullfishFragility(s)).toBe(s);
  });

  it('clears a stale watchlist when no fangfish is in the field anymore', () => {
    // Fangfish was in the field, was bought between turn-ends, leaves
    // a stale id in the watchlist. The next end-phase scan must wipe
    // it so the watchlist doesn't grow without bound.
    const s = makeState({
      field: [baseShellblade],
      skullfishFieldWatchlist: ['fangfish'],
    });
    const next = applySkullfishFragility(s);
    expect(next).not.toBe(s);
    expect(next.skullfishFieldWatchlist).toEqual([]);
  });
});

describe('applySkullfishFragility — first scan (b)', () => {
  it('populates the watchlist with the fangfish id but does not discard', () => {
    const s = makeState({ field: [baseSkullfish, baseShellblade] });
    const next = applySkullfishFragility(s);
    expect(next.field).toHaveLength(2); // both still in field
    expect(next.skullfishFieldWatchlist).toEqual(['fangfish']);
    expect(next.defeated).toHaveLength(0);
  });
});

describe('applySkullfishFragility — second scan, fragility fires (c)', () => {
  it('discards a fangfish that survived a full turn-end into state.defeated', () => {
    const s = makeState({
      field: [baseSkullfish, baseShellblade],
      skullfishFieldWatchlist: ['fangfish'],
    });
    const next = applySkullfishFragility(s);
    // fangfish removed from field
    expect(next.field).toHaveLength(1);
    expect(next.field[0].id).toBe('reefblade');
    // fangfish appended to defeated
    expect(next.defeated).toHaveLength(1);
    expect(next.defeated[0].id).toBe('fangfish');
    // watchlist clears (no fangfish remaining in field)
    expect(next.skullfishFieldWatchlist).toEqual([]);
  });
});

describe('applySkullfishFragility — re-engagement path (d)', () => {
  it('a fangfish that left the field between scans is not auto-banished', () => {
    // Player bought / fought the fangfish between End-phases; it left
    // the field naturally. Watchlist still carries the id but the next
    // scan must just clear the stale id without affecting state.defeated.
    const s = makeState({
      field: [baseShellblade],
      defeated: [baseSkullfish], // already in defeated from the fight
      skullfishFieldWatchlist: ['fangfish'],
    });
    const next = applySkullfishFragility(s);
    expect(next.field).toEqual([baseShellblade]);
    // Defeated is unchanged (no double-discard).
    expect(next.defeated).toHaveLength(1);
    expect(next.defeated[0].id).toBe('fangfish');
    expect(next.skullfishFieldWatchlist).toEqual([]);
  });
});

describe('applySkullfishFragility — multi-fangfish independence (e)', () => {
  it('a fresh fangfish gets its own grace window when an older one fires', () => {
    // Old fangfish (id 'fangfish') was in the watchlist last turn.
    // A second fangfish ('fangfish-2') just appeared this turn.
    // Old should fire; new should populate the watchlist for next time.
    const oldSkullfish: Card = { ...baseSkullfish, id: 'fangfish' };
    const newSkullfish: Card = { ...baseSkullfish, id: 'fangfish-2' };
    const s = makeState({
      field: [oldSkullfish, newSkullfish, baseShellblade],
      skullfishFieldWatchlist: ['fangfish'],
    });
    const next = applySkullfishFragility(s);
    // Old fangfish is gone from field, in defeated.
    expect(next.field.find((c) => c.id === 'fangfish')).toBeUndefined();
    expect(next.defeated.find((c) => c.id === 'fangfish')).toBeDefined();
    // New fangfish stays in field, joins watchlist.
    expect(next.field.find((c) => c.id === 'fangfish-2')).toBeDefined();
    expect(next.skullfishFieldWatchlist).toEqual(['fangfish-2']);
  });

  it('two coexisting fangfish that both survived BOTH fire on the same scan', () => {
    const a: Card = { ...baseSkullfish, id: 'fangfish' };
    const b: Card = { ...baseSkullfish, id: 'fangfish-2' };
    const s = makeState({
      field: [a, b, baseShellblade],
      skullfishFieldWatchlist: ['fangfish', 'fangfish-2'],
    });
    const next = applySkullfishFragility(s);
    expect(next.field).toEqual([baseShellblade]);
    expect(next.defeated).toHaveLength(2);
    expect(next.skullfishFieldWatchlist).toEqual([]);
  });
});

describe('applySkullfishFragility — suffix-mint duplicates resolve via baseId (f)', () => {
  it('a suffix-minted "fangfish-3" still triggers the fragility window', () => {
    const minted: Card = { ...baseSkullfish, id: 'fangfish-3' };
    // First scan — populates.
    let s = makeState({ field: [minted] });
    s = applySkullfishFragility(s);
    expect(s.skullfishFieldWatchlist).toEqual(['fangfish-3']);
    expect(s.field).toHaveLength(1);
    // Second scan — fires.
    s = applySkullfishFragility(s);
    expect(s.field).toHaveLength(0);
    expect(s.defeated.find((c) => c.id === 'fangfish-3')).toBeDefined();
  });
});

describe('applySkullfishFragility — non-Maren robustness', () => {
  it('non-Maren zones are still identity when no fangfish is in the field (sanity)', () => {
    const s = makeState({ currentZone: 'sylvani', field: [baseShellblade] });
    expect(applySkullfishFragility(s)).toBe(s);
  });

  it('still fires across zone boundaries if a fangfish-id is somehow in field outside Maren', () => {
    // Defensive: the fragility check is zone-agnostic. In practice,
    // fangfish only ever spawns from the Maren supply, but if a future
    // path mints a fangfish-baseId card outside Maren, the same window
    // applies (matches the "darts away" thematic regardless of zone).
    const s = makeState({
      currentZone: 'emberpeak',
      field: [baseSkullfish],
      skullfishFieldWatchlist: ['fangfish'],
    });
    const next = applySkullfishFragility(s);
    expect(next.field).toHaveLength(0);
    expect(next.defeated).toHaveLength(1);
  });
});
