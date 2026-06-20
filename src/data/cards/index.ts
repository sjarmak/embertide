/**
 * Kid Mode card dataset (public barrel).
 *
 * IP-safety note: every id is a generic, role-based kebab-case string.
 * Franchise-specific names live exclusively in public/theme.example.json
 * (loaded at runtime) and never appear in the data layer.
 *
 * Implementation lives under `./` per concern:
 *   - `types.ts` — local effect/metadata shapes + SupplyCard
 *   - `heroes.ts` / `items.ts` / `passives.ts` / `monsters.ts`
 *   - `zones/{sylvani,emberpeak,maren,shadow,spirit,gildedCage}.ts`
 *   - `heirlooms.ts` — wild-boss heirloom drops + HEIRLOOM_DROPS map
 *   - `princess.ts` — freed-princess crystal-break grant
 *   - `chests.ts` — 3-tier chest cards
 *   - `heartTiers.ts` — grunt + tough ember-shard allowlists
 *   - `alwaysAvailable.ts` — buyable templates + vendors + mintAlwaysAvailable
 *   - `supply.ts` — buildSupply, buildChestSupply, baseIdOf
 */

import type { Card } from '../../types/card';

import { heroes } from './heroes';
import {
  items,
  wisp,
  greatWisp,
  wispInBottle,
  blacksmithForge,
  ritualRelic,
  ancientBlade,
} from './items';
import { itemPassiveConstructs, itemPassiveRelics } from './passives';
import { monsters, miniBosses, finalBoss } from './monsters';
import { sylvaniRegulars, sylvaniBosses } from './zones/sylvani';
import { emberpeakRegulars, boulderkin, ashenTyrant } from './zones/emberpeak';
import { marenRegulars, maelstrom, tidewraith } from './zones/maren';
import { shadowRegulars, hollowEffigy, knell } from './zones/shadow';
import { spiritRegulars, ironSentinel, hextwins } from './zones/spirit';
import { GILDED_CAGE_BOSSES } from './zones/gildedCage';
import { heirlooms } from './heirlooms';
import { freedPrincess } from './princess';
import { chests } from './chests';
import { colosseumCards } from './colosseum';

// Public surface re-exports (kept stable for the 49 consumer files).
export {
  wisp,
  greatWisp,
  wispInBottle,
  blacksmithForge,
  ritualRelic,
  ancientBlade,
} from './items';
export {
  CHEST_ITEM_POOL_IDS,
  TEST_PASSIVE_SAMPLE_CARD,
  TEST_ROLL_DIE_SAMPLE_CARD,
  TEST_SHARD_GRANT_SAMPLE_CARD,
} from './passives';
export { MAREN_REGULARS, MAREN_BOSSES } from './zones/maren';
export { SHADOW_REGULARS, SHADOW_BOSSES } from './zones/shadow';
export { SPIRIT_REGULARS, SPIRIT_BOSSES } from './zones/spirit';
export { GILDED_CAGE_REGULARS, GILDED_CAGE_BOSSES } from './zones/gildedCage';
export { heirlooms, HEIRLOOM_DROPS } from './heirlooms';
export { GRUNT_HEART_METER_IDS, TOUGH_EMBER_SHARD_IDS } from './heartTiers';
export { FREED_PRINCESS_ID, freedPrincess } from './princess';
export {
  MYSTIC_ID,
  MILITIA_GRUNT_ID,
  WILD_WOLF_ID,
  KEY_VENDOR_ID,
  ALWAYS_AVAILABLE,
  VENDORS,
  findAlwaysAvailable,
  findVendor,
  mintAlwaysAvailable,
} from './alwaysAvailable';
export type { SupplyCard } from './types';
export {
  baseIdOf,
  buildSupply,
  buildChestSupply,
  ATTACHED_CHEST_PROBABILITY,
  SUPPLY_CARD_COUNT,
  CHEST_SUPPLY_CARD_COUNT,
} from './supply';

