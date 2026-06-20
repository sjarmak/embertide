/**
 * Item-passive cards (embertide-4uyn) — Ascension constructs +
 * Slay-the-Spire relics.
 *
 * Framing: deck-building = Ascension (persistent always-on
 * "constructs" declared as `item-passive` with a start-of-turn
 * trigger), boss encounters = Slay the Spire (one-shot "relics" with
 * on-event triggers — `on-combat-enter` / `on-damage` /
 * `on-monster-defeated`). All ten cards ship as `role: 'item'` +
 * `itemKind: 'item-passive'`, drop-only (NOT in SUPPLY_PLAN) — they
 * reach the kid through the `chest-mid` "item" reward (15% weight, 7
 * chests per run at the tq5 50/35/15 split, so a typical run rolls
 * 1-2 of these passives) and the rare `chest-std` "item" 15% slice.
 *
 * Cooldown fields are omitted on purpose: `item-passive` cards never
 * activate manually, so the cooldown-readout / lastUsedTurn pair (only
 * meaningful for item-active activation lifecycle) stays absent. The
 * `applyStartOfTurnItems` cooldown-decrement loop guards on
 * `itemKind !== 'item-active'` and skips passives cleanly.
 *
 * Effect numbers are deliberately small (+1 / +2 / draw 1) so a kid's
 * run accumulates upside without trivializing the HP / power economy.
 * The bigger numbers (combat-enter +2 power on `valor-pendant`, draw 1
 * per kill on `bloodlust-pendant`) are anchored to the rarer triggers
 * to balance the always-on cadence of the start-of-turn six.
 */

import type { Card } from '../../types/card';

// --- Ascension construct flavour (start-of-turn passives) ---

const forgeOfPower: Card = {
  id: 'forge-of-power',
  role: 'item',
  cost: { green: 5 },
  effects: {
    kind: 'item-passive',
    description: '+1 power at the start of your turn',
    trigger: 'start-of-turn',
    effect: { kind: 'gain', red: 1 },
  },
  itemKind: 'item-passive',
  // Generates +1 power every turn — classic start-of-turn economy engine.
  cardType: 'engine',
};

const wellOfVitality: Card = {
  id: 'well-of-vitality',
  role: 'item',
  cost: { green: 5 },
  effects: {
    kind: 'item-passive',
    description: 'Heal +1 ♥ at the start of your turn',
    trigger: 'start-of-turn',
    effect: { kind: 'heal', target: 'self', amount: 1 },
  },
  itemKind: 'item-passive',
  // Heals 1 HP every turn — sustain engine that scales health over time.
  cardType: 'engine',
};

const merchantsCharm: Card = {
  id: 'merchants-charm',
  role: 'item',
  cost: { green: 4 },
  effects: {
    kind: 'item-passive',
    description: '+1 gem at the start of your turn',
    trigger: 'start-of-turn',
    effect: { kind: 'gain', green: 1 },
  },
  itemKind: 'item-passive',
  // Generates +1 gem every turn — gem-economy scaling engine.
  cardType: 'engine',
};

const scholarsTome: Card = {
  id: 'scholars-tome',
  role: 'item',
  cost: { green: 6 },
  effects: {
    kind: 'item-passive',
    description: 'Draw 1 at the start of your turn',
    trigger: 'start-of-turn',
    effect: { kind: 'draw', amount: 1 },
  },
  itemKind: 'item-passive',
  // Draws an extra card every turn — card-draw engine that scales tempo.
  cardType: 'engine',
};

const sylvaniTalisman: Card = {
  id: 'sylvani-talisman',
  role: 'item',
  cost: { green: 4 },
  effects: {
    kind: 'item-passive',
    description: '+1 power when you enter combat',
    trigger: 'on-combat-enter',
    effect: { kind: 'gain', red: 1 },
  },
  itemKind: 'item-passive',
  // Grants +1 power at combat entry — scales combat opening resources.
  cardType: 'engine',
};

const ironWard: Card = {
  id: 'iron-ward',
  role: 'item',
  cost: { green: 5 },
  effects: {
    kind: 'item-passive',
    description: 'Reduce damage taken by 1',
    trigger: 'on-damage',
    effect: { kind: 'damage-reduction', amount: 1 },
  },
  itemKind: 'item-passive',
  // Reduces every incoming hit by 1 — a specific defensive counter
  // to boss damage. Tech.
  cardType: 'tech',
};

// --- Slay the Spire relic flavour (event-trigger passives) ---

// On-monster-defeated trigger (embertide-4uyn) — fires after every
// successful monster kill (regular, mini-boss, wild-boss, region-boss).
// Dispatched by `applyMonsterDefeatedPassives` in
// src/store/slices/combat.ts; runs AFTER the monster-drop reward + boss
// hooks so the per-kill loot stack is: monster-drop heal/keys → r94e
// gems/cardDraw → boss/ember-shard hooks → on-monster-defeated passives.

