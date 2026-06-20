/**
 * Colosseum card-registration acceptance test (embertide-lhlo.35 —
 * kw.colosseum-card-registration).
 *
 * Bead-specific acceptance gates:
 *   A1. Every colosseum tier slot `sourceCardId` across tiers 1-5
 *       resolves via `cardByIdOrThrow` (no throw). Blocks progression
 *       past T2 if any id is missing.
 *   A2. T3/T4 boss cards are registered in KID_CARDS with `role: 'mini-boss'`
 *       and no `bossTier` (consistent with T1/T2/T5 registrations).
 *   A3. `selectBossFromTier` (slotRouter) returns a boss whose sourceCardId
 *       resolves via `cardByIdOrThrow` for every tier (T1–T5).
 *   A4. `tierForColosseumBoss` correctly maps T3+ sourceCardIds to their
 *       tier numbers, proving slotRouter resolves T3+ slots.
 */
import { describe, expect, it } from 'vitest';
import { TIER_1_ROSTER } from './tier1';
import { TIER_2_ROSTER } from './tier2';
import { TIER_3_ROSTER } from './tier3';
import { TIER_4_ROSTER } from './tier4';
import { TIER_5_ROSTER } from './tier5';
import { cardByIdOrThrow } from '../../store/combatBootstrap';
import { KID_CARDS } from '../cards';
import { selectBossFromTier, tierForColosseumBoss } from '../../core/colosseum/slotRouter';
import type { CombatBoss } from '../../types/combat';
import type { TierId } from '../../core/colosseum/progression';

// ---------------------------------------------------------------------------
// Fixture: all tier rosters in order, keyed by tier number.
// ---------------------------------------------------------------------------

const ALL_TIER_ROSTERS: ReadonlyArray<{ tier: TierId; roster: readonly CombatBoss[] }> = [
  { tier: 1, roster: TIER_1_ROSTER },
  { tier: 2, roster: TIER_2_ROSTER },
  { tier: 3, roster: TIER_3_ROSTER },
  { tier: 4, roster: TIER_4_ROSTER },
  { tier: 5, roster: TIER_5_ROSTER },
];

/** Deterministic step RNG — yields 0.0, 0.1, 0.2, …, 0.9, then loops. */
function makeStepRng(): () => number {
  let i = 0;
  return () => {
    const v = (i % 10) / 10;
    i += 1;
    return v;
  };
}

// ---------------------------------------------------------------------------
// A1. Every colosseum sourceCardId resolves via cardByIdOrThrow.
// ---------------------------------------------------------------------------

