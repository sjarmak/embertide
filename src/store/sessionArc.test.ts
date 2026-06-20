/**
 * Session-arc + softclock test suite (REQ-19 full 4-phase + REQ-16,
 * amendment A2/A4, u-7 + gm0.9).
 *
 * Acceptance coverage:
 *  (a) Phase derivation: Stirring (turns 1-2) → Rising (turns 3-5) →
 *      Boss (turns 6-8) → Climax (turns 9+). Wild-boss spawns gate at
 *      Rising (turn 3); region-boss spawns gate at Boss (turn 6).
 *  (b) Climax phase forces Vurmox pin at turn 9 when party is in
 *      gilded-cage.
 *  (c) Climax phase at turn 9 with party still in sylvani returns the
 *      stall signal (no crash, no pin).
 *  (d) Softclock fires at turn 10 when sharedTriforce < 2.
 *  (e) Softclock does NOT fire at turn 10 when sharedTriforce >= 2.
 *  (f) Softclock grows cumulatively across subsequent turns while the
 *      condition holds.
 *
 * Scope stance: the session slice exposes pure helpers; UI + combat
 * wiring lives in `WildBossEncounterSlot.tsx` (dormant variant) and
 * `gameStore.ts` (engage-slot phase gates). These tests verify the
 * helpers directly.
 */

import { describe, it, expect } from 'vitest';
import { createSeededRng } from '../rules/chestPool';
import type { KidGameState, KidPlayer, SharedTriforce } from './types';
import { ZONE_METADATA } from '../rules/zones';
import { makeKidPlayer, makeKidGameState } from '../testing/stateFixtures';
import {
  BOSS_PHASE_TURN,
  CLIMAX_PHASE_TURN,
  VURMOX_ID,
  RISING_PHASE_TURN,
  SOFTCLOCK_SHARD_FLOOR,
  SOFTCLOCK_TURN,
  STIRRING_PHASE_TURN,
  applyGanonPin,
  canSpawnRegionBossByPhase,
  canSpawnWildBossInZone,
  isClimaxStalled,
  sessionPhase,
  shouldPinGanon,
  softclockHpEase,
} from './slices/session';
import { KID_CARDS } from '../data/cards';
import type { Card } from '../types/card';

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

const VURMOX = KID_CARDS.find((c) => c.id === VURMOX_ID)!;

function tForce(overrides: Partial<SharedTriforce> = {}): SharedTriforce {
  return { wisdom: false, courage: false, power: false, ...overrides };
}

// ---------------------------------------------------------------------------
// Sanity: constants + card lookup wired to the same id.
// ---------------------------------------------------------------------------

describe('session-arc constants + Vurmox id wiring', () => {
  it('STIRRING_PHASE_TURN = 1 and RISING_PHASE_TURN = 3 (REQ-19 4-phase anchors)', () => {
    expect(STIRRING_PHASE_TURN).toBe(1);
    expect(RISING_PHASE_TURN).toBe(3);
  });

  it('BOSS_PHASE_TURN = 6 and CLIMAX_PHASE_TURN = 9 (REQ-19 anchors)', () => {
    expect(BOSS_PHASE_TURN).toBe(6);
    expect(CLIMAX_PHASE_TURN).toBe(9);
  });

  it('SOFTCLOCK_TURN = 10 and SOFTCLOCK_SHARD_FLOOR = 2 (amendment A4)', () => {
    expect(SOFTCLOCK_TURN).toBe(10);
    expect(SOFTCLOCK_SHARD_FLOOR).toBe(2);
  });

  it('VURMOX_ID matches ZONE_METADATA["gilded-cage"].regionBossId + exists in KID_CARDS', () => {
    expect(VURMOX_ID).toBe('cagewright-vurmox');
    expect(ZONE_METADATA['gilded-cage'].regionBossId).toBe(VURMOX_ID);
    expect(VURMOX).toBeDefined();
    expect(VURMOX.id).toBe(VURMOX_ID);
  });
});

// ---------------------------------------------------------------------------
// sessionPhase derivation + per-tier spawn gates (a).
// ---------------------------------------------------------------------------

