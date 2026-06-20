import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { createSeededRng } from '../rules/chestPool';
import { KID_CARDS } from '../data/cards';
import type { Card } from '../types/card';
import type { KidGameState, KidPlayer } from './types';
import { buildResolveWinAction, createGameStore } from './gameStore';
import { fightMonster } from './slices/combat';
import { PRINCESS_CRYSTAL_INITIAL_CHARGES } from './slices/crystal';
import {
  advanceZone,
  COLOSSEUM_UNLOCK_BOSS_IDS,
  initialZoneFields,
  isColosseumUnlocked,
  recordBossDefeat,
} from './slices/zones';
import {
  ZONE_METADATA,
  ZONE_ORDER,
  isTerminalZone,
  nextZone,
  type ZoneMetadata,
} from '../rules/zones';
import { makeKidPlayer, makeKidGameState } from '../testing/stateFixtures';

// ---------------------------------------------------------------------------
// Test-metadata safety: a couple of tests patch ZONE_METADATA.sylvani to
// exercise the zone-advance hook on a synthetic region boss. Without a
// module-wide snapshot/restore, a thrown exception mid-test would leak
// patched metadata into later tests in the same Vitest worker. The
// beforeEach/afterEach pair below guarantees restore, replacing the
// per-test try/finally wrappers that were fragile under parallel
// execution (u-5a reviewer finding 3).
// ---------------------------------------------------------------------------
let ZONE_METADATA_SNAPSHOT: Record<string, ZoneMetadata> | null = null;

beforeEach(() => {
  ZONE_METADATA_SNAPSHOT = {
    sylvani: { ...ZONE_METADATA.sylvani },
    'emberpeak': { ...ZONE_METADATA['emberpeak'] },
    'gilded-cage': { ...ZONE_METADATA['gilded-cage'] },
  };
});

afterEach(() => {
  if (ZONE_METADATA_SNAPSHOT) {
    ZONE_METADATA.sylvani = ZONE_METADATA_SNAPSHOT.sylvani;
    ZONE_METADATA['emberpeak'] = ZONE_METADATA_SNAPSHOT['emberpeak'];
    ZONE_METADATA['gilded-cage'] = ZONE_METADATA_SNAPSHOT['gilded-cage'];
    ZONE_METADATA_SNAPSHOT = null;
  }
});

/**
 * u-5a acceptance coverage (REQ-32/u-9a retired the wild-bosses-cleared
 * gate — see src/rules/zones.test.ts for selector coverage):
 *  (a) currentZone starts at 'sylvani', zoneHistory empty, defeatedBossIds empty
 *  (b) advanceZone progresses sylvani → emberpeak → gilded-cage
 *  (c) advanceZone at the terminal zone is a no-op and does not throw
 *  (d) zoneHistory accumulates cleared zones in order
 *  (e) recordBossDefeat appends idempotently
 *  (g) region-boss kill (matching the zone's regionBossId) triggers advanceZone
 *  (h) wild-boss kill appends to defeatedBossIds WITHOUT advancing
 *  (i) order invariant: recordBossDefeat fires before advanceZone so
 *      downstream observers see the defeated id at advance time
 */

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

const GRUNT_ORC = KID_CARDS.find((c) => c.id === 'grunt-orc')!;

// ---------------------------------------------------------------------------
// ZONE_ORDER + metadata sanity.
// ---------------------------------------------------------------------------

