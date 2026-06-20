import { describe, it, expect } from 'vitest';
import { rewardsForTier, type ColosseumReward } from './rewards';
import type { TierId } from './progression';

/**
 * embertide-4hr1.6 — pure tier→reward table.
 *
 * Acceptance coverage:
 *   A3 (structural): no kind appears in both a lower tier and tier 5
 *       (would silently leak top-tier loot). Enforced by deriving the
 *       lower-tier kind set from the table itself, so adding a new
 *       T5-only kind to `ColosseumReward` cannot weaken the invariant
 *       — the test self-widens.
 *   Plus: purity + per-tier shape lockdown so adding a new tier roster
 *       (T3/T4) is a single-table edit + a single-test-row addition.
 */

const SHIPPING_TIERS: readonly TierId[] = [1, 2, 3, 4, 5];

describe('embertide-4hr1.6 — rewardsForTier purity + shape', () => {
  it('is pure (same input → same output by deep equality across calls)', () => {
    for (const tier of SHIPPING_TIERS) {
      expect(rewardsForTier(tier)).toEqual(rewardsForTier(tier));
    }
  });

  it('returns at least one reward for every shipping tier', () => {
    for (const tier of SHIPPING_TIERS) {
      expect(rewardsForTier(tier).length).toBeGreaterThan(0);
    }
  });
});

describe('embertide-4hr1.6 — A3 invariant (lower tiers cannot drop top-tier loot)', () => {
  it('no kind appears in both a lower tier and tier 5 (table is the single source of truth)', () => {
    // Derive the lower-tier kind set from the table itself rather than
    // hand-curating a T5_ONLY_KINDS list — when designers add a new
    // T5-restricted kind to `ColosseumReward`, this invariant
    // automatically covers it. Symmetrically, if anyone accidentally
    // adds the same kind to BOTH a lower tier AND T5, this test fails.
    const lowerTierKinds = new Set<string>();
    for (const tier of SHIPPING_TIERS) {
      if (tier === 5) continue;
      for (const reward of rewardsForTier(tier)) {
        lowerTierKinds.add(reward.kind);
      }
    }
    for (const reward of rewardsForTier(5)) {
      expect(lowerTierKinds.has(reward.kind)).toBe(false);
    }
  });

  it('tier 5 INCLUDES the golden-rainbow-heirloom (044 GR Chimera precedent)', () => {
    const t5 = rewardsForTier(5);
    const hasGoldenRainbow = t5.some(
      (r) => r.kind === 'golden-rainbow-heirloom' && r.heirloomId === 'rainbow-ancient-chimera-sword',
    );
    expect(hasGoldenRainbow).toBe(true);
  });

  it('tier 5 INCLUDES at least one unique-cosmetic unlock', () => {
    const t5 = rewardsForTier(5);
    const hasUniqueCosmetic = t5.some((r) => r.kind === 'unique-cosmetic');
    expect(hasUniqueCosmetic).toBe(true);
  });
});

/**
 * embertide-4hr1.16 — HUD exhaustiveness lockdown for
 * `ColosseumReward['kind']`.
 *
 * Pre-emptive type-level contract for the (not-yet-built) HUD reward-
 * display surface. The bead requires that when the HUD lands, the
 * `cosmetic-unlock-placeholder` sentinel cannot silently render as
 * nothing — it must have explicit handling alongside every other kind.
 *
 * Rather than rely on a future bead author remembering this, we lock
 * the requirement in here: a fake HUD-shaped reducer that switches
 * exhaustively on `kind` with `const _x: never` narrowing on the
 * default. If a new kind is ever added to `ColosseumReward` without
 * an explicit case, TypeScript fails the build (assignment to `never`
 * is the compiler error). The future HUD bead can either import this
 * helper or re-implement the pattern — either way the contract holds.
 *
 * The sentinel branch deliberately produces a non-empty token so the
 * runtime assertion below catches a regression where the case body is
 * dropped to `return ''` or `return null`. That is the user-reported
 * failure mode (silently rendering as nothing) the bead names.
 */
describe('embertide-4hr1.16 — HUD exhaustiveness lockdown', () => {
  function describeReward(reward: ColosseumReward): string {
    switch (reward.kind) {
      case 'reroll-token':
        return `reroll-token:${reward.id}`;
      case 'ember-shard':
        return `ember-shard:${reward.id}`;
      case 'cosmetic-unlock-placeholder':
        // Explicit handling per 4hr1.16: the HUD MUST surface the
        // placeholder as a "locked cosmetic" (or equivalent) rather
        // than letting it fall through to the default branch and
        // render as nothing. The exact UI shape is the HUD bead's
        // call; this helper just locks the kind into a non-empty
        // descriptor so a missing-case regression fails loudly here.
        return `cosmetic-placeholder:${reward.id}`;
      case 'golden-rainbow-heirloom':
        return `golden-rainbow:${reward.heirloomId}`;
      case 'unique-cosmetic':
        return `unique-cosmetic:${reward.id}`;
      default: {
        const _exhaustive: never = reward;
        return _exhaustive;
      }
    }
  }

  it('every reward across every shipping tier is exhaustively classified', () => {
    for (const tier of SHIPPING_TIERS) {
      for (const reward of rewardsForTier(tier)) {
        const desc = describeReward(reward);
        expect(desc).toMatch(/^[a-z-]+:.+/);
      }
    }
  });

  it('cosmetic-unlock-placeholder is explicitly described (the bead acceptance)', () => {
    // Both T3 and T4 ride the sentinel today (see TIER_3_REWARDS /
    // TIER_4_REWARDS in rewards.ts). Walking both tiers protects the
    // case where one of them later swaps to a designer-approved
    // unique cosmetic but the other still rides the placeholder.
    const placeholderTiers: readonly TierId[] = [3, 4];
    let sawPlaceholder = false;
    for (const tier of placeholderTiers) {
      for (const reward of rewardsForTier(tier)) {
        if (reward.kind === 'cosmetic-unlock-placeholder') {
          sawPlaceholder = true;
          const desc = describeReward(reward);
          // Non-empty + matches the sentinel-prefix contract above so
          // a "silent render as nothing" regression fails here.
          expect(desc).not.toBe('');
          expect(desc.startsWith('cosmetic-placeholder:')).toBe(true);
        }
      }
    }
    // Sanity: at least one of T3/T4 still ships the sentinel — the
    // lockdown is only meaningful while the sentinel exists in the
    // table. Once both tiers swap to final designer rewards, this
    // assertion will fail and the lockdown can be retired with the
    // bead.
    expect(sawPlaceholder).toBe(true);
  });
});
