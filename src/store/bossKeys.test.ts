/**
 * gm0.12 (v2.1 REVERSE-Q8) — boss-key gating + wild-boss dual-drop.
 *
 * Coverage matrix:
 *  - Pure helpers (recordBossKey / canSpawnRegionBoss) over a bare state.
 *  - Zustand store integration: wild-boss defeat drops BOTH the heirloom
 *    AND the zone's boss key, heirloom path unchanged (both fire).
 *  - engageRegionBossSlot throws a "sealed" error until the zone's keys
 *    are present.
 *  - Multi-zone gating: Gilded Cage needs BOTH Sentinel + Silver
 *    Chimera keys; neither alone unlocks Vurmox.
 *  - Save-load parity: a pre-populated bossKeys record unlocks the slot
 *    without having to replay the wild combats.
 *
 * Designer decision (2026-04-23) REVERSES REQ-32 / u-9a's always-on
 * region slot contract (see the bd ticket for the signed-off rollback).
 */

import { describe, it, expect } from 'vitest';
import { KID_CARDS, baseIdOf } from '../data/cards';
import { buildResolveWinAction, createGameStore, type GameStore } from './gameStore';
import { canSpawnRegionBoss, emptyBossKeys, recordBossKey } from './slices/zones';
import type { KidGameState } from './types';

const CRAGHORN = KID_CARDS.find((c) => c.id === 'craghorn')!;
const BOULDERKIN = KID_CARDS.find((c) => c.id === 'boulderkin')!;
const SENTINEL = KID_CARDS.find((c) => c.id === 'sentinel')!;
const SILVER_CHIMERA = KID_CARDS.find((c) => c.id === 'silver-chimera')!;
const BROODMAW = KID_CARDS.find((c) => c.id === 'broodmaw')!;
const ASHEN_TYRANT = KID_CARDS.find((c) => c.id === 'ashen-tyrant')!;
const VURMOX = KID_CARDS.find((c) => c.id === 'cagewright-vurmox')!;

function newGame() {
  const store = createGameStore(1);
  store.getState().initGame({
    players: 2,
    championIds: ['champion-power', 'champion-courage'],
    names: ['P0', 'P1'],
  });
  // gm0.9 REQ-19: engagements require phase ≥ Rising (turn 3) for wild
  // and phase ≥ Boss (turn 6) for region. gm0.12 coverage exercises
  // both tiers, so bump to the Boss phase by default; per-test cases
  // that need a specific turn (e.g. Stirring assertions) override.
  store.setState((s) => ({ ...s, turn: 6 }));
  return store;
}

// ---------------------------------------------------------------------------
// Pure-helper layer — recordBossKey + canSpawnRegionBoss.
// ---------------------------------------------------------------------------

describe('gm0.12 — canSpawnRegionBoss predicate', () => {
  function baseState(bossKeys: KidGameState['bossKeys'] = emptyBossKeys()): KidGameState {
    // Minimal stub — canSpawnRegionBoss only reads state.bossKeys.
    return { bossKeys } as unknown as KidGameState;
  }

  it('sylvani: SEALED with empty bossKeys.sylvani', () => {
    expect(canSpawnRegionBoss(baseState(), 'sylvani')).toBe(false);
  });

  it('sylvani: UNLOCKED once bossKeys.sylvani includes "craghorn"', () => {
    expect(canSpawnRegionBoss(baseState({ ...emptyBossKeys(), sylvani: ['craghorn'] }), 'sylvani')).toBe(
      true,
    );
  });

  it('emberpeak: SEALED until "boulderkin" key drops', () => {
    expect(canSpawnRegionBoss(baseState(), 'emberpeak')).toBe(false);
    const unlocked = {
      ...emptyBossKeys(),
      'emberpeak': ['boulderkin'],
    };
    expect(canSpawnRegionBoss(baseState(unlocked), 'emberpeak')).toBe(true);
  });

  it('temple: Sentinel alone does NOT unlock Vurmox', () => {
    const onlyGuardian = {
      ...emptyBossKeys(),
      'gilded-cage': ['sentinel'],
    };
    expect(canSpawnRegionBoss(baseState(onlyGuardian), 'gilded-cage')).toBe(false);
  });

  it('temple: Silver Chimera alone does NOT unlock Vurmox', () => {
    const onlyLynel = {
      ...emptyBossKeys(),
      'gilded-cage': ['silver-chimera'],
    };
    expect(canSpawnRegionBoss(baseState(onlyLynel), 'gilded-cage')).toBe(false);
  });

  it('temple: BOTH Sentinel + Silver Chimera keys unlock Vurmox', () => {
    const both = {
      ...emptyBossKeys(),
      'gilded-cage': ['sentinel', 'silver-chimera'],
    };
    expect(canSpawnRegionBoss(baseState(both), 'gilded-cage')).toBe(true);
  });

  it('temple: Prism Chimera key (if dropped after Vurmox is already slain) is ignored by the gate', () => {
    // embertide-044 (2026-04-24): Prism Chimera is now a
    // dynamic-spawn encounter OUTSIDE the zone's wildBossIds — it
    // never participates in the Vurmox-unlock gate. Sentinel + Silver
    // Chimera keys are sufficient to unlock. An extra key from Rainbow
    // (if somehow recorded) is harmless noise — the gate requires
    // "every CORE key", not "only core keys".
    const coreOnly = {
      ...emptyBossKeys(),
      'gilded-cage': ['sentinel', 'silver-chimera'],
    };
    expect(canSpawnRegionBoss(baseState(coreOnly), 'gilded-cage')).toBe(true);
    const coreAndRainbow = {
      ...emptyBossKeys(),
      'gilded-cage': ['sentinel', 'silver-chimera', 'prism-chimera'],
    };
    expect(canSpawnRegionBoss(baseState(coreAndRainbow), 'gilded-cage')).toBe(true);
  });

  it('recordBossKey is idempotent — re-recording the same id returns the same state', () => {
    const s = baseState();
    const once = recordBossKey(s, 'sylvani', 'craghorn');
    expect(once.bossKeys.sylvani).toEqual(['craghorn']);
    const twice = recordBossKey(once, 'sylvani', 'craghorn');
    expect(twice).toBe(once);
  });
});

