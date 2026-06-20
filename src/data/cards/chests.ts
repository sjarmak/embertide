/**
 * Chests (v2 / REQ-5a, u-2b → embertide-tq5 final 3-tier system):
 *   chest-std  Sturdy Chest. 1 key. Common-tier rewards — supply workhorse.
 *   chest-mid  Ornate Chest. 2 keys. Middle tier between Sturdy and Vault.
 *   chest-boss Grand Vault. 3 keys (lifted from 2). Premium-item heavy.
 *
 * Weight tables live in src/rules/chestPool.ts (CHEST_WEIGHT_TABLE). The
 * inline pool.weights here mirror the authoritative table for UI consumers
 * that inspect cards directly; chestPool remains the source of truth.
 */

import type { ChestCard } from './types';

export const chests: readonly ChestCard[] = [
  {
    id: 'chest-std',
    role: 'chest-std',
    cost: { keys: 1 },
    effects: { kind: 'chest-draw', tier: 'std' },
    // 8xp9 (2026-05-26): hero slot removed; weight renormalized — mirrors
    // CHEST_WEIGHT_TABLE in src/rules/chestPool.ts (source of truth).
    pool: {
      weights: [
        { reward: 'heart', weight: 60 },
        { reward: 'item', weight: 20 },
        { reward: 'ember-shard', weight: 13 },
        { reward: 'wisp', weight: 7 },
      ],
    },
  },
  {
    id: 'chest-mid',
    role: 'chest-mid',
    cost: { keys: 2 },
    effects: { kind: 'chest-draw', tier: 'mid' },
    // 8xp9 (2026-05-26): hero slot removed; weight renormalized — mirrors
    // CHEST_WEIGHT_TABLE in src/rules/chestPool.ts (source of truth).
    pool: {
      weights: [
        { reward: 'heart', weight: 29 },
        { reward: 'double-heart', weight: 17 },
        { reward: 'item', weight: 17 },
        { reward: 'premium-item', weight: 14 },
        { reward: 'ember-shard', weight: 12 },
        { reward: 'wisp', weight: 11 },
      ],
    },
  },
  {
    id: 'chest-boss',
    role: 'chest-boss',
    cost: { keys: 3 },
    effects: { kind: 'chest-draw', tier: 'boss' },
    pool: {
      weights: [
        { reward: 'double-heart', weight: 36 },
        { reward: 'premium-item', weight: 27 },
        { reward: 'wisp', weight: 15 },
        // ynn4 (2026-04-25): retired seers-omen 5% slot absorbed into
        // ember-shard (15 → 20). Boss-chest progression slants slightly
        // more toward vital-ember ramp; total still sums to 100.
        { reward: 'ember-shard', weight: 20 },
        { reward: 'vital-ember', weight: 2 },
      ],
    },
  },
];
