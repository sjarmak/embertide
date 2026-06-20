/**
 * Slot-selector coverage for REQ-32 / u-9a (Wild & Region Boss Encounter
 * Slots). The prior `canSpawnRegionBoss` gate is retired; the per-zone
 * wild/region slot state is now queried via
 * `currentWildBossForZone` / `currentRegionBossForZone`.
 *
 * Both selectors only read `state.defeatedBossIds` and the frozen
 * `ZONE_METADATA` record — so these tests build a minimal `KidGameState`
 * fixture (RNG-free) without touching the full zustand store.
 */

import { describe, it, expect } from 'vitest';
import type { KidGameState } from '../store/types';
import {
  PRISM_CHIMERA_ID,
  PRISM_CHIMERA_SPAWN_CAP,
  PRISM_CHIMERA_SPAWN_STEP,
  ZONE_METADATA,
  computePrismChimeraSpawnChance,
  currentRegionBossForZone,
  currentWildBossForZone,
} from './zones';
import { createSeededRng } from './chestPool';
import { makeKidGameState } from '../testing/stateFixtures';

// ---------------------------------------------------------------------------
// Minimal fixture. The selectors read only `defeatedBossIds`; every other
// field is filler to satisfy the KidGameState type.
// ---------------------------------------------------------------------------