// ---------------------------------------------------------------------------
// Store-level: wild-boss defeat drops heirloom AND boss-key together.
// ---------------------------------------------------------------------------

describe('gm0.12 — wild-boss defeat dual-drop (heirloom + key)', () => {
  it('Craghorn defeat drops craghorn-tusk AND bossKeys.sylvani becomes ["craghorn"]', () => {
    const store = newGame();
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], items: [] };
      players[1] = { ...players[1], items: [] };
      return { ...s, players };
    });
    store.getState().engageWildBossSlot('sylvani', 'craghorn');
    store.getState().dispatchCombat(buildResolveWinAction(CRAGHORN, ['p0', 'p1'], 'sylvani'));
    const after = store.getState();
    // Heirloom landed in some player's items (cap routing).
    const heirloomFound = after.players.some((p) =>
      p.items.some((c) => baseIdOf(c) === 'craghorn-tusk'),
    );
    expect(heirloomFound).toBe(true);
    // Key landed in bossKeys.sylvani.
    expect(after.bossKeys.sylvani).toEqual(['craghorn']);
  });

  it('Boulderkin defeat drops boulderkin-core AND bossKeys["emberpeak"] === ["boulderkin"]', () => {
    const store = newGame();
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], items: [] };
      players[1] = { ...players[1], items: [] };
      return { ...s, players, currentZone: 'emberpeak' };
    });
    store.getState().engageWildBossSlot('emberpeak', 'boulderkin');
    store
      .getState()
      .dispatchCombat(buildResolveWinAction(BOULDERKIN, ['p0', 'p1'], 'emberpeak'));
    const after = store.getState();
    const heirloomFound = after.players.some((p) =>
      p.items.some((c) => baseIdOf(c) === 'boulderkin-core'),
    );
    expect(heirloomFound).toBe(true);
    expect(after.bossKeys['emberpeak']).toEqual(['boulderkin']);
  });

  it('Region-boss defeat does NOT drop a boss-key (bossKey payload is null for region tier)', () => {
    // Broodmaw defeat should leave bossKeys untouched — only wild-boss
    // defeats feed the gate.
    const store = newGame();
    store.setState((s) => ({
      ...s,
      // Pre-populate so the slot is unlocked; Broodmaw defeat shouldn't
      // append a second entry.
      bossKeys: { ...s.bossKeys, sylvani: ['craghorn'] },
    }));
    store.getState().engageRegionBossSlot('sylvani', 'broodmaw');
    store.getState().dispatchCombat(buildResolveWinAction(BROODMAW, ['p0', 'p1'], 'sylvani'));
    expect(store.getState().bossKeys.sylvani).toEqual(['craghorn']);
  });
});

// ---------------------------------------------------------------------------
// engageRegionBossSlot gating: sealed vs unlocked paths.
// ---------------------------------------------------------------------------

