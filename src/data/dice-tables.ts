/**
 * Authored dice-roll tables + their pure outcome resolvers.
 *
 * Two probabilistic outcome surfaces live here:
 *   - DUNGEON_BOSS_REWARD_TABLE (REQ-9d / embertide-3wd6, d20)
 *   - FOREST_SAGE_OMEN_TABLE     (REQ-6, d6)
 *
 * Both are pure data + pure resolvers — no store imports, no
 * Zustand wiring. The store calls `apply*Outcome(state, playerId,
 * outcome)` from its `commit*` action handler and reassigns the result.
 */

import type { KidGameState, KidPlayer } from '../store/types';
import { drawCards } from '../store/slices/deck';
import { applyReward } from '../store/slices/chests';
import { applyHeartReward } from '../core/vitalEmber';

// ---------------------------------------------------------------------------
// v2.1 REQ-9d: Dungeon Boss onDefeat reward roll (embertide-4hz6 +
// embertide-3wd6 d20 tier-curve redesign 2026-04-25).
// ---------------------------------------------------------------------------

/**
 * Loot tier produced by a region-boss d20 roll. Each tier maps to a
 * card-grant family inside `applyDungeonBossRewardOutcome`:
 *   - 'std'       : 50/50 random hero ↔ standard supply item
 *   - 'mid'       : 50/50 random hero ↔ premium item (legendary 7/8 +
 *                   great-wisp 1/8 via `applyReward('premium-item')`)
 *   - 'legendary' : premium item only (the showpiece tier)
 */
export type DungeonBossRewardTier = 'std' | 'mid' | 'legendary';

/**
 * Outcome kind discriminants for the Dungeon-Boss reward roll
 * (embertide-3wd6, 2026-04-25). The pre-3wd6 union covered heal /
 * peek / gems / rare-item — designer ruling collapsed all of those to a
 * single 'card-tier' shape so a region-boss kill ALWAYS hands the kid a
 * card (hero or weapon/item), never bare gems or a peek flag.
 *
 * Shard-producing outcomes still never appear on a probabilistic dice
 * roll (REQ-13 Phase 2d / gm0.4 — the `RollDieOutcomeEffect` compile-time
 * exclusion is the type-level guard).
 */
export type DungeonBossRewardOutcome = {
  readonly kind: 'card-tier';
  readonly tier: DungeonBossRewardTier;
};

/**
 * Authored outcome table — d20 face → loot tier (embertide-3wd6,
 * 2026-04-25). Tier curve per designer ruling: 50% std / 35% mid / 15%
 * legendary. Frozen so consumers can read the table without risking
 * accidental mutation.
 *
 *   1-10  (50%) → std  (random hero ↔ standard item, 50/50)
 *   11-17 (35%) → mid  (random hero ↔ premium item, 50/50)
 *   18-20 (15%) → legendary (premium item)
 *
 * The table is keyed 1..20 to match the d20 face range; each entry is
 * the *tier* — the card draw itself happens inside
 * `applyDungeonBossRewardOutcome`, which routes through the chest
 * pool's `applyReward` helper so card-grant logic stays centralized.
 */
export const DUNGEON_BOSS_REWARD_TABLE: Readonly<Record<number, DungeonBossRewardOutcome>> = {
  1: { kind: 'card-tier', tier: 'std' },
  2: { kind: 'card-tier', tier: 'std' },
  3: { kind: 'card-tier', tier: 'std' },
  4: { kind: 'card-tier', tier: 'std' },
  5: { kind: 'card-tier', tier: 'std' },
  6: { kind: 'card-tier', tier: 'std' },
  7: { kind: 'card-tier', tier: 'std' },
  8: { kind: 'card-tier', tier: 'std' },
  9: { kind: 'card-tier', tier: 'std' },
  10: { kind: 'card-tier', tier: 'std' },
  11: { kind: 'card-tier', tier: 'mid' },
  12: { kind: 'card-tier', tier: 'mid' },
  13: { kind: 'card-tier', tier: 'mid' },
  14: { kind: 'card-tier', tier: 'mid' },
  15: { kind: 'card-tier', tier: 'mid' },
  16: { kind: 'card-tier', tier: 'mid' },
  17: { kind: 'card-tier', tier: 'mid' },
  18: { kind: 'card-tier', tier: 'legendary' },
  19: { kind: 'card-tier', tier: 'legendary' },
  20: { kind: 'card-tier', tier: 'legendary' },
};

