/**
 * Always Available row (§12 / embertide-9yu).
 *
 * Three templates that live outside `KID_CARDS` / the main supply.
 * Purchases mint a fresh copy with a unique id each time (see
 * `mintAlwaysAvailable`); a defeated Wild Wolf is not banished to the
 * Void — it remains buyable.
 *
 * Vendors live in a separate `VENDORS` array because they are never
 * bought, never enter a player's deck, and never appear in combat.
 */

import type { Card } from '../../types/card';
import type { SupplyCard } from './types';

/** Canonical base id for the Mystic always-available hero. */
export const MYSTIC_ID = 'mystic';
/** Canonical base id for the Militia Grunt always-available hero. */
export const MILITIA_GRUNT_ID = 'militia-grunt';
/** Canonical base id for the Wild Wolf always-available monster. */
export const WILD_WOLF_ID = 'wild-wolf';
/**
 * Canonical base id for the Key Vendor (Pell). Originally landed as a
 * buyable always-available hero (u-2c / REQ-3 — pay 4g, mint a copy in
 * discard, draw + play for +1 key). embertide-1eby (2026-04-24)
 * reframed it as a VENDOR SERVICE: clicking Pell's tile pays 4 green
 * directly and grants +1 key on the spot — no card enters the deck, no
 * draw cycle, no combat-effect override needed. The id stays the same
 * so existing portrait wiring (SPEC_BY_BASE_ID, theme display name)
 * continues to resolve.
 */
export const KEY_VENDOR_ID = 'key-vendor';

const mysticTemplate: Card = {
  id: MYSTIC_ID,
  role: 'hero',
  cost: { green: 3 },
  effects: { kind: 'gain', green: 2 },
  // Generates +2 gems on play — gem-economy engine.
  cardType: 'engine',
};

const militiaGruntTemplate: Card = {
  id: MILITIA_GRUNT_ID,
  role: 'hero',
  cost: { green: 2 },
  effects: { kind: 'gain', red: 2 },
  // Generates +2 power on play — power-economy engine.
  cardType: 'engine',
};

const wildWolfTemplate: Card = {
  id: WILD_WOLF_ID,
  role: 'monster',
  cost: { red: 2 },
  // z9xq (2026-04-25): direct heart drop retired — Scrabling defeats now
  // contribute to GRUNT_HEART_METER_IDS instead (3 kills → 1 piece, 4
  // pieces auto-promote to a vital ember). The always-available
  // tile is repeatable and was previously overpowered at +1 hp per kill.
  effects: { kind: 'monster-drop', hearts: 0 },
};

/**
 * Vendor service template: pay-on-the-spot trade lane (embertide-1eby,
 * 2026-04-24). Vendors live separately from `ALWAYS_AVAILABLE` because
 * they are never bought, never enter a player's deck, and never appear
 * in combat. The Card shape is reused (cost + role:'hero' + effects)
 * for tile rendering parity, but the role tag is incidental — the
 * `tradeWithKeyVendor` reducer reads `cost.green` and the `effects.gain`
 * payload directly to compute the resource swap. CardRole was kept
 * unchanged to avoid rippling a `'vendor'` discriminant through the
 * art-spec / theme / supply-filter switches.
 *
 * `effects.gain.keys: 1` declares what the trade GRANTS, not an on-play
 * effect (vendors are never played). Kept in the existing `gain` shape
 * so UI cost-gem rendering can reuse the same code path as heroes.
 */
const keyVendorTemplate: Card = {
  id: KEY_VENDOR_ID,
  role: 'hero',
  cost: { green: 4 },
  effects: { kind: 'gain', keys: 1 },
};

/**
 * The three always-available BUYABLE/DEFEATABLE templates. The two heroes
 * (baseIds `mystic` / `militia-grunt`, displayed as Oracle / Elysian
 * Soldier per src/theme/generic.ts) are buyable; `wild-wolf` (displayed
 * as Scrabling) is a defeatable monster. Vendor services (currently just
 * Pell / `key-vendor`) live in the separate `VENDORS` array below.
 */
export const ALWAYS_AVAILABLE: readonly Card[] = [
  mysticTemplate,
  militiaGruntTemplate,
  wildWolfTemplate,
];

/**
 * Vendor services rendered in the always-available row but routed
 * through the trade path instead of buy/fight. Single-vendor today
 * (Pell, the Key Vendor); a second vendor would justify generalizing
 * the trade reducer (`tradeWithKeyVendor` → `tradeWithVendor(id)`),
 * not before.
 */
export const VENDORS: readonly Card[] = [keyVendorTemplate];

/**
 * Look up an always-available template by its canonical base id. Returns
 * undefined if the id is not registered — callers must throw their own
 * domain-appropriate error.
 */
export function findAlwaysAvailable(baseId: string): Card | undefined {
  return ALWAYS_AVAILABLE.find((c) => c.id === baseId);
}

/**
 * Look up a vendor template by its canonical base id. Returns undefined
 * when the id is not a registered vendor — callers throw their own
 * domain-appropriate error.
 */
export function findVendor(baseId: string): Card | undefined {
  return VENDORS.find((c) => c.id === baseId);
}

/**
 * Mint a fresh purchasable copy of an always-available hero. Each call
 * returns a new `SupplyCard` with a unique `-<monotonic>-<rng>` suffix so
 * duplicate purchases don't collide by id. The `baseId` is set to the
 * canonical template id so `baseIdOf` / `playCard` still dispatch the
 * right effect.
 */
let alwaysAvailableMintCounter = 0;
export function mintAlwaysAvailable(baseId: string, rng: () => number): SupplyCard {
  const template = findAlwaysAvailable(baseId);
  if (!template) {
    throw new Error(`Unknown always-available card: ${baseId}`);
  }
  alwaysAvailableMintCounter += 1;
  const suffix = `${alwaysAvailableMintCounter}-${Math.floor(rng() * 1_000_000)}`;
  return {
    ...template,
    id: `${template.id}-${suffix}`,
    baseId: template.id,
  };
}