function makeState(
  defeatedBossIds: readonly string[] = [],
  overrides: Partial<KidGameState> = {},
): KidGameState {
  return makeKidGameState({
    seed: 1,
    rng: createSeededRng(1),
    defeatedBossIds,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// currentWildBossForZone
// ---------------------------------------------------------------------------

describe('currentWildBossForZone (u-9a)', () => {
  it('Sylvani: returns "craghorn" when no wild bosses are defeated', () => {
    expect(currentWildBossForZone(makeState([]), 'sylvani')).toBe('craghorn');
  });

  it('Sylvani: returns null once craghorn is in defeatedBossIds', () => {
    expect(currentWildBossForZone(makeState(['craghorn']), 'sylvani')).toBeNull();
  });

  it('Emberpeak: returns "boulderkin" when no wild bosses are defeated', () => {
    expect(currentWildBossForZone(makeState([]), 'emberpeak')).toBe('boulderkin');
  });

  it('Emberpeak: returns null once boulderkin is in defeatedBossIds', () => {
    expect(currentWildBossForZone(makeState(['boulderkin']), 'emberpeak')).toBeNull();
  });

  it('Gilded Cage: returns "sentinel" first when no wild bosses are defeated', () => {
    expect(currentWildBossForZone(makeState([]), 'gilded-cage')).toBe('sentinel');
  });

  it('Gilded Cage: returns "silver-chimera" after sentinel is defeated (FIFO queue advance)', () => {
    expect(currentWildBossForZone(makeState(['sentinel']), 'gilded-cage')).toBe('silver-chimera');
  });

  it('Gilded Cage: still returns "sentinel" when silver-chimera alone is defeated (first-not-defeated, not "next after last defeated")', () => {
    // Defensive: the selector walks `wildBossIds` in declared order and
    // returns the first entry not in `defeatedBossIds`. If silver-chimera is
    // defeated out-of-order, sentinel is still the current slot.
    expect(currentWildBossForZone(makeState(['silver-chimera']), 'gilded-cage')).toBe('sentinel');
  });

  it('Gilded Cage: returns null when only sentinel and silver-chimera are defeated AND prismChimeraSpawned is false', () => {
    // embertide-044 (2026-04-24): Rainbow is now a dynamic-spawn
    // encounter. With the FIFO cleared but the one-shot spawn roll
    // having failed (flag false), the wild slot is empty.
    expect(
      currentWildBossForZone(makeState(['sentinel', 'silver-chimera']), 'gilded-cage'),
    ).toBeNull();
  });

  it('Gilded Cage: returns "prism-chimera" once FIFO cleared AND prismChimeraSpawned is true', () => {
    // embertide-044: the spawn roll fired at Silver Chimera's defeat
    // set `prismChimeraSpawned: true` — the Temple wild slot now
    // surfaces the post-completion boss. Cross-zone prerequisites
    // (craghorn + boulderkin) are NO LONGER required.
    expect(
      currentWildBossForZone(
        makeState(['sentinel', 'silver-chimera'], { prismChimeraSpawned: true }),
        'gilded-cage',
      ),
    ).toBe(PRISM_CHIMERA_ID);
  });

  it('Gilded Cage: rainbow surfaces regardless of craghorn / boulderkin defeat state (cross-zone gate retired)', () => {
    // Regression guard for the retired RAINBOW_CHIMERA_CROSS_ZONE_GATE —
    // confirm the predicate no longer reads from the OTHER zones'
    // defeated-boss ids.
    expect(
      currentWildBossForZone(
        makeState(['sentinel', 'silver-chimera'], { prismChimeraSpawned: true }),
        'gilded-cage',
      ),
    ).toBe(PRISM_CHIMERA_ID);
    expect(
      currentWildBossForZone(
        makeState(['craghorn', 'sentinel', 'silver-chimera'], { prismChimeraSpawned: true }),
        'gilded-cage',
      ),
    ).toBe(PRISM_CHIMERA_ID);
  });

  it('Gilded Cage: returns null once Prism Chimera is defeated (even with spawn flag still true)', () => {
    expect(
      currentWildBossForZone(
        makeState(['sentinel', 'silver-chimera', PRISM_CHIMERA_ID], {
          prismChimeraSpawned: true,
        }),
        'gilded-cage',
      ),
    ).toBeNull();
  });

  it('Gilded Cage: rainbow is NEVER returned before silver-chimera is defeated (FIFO takes precedence)', () => {
    // Defensive: even if the spawn flag somehow flipped before the FIFO
    // clears, the selector prefers the undefeated FIFO entry.
    expect(
      currentWildBossForZone(
        makeState(['sentinel'], { prismChimeraSpawned: true }),
        'gilded-cage',
      ),
    ).toBe('silver-chimera');
  });

  it('ZONE_METADATA.wildBossIds matches the expected per-zone roster (sanity anchor)', () => {
    // Keeps the selector tests coupled to the canonical roster — a future
    // v2.1 splice (maren / hollow-shrine / dune-sanctum) would need to add
    // its own rows here without silently drifting the existing three.
    expect(ZONE_METADATA.sylvani.wildBossIds).toEqual(['craghorn']);
    expect(ZONE_METADATA['emberpeak'].wildBossIds).toEqual(['boulderkin']);
    // embertide-044 (2026-04-24): Temple's FIFO carries only the
    // two core wild bosses — Prism Chimera is a dynamic-spawn
    // encounter outside the queue.
    expect(ZONE_METADATA['gilded-cage'].wildBossIds).toEqual(['sentinel', 'silver-chimera']);
  });
});

// ---------------------------------------------------------------------------
// computePrismChimeraSpawnChance — embertide-044 linear-ramp
// formula: P = min(0.05 * centerRowKillCount, 0.85). One-shot roll fired
// at Silver Chimera's defeat transaction; see `COMBAT_RESOLVE_WIN` in
// src/store/gameStore.ts for the roll site.
// ---------------------------------------------------------------------------

describe('computePrismChimeraSpawnChance (embertide-044)', () => {
  it('returns 0 at 0 center-row kills (floor)', () => {
    expect(computePrismChimeraSpawnChance(0)).toBe(0);
  });

  it('clamps negative input to 0 (defensive)', () => {
    expect(computePrismChimeraSpawnChance(-5)).toBe(0);
  });

  it('returns 0.25 at 5 kills (linear ramp: 0.05 * 5)', () => {
    expect(computePrismChimeraSpawnChance(5)).toBeCloseTo(0.25, 10);
  });

  it('returns 0.5 at 10 kills (linear ramp: 0.05 * 10)', () => {
    expect(computePrismChimeraSpawnChance(10)).toBeCloseTo(0.5, 10);
  });

  it('returns exactly the cap (0.85) at 17 kills (0.05 * 17)', () => {
    expect(computePrismChimeraSpawnChance(17)).toBeCloseTo(
      PRISM_CHIMERA_SPAWN_CAP,
      10,
    );
  });

  it('stays at the cap (0.85) for kill counts past the threshold', () => {
    expect(computePrismChimeraSpawnChance(20)).toBe(PRISM_CHIMERA_SPAWN_CAP);
    expect(computePrismChimeraSpawnChance(100)).toBe(PRISM_CHIMERA_SPAWN_CAP);
    expect(computePrismChimeraSpawnChance(1_000_000)).toBe(PRISM_CHIMERA_SPAWN_CAP);
  });

  it('matches the designer-locked step/cap constants', () => {
    expect(PRISM_CHIMERA_SPAWN_STEP).toBe(0.05);
    expect(PRISM_CHIMERA_SPAWN_CAP).toBe(0.85);
  });
});

// ---------------------------------------------------------------------------
// currentRegionBossForZone
// ---------------------------------------------------------------------------

describe('currentRegionBossForZone (u-9a)', () => {
  it('Sylvani: returns "broodmaw" when the region boss has not yet been defeated', () => {
    expect(currentRegionBossForZone(makeState([]), 'sylvani')).toBe('broodmaw');
  });

  it('Sylvani: returns null once broodmaw is in defeatedBossIds', () => {
    expect(currentRegionBossForZone(makeState(['broodmaw']), 'sylvani')).toBeNull();
  });

  it('Emberpeak: returns "ashen-tyrant" when the region boss has not been defeated', () => {
    expect(currentRegionBossForZone(makeState([]), 'emberpeak')).toBe('ashen-tyrant');
  });

  it('Emberpeak: returns null once ashen-tyrant is in defeatedBossIds', () => {
    expect(currentRegionBossForZone(makeState(['ashen-tyrant']), 'emberpeak')).toBeNull();
  });

  it('Gilded Cage: returns "cagewright-vurmox" when the region boss has not been defeated', () => {
    expect(currentRegionBossForZone(makeState([]), 'gilded-cage')).toBe('cagewright-vurmox');
  });

  it('Gilded Cage: returns null once cagewright-vurmox is in defeatedBossIds', () => {
    expect(currentRegionBossForZone(makeState(['cagewright-vurmox']), 'gilded-cage')).toBeNull();
  });

  it('REQ-32: region slot is always engageable even when the zone wild bosses are all alive', () => {
    // Core REQ-32 contract — the retired `canSpawnRegionBoss` gate would
    // have returned false here; the new selector must return the boss id.
    expect(currentRegionBossForZone(makeState([]), 'gilded-cage')).toBe('cagewright-vurmox');
    expect(currentRegionBossForZone(makeState([]), 'sylvani')).toBe('broodmaw');
    expect(currentRegionBossForZone(makeState([]), 'emberpeak')).toBe('ashen-tyrant');
  });

  it('ZONE_METADATA.regionBossId matches the expected per-zone entry (sanity anchor)', () => {
    expect(ZONE_METADATA.sylvani.regionBossId).toBe('broodmaw');
    expect(ZONE_METADATA['emberpeak'].regionBossId).toBe('ashen-tyrant');
    expect(ZONE_METADATA['gilded-cage'].regionBossId).toBe('cagewright-vurmox');
  });
});