describe('colosseum card registration — A1: every sourceCardId resolves via cardByIdOrThrow (lhlo.35)', () => {
  for (const { tier, roster } of ALL_TIER_ROSTERS) {
    it(`tier ${tier}: all ${roster.length} sourceCardIds resolve without throwing`, () => {
      for (const boss of roster) {
        // cardByIdOrThrow throws on missing registration — this would fail
        // the test with a descriptive message naming the offending id.
        expect(() => cardByIdOrThrow(boss.sourceCardId)).not.toThrow();
      }
    });
  }

  it('full enumeration across all 5 tiers — every sourceCardId resolves', () => {
    const allIds: string[] = [];
    for (const { roster } of ALL_TIER_ROSTERS) {
      for (const boss of roster) {
        allIds.push(boss.sourceCardId);
      }
    }
    // Sanity: total colosseum boss count across all tiers.
    // T1: 4 (craghorn, coilworm, boulderkin, bonereaver)
    // T2: 5 (chimera, blackguard, cinderwyrm, phantom-vurmox, palegrasp)
    // T3: 5 (skrall-king, voltwyrm, vinemaw, sandscourge, idolarch)
    // T4: 4 (ossiarch, the-fettered, pyrax, oblivar)
    // T5: 1 (trinity-aurogax)
    expect(allIds).toHaveLength(19);

    for (const id of allIds) {
      expect(
        () => cardByIdOrThrow(id),
        `cardByIdOrThrow should not throw for id: ${id}`,
      ).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// A2. T3/T4 boss cards are registered with correct role and no bossTier.
// ---------------------------------------------------------------------------

describe('colosseum card registration — A2: T3/T4 boss card shape (lhlo.35)', () => {
  const t3T4Ids = [
    // Tier 3
    'skrall-king',
    'voltwyrm',
    'vinemaw',
    'sandscourge',
    'idolarch',
    // Tier 4
    'ossiarch',
    'the-fettered',
    'pyrax',
    'oblivar',
  ];

  for (const id of t3T4Ids) {
    it(`${id}: registered with role='mini-boss' and no bossTier (consistent with T1/T2/T5)`, () => {
      const card = KID_CARDS.find((c) => c.id === id);
      expect(card, `KID_CARDS must contain id: ${id}`).toBeDefined();
      expect(card?.role).toBe('mini-boss');
      // bossTier omitted — colosseum bosses do not go through zone routing
      // hooks (advanceZone / wisp-drop). T1/T2/T5 establish this convention.
      expect(card?.bossTier).toBeUndefined();
    });
  }

  it('all T3/T4 cards have a neutral gain no-op effect (not routed through Defeat path)', () => {
    for (const id of t3T4Ids) {
      const card = KID_CARDS.find((c) => c.id === id);
      expect(card?.effects.kind).toBe('gain');
    }
  });
});

// ---------------------------------------------------------------------------
// A3. selectBossFromTier resolves a boss whose sourceCardId resolves via
//     cardByIdOrThrow for every tier.
// ---------------------------------------------------------------------------

describe('colosseum slot router — A3: selectBossFromTier resolves for all tiers (lhlo.35)', () => {
  for (const { tier } of ALL_TIER_ROSTERS) {
    it(`tier ${tier}: selectBossFromTier returns a boss with a registered sourceCardId`, () => {
      const rng = makeStepRng();
      // Pick enough times to sample multiple roster entries.
      for (let i = 0; i < 20; i += 1) {
        const boss = selectBossFromTier(tier as TierId, rng);
        expect(() => cardByIdOrThrow(boss.sourceCardId)).not.toThrow();
      }
    });
  }
});

// ---------------------------------------------------------------------------
// A4. tierForColosseumBoss maps T3+ sourceCardIds to their correct tier.
// ---------------------------------------------------------------------------

describe('colosseum slot router — A4: tierForColosseumBoss resolves T3+ slots (lhlo.35)', () => {
  it('T3 sourceCardIds all map to tier 3', () => {
    for (const boss of TIER_3_ROSTER) {
      expect(tierForColosseumBoss(boss.sourceCardId)).toBe(3);
    }
  });

  it('T4 sourceCardIds all map to tier 4', () => {
    for (const boss of TIER_4_ROSTER) {
      expect(tierForColosseumBoss(boss.sourceCardId)).toBe(4);
    }
  });

  it('T1 and T2 sourceCardIds still resolve to their correct tiers', () => {
    for (const boss of TIER_1_ROSTER) {
      expect(tierForColosseumBoss(boss.sourceCardId)).toBe(1);
    }
    for (const boss of TIER_2_ROSTER) {
      expect(tierForColosseumBoss(boss.sourceCardId)).toBe(2);
    }
  });

  it('T5 sourceCardId resolves to tier 5', () => {
    for (const boss of TIER_5_ROSTER) {
      expect(tierForColosseumBoss(boss.sourceCardId)).toBe(5);
    }
  });

  it('unknown id returns null (no cross-tier confusion)', () => {
    expect(tierForColosseumBoss('not-a-real-boss')).toBeNull();
  });

  it('all sourceCardId sets across T3/T4 are disjoint from T1/T2/T5', () => {
    const t1Ids = new Set(TIER_1_ROSTER.map((b) => b.sourceCardId));
    const t2Ids = new Set(TIER_2_ROSTER.map((b) => b.sourceCardId));
    const t3Ids = new Set(TIER_3_ROSTER.map((b) => b.sourceCardId));
    const t4Ids = new Set(TIER_4_ROSTER.map((b) => b.sourceCardId));
    const t5Ids = new Set(TIER_5_ROSTER.map((b) => b.sourceCardId));

    for (const id of t3Ids) {
      expect(t1Ids.has(id), `T3 id '${id}' must not appear in T1`).toBe(false);
      expect(t2Ids.has(id), `T3 id '${id}' must not appear in T2`).toBe(false);
      expect(t4Ids.has(id), `T3 id '${id}' must not appear in T4`).toBe(false);
      expect(t5Ids.has(id), `T3 id '${id}' must not appear in T5`).toBe(false);
    }
    for (const id of t4Ids) {
      expect(t1Ids.has(id), `T4 id '${id}' must not appear in T1`).toBe(false);
      expect(t2Ids.has(id), `T4 id '${id}' must not appear in T2`).toBe(false);
      expect(t5Ids.has(id), `T4 id '${id}' must not appear in T5`).toBe(false);
    }
  });
});
