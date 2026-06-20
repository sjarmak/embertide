/**
 * Supply builder — duplicates the non-starter, non-final-boss cards
 * into a shuffled draw deck that feeds the Ascension-style center row.
 *
 * Also home to:
 *   - `baseIdOf` (the SupplyCard `baseId` resolver)
 *   - `ATTACHED_CHEST_PROBABILITY` (REQ-21 / gm0.6)
 *   - `buildSupply` / `buildChestSupply` (called from initGame)
 *   - `SUPPLY_CARD_COUNT` / `CHEST_SUPPLY_CARD_COUNT` (test surface)
 */

import type { Card } from '../../types/card';
import type { SupplyCard, TemplateEntry } from './types';
import { heroes } from './heroes';
import { items, ancientBlade } from './items';
import { monsters, miniBosses } from './monsters';
import { sylvaniRegulars } from './zones/sylvani';
import { emberpeakRegulars } from './zones/emberpeak';
import { marenRegulars } from './zones/maren';
import { shadowRegulars } from './zones/shadow';
import { spiritRegulars } from './zones/spirit';
import { chests } from './chests';

/**
 * Local Fisher–Yates shuffle. Duplicated here (instead of importing from
 * src/store/slices/deck.ts) to avoid a circular import — deck.ts imports
 * KID_CARDS from this module.
 */
function shuffleCards<T>(items: readonly T[], rng: () => number): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Return the canonical role-based id of a supply card. For base copies this
 * equals `card.id`; for duplicates it is the original template id stored on
 * the `baseId` field.
 */
export function baseIdOf(card: Card): string {
  const baseId = (card as SupplyCard).baseId;
  return baseId ?? card.id;
}

// Duplication plan per the Ascension-style supply (embertide-7kw + 7c1):
//   hero x3, item x2, legendary-sword x1, monster x3, mini-boss x2.
// Chests have been moved to their own dedicated chest supply (see
// buildChestSupply) and are no longer part of the main market.
// The final-boss is NOT in the supply — it is injected by the endgame slice
// at turn 8.
//
// u-6a Sylvani additions:
//   - 4 regular enemies × 3 copies each (parity with existing monsters).
//   - Craghorn wild-boss × 3 copies (acceptance: "~3 copies in supply").
//   - Broodmaw region-boss × 1 copy (acceptance: exactly 1, spawn-gated).
// v2.1 gm0.15 (embertide-9hy): ancient-sword ships as ×1 rather
// than the default ×2 for market items — it sits at green:5 (post-ijge
// knob 1) with combat-attack damage 5, the same power band as `ancient-blade`
// (legendary-sword, ×1). Keeping it at scarcity 1 preserves the
// legendary-tier acquisition feel without demoting it into the common
// supply pool.
const ANCIENT_SWORD_SINGLETON_IDS: ReadonlySet<string> = new Set(['ancient-sword']);

// embertide-58oo (2026-04-25): named-character heroes ship as singletons
// in the supply (1 copy each) so the center-row field can never show two of
// the same character at once. The franchise reads as "Liel, Brammel, Naerin,
// Aurelia, Wren, the forest sage, the avatar, Velrath" — each is a unique
// individual, not a deck-of-three. Generic-archetype heroes (today only
// `wandering-merchant` / Coll, a recurring shopkeeper class) keep the
// default ×3 duplication so the market still has a steady supply of
// generalist heroes early on.
const MULTI_COPY_HERO_IDS: ReadonlySet<string> = new Set(['wandering-merchant']);

