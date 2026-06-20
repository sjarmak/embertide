import { describe, it, expect } from 'vitest';
import { KID_CHAMPIONS, findChampion } from './champions';

const FORBIDDEN_SUBSTRINGS: readonly string[] = [
  'aurelia',
  'link',
  'vurmox',
  'embertide',
  'emberblade',
  'elysia',
  'vurmox',
];

describe('KID_CHAMPIONS', () => {
  it('defines exactly 4 champions', () => {
    expect(KID_CHAMPIONS.length).toBe(4);
  });

  it('gives every champion a unique id and portraitCardId', () => {
    const ids = KID_CHAMPIONS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const portraits = KID_CHAMPIONS.map((c) => c.portraitCardId);
    expect(new Set(portraits).size).toBe(portraits.length);
  });

  it('every portraitCardId is a non-empty kebab-case key (j49z: portrait-only, no KID_CARDS round-trip)', () => {
    // j49z (2026-04-24): the four portraitCardId values (spirit-arrow /
    // seer-rune / warblade / ancient-keepsake) used to resolve to
    // `role: 'starter-home'` entries in KID_CARDS. The role and entries
    // were retired; the ids now serve only as lookup keys for bespoke
    // champion-portrait rasters in src/ui/CardArt.tsx (SPEC_BY_BASE_ID).
    // No KID_CARDS round-trip is required — only the picker-side raster
    // wiring (covered by CardArt.test.tsx illustrationForChampion).
    const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
    for (const champion of KID_CHAMPIONS) {
      expect(
        champion.portraitCardId.length,
        `champion "${champion.id}" must have a non-empty portraitCardId`,
      ).toBeGreaterThan(0);
      expect(
        champion.portraitCardId,
        `champion "${champion.id}" portraitCardId must be kebab-case`,
      ).toMatch(KEBAB_CASE);
    }
  });

  it('every champion has a non-empty displayName and passiveDescription', () => {
    for (const c of KID_CHAMPIONS) {
      expect(c.displayName.length).toBeGreaterThan(0);
      expect(c.passiveDescription.length).toBeGreaterThan(0);
    }
  });

  it('findChampion returns the right champion by id', () => {
    expect(findChampion('champion-courage')?.portraitCardId).toBe('spirit-arrow');
    expect(findChampion('champion-wisdom')?.portraitCardId).toBe('seer-rune');
    expect(findChampion('champion-power')?.portraitCardId).toBe('warblade');
    expect(findChampion('champion-sword')?.portraitCardId).toBe('ancient-keepsake');
  });

  it('findChampion returns undefined for an unknown id', () => {
    expect(findChampion('champion-unknown')).toBeUndefined();
  });

  it('contains no franchise-name substrings in the serialised champions', () => {
    const serialised = JSON.stringify(KID_CHAMPIONS).toLowerCase();
    for (const needle of FORBIDDEN_SUBSTRINGS) {
      expect(serialised.includes(needle), `KID_CHAMPIONS data must not contain "${needle}"`).toBe(
        false,
      );
    }
  });
});