/**
 * Apply a resolved Dungeon-Boss reward outcome to the active player.
 * Pure helper — returns a fresh state with the player slot replaced.
 * Caller is responsible for clearing `pendingDungeonBossRoll` after
 * this returns.
 *
 * Tier dispatch (embertide-3wd6, 2026-04-25):
 *  - 'std'       : 50/50 coin → 'hero' (chest-pool hero draw) or 'item'
 *                  (CHEST_ITEM_POOL_IDS standard-supply item draw).
 *  - 'mid'       : 50/50 coin → 'hero' or 'premium-item' (legendary-sword
 *                  7/8 + great-wisp 1/8 via existing applyReward).
 *  - 'legendary' : 'premium-item' guaranteed.
 *
 * All tiers route through `applyReward` so the card-grant equip logic
 * (items-zone cap → discard fallback for items, deck push for heroes)
 * stays centralized in the chest module.
 */
export function applyDungeonBossRewardOutcome(
  state: KidGameState,
  playerId: string,
  outcome: DungeonBossRewardOutcome,
): KidGameState {
  const idx = state.players.findIndex((p) => p.id === playerId);
  if (idx === -1) {
    throw new Error(`applyDungeonBossRewardOutcome: no player with id "${playerId}" in state`);
  }
  const player = state.players[idx];
  let reward: 'hero' | 'item' | 'premium-item';
  switch (outcome.tier) {
    case 'std': {
      reward = state.rng() < 0.5 ? 'hero' : 'item';
      break;
    }
    case 'mid': {
      reward = state.rng() < 0.5 ? 'hero' : 'premium-item';
      break;
    }
    case 'legendary': {
      reward = 'premium-item';
      break;
    }
    default: {
      const _exhaustive: never = outcome.tier;
      throw new Error(`applyDungeonBossRewardOutcome: unhandled tier ${String(_exhaustive)}`);
    }
  }
  // Dungeon-Boss reward DieRollReveal animates this card surface itself;
  // the dropped `.card` is intentionally not threaded into `lastChestReward*`
  // because this flow does not pop the chest-reveal popup.
  const { player: nextPlayer } = applyReward(player, reward, state.rng);
  const players = state.players.slice();
  players[idx] = nextPlayer;
  return { ...state, players };
}

// ---------------------------------------------------------------------------
// v2.1 REQ-6: Forest-Sage on-play omen roll (embertide-gm0.10).
// ---------------------------------------------------------------------------

/**
 * Outcome kind discriminants for the Forest-Sage on-play omen roll. Pure
 * data — the table is rendered to {@link FOREST_SAGE_OMEN_TABLE} below
 * and consumed by the commit reducer.
 *
 * Outcomes are HP / gem / peek / power / draw / rare-item — shard-
 * producing outcomes never appear on a probabilistic dice roll. Face 6
 * was retabled from `reroll-token` to `rare-item` (designer ruling
 * 2026-04-25, embertide-ynn4) when the reroll-token system was
 * removed — symmetric with the dungeon-boss face-6 premium-item draw.
 */
export type ForestSageOmenOutcome =
  | { readonly kind: 'heal'; readonly hp: number }
  | { readonly kind: 'gems'; readonly amount: number }
  | { readonly kind: 'peek-next-chest' }
  | { readonly kind: 'power'; readonly amount: number }
  | { readonly kind: 'draw'; readonly amount: number }
  | { readonly kind: 'rare-item' };

