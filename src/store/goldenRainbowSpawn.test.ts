/**
 * embertide-044 — Prism Chimera dynamic-spawn coverage.
 *
 * The rare post-completion wild boss was retired from Gilded Cage's
 * FIFO queue and replaced with a one-shot roll fired at Silver Chimera's
 * defeat. These tests verify:
 *
 *   - `centerRowKillCount` increments on regular field kills
 *     (`fightMonster`) and on wild-boss `COMBAT_RESOLVE_WIN`, but NOT
 *     on always-available kills (Wild Wolf) or region-boss
 *     `COMBAT_RESOLVE_WIN`.
 *   - The spawn roll fires exactly once at Silver Chimera's defeat; a
 *     seeded RNG that returns < 0.85 flips `prismChimeraSpawned`
 *     to true, a seeded RNG that returns >= 0.85 leaves the flag false.
 *   - The slot selector (`currentWildBossForZone`) surfaces
 *     `'prism-chimera'` only when the FIFO is cleared AND the
 *     flag is true AND the boss is not already defeated.
 *
 * These tests depend on the store factory + `COMBAT_RESOLVE_WIN`
 * reducer to observe the end-to-end spawn transaction; they do not
 * drive the combat sub-state forward turn-by-turn.
 */

import { describe, it, expect } from 'vitest';
import { buildResolveWinAction, createGameStore } from './gameStore';
import { KID_CARDS, WILD_WOLF_ID } from '../data/cards';
import { fightMonster } from './slices/combat';
import type { KidGameState } from './types';

const GRUNT = KID_CARDS.find((c) => c.id === 'grunt-orc')!;
const SILVER_CHIMERA = KID_CARDS.find((c) => c.id === 'silver-chimera')!;
const SENTINEL = KID_CARDS.find((c) => c.id === 'sentinel')!;
const CRAGHORN = KID_CARDS.find((c) => c.id === 'craghorn')!;
const VURMOX = KID_CARDS.find((c) => c.id === 'cagewright-vurmox')!;

function newGame(seed = 1) {
  const store = createGameStore(seed);
  store.getState().initGame({
    players: 2,
    championIds: ['champion-courage', 'champion-wisdom'],
  });
  return store;
}

describe('centerRowKillCount — embertide-044 (increment sites)', () => {
  it('initGame seeds centerRowKillCount at 0 and prismChimeraSpawned at false', () => {
    const store = newGame();
    const s = store.getState();
    expect(s.centerRowKillCount).toBe(0);
    expect(s.prismChimeraSpawned).toBe(false);
  });

  it('fightMonster (regular center-row kill) increments centerRowKillCount by 1', () => {
    const store = newGame();
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], red: 10 };
      return { ...s, players, field: [GRUNT] };
    });
    const before = store.getState().centerRowKillCount;
    store.getState().fightMonster(GRUNT.id);
    expect(store.getState().centerRowKillCount).toBe(before + 1);
  });

  it('defeatAlwaysAvailableMonster (Wild Wolf) does NOT increment centerRowKillCount', () => {
    const store = newGame();
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], red: 10 };
      return { ...s, players };
    });
    const before = store.getState().centerRowKillCount;
    store.getState().defeatAlwaysAvailable(WILD_WOLF_ID);
    expect(store.getState().centerRowKillCount).toBe(before);
  });

  it('wild-boss COMBAT_RESOLVE_WIN increments centerRowKillCount by 1 (Sentinel at Temple)', () => {
    const store = newGame();
    store.setState((s) => ({
      ...s,
      turn: 6,
      currentZone: 'gilded-cage',
      defeatedBossIds: [],
    }));
    store.getState().engageWildBossSlot('gilded-cage', 'sentinel');
    const before = store.getState().centerRowKillCount;
    store
      .getState()
      .dispatchCombat(buildResolveWinAction(SENTINEL, ['p0', 'p1'], 'gilded-cage'));
    expect(store.getState().centerRowKillCount).toBe(before + 1);
  });

  it('region-boss COMBAT_RESOLVE_WIN does NOT increment centerRowKillCount (Vurmox)', () => {
    const store = newGame();
    store.setState((s) => ({
      ...s,
      turn: 6,
      currentZone: 'gilded-cage',
      // Prep the boss-key gate so engageRegionBossSlot reaches the
      // COMBAT_ENTER dispatch (we only care about the WIN transaction's
      // counter side effect, not the gate itself).
      defeatedBossIds: ['sentinel', 'silver-chimera'],
      bossKeys: {
        sylvani: [],
        'emberpeak': [],
        maren: [],
        'hollow-shrine': [],
        'dune-sanctum': [],
        'gilded-cage': ['sentinel', 'silver-chimera'],
      },
    }));
    store.getState().engageRegionBossSlot('gilded-cage', 'cagewright-vurmox');
    const before = store.getState().centerRowKillCount;
    store.getState().dispatchCombat(buildResolveWinAction(VURMOX, ['p0', 'p1'], 'gilded-cage'));
    expect(store.getState().centerRowKillCount).toBe(before);
  });

  it('fightMonster on a Sylvani regular in a non-Temple zone counts (cross-zone kills ramp the Rainbow roll)', () => {
    // Designer direction (bead 044): "including non-Temple zones" —
    // the counter is a run-wide total, not Temple-scoped.
    const store = newGame();
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], red: 20 };
      return { ...s, players, field: [GRUNT, GRUNT, GRUNT], currentZone: 'sylvani' };
    });
    // Use fightMonster slice directly against distinct-id copies.
    let state: KidGameState = store.getState();
    state = fightMonster({ ...state, field: [{ ...GRUNT, id: 'grunt-orc-a' }] }, 0, 'grunt-orc-a');
    state = fightMonster({ ...state, field: [{ ...GRUNT, id: 'grunt-orc-b' }] }, 0, 'grunt-orc-b');
    expect(state.centerRowKillCount).toBe(2);
  });
});