describe('sessionPhase derives from turn count (a)', () => {
  it('turns 1-2 → Stirring', () => {
    for (const t of [1, 2]) {
      expect(sessionPhase(t)).toBe('Stirring');
    }
  });

  it('turns 3-5 → Rising', () => {
    for (const t of [3, 4, 5]) {
      expect(sessionPhase(t)).toBe('Rising');
    }
  });

  it('turns 6-8 → Boss', () => {
    for (const t of [6, 7, 8]) {
      expect(sessionPhase(t)).toBe('Boss');
    }
  });

  it('turns 9+ → Climax', () => {
    for (const t of [9, 10, 11, 20]) {
      expect(sessionPhase(t)).toBe('Climax');
    }
  });

  it('phase is monotonic non-decreasing as turn grows', () => {
    const order: Record<string, number> = {
      Stirring: 0,
      Rising: 1,
      Boss: 2,
      Climax: 3,
    };
    let prev = -1;
    for (let t = 1; t <= 20; t += 1) {
      const cur = order[sessionPhase(t)];
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });

  it('flips Stirring → Rising at the exact turn 2 → 3 boundary', () => {
    expect(sessionPhase(2)).toBe('Stirring');
    expect(sessionPhase(3)).toBe('Rising');
  });

  it('flips Rising → Boss at the exact turn 5 → 6 boundary', () => {
    expect(sessionPhase(5)).toBe('Rising');
    expect(sessionPhase(6)).toBe('Boss');
  });

  it('flips Boss → Climax at the exact turn 8 → 9 boundary', () => {
    expect(sessionPhase(8)).toBe('Boss');
    expect(sessionPhase(9)).toBe('Climax');
  });
});

describe('canSpawnWildBossInZone gates wild-boss spawns by session phase (a)', () => {
  it('returns false in Stirring phase (turns 1-2)', () => {
    for (const t of [1, 2]) {
      const s = makeState({ turn: t });
      expect(canSpawnWildBossInZone(s, 'sylvani')).toBe(false);
      expect(canSpawnWildBossInZone(s, 'emberpeak')).toBe(false);
      expect(canSpawnWildBossInZone(s, 'gilded-cage')).toBe(false);
    }
  });

  it('returns true in Rising phase (turns 3-5)', () => {
    for (const t of [3, 4, 5]) {
      const s = makeState({ turn: t });
      expect(canSpawnWildBossInZone(s, 'sylvani')).toBe(true);
      expect(canSpawnWildBossInZone(s, 'emberpeak')).toBe(true);
      expect(canSpawnWildBossInZone(s, 'gilded-cage')).toBe(true);
    }
  });

  it('returns true in Boss + Climax phases', () => {
    for (const t of [6, 8, 9, 15]) {
      const s = makeState({ turn: t });
      expect(canSpawnWildBossInZone(s, 'sylvani')).toBe(true);
    }
  });

  it('flips false → true at the exact turn 2 → 3 boundary (Rising gate)', () => {
    const s2 = makeState({ turn: 2 });
    const s3 = makeState({ turn: 3 });
    expect(canSpawnWildBossInZone(s2, 'sylvani')).toBe(false);
    expect(canSpawnWildBossInZone(s3, 'sylvani')).toBe(true);
  });
});

describe('canSpawnRegionBossByPhase gates region-boss spawns by session phase (a)', () => {
  it('returns false in Stirring + Rising phases (turns 1-5)', () => {
    for (const t of [1, 2, 3, 4, 5]) {
      const s = makeState({ turn: t });
      expect(canSpawnRegionBossByPhase(s, 'sylvani')).toBe(false);
      expect(canSpawnRegionBossByPhase(s, 'emberpeak')).toBe(false);
      expect(canSpawnRegionBossByPhase(s, 'gilded-cage')).toBe(false);
    }
  });

  it('returns true in Boss + Climax phases (turn 6+)', () => {
    for (const t of [6, 8, 9, 15]) {
      const s = makeState({ turn: t });
      expect(canSpawnRegionBossByPhase(s, 'sylvani')).toBe(true);
      expect(canSpawnRegionBossByPhase(s, 'emberpeak')).toBe(true);
      expect(canSpawnRegionBossByPhase(s, 'gilded-cage')).toBe(true);
    }
  });

  it('flips false → true at the exact turn 5 → 6 boundary (Boss gate)', () => {
    const s5 = makeState({ turn: 5 });
    const s6 = makeState({ turn: 6 });
    expect(canSpawnRegionBossByPhase(s5, 'sylvani')).toBe(false);
    expect(canSpawnRegionBossByPhase(s6, 'sylvani')).toBe(true);
  });

  it('region gate is strictly one-phase-later than wild gate (turn 3 allows wild, not region)', () => {
    const s3 = makeState({ turn: 3 });
    expect(canSpawnWildBossInZone(s3, 'sylvani')).toBe(true);
    expect(canSpawnRegionBossByPhase(s3, 'sylvani')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Vurmox pin in Gilded Cage (b).
// ---------------------------------------------------------------------------

describe('Climax phase forces Vurmox pin in Gilded Cage (b)', () => {
  it('shouldPinGanon returns true at turn 9+ when currentZone is gilded-cage AND Vurmox not in field', () => {
    const s = makeState({ turn: 9, currentZone: 'gilded-cage', field: [] });
    expect(shouldPinGanon(s)).toBe(true);
  });

  it('applyGanonPin appends Vurmox to field when shouldPinGanon is true', () => {
    const s = makeState({ turn: 9, currentZone: 'gilded-cage', field: [] });
    const next = applyGanonPin(s, VURMOX);
    expect(next.field).toHaveLength(1);
    expect(next.field[0].id).toBe(VURMOX_ID);
  });

  it('applyGanonPin is idempotent — Vurmox already in field is a no-op', () => {
    const s = makeState({
      turn: 9,
      currentZone: 'gilded-cage',
      field: [VURMOX],
    });
    expect(shouldPinGanon(s)).toBe(false);
    const next = applyGanonPin(s, VURMOX);
    expect(next).toBe(s);
    expect(next.field).toHaveLength(1);
  });

  it('applyGanonPin recognizes a supply-duplicated Vurmox copy via baseId as already-pinned', () => {
    const duplicate: Card & { baseId: string } = {
      ...VURMOX,
      id: `${VURMOX_ID}-2`,
      baseId: VURMOX_ID,
    };
    const s = makeState({
      turn: 9,
      currentZone: 'gilded-cage',
      field: [duplicate],
    });
    expect(shouldPinGanon(s)).toBe(false);
    expect(applyGanonPin(s, VURMOX)).toBe(s);
  });

  it('fires at turn 9+ across multiple subsequent turns while Vurmox is not in field', () => {
    for (const t of [9, 10, 11, 15]) {
      const s = makeState({ turn: t, currentZone: 'gilded-cage', field: [] });
      expect(shouldPinGanon(s)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Climax stall when party has not reached Gilded Cage (c).
// ---------------------------------------------------------------------------

describe('Climax phase stall when party is still in an earlier zone (c)', () => {
  it('isClimaxStalled is true at turn 9 when currentZone is sylvani (no pin, no crash)', () => {
    const s = makeState({ turn: 9, currentZone: 'sylvani' });
    expect(isClimaxStalled(s)).toBe(true);
    expect(shouldPinGanon(s)).toBe(false);
    // applyGanonPin does nothing when shouldPinGanon is false.
    expect(() => applyGanonPin(s, VURMOX)).not.toThrow();
    expect(applyGanonPin(s, VURMOX)).toBe(s);
  });

  it('isClimaxStalled is true at turn 9 when currentZone is emberpeak', () => {
    const s = makeState({ turn: 9, currentZone: 'emberpeak' });
    expect(isClimaxStalled(s)).toBe(true);
  });

  it('isClimaxStalled is false once currentZone becomes gilded-cage (party caught up)', () => {
    const s = makeState({ turn: 9, currentZone: 'gilded-cage' });
    expect(isClimaxStalled(s)).toBe(false);
  });

  it('isClimaxStalled is false in Stirring / Rising / Boss phases regardless of zone', () => {
    for (const t of [1, 2, 3, 5, 6, 8]) {
      const s = makeState({ turn: t, currentZone: 'sylvani' });
      expect(isClimaxStalled(s)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Softclock (d), (e), (f).
// ---------------------------------------------------------------------------

describe('softclock fires at turn 10 when sharedTriforce < 2 (d)', () => {
  it('softclockHpEase returns 0 before turn 10', () => {
    for (const t of [1, 5, 9]) {
      const s = makeState({ turn: t, sharedTriforce: tForce({ wisdom: true }) });
      expect(softclockHpEase(s)).toBe(0);
    }
  });

  it('softclockHpEase returns 1 at turn 10 when sharedTriforce is all-false', () => {
    const s = makeState({ turn: 10, sharedTriforce: tForce() });
    expect(softclockHpEase(s)).toBe(1);
  });

  it('softclockHpEase returns 1 at turn 10 when exactly one shard is granted', () => {
    const s = makeState({ turn: 10, sharedTriforce: tForce({ power: true }) });
    expect(softclockHpEase(s)).toBe(1);
  });
});

describe('softclock does NOT fire at turn 10 when sharedTriforce >= 2 (e)', () => {
  it('returns 0 at turn 10 with exactly 2 shards', () => {
    for (const pair of [
      { wisdom: true, courage: true },
      { wisdom: true, power: true },
      { courage: true, power: true },
    ] as const) {
      const s = makeState({ turn: 10, sharedTriforce: tForce(pair) });
      expect(softclockHpEase(s)).toBe(0);
    }
  });

  it('returns 0 at turn 10 with all 3 shards (co-op victory state)', () => {
    const s = makeState({
      turn: 10,
      sharedTriforce: tForce({ wisdom: true, courage: true, power: true }),
    });
    expect(softclockHpEase(s)).toBe(0);
  });
});

describe('softclock is cumulative across subsequent turns (f)', () => {
  it('turn 10 → 1, turn 11 → 2, turn 12 → 3, turn 15 → 6 while sharedTriforce<2', () => {
    for (const [turn, expected] of [
      [10, 1],
      [11, 2],
      [12, 3],
      [15, 6],
    ] as const) {
      const s = makeState({ turn, sharedTriforce: tForce({ wisdom: true }) });
      expect(softclockHpEase(s)).toBe(expected);
    }
  });

  it('snaps back to 0 the turn the party reaches 2 shards even mid-ramp', () => {
    // At turn 12, party has been getting softclock help since turn 10.
    // They flip a second shard → ease returns to 0 on the next check.
    const before = makeState({ turn: 12, sharedTriforce: tForce({ wisdom: true }) });
    expect(softclockHpEase(before)).toBe(3);
    const after = makeState({
      turn: 12,
      sharedTriforce: tForce({ wisdom: true, power: true }),
    });
    expect(softclockHpEase(after)).toBe(0);
  });
});
