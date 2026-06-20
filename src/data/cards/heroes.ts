/**
 * Heroes (role='hero'): champion roster authored in cards.ts.
 *
 * Most heroes are the seven main-roster champions; two zone-themed
 * stub heroes (dune-revenant / velrath-duke-of-veils) ship as
 * mid-cost gain-resource defaults pending a designer tuning pass —
 * see the inline notes for context.
 */

import type { Card } from '../../types/card';

export const heroes: readonly Card[] = [
  {
    id: 'sage-keeper',
    role: 'hero',
    cost: { green: 4 },
    effects: { kind: 'gain', green: 2, keys: 1 },
    // Generates gems + keys on play — pure economy card.
    cardType: 'engine',
  },
  {
    id: 'water-warrior',
    role: 'hero',
    cost: { green: 3 },
    effects: { kind: 'gain', red: 2 },
    // Generates power on play — resource-scaling engine.
    cardType: 'engine',
  },
  {
    id: 'scholar-princess',
    role: 'hero',
    cost: { green: 5 },
    // mvjx (wun Track C, 2026-04-25): main-phase fire was Draw 2,
    // duplicating combat-draw 2 in EXPLICIT_OVERRIDES. Phases now
    // differentiate — main grants +2g, combat keeps draw 2. Audit
    // flagged this card as "feels redundant" because both phases
    // resolved to the same shape; resource → draw split makes the
    // card a deliberate dual-phase contributor.
    effects: { kind: 'gain', green: 2 },
    // Generates gems on play; combat side draws cards — primary role is
    // economy / tempo (resource generation).
    cardType: 'engine',
  },
  {
    id: 'wandering-merchant',
    role: 'hero',
    cost: { green: 3 },
    effects: { kind: 'gain', green: 1, red: 1 },
    // Splits economy across gem + power — resource generation engine.
    cardType: 'engine',
  },
  {
    id: 'ranch-keeper',
    role: 'hero',
    cost: { green: 4 },
    // 487 (2026-04-24): conditional-heart EffectSpec retired. The boss
    // bonus fires from a hardcoded baseId check in slices/combat.ts
    // (`ranchKeeperHealBonus`); the EffectSpec was a schema-only shim
    // never read by the dispatcher.
    // mvjx (wun Track C, 2026-04-25): added flat +1g main-phase fire so
    // ranch-keeper isn't dead weight on non-boss turns. Boss-conditional
    // +1♥ heal still fires through `ranchKeeperHealBonus` — the gain is
    // strictly additive, not a replacement.
    effects: { kind: 'gain', green: 1 },
    // Generates a gem on play and heals on boss kill — resource + incidental
    // sustain; economy generation is the primary play pattern.
    cardType: 'engine',
  },
  {
    id: 'forest-sage',
    role: 'hero',
    cost: { green: 5 },
    // gm0.10 (2026-04-24, v2.1 REQ-6): forest-sage is a player-visible
    // roll site — paired with the Dungeon Boss reward roll (4hz6).
    // The roll-die EffectSpec shape carries the AUTHORING surface and
    // the balance-test coverage in src/balance/rollDie.test.ts walks
    // every face. The semantic per-face dispatch is owned by
    // FOREST_SAGE_OMEN_TABLE in src/data/dice-tables.ts — it routes
    // face → handler so the rare-item outcome (no coherent EffectSpec
    // discriminant today) can still ride the same roll surface.
    //
    // OMEN re-format (lhlo.29, 2026-05-26): promoted to the named Omen
    // keyword (keyword-glossary §DICE/OMEN). Outcomes MUST be grouped
    // into ranges 1-2 / 3-4 / 5-6 (bounded variance — never six
    // separate outcomes). Six distinct faces (heal / gem / peek / power
    // / draw / rare-item) collapsed to three escalating-value ranges,
    // keeping the rare-item showpiece on the top range (designer
    // retable 2026-04-25). Dropped outcomes (heal/peek/power) remain
    // valid ForestSageOmenOutcome union members for future Omen cards;
    // open to designer retuning via the lhlo.30 review.
    //
    //   1-2 → +1 gem        (economy floor; never a dead roll)
    //   3-4 → draw 1 card   (tempo / card advantage)
    //   5-6 → rare-item     (chest-boss premium-item showpiece)
    //
    // The `omen: 'song'` tag is COSMETIC ONLY — forest theme (Liel's
    // Song); no resolver reads it (see src/core/omen.ts resolveOmenFace
    // + the cosmetic-only test). No outcome produces a embertide shard
    // (compile-time guard via RollDieOutcomeEffect's exclusion of
    // ShardGrantEffect). REQ-9f per-encounter cap: handled implicitly —
    // the EffectSpec resolves once per play and the pending surface is
    // cleared on commit so a re-entrant playCard can never double-fire.
    effects: {
      kind: 'roll-die',
      omen: 'song',
      outcomes: {
        // Range 1-2 — +1 gem (economy floor).
        1: { kind: 'gain', green: 1 },
        2: { kind: 'gain', green: 1 },
        // Range 3-4 — draw 1 card.
        3: { kind: 'draw', amount: 1 },
        4: { kind: 'draw', amount: 1 },
        // Range 5-6 — rare-item draw. EffectSpec has no `rare-item`
        // kind, so the schema surface uses a no-op `gain` placeholder
        // and the real effect lives in FOREST_SAGE_OMEN_TABLE[5..6]
        // (routes through applyReward(player, 'premium-item', rng) —
        // symmetric with dungeon-boss face 6).
        5: { kind: 'gain' },
        6: { kind: 'gain' },
      },
    },
    // Omen card: all outcomes yield economy or card advantage (+gem /
    // draw 1 / rare-item). Primarily scales the run's resources over
    // time — classic engine play pattern.
    cardType: 'engine',
  },
  {
    id: 'mountain-king',
    role: 'hero',
    cost: { green: 5 },
    // 487 (2026-04-24): per-kill EffectSpec retired. The per-kill bonus
    // fires from a hardcoded baseId check in slices/combat.ts
    // (`mountainKingBonus`); the EffectSpec was a schema-only shim never
    // read by the dispatcher. Neutral `gain` placeholder keeps the
    // schema valid; card text comes from the baseId branch in
    // effectTextFor (`+1 power per kill`).
    effects: { kind: 'gain' },
    // Generates +1 power per kill — scales economy as monsters fall.
    // Pure resource-scaling engine.
    cardType: 'engine',
  },
  // 2026-04-25 — original designer characters: zone-themed center-row
  // heroes for Dune Sanctum + Gilded Cage. Mechanics are STUB
  // defaults (gain-resource on-play, mid-cost). The user-facing display
  // names live in `src/theme/generic.ts::GENERIC_BASE_ID_THEME` (Avatar
  // of the Fallen / Velrath, Duke of Veils). Tune mechanics in a follow-up
  // pass — these placeholders only ensure the cards load + render.
  {
    id: 'dune-revenant',
    role: 'hero',
    cost: { green: 5 },
    // STUB: gain 2 red + 1 key. Themed around recovering ancient relics.
    effects: { kind: 'gain', red: 2, keys: 1 },
    zone: 'dune-sanctum',
    // Generates power + key on play — resource-scaling engine.
    cardType: 'engine',
  },
  {
    id: 'velrath-duke-of-veils',
    role: 'hero',
    cost: { green: 6 },
    // STUB: gain 3 red — duke of double-dealing, more red-tilted than
    // standard heroes. Tune with designer pass.
    effects: { kind: 'gain', red: 3 },
    zone: 'gilded-cage',
    // Generates a large power burst on play — power-economy engine.
    cardType: 'engine',
  },
  // lhlo.23 §WEAKEN / §VULNERABLE keyword cards. Market heroes —
  // mid-cost control plays whose combat roles exercise the two new
  // keywords. Main-board effect is a minimal gain so the card is
  // never dead outside combat. Combat effects wired via
  // EXPLICIT_OVERRIDES in src/data/combatEffects.ts.
  {
    id: 'curse-charm',
    role: 'hero',
    cost: { green: 4 },
    // Main-board: +1 red (a modest attack prep — the real value is
    // the combat Weaken 2 that saps the boss's next attack).
    effects: { kind: 'gain', red: 1 },
    // Combat Weaken 2 counters the boss's damage output — a specific
    // situational answer. Utility without core damage = tech.
    cardType: 'tech',
  },
  {
    id: 'shadow-veil',
    role: 'hero',
    cost: { green: 4 },
    // Main-board: +1 green (light tempo — the real value is the
    // combat Vulnerable 3 that opens a burst window for teammates).
    effects: { kind: 'gain', green: 1 },
    // Combat Vulnerable 3 amplifies the team's burst window — a
    // tactical answer/multiplier for a specific situation. Tech.
    cardType: 'tech',
  },
];