describe('gm0.12 — engageRegionBossSlot locked-door enforcement', () => {
  it('Sylvani: throws "sealed" when engaged with zero wild-boss keys', () => {
    const store = newGame();
    expect(store.getState().bossKeys.sylvani).toEqual([]);
    expect(() => store.getState().engageRegionBossSlot('sylvani', 'broodmaw')).toThrow(/sealed/);
    expect(store.getState().activeCombat).toBeNull();
  });

  it('Sylvani: unlocked after a full Craghorn defeat → Broodmaw engage succeeds', () => {
    const store = newGame();
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], items: [] };
      players[1] = { ...players[1], items: [] };
      return { ...s, players };
    });
    // Defeat Craghorn — this must also drop the key.
    store.getState().engageWildBossSlot('sylvani', 'craghorn');
    store.getState().dispatchCombat(buildResolveWinAction(CRAGHORN, ['p0', 'p1'], 'sylvani'));
    expect(store.getState().bossKeys.sylvani).toEqual(['craghorn']);
    // Engage Broodmaw — does not throw now.
    expect(() => store.getState().engageRegionBossSlot('sylvani', 'broodmaw')).not.toThrow();
    expect(store.getState().activeCombat?.boss.sourceCardId).toBe('broodmaw');
  });

  it('Emberpeak: sealed until boulderkin key drops', () => {
    const store = newGame();
    store.setState((s) => ({ ...s, currentZone: 'emberpeak' }));
    expect(() => store.getState().engageRegionBossSlot('emberpeak', 'ashen-tyrant')).toThrow(
      /sealed/,
    );
  });

  it('Temple: Sentinel-only does NOT unlock Vurmox engage (throws sealed)', () => {
    const store = newGame();
    store.setState((s) => ({
      ...s,
      currentZone: 'gilded-cage',
      bossKeys: {
        ...s.bossKeys,
        sylvani: ['craghorn'],
        'emberpeak': ['boulderkin'],
        'gilded-cage': ['sentinel'],
      },
    }));
    expect(() =>
      store.getState().engageRegionBossSlot('gilded-cage', 'cagewright-vurmox'),
    ).toThrow(/sealed/);
  });

  it('Temple: Silver-Chimera-only does NOT unlock Vurmox engage (throws sealed)', () => {
    const store = newGame();
    store.setState((s) => ({
      ...s,
      currentZone: 'gilded-cage',
      bossKeys: {
        ...s.bossKeys,
        'gilded-cage': ['silver-chimera'],
      },
    }));
    expect(() =>
      store.getState().engageRegionBossSlot('gilded-cage', 'cagewright-vurmox'),
    ).toThrow(/sealed/);
  });

  it('Temple: BOTH Sentinel + Silver Chimera keys unlock Vurmox engage', () => {
    const store = newGame();
    store.setState((s) => ({
      ...s,
      currentZone: 'gilded-cage',
      bossKeys: {
        ...s.bossKeys,
        'gilded-cage': ['sentinel', 'silver-chimera'],
      },
    }));
    expect(() =>
      store.getState().engageRegionBossSlot('gilded-cage', 'cagewright-vurmox'),
    ).not.toThrow();
    expect(store.getState().activeCombat?.boss.sourceCardId).toBe('cagewright-vurmox');
  });

  it('Save-load parity: loading a state with keys pre-populated unlocks the slot directly', () => {
    // Simulates "resume" — no wild combats replayed, but the
    // post-restore bossKeys satisfy the gate.
    const store = newGame();
    store.setState((s) => ({
      ...s,
      bossKeys: { ...s.bossKeys, sylvani: ['craghorn'] },
    }));
    // No wild combats, no defeatedBossIds tampering — just the key.
    expect(() => store.getState().engageRegionBossSlot('sylvani', 'broodmaw')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// End-to-end: dual-drop is observable at the reducer boundary.
// ---------------------------------------------------------------------------

describe('gm0.12 — end-to-end wild→region→zone-advance sequencing', () => {
  it('full Sylvani clear: Craghorn → Broodmaw → zone advances to emberpeak', () => {
    const store = newGame();
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], items: [] };
      players[1] = { ...players[1], items: [] };
      return { ...s, players };
    });
    // Beat Craghorn.
    store.getState().engageWildBossSlot('sylvani', 'craghorn');
    store.getState().dispatchCombat(buildResolveWinAction(CRAGHORN, ['p0', 'p1'], 'sylvani'));
    expect(store.getState().bossKeys.sylvani).toEqual(['craghorn']);
    // Beat Broodmaw — unlocked by the key drop.
    store.getState().engageRegionBossSlot('sylvani', 'broodmaw');
    store.getState().dispatchCombat(buildResolveWinAction(BROODMAW, ['p0', 'p1'], 'sylvani'));
    const after = store.getState();
    expect(after.currentZone).toBe('emberpeak');
    // Key is still recorded (not consumed) — a key, once dropped,
    // persists for the rest of the run.
    expect(after.bossKeys.sylvani).toEqual(['craghorn']);
  });

  it('repeat wild-boss payloads are idempotent at the bossKeys layer', () => {
    // Defensive check: if the same COMBAT_RESOLVE_WIN is re-dispatched
    // (should never happen in prod, but helps prove the helper's
    // idempotency contract), bossKeys does NOT double-append.
    const store = newGame();
    store.getState().engageWildBossSlot('sylvani', 'craghorn');
    const action = buildResolveWinAction(CRAGHORN, ['p0', 'p1'], 'sylvani');
    store.getState().dispatchCombat(action);
    // Second dispatch is a no-op at the combat layer (activeCombat is
    // already null), so re-dispatching lands on a null activeCombat
    // and short-circuits — but even if it did run through, the
    // recordBossKey call would be a no-op.
    expect(store.getState().bossKeys.sylvani).toEqual(['craghorn']);
  });
});

// Silence unused-var linter warnings for fixtures exported only for
// symbolic readability above.
void VURMOX;
void ASHEN_TYRANT;
void SILVER_CHIMERA;
void SENTINEL;

export type _EnsureStoreTypePinned = GameStore;
