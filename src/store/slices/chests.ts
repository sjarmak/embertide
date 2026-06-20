import type { Card } from '../../types/card';
import { applyHeartReward } from '../../core/vitalEmber';
import { CHEST_ITEM_POOL_IDS, KID_CARDS } from '../../data/cards';
import {
  CHEST_KEY_COSTS,
  openChest as sampleChestReward,
  type ChestReward,
  type ChestVariant,
} from '../../rules/chestPool';
import { equipAsItem } from './inventory';
import { replacePlayer } from '../_shared';
import type { KidGameState, KidPlayer } from '../types';

/**
 * Pieces required to auto-promote to one vital ember (v2.1 gm0.16).
 * Duplicated here rather than imported from `store/gameStore.ts` to
 * avoid the gameStore → chests → gameStore circular-import chain.
 * Kept in lockstep with `HEART_PIECES_PER_CONTAINER` at the store layer
 * (see addEmberShardToPlayer below for the local helper that uses it).
 */
const HEART_PIECES_PER_CONTAINER = 4;

/**
 * Local copy of `addEmberShard` (v2.1 gm0.16). Increments a player's
 * ember-shard counter; on reaching `HEART_PIECES_PER_CONTAINER`, resets
 * to 0 and grows `hp` + `hpMax` via `applyHeartReward`. Duplicated here
 * so `applyReward` can call it without importing from gameStore.ts
 * (which would introduce a circular import through the store slice
 * graph).
 */
function addEmberShardToPlayer(player: KidPlayer): KidPlayer {
  const next = player.heartPieces + 1;
  if (next >= HEART_PIECES_PER_CONTAINER) {
    const grown = applyHeartReward(player, 1);
    return { ...grown, heartPieces: 0 };
  }
  return { ...player, heartPieces: next };
}

/**
 * Target size for the dedicated chest row (embertide-7c1).
 * Always shows up to 3 chest cards — refilled from `chestSupply` when
 * openings leave an empty slot.
 */
export const CHEST_ROW_SIZE = 3;

/**
 * Top up `state.chestRow` to CHEST_ROW_SIZE from the top of
 * `state.chestSupply`. Pure / immutable: returns a new state with fresh
 * array references. If the chest supply is shorter than needed, the row
 * is left with fewer than CHEST_ROW_SIZE cards (no error).
 */
export function refillChestRow(state: KidGameState): KidGameState {
  const chestRow = state.chestRow.slice();
  const chestSupply = state.chestSupply.slice();

  let needed = CHEST_ROW_SIZE - chestRow.length;
  if (needed <= 0) return state;

  while (needed > 0 && chestSupply.length > 0) {
    const card = chestSupply.shift();
    if (!card) break;
    chestRow.push(card);
    needed -= 1;
  }

  return { ...state, chestRow, chestSupply };
}

function pickHero(rng: () => number): Card {
  const heroes = KID_CARDS.filter((c) => c.role === 'hero');
  return heroes[Math.floor(rng() * heroes.length)];
}

/**
 * Pool selector for the chest `'item'` reward (embertide-4uyn).
 *
 * Pulls from the curated `CHEST_ITEM_POOL_IDS` allowlist instead of every
 * `role === 'item'` entry in `KID_CARDS` — the broad filter previously
 * leaked drop-only items (wisp variants, heirlooms, freed-princess,
 * banish-from-hand catalog items) into the chest pool. The allowlist
 * is the union of v2.0/v2.1 supply items + the ten 4uyn item-passive
 * constructs/relics so a 6yo's run sees both familiar buyables AND
 * varied passive rewards from chest 'item' rolls.
 */
function pickNonLegendaryItem(rng: () => number): Card {
  const items = KID_CARDS.filter((c) => c.role === 'item' && CHEST_ITEM_POOL_IDS.has(c.id));
  return items[Math.floor(rng() * items.length)];
}

function pickLegendary(): Card {
  const legendary = KID_CARDS.find((c) => c.role === 'legendary-sword');
  if (!legendary) {
    throw new Error('No legendary-sword card in KID_CARDS');
  }
  return legendary;
}

/**
 * v2.1 gm0.16: chest `wisp` reward resolves to one of two templates at
 * draw time via a 50/50 seeded coin flip:
 *   - plain `wisp`           (original u-1d consumable-revive)
 *   - `wisp-in-bottle`       (gm0.16 reusable-once-per-combat variant)
 * Great Wisp is NOT in this split — it's a premium-item / boss-chest
 * drop only (see applyReward's 'premium-item' branch below).
 *
 * Pure at the data boundary — returns the canonical template Card;
 * `equipAsItem` downstream mints a unique copy via its own suffixing.
 */
function pickWispVariant(rng: () => number): Card {
  const useBottle = rng() < 0.5;
  const templateId = useBottle ? 'wisp-in-bottle' : 'wisp';
  const template = KID_CARDS.find((c) => c.id === templateId);
  if (!template) {
    throw new Error(`No ${templateId} card in KID_CARDS`);
  }
  return template;
}

