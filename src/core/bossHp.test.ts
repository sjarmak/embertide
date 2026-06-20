/**
 * Unit tests for `tierCombatHpFor` (embertide-bw6).
 *
 * Shared tier-based HP helper extracted from the duplicated bodies of
 * `bossSlotHpFor` (UI) and `defaultCombatHpFor` (store). Locks in the
 * legacy `card.power` read + bossTier fallback contract so future edits
 * can't silently change the altar readout.
 */

import { describe, it, expect } from 'vitest';
import type { Card } from '../types/card';
import { TIER_HP_REGION_BOSS, TIER_HP_REGULAR, TIER_HP_WILD_BOSS, tierCombatHpFor } from './bossHp';

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'test-card',
    role: 'monster',
    cost: {},
    effects: { kind: 'gain' },
    ...overrides,
  };
}

describe('tierCombatHpFor', () => {
  it('returns 12 for a region-boss card with no power override', () => {
    const card = makeCard({ id: 'broodmaw', bossTier: 'region-boss' });
    expect(tierCombatHpFor(card)).toBe(TIER_HP_REGION_BOSS);
    expect(tierCombatHpFor(card)).toBe(12);
  });

  it('returns 8 for a wild-boss card with no power override', () => {
    const card = makeCard({ id: 'craghorn', bossTier: 'wild-boss' });
    expect(tierCombatHpFor(card)).toBe(TIER_HP_WILD_BOSS);
    expect(tierCombatHpFor(card)).toBe(8);
  });

  it('returns 5 for a card with no bossTier', () => {
    const card = makeCard({ id: 'grunt-orc' });
    expect(tierCombatHpFor(card)).toBe(TIER_HP_REGULAR);
    expect(tierCombatHpFor(card)).toBe(5);
  });

  it('prefers card.power over the bossTier fallback when power > 0', () => {
    // Legacy defensive read — balance sim mocks attach `power` directly.
    const card = makeCard({
      id: 'custom-boss',
      bossTier: 'wild-boss',
    }) as Card & { power?: number };
    const withPower: Card = { ...card, power: 15 } as Card;
    expect(tierCombatHpFor(withPower)).toBe(15);
  });

  it('ignores card.power when it is 0 or negative (falls through to tier)', () => {
    const regionZero = { ...makeCard({ bossTier: 'region-boss' }), power: 0 } as Card;
    const regionNeg = { ...makeCard({ bossTier: 'region-boss' }), power: -5 } as Card;
    expect(tierCombatHpFor(regionZero)).toBe(TIER_HP_REGION_BOSS);
    expect(tierCombatHpFor(regionNeg)).toBe(TIER_HP_REGION_BOSS);
  });

  it('ignores card.power when it is a non-number (defensive)', () => {
    const card = {
      ...makeCard({ bossTier: 'wild-boss' }),
      power: 'not-a-number',
    } as unknown as Card;
    expect(tierCombatHpFor(card)).toBe(TIER_HP_WILD_BOSS);
  });
});