const SUPPLY_PLAN: readonly TemplateEntry[] = [
  ...heroes.map((template) => ({
    template,
    copies: MULTI_COPY_HERO_IDS.has(template.id) ? 3 : 1,
  })),
  ...items.map((template) => ({
    template,
    copies: ANCIENT_SWORD_SINGLETON_IDS.has(template.id) ? 1 : 2,
  })),
  { template: ancientBlade, copies: 1 },
  ...monsters.map((template) => ({ template, copies: 3 })),
  ...miniBosses.map((template) => ({ template, copies: 2 })),
  // u-6a Sylvanwood regulars (amendment A5): 4 regulars × 3 copies.
  // u-9a / REQ-32: boss cards (craghorn, broodmaw, boulderkin, ashen-tyrant,
  // sentinel, silver-chimera, cagewright-vurmox) no longer populate the
  // market — they spawn exclusively through the Wild/Region boss slot
  // selectors in src/rules/zones.ts. Templates remain in KID_CARDS for
  // by-id lookup (ZONE_METADATA, engagement dispatch, etc.).
  ...sylvaniRegulars.map((template) => ({ template, copies: 3 })),
  // u-6b Emberpeak regulars (amendment A5): 4 regulars × 3 copies.
  ...emberpeakRegulars.map((template) => ({ template, copies: 3 })),
  // gdd.1 Tidehold regulars (v2.1 zone 3): 4 regulars × 3 copies.
  // Bosses (maelstrom, tidewraith) spawn exclusively through the
  // Wild/Region boss slot selectors in src/rules/zones.ts (same
  // post-u-9a contract as the Sylvani / Emberpeak bosses).
  ...marenRegulars.map((template) => ({ template, copies: 3 })),
  // gdd.2 Hollow Shrine regulars (v2.1 zone 4): 4 regulars × 3 copies.
  // Bosses (hollow-effigy, knell) spawn exclusively through the
  // Wild/Region boss slot selectors in src/rules/zones.ts.
  ...shadowRegulars.map((template) => ({ template, copies: 3 })),
  // gdd.3 Dune Sanctum regulars (v2.1 zone 5): 4 regulars × 3 copies.
  // Bosses (iron-sentinel, hextwins) spawn exclusively through the
  // Wild/Region boss slot selectors in src/rules/zones.ts.
  ...spiritRegulars.map((template) => ({ template, copies: 3 })),
  // Gilded-cage has NO regulars in the market (see GILDED_CAGE_REGULARS
  // note above) and no bosses post-u-9a. Its content reaches the player
  // via the zone-spawn selectors in src/rules/zones.ts.
];

// Chest-only duplication plan (embertide-7c1 → tq5):
//   tq5 distributes chest spawns across the 3 tiers at 50% / 35% / 15%
//   (std / mid / boss) by spawn frequency, NOT per-pool reward weight.
//   With a 20-card chest supply this resolves to 10 std + 7 mid + 3 boss.
//   The deck is shuffled into `state.chestSupply` and dealt into the
//   3-slot chestRow at game start; refill keeps the row at 3 chests.
const CHEST_SUPPLY_PLAN: readonly TemplateEntry[] = [
  { template: chests[0], copies: 10 }, // chest-std × 10 (50%)
  { template: chests[1], copies: 7 }, //  chest-mid × 7  (35%)
  { template: chests[2], copies: 3 }, //  chest-boss × 3 (15%)
];

function expandTemplate(entry: TemplateEntry): SupplyCard[] {
  const out: SupplyCard[] = [];
  for (let i = 0; i < entry.copies; i += 1) {
    if (i === 0) {
      // Base copy retains the original id so existing id-based lookups work.
      out.push(entry.template as SupplyCard);
    } else {
      const duplicate: SupplyCard = {
        ...entry.template,
        id: `${entry.template.id}-${i + 1}`,
        baseId: entry.template.id,
      };
      out.push(duplicate);
    }
  }
  return out;
}