const banditsCache: Card = {
  id: 'bandits-cache',
  role: 'item',
  cost: { green: 5 },
  effects: {
    kind: 'item-passive',
    description: '+1 gem when you defeat a monster',
    trigger: 'on-monster-defeated',
    effect: { kind: 'gain', green: 1 },
  },
  itemKind: 'item-passive',
  // Generates +1 gem per monster kill — economy scales with kill rate.
  cardType: 'engine',
};

const bloodlustPendant: Card = {
  id: 'bloodlust-pendant',
  role: 'item',
  cost: { green: 6 },
  effects: {
    kind: 'item-passive',
    description: 'Draw 1 when you defeat a monster',
    trigger: 'on-monster-defeated',
    effect: { kind: 'draw', amount: 1 },
  },
  itemKind: 'item-passive',
  // Draws 1 card per monster kill — card-draw engine scaling with kills.
  cardType: 'engine',
};

const valorPendant: Card = {
  id: 'valor-pendant',
  role: 'item',
  cost: { green: 6 },
  effects: {
    kind: 'item-passive',
    description: '+2 power when you enter combat',
    trigger: 'on-combat-enter',
    effect: { kind: 'gain', red: 2 },
  },
  itemKind: 'item-passive',
  // Grants +2 power at combat entry — power-burst engine on every fight.
  cardType: 'engine',
};

const surgeTotem: Card = {
  id: 'surge-totem',
  role: 'item',
  cost: { green: 4 },
  effects: {
    kind: 'item-passive',
    description: '+1 gem when you enter combat',
    trigger: 'on-combat-enter',
    effect: { kind: 'gain', green: 1 },
  },
  itemKind: 'item-passive',
  // Grants +1 gem at combat entry — gem-burst engine on every fight.
  cardType: 'engine',
};

/**
 * The ten embertide-4uyn item-passive cards, grouped so a reader
 * can scan the construct + relic split. Order is stable so chest-pool
 * draw determinism (seed-based deterministic index into KID_CARDS-
 * filtered list) remains insensitive to any future refactor that
 * preserves declaration order.
 */
export const itemPassiveConstructs: readonly Card[] = [
  forgeOfPower,
  wellOfVitality,
  merchantsCharm,
  scholarsTome,
  sylvaniTalisman,
  ironWard,
];

export const itemPassiveRelics: readonly Card[] = [
  banditsCache,
  bloodlustPendant,
  valorPendant,
  surgeTotem,
];

/**
 * Allowlist of item ids eligible for the chest "item" reward
 * (embertide-4uyn). Defines the curated pool that
 * `pickNonLegendaryItem` (src/store/slices/chests.ts) draws from when a
 * chest rolls a generic `'item'` reward — instead of pulling from EVERY
 * `role === 'item'` entry in `KID_CARDS` (which silently leaked drop-
 * only items like wisp / heirlooms / freed-princess into the chest
 * pool).
 *
 * The allowlist is the union of:
 *   - the v2.0 + v2.1 supply items (short-sword .. ancient-sword) so
 *     buyable items stay representable in chest drops;
 *   - the ten 4uyn item-passive constructs + relics, which are NOT in
 *     SUPPLY_PLAN — chests are their only acquisition path.
 *
 * Excluded by deliberate omission: wisp / great-wisp / wisp-in-bottle
 * (own dedicated `'wisp'` reward path),
 * wild-boss heirlooms (`craghorn-tusk` / `boulderkin-core` / `sentinel-eye`
 * / `chimera-sword` / `rainbow-ancient-chimera-sword` — drop on wild-boss
 * defeat, not chest), `freed-princess` (crystal-break grant only),
 * banish-from-hand items `blacksmith-forge` / `ritual-relic` (catalog-
 * only per embertide-91p note), `ancient-blade` (legendary-sword
 * routed through `pickPremiumItem`).
 *
 * A 6yo's average run draws ~7 chest-mid + ~3 chest-boss + ~10 chest-std
 * across the tq5 supply; the chest-mid 'item' reward at 15% weight pulls
 * from this allowlist, giving roughly 1-2 item-passive drops per run when
 * combined with the chest-std 15% 'item' weight. That hits the bead's
 * "varied items per 6yo run" target without flooding the items zone.
 */