/**
 * Exported dataset (one copy of every card, including the final-boss).
 * The first (base) copy retains its original id so existing references such
 * as `KID_CARDS.find(c => c.id === 'sage-keeper')` continue to resolve. The
 * supply builder emits additional duplicate copies with suffixed ids
 * (e.g. `sage-keeper-2`, `sage-keeper-3`) and the optional `baseId` field so
 * consumers can recover the canonical role-based identifier.
 *
 * Champion starter cards retired (j49z, 2026-04-24). The four
 * `starter-home` entries (spirit-arrow / seer-rune / warblade /
 * ancient-keepsake) and the role itself were retired after the 8bh
 * audit confirmed the on-play dispatch was unreachable in v2 (starter
 * decks no longer include them per the 2026-04-24 designer direction).
 */
export const KID_CARDS: readonly Card[] = [
  ...heroes,
  ...items,
  ancientBlade,
  ...monsters,
  ...miniBosses,
  finalBoss,
  ...chests,
  wisp,
  // v2.1 gm0.16 wisp variants. Both drop-only items (not in SUPPLY_PLAN).
  greatWisp,
  wispInBottle,
  // embertide-91p (b): banish-from-hand item-active cards. Drop-only
  // (NOT in SUPPLY_PLAN) so they don't perturb the market shuffle but
  // remain accessible by id for catalog tests + future drop-source
  // wiring (e.g. boss-chest enchanted-tier additions).
  blacksmithForge,
  ritualRelic,
  // embertide-4uyn — chest-pool item-passive variety expansion.
  // Drop-only (NOT in SUPPLY_PLAN); reach the player exclusively through
  // chest "item" rewards. CHEST_ITEM_POOL_IDS controls inclusion.
  ...itemPassiveConstructs,
  ...itemPassiveRelics,
  // u-6a Sylvanwood content (amendment A5).
  ...sylvaniRegulars,
  ...sylvaniBosses,
  // u-6b Emberpeak content (amendment A5).
  ...emberpeakRegulars,
  boulderkin,
  ashenTyrant,
  // gdd.1 Tidehold content (v2.1 zone 3). Mirrors the Death
  // Mountain pattern: regulars + wild + region inline-listed here so
  // by-id lookups resolve (zone-spawn surface still reads them via
  // ZONE_METADATA.maren). Distinct from gilded-cage regulars which
  // stay out of KID_CARDS — the design choice diverges by zone.
  ...marenRegulars,
  maelstrom,
  tidewraith,
  // gdd.2 Hollow Shrine content (v2.1 zone 4). Same shape as Maren —
  // regulars + wild + region inline so by-id lookups resolve. The
  // zone-spawn surface reads via ZONE_METADATA['hollow-shrine'].
  ...shadowRegulars,
  hollowEffigy,
  knell,
  // gdd.3 Dune Sanctum content (v2.1 zone 5). Same shape as Shadow —
  // regulars + wild + region inline so by-id lookups resolve. The
  // zone-spawn surface reads via ZONE_METADATA['dune-sanctum'].
  ...spiritRegulars,
  ironSentinel,
  hextwins,
  // u-6c-bosses Gilded Cage content (amendment A5, Layer 7). Temple
  // regulars stay out of KID_CARDS (see GILDED_CAGE_REGULARS note);
  // only the bosses are authored here for supply inclusion.
  ...GILDED_CAGE_BOSSES,
  // u-9b heirlooms (REQ-32). Reward-only items dropped by wild bosses.
  // NOT in SUPPLY_PLAN — heirlooms are never purchasable through the
  // center row (see HEIRLOOM_DROPS for the drop routing table).
  ...heirlooms,
  // fix-aurelia (2026-04-22): Freed Princess (display: Princess Aurelia) —
  // granted on crystal break. NOT in SUPPLY_PLAN. Registered in
  // KID_CARDS so by-id lookups (effectTextFor, combat deck minting,
  // GENERIC_BASE_ID_THEME) resolve.
  freedPrincess,
  // p24m (2026-05-02): colosseum cards. NOT in SUPPLY_PLAN — colosseum
  // bosses are encountered via the colosseum slot router (4hr1), not
  // the center-row Acquire/Defeat flow. Today carries Trinity Aurogax
  // (Tier-5 capstone); the remaining 21 colosseum bosses land
  // alongside their art-batch beads.
  ...colosseumCards,
];