/**
 * v2.1 gm0.16: premium-item chest reward has a small chance (~12%) of
 * awarding a Great Wisp instead of the legendary sword. Great Wisp is
 * a rare enhanced revive with a combat-heal amount:5 in-combat effect
 * (see EXPLICIT_OVERRIDES in src/data/combatEffects.ts). Falls back to
 * the standard `ancient-blade` legendary drop 7/8 of the time so the
 * premium tier still anchors on the existing item.
 */
function pickPremiumItem(rng: () => number): Card {
  if (rng() < 0.125) {
    const great = KID_CARDS.find((c) => c.id === 'great-wisp');
    if (!great) {
      throw new Error('No great-wisp card in KID_CARDS');
    }
    return great;
  }
  return pickLegendary();
}

/**
 * Outcome of applying a chest reward — the new player snapshot plus the
 * resolved Card (for `'hero'` / `'item'` / `'premium-item'` / `'wisp'`
 * rolls) so the UI can surface the actual rolled card art in the reveal
 * popup (embertide-ymgc). `card` is `null` for non-card rewards
 * (heart / double-heart / ember-shard / vital-ember).
 */
interface AppliedReward {
  readonly player: KidPlayer;
  readonly card: Card | null;
}

/**
 * Apply a resolved chest reward to a single player. Items and premium-items
 * (legendary-sword) enter the player's Items zone with no slot cost
 * (embertide-9yu — MH-11 is obsoleted by the u-2d Items redesign).
 * Items are unbounded per embertide-nmmc — every reward equips.
 *
 * v2: `heart` / `double-heart` rewards are HP heals; at the hpMax cap
 * they grow hp + hpMax up to HP_CAP (embertide 2026-04-22 heart-
 * container pass), so chest hearts stay rewarding at full health.
 *
 * v2.1 embertide-ymgc: returns `{ player, card }` so the chest-
 * reveal UI can render the rolled card's actual illustration. `card`
 * is the picker's resolved Card for hero/item/premium-item/wisp and
 * `null` for the heart-only paths.
 */
export function applyReward(
  player: KidPlayer,
  reward: ChestReward,
  rng: () => number,
): AppliedReward {
  switch (reward) {
    case 'heart':
      return { player: applyHeartReward(player, 1), card: null };
    case 'double-heart':
      return { player: applyHeartReward(player, 2), card: null };
    case 'hero': {
      const hero = pickHero(rng);
      return { player: { ...player, discard: [...player.discard, hero] }, card: hero };
    }
    case 'item': {
      const item = pickNonLegendaryItem(rng);
      const outcome = equipAsItem(player, item);
      return { player: outcome.owner, card: item };
    }
    case 'premium-item': {
      // gm0.16: premium-item has an ~12% chance to roll Great Wisp
      // instead of the legendary. Both are equipped via equipAsItem;
      // items-zone cap overflow falls back to discard per contract.
      const premium = pickPremiumItem(rng);
      const outcome = equipAsItem(player, premium);
      return { player: outcome.owner, card: premium };
    }
    case 'wisp': {
      // Wisp (u-1d amendment A6 + gm0.16): chest wisp rewards roll
      // 50/50 between the plain consumable `wisp` and the
      // `wisp-in-bottle` reusable-once-per-combat variant. Both slot
      // into the active player's items; cap overflow falls back to
      // discard via equipAsItem so the wisp is never lost silently.
      const wisp = pickWispVariant(rng);
      const outcome = equipAsItem(player, wisp);
      return { player: outcome.owner, card: wisp };
    }
    case 'ember-shard': {
      // gm0.16: accumulator path. Not a card — increments the player's
      // `heartPieces` counter. On the 4th piece this auto-promotes to
      // a vital ember (+1 hpMax + full heal) and resets the counter.
      return { player: addEmberShardToPlayer(player), card: null };
    }
    case 'vital-ember': {
      // gm0.16: direct vital-ember drop. Bypasses the piece
      // accumulator entirely — grants +1 hpMax + full heal via
      // applyHeartReward(player, 1). Does NOT touch `heartPieces`.
      return { player: applyHeartReward(player, 1), card: null };
    }
    default: {
      const _exhaustive: never = reward;
      return _exhaustive;
    }
  }
}

/**
 * Open a chest of the given variant for the player at `playerIdx`. Deducts
 * the chest's key cost (throws if the player cannot pay), samples a reward
 * from `chestPool.openChest` using the store's seeded RNG, and applies the
 * reward. Increments the player's `chestsOpened` counter.
 */
export function openChestFor(
  state: KidGameState,
  playerIdx: number,
  variant: ChestVariant,
): KidGameState {
  const player = state.players[playerIdx];
  if (!player) throw new Error(`Invalid player index: ${playerIdx}`);

  const keyCost = CHEST_KEY_COSTS[variant];
  if (player.keys < keyCost) {
    throw new Error(
      `Insufficient keys to open ${variant} chest: need ${keyCost}, have ${player.keys}`,
    );
  }

  const { reward } = sampleChestReward(variant, state.rng);
  const withKeysPaid: KidPlayer = {
    ...player,
    keys: player.keys - keyCost,
    chestsOpened: player.chestsOpened + 1,
  };
  const { player: rewarded, card } = applyReward(withKeysPaid, reward, state.rng);
  return {
    ...replacePlayer(state, playerIdx, rewarded),
    lastChestReward: reward,
    lastChestRewardCard: card,
  };
}