/**
 * Probability that a given regular center-row monster receives the
 * `hasAttachedChest` flag at supply-build time (v2.1 REQ-21 / gm0.6).
 * Per the L1-mitigated acceptance ("~40% of spawned center-row
 * monsters"), each eligible card is rolled independently against this
 * threshold using the same seeded rng that drives shuffling — keeping
 * the distribution deterministic per seed.
 *
 * Eligibility: `role === 'monster'` AND `bossTier === undefined` —
 * mini-bosses, wild bosses, region bosses, and the final boss are
 * excluded by role/tier. Bonus loot is `chest-std` (NOT chest-boss)
 * per L1: routing the bonus through the std weight table keeps the
 * boss-chest pay-off curve insulated from the per-monster chest path.
 */
export const ATTACHED_CHEST_PROBABILITY = 0.4;

/**
 * Stamp `hasAttachedChest: true` on regular center-row monsters at
 * the rate defined by {@link ATTACHED_CHEST_PROBABILITY}. Pure: returns
 * a new array with new card objects for stamped entries; non-stamped
 * entries are returned by reference. Deterministic given a seeded rng.
 */
function stampAttachedChests(cards: readonly SupplyCard[], rng: () => number): SupplyCard[] {
  const out: SupplyCard[] = [];
  for (const card of cards) {
    const eligible = card.role === 'monster' && card.bossTier === undefined;
    // Always advance the rng for eligible cards so the per-card roll
    // sequence stays decoupled from card ordering. Ineligible cards
    // (heroes, items, mini-bosses, etc.) leave the rng untouched —
    // they cannot receive the flag and have no per-card decision.
    if (!eligible) {
      out.push(card);
      continue;
    }
    const roll = rng();
    if (roll < ATTACHED_CHEST_PROBABILITY) {
      out.push({ ...card, hasAttachedChest: true });
    } else {
      out.push(card);
    }
  }
  return out;
}

/**
 * Build the shuffled Ascension-style supply deck for a new game. Excludes the
 * starter shard/home cards (those live in individual player decks) and the
 * final-boss (spawned separately by the endgame slice).
 *
 * Deterministic: the caller must pass the game's seeded rng so repeated
 * initGame calls with the same seed yield identical supplies.
 *
 * v2.1 REQ-21 (gm0.6): after shuffling, ~40% of `role === 'monster'`
 * regulars are stamped with `hasAttachedChest: true`. The stamping
 * shares the same rng so the decision is part of the supply seed —
 * a given seed always produces the same flagged set.
 */
export function buildSupply(rng: () => number): SupplyCard[] {
  const expanded: SupplyCard[] = [];
  for (const entry of SUPPLY_PLAN) {
    expanded.push(...expandTemplate(entry));
  }
  const shuffled = shuffleCards(expanded, rng);
  return stampAttachedChests(shuffled, rng);
}

/**
 * Planned supply size — exposed so tests can assert the full dataset count
 * without re-encoding the duplication plan.
 */
export const SUPPLY_CARD_COUNT: number = SUPPLY_PLAN.reduce((sum, entry) => sum + entry.copies, 0);

/**
 * Build the shuffled chest draw pile for a new game (embertide-7c1
 * → tq5). Returns 20 chest cards (10 × std, 7 × mid, 3 × boss) with
 * unique ids per the duplicate-suffix convention used by `buildSupply`.
 * The first 3 cards are dealt into `state.chestRow` by `initGame`; the
 * remaining 17 stay in `state.chestSupply` to refill the row as chests
 * are opened.
 */
export function buildChestSupply(rng: () => number): SupplyCard[] {
  const expanded: SupplyCard[] = [];
  for (const entry of CHEST_SUPPLY_PLAN) {
    expanded.push(...expandTemplate(entry));
  }
  return shuffleCards(expanded, rng);
}

/**
 * Planned chest supply size (20 cards: 10 std + 7 mid + 3 boss per
 * embertide-tq5's 50% / 35% / 15% spawn-frequency split). Exposed
 * so tests can assert the full chest pool size without re-encoding the
 * plan.
 */
export const CHEST_SUPPLY_CARD_COUNT: number = CHEST_SUPPLY_PLAN.reduce(
  (sum, entry) => sum + entry.copies,
  0,
);