describe('zone rules — ZONE_ORDER + metadata (u-5a)', () => {
  it("ships the 6-zone v2.1 sequence (Sylvani → Emberpeak → Tidehold → Hollow Shrine → Dune Sanctum → Gilded Cage)", () => {
    expect(ZONE_ORDER).toEqual([
      'sylvani',
      'emberpeak',
      'maren',
      'hollow-shrine',
      'dune-sanctum',
      'gilded-cage',
    ]);
  });

  it('each zone has display name + theme hint declared', () => {
    expect(ZONE_METADATA.sylvani.displayName).toBe('Sylvanwood');
    expect(ZONE_METADATA['emberpeak'].displayName).toBe('Emberpeak');
    expect(ZONE_METADATA['gilded-cage'].displayName).toBe('Gilded Cage');
    for (const id of ZONE_ORDER) {
      expect(ZONE_METADATA[id].themeHint.length).toBeGreaterThan(0);
    }
  });

  it('Layer 7 baseline: all three zones carry wild + region boss metadata (gilded-cage populated by u-6c-bosses)', () => {
    // u-6a populated sylvani (craghorn / broodmaw — see sylvaniContent.test.ts).
    // u-6b populated emberpeak (boulderkin / ashen-tyrant — see
    // emberpeakContent.test.ts).
    // u-6c-bosses populated gilded-cage: wildBossIds=[sentinel,
    // silver-chimera], regionBossId='cagewright-vurmox' — see
    // gildedCageBosses.test.ts for the full acceptance coverage.
    const meta = ZONE_METADATA['gilded-cage'];
    // embertide-044 (2026-04-24): Temple's FIFO carries only the
    // two cores (Sentinel + Silver Chimera). Prism Chimera is a
    // dynamic-spawn encounter rolled once at Silver Chimera's defeat
    // (see src/rules/zones.test.ts for spawn-formula coverage).
    expect(meta.wildBossIds).toEqual(['sentinel', 'silver-chimera']);
    expect(meta.regionBossId).toBe('cagewright-vurmox');
  });

  it('u-6c populates gilded-cage regulars (wardeye/bubble/bone-knight/gulpmaw/hexrobe)', () => {
    expect(ZONE_METADATA['gilded-cage'].regularEnemyIds).toEqual([
      'wardeye',
      'emberskull',
      'bone-knight',
      'gulpmaw',
      'hexrobe',
    ]);
    // Sylvani regulars asserted in src/data/sylvaniContent.test.ts.
    // Emberpeak regulars land on u-6b.
  });

  it('isTerminalZone returns true only for the last zone in ZONE_ORDER', () => {
    expect(isTerminalZone('sylvani')).toBe(false);
    expect(isTerminalZone('emberpeak')).toBe(false);
    expect(isTerminalZone('maren')).toBe(false);
    expect(isTerminalZone('hollow-shrine')).toBe(false);
    expect(isTerminalZone('dune-sanctum')).toBe(false);
    expect(isTerminalZone('gilded-cage')).toBe(true);
  });

  it('nextZone returns the next entry in sequence, null at terminal', () => {
    expect(nextZone('sylvani')).toBe('emberpeak');
    // gdd.1: maren spliced between emberpeak and gilded-cage.
    expect(nextZone('emberpeak')).toBe('maren');
    // gdd.2: hollow-shrine spliced between maren and gilded-cage.
    expect(nextZone('maren')).toBe('hollow-shrine');
    // gdd.3: dune-sanctum spliced between hollow-shrine and gilded-cage.
    expect(nextZone('hollow-shrine')).toBe('dune-sanctum');
    expect(nextZone('dune-sanctum')).toBe('gilded-cage');
    expect(nextZone('gilded-cage')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// initialZoneFields + pure slice helpers.
// ---------------------------------------------------------------------------

describe('initialZoneFields + advanceZone + recordBossDefeat (u-5a)', () => {
  it('(a) initial fields: currentZone=sylvani, zoneHistory=[], defeatedBossIds=[]', () => {
    const init = initialZoneFields();
    expect(init.currentZone).toBe('sylvani');
    expect(init.zoneHistory).toEqual([]);
    expect(init.defeatedBossIds).toEqual([]);
  });

  it('initGame seeds the zone fields in the store', () => {
    const store = createGameStore(1);
    store.getState().initGame({
      players: 2,
      championIds: ['champion-power', 'champion-courage'],
    });
    const s = store.getState();
    expect(s.currentZone).toBe('sylvani');
    expect(s.zoneHistory).toEqual([]);
    expect(s.defeatedBossIds).toEqual([]);
  });

  it('(b + d) advanceZone progresses sylvani → emberpeak → maren → hollow-shrine → dune-sanctum → gilded-cage and accumulates history (gdd.3 6-zone v2.1 chain)', () => {
    let s = makeState();
    // First advance.
    s = advanceZone(s);
    expect(s.currentZone).toBe('emberpeak');
    expect(s.zoneHistory).toEqual(['sylvani']);
    // Second advance — gdd.1 splices maren between emberpeak and temple.
    s = advanceZone(s);
    expect(s.currentZone).toBe('maren');
    expect(s.zoneHistory).toEqual(['sylvani', 'emberpeak']);
    // Third advance — gdd.2 splices hollow-shrine between maren and temple.
    s = advanceZone(s);
    expect(s.currentZone).toBe('hollow-shrine');
    expect(s.zoneHistory).toEqual(['sylvani', 'emberpeak', 'maren']);
    // Fourth advance — gdd.3 splices dune-sanctum between hollow-shrine and temple.
    s = advanceZone(s);
    expect(s.currentZone).toBe('dune-sanctum');
    expect(s.zoneHistory).toEqual(['sylvani', 'emberpeak', 'maren', 'hollow-shrine']);
    // Fifth advance — into the terminal zone.
    s = advanceZone(s);
    expect(s.currentZone).toBe('gilded-cage');
    expect(s.zoneHistory).toEqual([
      'sylvani',
      'emberpeak',
      'maren',
      'hollow-shrine',
      'dune-sanctum',
    ]);
  });

  it('(c) advanceZone at terminal zone records the terminal clearance in zoneHistory (u-5b amendment) and is idempotent on re-call', () => {
    // gdd.3: full v2.1 history is the 6-zone chain ending at terminal.
    const s = makeState({
      currentZone: 'gilded-cage',
      zoneHistory: ['sylvani', 'emberpeak', 'maren', 'hollow-shrine', 'dune-sanctum'],
    });
    expect(() => advanceZone(s)).not.toThrow();
    const next = advanceZone(s);
    // u-5b: terminal advance appends the terminal zone to history.
    // currentZone stays at terminal (no successor).
    expect(next.currentZone).toBe('gilded-cage');
    expect(next.zoneHistory).toEqual([
      'sylvani',
      'emberpeak',
      'maren',
      'hollow-shrine',
      'dune-sanctum',
      'gilded-cage',
    ]);
    // u-5b side effect: full 6-zone sequence cleared → Courage flips.
    expect(next.sharedEmbertide.courage).toBe(true);
    // Second call at terminal with the zone already in history is a
    // full no-op (identity return).
    const next2 = advanceZone(next);
    expect(next2).toBe(next);
  });

  it('advanceZone returns a new state (immutability) on a real advance', () => {
    const s = makeState();
    const next = advanceZone(s);
    expect(next).not.toBe(s);
    expect(next.zoneHistory).not.toBe(s.zoneHistory);
    // Original state is unchanged.
    expect(s.currentZone).toBe('sylvani');
    expect(s.zoneHistory).toEqual([]);
  });

  it('(e) recordBossDefeat appends a card id exactly once (idempotent on re-record)', () => {
    let s = makeState();
    s = recordBossDefeat(s, 'craghorn');
    expect(s.defeatedBossIds).toEqual(['craghorn']);
    // Second call is a no-op.
    const s2 = recordBossDefeat(s, 'craghorn');
    expect(s2).toBe(s);
    expect(s2.defeatedBossIds).toEqual(['craghorn']);
    // Different id appends.
    const s3 = recordBossDefeat(s2, 'broodmaw');
    expect(s3.defeatedBossIds).toEqual(['craghorn', 'broodmaw']);
  });
});

// ---------------------------------------------------------------------------
// Colosseum unlock predicate (embertide-4hr1.2).
// ---------------------------------------------------------------------------

describe('isColosseumUnlocked (embertide-4hr1.2)', () => {
  it('(a) returns false when defeatedBossIds is empty', () => {
    const s = makeState();
    expect(isColosseumUnlocked(s)).toBe(false);
  });

  // Read required ids from the exported tuple so the tests track the
  // single source of truth (preserves `[0]='craghorn'`, `[1]='broodmaw'` literal
  // types via `as const`).
  const [REQUIRED_A, REQUIRED_B] = COLOSSEUM_UNLOCK_BOSS_IDS;

  it('(b) returns false when only the first required id is defeated', () => {
    let s = makeState();
    s = recordBossDefeat(s, REQUIRED_A);
    expect(isColosseumUnlocked(s)).toBe(false);
  });

  it('(c) returns false when only the second required id is defeated', () => {
    let s = makeState();
    s = recordBossDefeat(s, REQUIRED_B);
    expect(isColosseumUnlocked(s)).toBe(false);
  });

  it('(d) returns true when both are defeated (canonical order)', () => {
    let s = makeState();
    s = recordBossDefeat(s, REQUIRED_A);
    s = recordBossDefeat(s, REQUIRED_B);
    expect(isColosseumUnlocked(s)).toBe(true);
  });

  it('(e) returns true when both are defeated (reverse order — A2 order independence)', () => {
    let s = makeState();
    s = recordBossDefeat(s, REQUIRED_B);
    s = recordBossDefeat(s, REQUIRED_A);
    expect(isColosseumUnlocked(s)).toBe(true);
  });

  // (f1)/(f2) lock in subset-check semantics: without them a regression to
  // `length === 2` or positional `[0]/[1]` matching would silently pass
  // (a)–(e). Cross-zone ids are intentionally hard-coded — they document
  // the "noise from other zones" scenario and would not benefit from a
  // shared const.

  it('(f1) cross-zone defeats with only one required id → false', () => {
    let s = makeState();
    s = recordBossDefeat(s, 'boulderkin');
    s = recordBossDefeat(s, 'ashen-tyrant');
    s = recordBossDefeat(s, REQUIRED_A);
    expect(isColosseumUnlocked(s)).toBe(false);
  });

  it('(f2) cross-zone defeats with both required ids → true', () => {
    let s = makeState();
    s = recordBossDefeat(s, REQUIRED_A);
    s = recordBossDefeat(s, REQUIRED_B);
    s = recordBossDefeat(s, 'sentinel');
    s = recordBossDefeat(s, 'silver-chimera');
    expect(isColosseumUnlocked(s)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// End-to-end via fightMonster: boss-tier hooks on combat resolution.
// ---------------------------------------------------------------------------

describe('fightMonster triggers u-5a zone hooks (u-5a)', () => {
  it('(g) region-boss kill (matching zone regionBossId) triggers advanceZone', () => {
    // Manufacture a region-boss card for Sylvani. u-6a will declare the
    // real Broodmaw; u-5a just needs to prove the hook fires.
    const regionBossCard: Card = {
      id: 'broodmaw-u5a-stub',
      role: 'mini-boss',
      cost: { red: 5 },
      effects: { kind: 'monster-drop', hearts: 0 },
      bossTier: 'region-boss',
    };
    // Patch the Sylvani zone metadata so its regionBossId matches the
    // card id we'll defeat.
    const original = ZONE_METADATA.sylvani;
    try {
      ZONE_METADATA.sylvani = {
        ...original,
        regionBossId: regionBossCard.id,
      };
      let s = makeState({
        players: [makePlayer({ id: 'p0', red: 10 }), makePlayer({ id: 'p1' })],
        field: [regionBossCard],
      });
      s = fightMonster(s, 0, regionBossCard.id);
      expect(s.currentZone).toBe('emberpeak');
      expect(s.zoneHistory).toEqual(['sylvani']);
      expect(s.defeatedBossIds).toEqual([regionBossCard.id]);
    } finally {
      ZONE_METADATA.sylvani = original;
    }
  });

  it('(h) wild-boss kill appends to defeatedBossIds but does NOT advance the zone', () => {
    const wildBossCard: Card = {
      id: 'craghorn-u5a-stub',
      role: 'mini-boss',
      cost: { red: 6 },
      effects: { kind: 'monster-drop', hearts: 0 },
      bossTier: 'wild-boss',
    };
    let s = makeState({
      players: [makePlayer({ id: 'p0', red: 10 }), makePlayer({ id: 'p1' })],
      field: [wildBossCard],
    });
    s = fightMonster(s, 0, wildBossCard.id);
    // Zone did NOT advance.
    expect(s.currentZone).toBe('sylvani');
    expect(s.zoneHistory).toEqual([]);
    // But the defeat was recorded.
    expect(s.defeatedBossIds).toEqual([wildBossCard.id]);
  });

  it('region-boss kill whose id does NOT match the current zone gate records the defeat but does NOT advance', () => {
    // Defensive case — guards against cross-zone region-boss cards
    // leaking into the wrong zone by data-authoring mistake.
    const otherZoneRegionBoss: Card = {
      id: 'ashen-tyrant-stub',
      role: 'mini-boss',
      cost: { red: 7 },
      effects: { kind: 'monster-drop', hearts: 0 },
      bossTier: 'region-boss',
    };
    // Sylvani's regionBossId is still null (u-5a default). So even
    // though the card carries 'region-boss', it does NOT match the
    // current zone's gatekeeper and the zone must NOT advance.
    let s = makeState({
      players: [makePlayer({ id: 'p0', red: 10 }), makePlayer({ id: 'p1' })],
      field: [otherZoneRegionBoss],
    });
    s = fightMonster(s, 0, otherZoneRegionBoss.id);
    expect(s.currentZone).toBe('sylvani');
    expect(s.zoneHistory).toEqual([]);
    expect(s.defeatedBossIds).toEqual([otherZoneRegionBoss.id]);
  });

  it('regular beast (no bossTier) triggers neither the record nor the advance', () => {
    // GRUNT_ORC has no bossTier → both hooks skip. Sanity: the crystal
    // counter still decrements, but defeatedBossIds stays empty.
    let s = makeState({
      players: [makePlayer({ id: 'p0', red: 10 }), makePlayer({ id: 'p1' })],
      field: [{ ...GRUNT_ORC, id: 'grunt-orc-zone-test' }],
    });
    s = fightMonster(s, 0, 'grunt-orc-zone-test');
    expect(s.defeatedBossIds).toEqual([]);
    expect(s.currentZone).toBe('sylvani');
    // Crystal counter ticked (pre-existing u-2e invariant). Schema is
    // provisional per embertide-vj52, so express relative to the
    // initial-charges constant rather than a literal.
    expect(s.princessCrystal.charges).toBe(PRINCESS_CRYSTAL_INITIAL_CHARGES - 1);
  });

  it('(i) region-boss defeat results in BOTH: defeatedBossIds contains the id AND currentZone advances (post-condition, not strict ordering)', () => {
    // HONESTY NOTE (u-5a reviewer finding 1): this test verifies the
    // POST-CONDITIONS of applyBossDefeatHooks, not the internal call
    // order of recordBossDefeat → advanceZone. A reversal of those
    // two calls inside combat.ts would produce an identical terminal
    // state for the current scope (where advanceZone is unconditional).
    // The ordering IS enforced in production code (see the defensive
    // comment in applyBossDefeatHooks) so downstream observers of
    // `defeatedBossIds` see the fresh id during the advance
    // transaction. For u-5a this post-condition test is the strongest
    // assertion available without coupling to implementation internals.
    const regionBossCard: Card = {
      id: 'order-invariant-region-boss',
      role: 'mini-boss',
      cost: { red: 5 },
      effects: { kind: 'monster-drop', hearts: 0 },
      bossTier: 'region-boss',
    };
    ZONE_METADATA.sylvani = {
      ...ZONE_METADATA.sylvani,
      regionBossId: regionBossCard.id,
    };
    let s = makeState({
      players: [makePlayer({ id: 'p0', red: 10 }), makePlayer({ id: 'p1' })],
      field: [regionBossCard],
    });
    s = fightMonster(s, 0, regionBossCard.id);
    expect(s.currentZone).toBe('emberpeak');
    expect(s.defeatedBossIds).toContain(regionBossCard.id);
    // afterEach restores ZONE_METADATA — no try/finally needed.
  });
});

// ---------------------------------------------------------------------------
// End-to-end via the zustand store.
// ---------------------------------------------------------------------------

describe('end-to-end: store-driven zone advance on region-boss defeat (u-5a / u-8c)', () => {
  it('fightMonster + COMBAT_RESOLVE_WIN on a region-boss card flips currentZone via the store', () => {
    // u-8c: region-boss engagement now routes through combat sub-state.
    // Use the canonical sylvani region boss (broodmaw) so the attack-pattern
    // lookup has an entry — and then dispatch COMBAT_RESOLVE_WIN to
    // trigger the zone advance transaction.
    const store = createGameStore(1);
    store.getState().initGame({
      players: 2,
      championIds: ['champion-power', 'champion-courage'],
    });
    expect(store.getState().currentZone).toBe('sylvani');

    const broodmaw = KID_CARDS.find((c) => c.id === 'broodmaw')!;
    // Inject the region boss + red shards/keys for p0.
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], red: 20, keys: 3 };
      return { ...s, players, field: [broodmaw] };
    });
    store.getState().fightMonster(broodmaw.id);
    // u-8c: fightMonster on a region-boss now dispatches COMBAT_ENTER.
    // Resolve the win to trigger zone advance + defeat recording.
    expect(store.getState().activeCombat).not.toBeNull();
    store.getState().dispatchCombat(buildResolveWinAction(broodmaw, ['p0', 'p1'], 'sylvani'));
    const after = store.getState();
    expect(after.currentZone).toBe('emberpeak');
    expect(after.zoneHistory).toEqual(['sylvani']);
    expect(after.defeatedBossIds).toEqual([broodmaw.id]);
  });
});