/**
 * Authored omen table — d6 face → outcome (REQ-6, v2.1). Frozen so
 * consumers can read it via the exported reference without risking
 * accidental mutation.
 *
 * OMEN re-format (lhlo.29, 2026-05-26): grouped into ranges per the
 * keyword-glossary bounded-variance rule (never six separate
 * outcomes). Mirrors the forest-sage roll-die EffectSpec authoring
 * surface in src/data/cards/heroes.ts.
 *
 *   1-2 → +1 gem      (economy floor)
 *   3-4 → draw 1 card (tempo)
 *   5-6 → rare item   (chest-boss `premium-item` table draw)
 *
 * The table is keyed 1..6 to match the `DieFace` literal union; each
 * entry is the *resolved* outcome — no further dispatch lives here.
 * `heal` / `peek-next-chest` / `power` remain valid
 * `ForestSageOmenOutcome` members (and stay handled in
 * `applyForestSageOmenOutcome`) for reuse by future Omen cards.
 */
export const FOREST_SAGE_OMEN_TABLE: Readonly<Record<number, ForestSageOmenOutcome>> = {
  1: { kind: 'gems', amount: 1 },
  2: { kind: 'gems', amount: 1 },
  3: { kind: 'draw', amount: 1 },
  4: { kind: 'draw', amount: 1 },
  5: { kind: 'rare-item' },
  6: { kind: 'rare-item' },
};

/**
 * Apply a resolved Forest-Sage omen outcome to the player who played
 * the card. Pure helper — returns a fresh state with the player slot
 * replaced. Caller is responsible for clearing `pendingForestSageRoll`
 * after this returns.
 *
 *  - `heal`            : `applyHeartReward(player, hp)` — respects hpMax,
 *                         grows hp+hpMax up to HP_CAP if at max already
 *                         (parity with chest-heart rewards and the
 *                         dungeon-boss face-1 heal).
 *  - `gems`            : `green += amount` (no cap; matches v2 gem
 *                         semantics).
 *  - `peek-next-chest` : flips `nextChestItemRevealed = true` on the
 *                         player. Consumed by the next chest opening.
 *  - `power`           : `red += amount`. Per-turn power — flushed at
 *                         endTurn alongside the rest of the player's
 *                         red.
 *  - `draw`            : draws `amount` cards via `drawCards` using
 *                         the store's seeded RNG.
 *  - `rare-item`       : `applyReward(player, 'premium-item', rng)` —
 *                         reuses the chest-boss premium-item draw
 *                         (legendary-sword 7/8, great-wisp 1/8); items
 *                         zone cap overflow falls back to discard.
 *                         Symmetric with dungeon-boss face-6.
 */
export function applyForestSageOmenOutcome(
  state: KidGameState,
  playerId: string,
  outcome: ForestSageOmenOutcome,
): KidGameState {
  const idx = state.players.findIndex((p) => p.id === playerId);
  if (idx === -1) {
    throw new Error(`applyForestSageOmenOutcome: no player with id "${playerId}" in state`);
  }
  const player = state.players[idx];
  let nextPlayer: KidPlayer = player;
  switch (outcome.kind) {
    case 'heal': {
      nextPlayer = applyHeartReward(player, outcome.hp);
      break;
    }
    case 'gems': {
      nextPlayer = { ...player, green: player.green + outcome.amount };
      break;
    }
    case 'peek-next-chest': {
      nextPlayer = { ...player, nextChestItemRevealed: true };
      break;
    }
    case 'power': {
      nextPlayer = { ...player, red: player.red + outcome.amount };
      break;
    }
    case 'draw': {
      const drawn = drawCards(
        { deck: player.deck, hand: player.hand, discard: player.discard },
        outcome.amount,
        state.rng,
      );
      nextPlayer = {
        ...player,
        deck: drawn.deck,
        hand: drawn.hand,
        discard: drawn.discard,
      };
      break;
    }
    case 'rare-item': {
      // Forest-Sage omen surfaces via DieRollReveal, not ChestReveal —
      // discard the rolled `.card` (only `.player` is consumed here).
      nextPlayer = applyReward(player, 'premium-item', state.rng).player;
      break;
    }
    default: {
      const _exhaustive: never = outcome;
      throw new Error(
        `applyForestSageOmenOutcome: unhandled outcome kind ${String((_exhaustive as { kind?: string }).kind)}`,
      );
    }
  }
  const players = state.players.slice();
  players[idx] = nextPlayer;
  return { ...state, players };
}