export const CHEST_ITEM_POOL_IDS: ReadonlySet<string> = new Set([
  // v2.0 supply items (short-sword + tower-shield + short-bow + curved-throwing-blade).
  'short-sword',
  'tower-shield',
  'short-bow',
  'curved-throwing-blade',
  // v2.1 gm0.15 supply items.
  'bow',
  'boomerang',
  'elysian-shield',
  'cinder-bloom',
  'ancient-sword',
  // 4uyn item-passive constructs (Ascension-style, start-of-turn).
  'forge-of-power',
  'well-of-vitality',
  'merchants-charm',
  'scholars-tome',
  'sylvani-talisman',
  'iron-ward',
  // 4uyn item-passive relics (StS-style, event-trigger).
  'bandits-cache',
  'bloodlust-pendant',
  'valor-pendant',
  'surge-totem',
]);

/**
 * Test-only sample card exercising the `item-passive` EffectSpec discriminant
 * (REQ-13 Phase 2b). Exported separately so tests can import it without any
 * risk of the card leaking into `KID_CARDS`, `SUPPLY_PLAN`, chest loot, or
 * any other runtime draw pool — by deliberate omission from every `readonly
 * Card[]` aggregate exported below. The reducer hook set that fires the
 * nested `effect` on the declared `trigger` ships in a follow-up unit; this
 * card is coverage fodder for the schema branch only.
 *
 * Shape rationale: the nested effect is a plain `gain` (+1 green) — the
 * narrowest, most inert EffectSpec member so the sample stays obviously
 * safe. The `item-passive` kind itself is forbidden recursively by the
 * `InnerEffectSpec` type at the authoring site.
 */
export const TEST_PASSIVE_SAMPLE_CARD: Card = {
  id: 'test-passive-sample',
  role: 'item',
  cost: { green: 0 },
  effects: {
    kind: 'item-passive',
    description: '+1 green at the start of your turn',
    trigger: 'start-of-turn',
    effect: { kind: 'gain', green: 1 },
  },
  itemKind: 'item-passive',
};

/**
 * Test-only sample card exercising the `roll-die` EffectSpec discriminant
 * (REQ-13 Phase 2a / gm0.7). Exported separately so tests can import it
 * without any risk of the card leaking into `KID_CARDS`, `SUPPLY_PLAN`,
 * chest loot, or any other runtime draw pool — by deliberate omission
 * from every `readonly Card[]` aggregate exported below.
 *
 * Shape rationale: every face 1..6 has a non-zero `gain` effect so the
 * fail-forward-floor invariant (REQ-10) is satisfied both by type
 * (the outcomes map is `Readonly<Record<DieFace, RollDieOutcomeEffect>>`,
 * which is a total map) and by balance-test runtime assertion. The
 * distribution is intentionally mundane — green/red/key gains with no
 * draw shenanigans — since no balance tuning is needed for a test-only
 * anchor. Outcomes are range-grouped (1-2 / 3-4 / 5-6 share an outcome)
 * so the anchor is a well-formed Omen per the bounded-variance
 * invariant (lhlo.29, src/core/omen.ts). Full player-visible pick-UI +
 * reducer wiring ships in gm0.10 (forest-sage omen) / gm0.11 (tutorial).
 */
export const TEST_ROLL_DIE_SAMPLE_CARD: Card = {
  id: 'test-roll-die-sample',
  role: 'item',
  cost: { green: 0 },
  effects: {
    kind: 'roll-die',
    outcomes: {
      1: { kind: 'gain', green: 1 },
      2: { kind: 'gain', green: 1 },
      3: { kind: 'gain', red: 1 },
      4: { kind: 'gain', red: 1 },
      5: { kind: 'gain', keys: 1 },
      6: { kind: 'gain', keys: 1 },
    },
  },
  itemKind: 'item-active',
};

/**
 * Test-only sample card exercising the `shard-grant` EffectSpec
 * discriminant (REQ-13 Phase 2d / gm0.4). Exported separately so tests
 * can import it without any risk of the card leaking into `KID_CARDS`,
 * `SUPPLY_PLAN`, chest loot, or any other runtime draw pool — by
 * deliberate omission from every `readonly Card[]` aggregate exported
 * below.
 *
 * The sample declares a single `wisdom` grant — the narrowest, most
 * inert shard payload so the fixture stays obviously safe. The reducer
 * hooks that fire the shared-pool flip on the declared trigger ship in
 * a follow-up unit; this card is coverage fodder for the schema branch
 * + effectText render path only. The combat-resolve `shardGrants` flow
 * (region-boss defeats via `BossAttackPattern.onDefeatEffect`) is
 * unaffected — this is the parallel declarative path (PRESERVE
 * semantics from the bead).
 */
export const TEST_SHARD_GRANT_SAMPLE_CARD: Card = {
  id: 'test-shard-grant-sample',
  role: 'item',
  cost: { green: 0 },
  effects: {
    kind: 'shard-grant',
    shards: ['wisdom'],
  },
  itemKind: 'item-active',
};