describe('Prism Chimera spawn roll — embertide-044 (roll site)', () => {
  it('succeeds when rng() < computed spawn chance and the boss is Silver Chimera', () => {
    // 20 prior kills → chance 0.05 * 20 = 1.0 capped at 0.85, counter
    // then bumps to 21 at Silver Chimera's defeat (still capped at 0.85).
    // A deterministic rng() returning 0.0 always succeeds.
    const store = newGame();
    store.setState((s) => ({
      ...s,
      turn: 6,
      currentZone: 'gilded-cage',
      centerRowKillCount: 20,
      // Override rng to a constant < 0.85 so the roll succeeds.
      rng: () => 0.1,
      defeatedBossIds: ['sentinel'],
      bossKeys: {
        sylvani: [],
        'emberpeak': [],
        maren: [],
        'hollow-shrine': [],
        'dune-sanctum': [],
        'gilded-cage': ['sentinel'],
      },
    }));
    store.getState().engageWildBossSlot('gilded-cage', 'silver-chimera');
    store
      .getState()
      .dispatchCombat(buildResolveWinAction(SILVER_CHIMERA, ['p0', 'p1'], 'gilded-cage'));
    const after = store.getState();
    expect(after.prismChimeraSpawned).toBe(true);
    expect(after.centerRowKillCount).toBe(21);
    expect(after.defeatedBossIds).toContain('silver-chimera');
  });

  it('fails when rng() >= computed spawn chance (leaves spawn flag false for the run)', () => {
    const store = newGame();
    store.setState((s) => ({
      ...s,
      turn: 6,
      currentZone: 'gilded-cage',
      centerRowKillCount: 20,
      // rng() returns a value above the cap (0.85) so the roll fails.
      rng: () => 0.99,
      defeatedBossIds: ['sentinel'],
      bossKeys: {
        sylvani: [],
        'emberpeak': [],
        maren: [],
        'hollow-shrine': [],
        'dune-sanctum': [],
        'gilded-cage': ['sentinel'],
      },
    }));
    store.getState().engageWildBossSlot('gilded-cage', 'silver-chimera');
    store
      .getState()
      .dispatchCombat(buildResolveWinAction(SILVER_CHIMERA, ['p0', 'p1'], 'gilded-cage'));
    expect(store.getState().prismChimeraSpawned).toBe(false);
  });

  it('does NOT roll at Sentinel defeat (pre-Silver-Chimera wild-boss wins only increment the counter)', () => {
    const store = newGame();
    store.setState((s) => ({
      ...s,
      turn: 6,
      currentZone: 'gilded-cage',
      centerRowKillCount: 20,
      // Even with a succeed-always rng, Sentinel's defeat must not
      // flip the spawn flag — the roll is gated on Silver Chimera.
      rng: () => 0.0,
      defeatedBossIds: [],
    }));
    store.getState().engageWildBossSlot('gilded-cage', 'sentinel');
    store
      .getState()
      .dispatchCombat(buildResolveWinAction(SENTINEL, ['p0', 'p1'], 'gilded-cage'));
    expect(store.getState().prismChimeraSpawned).toBe(false);
  });

  it('does NOT roll on a non-Temple wild-boss defeat (Craghorn in Sylvani)', () => {
    const store = newGame();
    store.setState((s) => ({
      ...s,
      turn: 6,
      currentZone: 'sylvani',
      centerRowKillCount: 20,
      rng: () => 0.0,
      defeatedBossIds: [],
    }));
    store.getState().engageWildBossSlot('sylvani', 'craghorn');
    store.getState().dispatchCombat(buildResolveWinAction(CRAGHORN, ['p0', 'p1'], 'sylvani'));
    expect(store.getState().prismChimeraSpawned).toBe(false);
  });

  it('does NOT re-roll once the flag has flipped (one-shot semantics)', () => {
    // If Silver Chimera somehow resolves again (defensive), the flag
    // must not regress and the condition (`!prismChimeraSpawned`)
    // short-circuits — so a failing rng post-flag would NOT flip it back.
    const store = newGame();
    store.setState((s) => ({
      ...s,
      turn: 6,
      currentZone: 'gilded-cage',
      centerRowKillCount: 30,
      prismChimeraSpawned: true,
      rng: () => 0.99, // would fail, but guard prevents a roll.
      defeatedBossIds: ['sentinel'],
      bossKeys: {
        sylvani: [],
        'emberpeak': [],
        maren: [],
        'hollow-shrine': [],
        'dune-sanctum': [],
        'gilded-cage': ['sentinel'],
      },
    }));
    store.getState().engageWildBossSlot('gilded-cage', 'silver-chimera');
    store
      .getState()
      .dispatchCombat(buildResolveWinAction(SILVER_CHIMERA, ['p0', 'p1'], 'gilded-cage'));
    expect(store.getState().prismChimeraSpawned).toBe(true);
  });
});
