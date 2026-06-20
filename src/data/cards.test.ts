import { describe, it, expect } from 'vitest';
import {
  ALWAYS_AVAILABLE,
  CHEST_SUPPLY_CARD_COUNT,
  GRUNT_HEART_METER_IDS,
  HEIRLOOM_DROPS,
  KID_CARDS,
  SUPPLY_CARD_COUNT,
  GILDED_CAGE_REGULARS,
  TEST_SHARD_GRANT_SAMPLE_CARD,
  TOUGH_EMBER_SHARD_IDS,
  baseIdOf,
  buildChestSupply,
  buildSupply,
} from './cards';
import { createSeededRng } from '../rules/chestPool';
import type { Card, CardRole } from '../types/card';

/**
 * IP-regression guard. No card id may contain a substring of the
 * franchise this game was reskinned away from, so a stray legacy id can
 * never creep back in. These are the ORIGINAL terms to keep OUT — this
 * file is excluded from the de-IP codemod (see deip/codemod.mjs SKIP) so
 * the denylist is never itself rewritten into the new world's terms.
 */
const FORBIDDEN_SUBSTRINGS: readonly string[] = [
  'zelda',
  'link',
  'ganon',
  'triforce',
  'hyrule',
  'hylian',
  'kokiri',
  'zora',
  'goron',
  'gerudo',
  'sheikah',
  'lynel',
  'hinox',
  'moblin',
  'octorok',
  'hookshot',
  'rupee',
];

// No card id legitimately contains a forbidden substring anymore.
const EXEMPT_FROM_FRANCHISE_SCRUB: ReadonlySet<string> = new Set<string>([]);

const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function countByRole(cards: readonly Card[]): Record<string, number> {
  return cards.reduce<Record<string, number>>((acc, card) => {
    acc[card.role] = (acc[card.role] ?? 0) + 1;
    return acc;
  }, {});
}

describe('KID_CARDS', () => {
  it('contains between 20 and 128 unique template cards', () => {
    // KID_CARDS is the TEMPLATE set (one copy of each role). The runtime
    // supply duplicates these templates into ~75+ cards — see
    // SUPPLY_CARD_COUNT. Upper bound history:
    //   embertide-57p → 26 (Champions added a 4th starter-home 3→4)
    //   j49z              → 22 (starter-home role retired; 4 entries removed)
    //   u-6a              → 31 (Sylvani: 4 regulars + Craghorn + Broodmaw)
    //   u-6b              → 37 (Emberpeak: 4 regulars + Boulderkin
    //                           + Ashen Tyrant)
    //   u-6c-regulars did NOT add to KID_CARDS (see templeOfTimeRegulars
    //   ambiguity note).
    //   u-6c-bosses       → 40 (Gilded Cage: Sentinel + Silver Chimera
    //                           + Cagewright Vurmox).
    // Generous cap leaves head-room for future additions. v2.1 gm0.15
    // + gm0.16 combined push the count above the old 48 cap (+6 items
    // from gm0.15, +2 wisp variants from gm0.16 at minimum). Raised to
    // 64 as the next round-numbered ceiling.
    // gdd.1 (v2.1): 4 maren regulars + maelstrom + tidewraith = 6 new
    // entries push the count above the prior 64 cap. Upper bound
    // raised to 96 (next round-number ceiling) to leave head-room for
    // gdd.2 (Hollow Shrine) and gdd.3 (Dune Sanctum).
    // lhlo.35 (colosseum-card-registration): 16 new colosseum boss
    // cards (T1 × 2, T2 × 5, T3 × 5, T4 × 4) push count to 100.
    // Upper bound raised to 128 (next round-number ceiling).
    expect(KID_CARDS.length).toBeGreaterThanOrEqual(20);
    expect(KID_CARDS.length).toBeLessThanOrEqual(128);
  });

  it('has unique, kebab-case ids', () => {
    const ids = KID_CARDS.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);

    for (const id of ids) {
      expect(id, `id "${id}" should be kebab-case`).toMatch(KEBAB_CASE);
    }
  });

  it('has the expected role distribution', () => {
    const counts = countByRole(KID_CARDS);

    // 12 heroes (7 v2.0 + 2 v2.1 zone-locked center-row heroes:
    // dune-revenant for dune-sanctum, velrath-duke-of-veils for
    // gilded-cage, added 2026-04-25 + 1 freed-princess re-roled
    // from item to hero per embertide-ajx1 2026-04-26 — crystal-
    // break grant, not in SUPPLY_PLAN + 2 lhlo.23 keyword heroes:
    // curse-charm (weaken) and shadow-veil (vulnerable)).
    expect(counts['hero']).toBe(12);

    // Items total (post-u-9b + fix-aurelia + fix-rainbow-chimera + v2.1
    // gm0.15 + v2.1 gm0.16 wisp variants + v2.1 gm0.17 mane retire +
    // v2.1 embertide-4uyn item-passive expansion + ajx1 2026-04-26
    // freed-princess re-rolled to hero):
    //   - 4 standard items (short-sword, tower-shield, short-bow,
    //     curved-throwing-blade)
    //   - 5 v2.1 gm0.15 supply items (bow, boomerang, elysian-shield,
    //     cinder-bloom, ancient-sword — embertide-9hy)
    //   - 1 wisp (u-1d, amendment A6)
    //   - 2 v2.1 gm0.16 wisp variants (great-wisp, wisp-in-bottle)
    //   - 3 u-9b heirlooms (craghorn-tusk, boulderkin-core, sentinel-eye) —
    //     wild-boss drops, not in SUPPLY_PLAN. silver-chimera-mane was
    //     retired in v2.1 gm0.17 (embertide-0jf).
    //   - 1 rainbow-ancient-chimera-sword (fix-rainbow-chimera 2026-04-22) —
    //     rare post-completion heirloom dropped by Prism Chimera.
    //   - 1 chimera-sword (v2.1 gm0.15 added, v2.1 gm0.17 promoted to
    //     sole Silver Chimera wild-boss drop) — not in SUPPLY_PLAN.
    //   - 2 embertide-91p (b) banish-from-hand items
    //     (blacksmith-forge / ritual-relic) — catalog-only, not in
    //     SUPPLY_PLAN.
    //   - 10 embertide-4uyn item-passive cards (6 Ascension-style
    //     constructs + 4 StS-style event-trigger relics) — drop-only
    //     via chest 'item' reward through CHEST_ITEM_POOL_IDS, NOT in
    //     SUPPLY_PLAN.
    //   = 29 role='item' cards as of ajx1 2026-04-26 (which retired
    //     freed-princess from this column to the hero column).
    //   + 3 embertide-akop item-check opener items (grapplethorn,
    //     grapnels, aegis-pane) — supply items carrying item-tag-*
    //     to break the Tidewraith / Voltwyrm T3 / Sentinel guards.
    //   = 32 role='item' cards total.
    // legendary-sword count (ancient-blade) is unchanged at 1.
    expect(counts['item']).toBe(32);
    expect(counts['legendary-sword']).toBe(1);

    // Monster-tier (post-u-6a + u-6b + u-6c-bosses merge):
    //   - 3 generic monsters (grunt-orc / spear-orc / squidlet)
    //   - 4 sylvani regulars (thorn-scrub / snapvine / jellet / scrabling)
    //   - 4 emberpeak regulars (saurian / ashjaw / skittermite /
    //     red-squidlet)
    //   - 2 existing mini-bosses (mini-boss-reptile / mini-boss-slime)
    //   - Craghorn + Broodmaw (role='mini-boss', bossTier='wild-boss' /
    //     'region-boss')
    //   - Boulderkin + Ashen Tyrant (role='mini-boss', bossTier
    //     'wild-boss' / 'region-boss')
    //   - u-6c-bosses: Sentinel + Silver Chimera (wild-boss) + Demon King
    //     Vurmox (region-boss) — all role='mini-boss'.
    //   - 1 final-boss (legacy dark-lord; Vurmox intentionally uses
    //     role='mini-boss' + bossTier='region-boss' so the final-boss
    //     slot remains pinned at 1 for the v1 endgame contract).
    // Lower bounds used so any future zone-content unit can add
    // additional bosses/regulars additively without churning this test.
    expect(counts['monster']).toBeGreaterThanOrEqual(11);
    expect(counts['mini-boss']).toBeGreaterThanOrEqual(6);
    expect(counts['final-boss']).toBe(1);

    // 3 chests (embertide-tq5 final 3-tier system): chest-std,
    // chest-mid, chest-boss. The retired vy9 enchanted/ancient roles
    // fold into the new chest-mid (Ornate Chest) middle tier.
    expect(counts['chest-std']).toBe(1);
    expect(counts['chest-mid']).toBe(1);
    expect(counts['chest-boss']).toBe(1);
    // Retired vy9 roles must no longer appear in CARD_ROLES.
    expect(counts['chest-enchanted']).toBeUndefined();
    expect(counts['chest-ancient']).toBeUndefined();

    // j49z (2026-04-24): the `starter-home` role was retired and its 4
    // entries (spirit-arrow / seer-rune / warblade / ancient-keepsake)
    // were deleted from KID_CARDS. The role no longer exists in
    // CARD_ROLES — countByRole produces no `starter-home` bucket and
    // any incoming card with that label would be rejected at the type
    // boundary.
    expect(counts['starter-home']).toBeUndefined();
  });

  it('has a final-boss card with metadata.spawnTurn === 8', () => {
    const finalBoss = KID_CARDS.find((c) => c.role === 'final-boss');
    expect(finalBoss).toBeDefined();

    const meta = (finalBoss as { metadata?: { spawnTurn?: number } }).metadata;
    expect(meta).toBeDefined();
    expect(meta?.spawnTurn).toBe(8);
  });

  it('contains no franchise-name substrings in the serialised dataset', () => {
    // Exempt canonical-enemy ids are stripped from the serialised
    // payload before the substring scan so a bare-string match like
    // "hollow-effigy" → "link" doesn't trip the trademark filter. Every
    // OTHER card still has to pass the scan.
    const filtered = KID_CARDS.filter((c) => !EXEMPT_FROM_FRANCHISE_SCRUB.has(c.id));
    const serialised = JSON.stringify(filtered).toLowerCase();
    for (const needle of FORBIDDEN_SUBSTRINGS) {
      expect(serialised.includes(needle), `KID_CARDS data must not contain "${needle}"`).toBe(
        false,
      );
    }
  });

  it('has no franchise-name substrings in any card id', () => {
    for (const card of KID_CARDS) {
      // Exempt canonical-enemy ids (see EXEMPT_FROM_FRANCHISE_SCRUB) —
      // their substring overlap with player-character / trademark
      // tokens is a knowingly-shipped exception, not a leak.
      if (EXEMPT_FROM_FRANCHISE_SCRUB.has(card.id)) continue;
      const id = card.id.toLowerCase();
      for (const needle of FORBIDDEN_SUBSTRINGS) {
        expect(id.includes(needle), `card id "${card.id}" must not contain "${needle}"`).toBe(
          false,
        );
      }
    }
  });

  it('buildSupply returns the Ascension-style supply (excludes chests/starters/final-boss)', () => {
    const rng = createSeededRng(1);
    const supply = buildSupply(rng);
    // Duplication plan (embertide-7c1 + u-6a + u-6b + u-9a):
    //   v1 baseline (43): 7 heroes x3 + 4 items x2 + 1 legendary-sword
    //     + 3 monsters x3 + 2 mini-bosses x2 = 43.
    //   u-6a Sylvani regulars (+12):         4 regulars x3
    //   u-6b Emberpeak regulars (+12): 4 regulars x3
    //   u-9a / REQ-32:                      boss cards removed from supply
    //                                       (7 entries / 12 copies) —
    //                                       they spawn via zone slot
    //                                       selectors.
    //   → total 67. Lower bound used for merge-order resilience.
    expect(supply).toHaveLength(SUPPLY_CARD_COUNT);
    expect(SUPPLY_CARD_COUNT).toBeGreaterThanOrEqual(43);

    // Starter cards, the final-boss, and chest cards must NOT appear in
    // the main supply. (j49z 2026-04-24: `starter-home` role retired —
    // the assertion is kept narrow to the two surviving starter roles.)
    for (const card of supply) {
      expect(card.role).not.toBe('starter-green');
      expect(card.role).not.toBe('starter-red');
      expect(card.role).not.toBe('final-boss');
      expect(card.role.startsWith('chest-')).toBe(false);
    }
  });

  it('buildChestSupply returns 20 chest cards distributed 50% / 35% / 15% across std / mid / boss with unique ids (embertide-tq5)', () => {
    const rng = createSeededRng(1);
    const chestSupply = buildChestSupply(rng);
    expect(chestSupply).toHaveLength(CHEST_SUPPLY_CARD_COUNT);
    // tq5 distribution: 10 std + 7 mid + 3 boss = 20 cards.
    expect(CHEST_SUPPLY_CARD_COUNT).toBe(20);

    const ids = chestSupply.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const card of chestSupply) {
      expect(card.role.startsWith('chest-')).toBe(true);
    }

    const countByBase = chestSupply.reduce<Record<string, number>>((acc, c) => {
      const base = baseIdOf(c);
      acc[base] = (acc[base] ?? 0) + 1;
      return acc;
    }, {});
    expect(countByBase['chest-std']).toBe(10);
    expect(countByBase['chest-mid']).toBe(7);
    expect(countByBase['chest-boss']).toBe(3);
    // Retired vy9 roles must no longer ship in the chest supply.
    expect(countByBase['chest-enchanted']).toBeUndefined();
    expect(countByBase['chest-ancient']).toBeUndefined();
  });

  it('buildChestSupply is deterministic per seed', () => {
    const a = buildChestSupply(createSeededRng(7));
    const b = buildChestSupply(createSeededRng(7));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it('buildSupply assigns unique ids and correct copy counts via baseIdOf', () => {
    const rng = createSeededRng(2);
    const supply = buildSupply(rng);
    const ids = supply.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);

    const countByBase = supply.reduce<Record<string, number>>((acc, c) => {
      const base = baseIdOf(c);
      acc[base] = (acc[base] ?? 0) + 1;
      return acc;
    }, {});

    // Heroes: named-character heroes are unique singletons (embertide-58oo,
    // 2026-04-25) — the center-row field can never show two of the same
    // canonical character. wandering-merchant (Coll, generic shopkeeper
    // archetype) keeps the default ×3 duplication.
    expect(countByBase['sage-keeper']).toBe(1);
    expect(countByBase['water-warrior']).toBe(1);
    expect(countByBase['scholar-princess']).toBe(1);
    expect(countByBase['wandering-merchant']).toBe(3);
    // Items: 2 copies each for the common items.
    expect(countByBase['short-sword']).toBe(2);
    expect(countByBase['tower-shield']).toBe(2);
    // v2.1 gm0.15 (embertide-9hy): 5 new supply items — 4 at the
    // standard ×2 duplication, 1 (ancient-sword) at ×1 to preserve the
    // legendary-tier scarcity beside `ancient-blade`.
    expect(countByBase['bow']).toBe(2);
    expect(countByBase['boomerang']).toBe(2);
    expect(countByBase['elysian-shield']).toBe(2);
    expect(countByBase['cinder-bloom']).toBe(2);
    expect(countByBase['ancient-sword']).toBe(1);
    // Legendary: 1 copy.
    expect(countByBase['ancient-blade']).toBe(1);
    // Monsters: 3 copies each.
    expect(countByBase['grunt-orc']).toBe(3);
    // Mini-bosses: 2 copies each.
    expect(countByBase['mini-boss-reptile']).toBe(2);
    // Chests no longer appear in the main supply (embertide-7c1).
    // embertide-tq5: same exclusion applies to all three tiers.
    expect(countByBase['chest-std']).toBeUndefined();
    expect(countByBase['chest-mid']).toBeUndefined();
    expect(countByBase['chest-boss']).toBeUndefined();
  });

  it('buildSupply duplicate ids retain their role and use a "-N" suffix', () => {
    const rng = createSeededRng(3);
    const supply = buildSupply(rng);
    for (const card of supply) {
      const base = baseIdOf(card);
      if (card.id !== base) {
        // Suffix pattern -2, -3, ...
        expect(card.id).toMatch(/-[2-9]$/);
        // Duplicate inherits the template's role.
        const template = supply.find((c) => c.id === base);
        expect(template?.role).toBe(card.role);
      }
    }
  });

  it('buildSupply is deterministic per seed', () => {
    const a = buildSupply(createSeededRng(42));
    const b = buildSupply(createSeededRng(42));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it('v2.1 REQ-21 / gm0.6: stamps hasAttachedChest only on regular monsters (not heroes/items/mini-bosses)', () => {
    const supply = buildSupply(createSeededRng(123));
    for (const card of supply) {
      if (!card.hasAttachedChest) continue;
      expect(card.role).toBe('monster');
      expect(card.bossTier).toBeUndefined();
    }
  });

  it('v2.1 REQ-21 / gm0.6: hasAttachedChest distribution sits near ~40% of regular monsters and is deterministic per seed', () => {
    const a = buildSupply(createSeededRng(42));
    const b = buildSupply(createSeededRng(42));
    const flaggedA = a.filter((c) => c.hasAttachedChest).map((c) => c.id);
    const flaggedB = b.filter((c) => c.hasAttachedChest).map((c) => c.id);
    expect(flaggedA).toEqual(flaggedB);

    const regulars = a.filter((c) => c.role === 'monster' && c.bossTier === undefined);
    const flagged = regulars.filter((c) => c.hasAttachedChest);
    expect(regulars.length).toBeGreaterThan(0);
    const ratio = flagged.length / regulars.length;
    expect(ratio).toBeGreaterThanOrEqual(0.2);
    expect(ratio).toBeLessThanOrEqual(0.6);
    // gdd.1 (v2.1): adding 4 maren regulars × 3 copies = 12 new
    // monster-supply entries shifts the deterministic 40% sample.
    // gdd.2 (v2.1): adding 4 shadow regulars × 3 copies = 12 more
    // monster-supply entries shifts the deterministic sample again
    // from 18 → 26.
    // gdd.3 (v2.1): adding 4 spirit regulars × 3 copies = 12 more
    // monster-supply entries shifts the deterministic sample from
    // 26 → 34. Pin the new count so the regression remains tight on
    // the per-seed-per-pool flag distribution.
    // 2026-04-25: 2 new zone-locked heroes (dune-revenant +
    // velrath-duke-of-veils) added 6 supply slots that shift the seeded
    // sample by one card (34 → 33).
    // embertide-58oo (2026-04-25): named-character heroes dropped from
    // ×3 to ×1, removing 16 supply slots; deterministic seed lands the
    // monster-supply window on a different stride (33 → 37).
    // embertide-akop (2026-05-26): 3 new supply items × 2 copies = 6
    // added supply slots shift the seeded sample stride again (37 → 35).
    // The ~40% intent is enforced by the ratio bounds above (0.2–0.6,
    // still satisfied); this pin is the per-seed regression-tightness
    // snapshot, expected to move with supply composition.
    expect(flagged.length).toBe(35);
  });

  it("v2.1 gm0.3: plain wisp carries an explicit 'heal' EffectSpec (REQ-13 Phase 2c)", () => {
    const plain = KID_CARDS.find((c) => c.id === 'wisp');
    expect(plain, 'wisp missing from KID_CARDS').toBeDefined();
    expect(plain?.effects.kind).toBe('heal');
    if (plain?.effects.kind === 'heal') {
      expect(plain.effects.target).toBe('team');
      expect(plain.effects.amount).toBe(0);
    }
  });

  it('v2.1 gm0.16: registers great-wisp + wisp-in-bottle as role=item cards with distinct ids', () => {
    const greatFairy = KID_CARDS.find((c) => c.id === 'great-wisp');
    const bottle = KID_CARDS.find((c) => c.id === 'wisp-in-bottle');
    const plain = KID_CARDS.find((c) => c.id === 'wisp');
    expect(greatFairy, 'great-wisp missing from KID_CARDS').toBeDefined();
    expect(bottle, 'wisp-in-bottle missing from KID_CARDS').toBeDefined();
    expect(plain, 'wisp missing from KID_CARDS').toBeDefined();
    // All three are role=item so the existing items-zone equip path
    // handles them without a new role discriminant.
    expect(greatFairy?.role).toBe('item');
    expect(bottle?.role).toBe('item');
    // ppf9.2: migrated from the inert `{kind:'gain'}` placeholder onto
    // `{kind:'heal', target:'team', amount:0}` — the same revive sentinel
    // shape plain wisp carries. The dispatcher (`playFairyOn`) substitutes
    // `target.hpMax` at use time; the heirloom + equip-bonus paths
    // short-circuit on non-matching kinds so the on-equip surface is
    // unchanged.
    expect(greatFairy?.effects.kind).toBe('heal');
    expect(bottle?.effects.kind).toBe('heal');
    if (greatFairy?.effects.kind === 'heal') {
      expect(greatFairy.effects.target).toBe('team');
      expect(greatFairy.effects.amount).toBe(0);
    }
    if (bottle?.effects.kind === 'heal') {
      expect(bottle.effects.target).toBe('team');
      expect(bottle.effects.amount).toBe(0);
    }
    // Distinct baseIds so playerHasFairy + combatEffectFor differentiate
    // them from the plain 'wisp' template.
    expect(greatFairy?.id).not.toBe(plain?.id);
    expect(bottle?.id).not.toBe(plain?.id);
    expect(greatFairy?.id).not.toBe(bottle?.id);
  });

  it('embertide-4t2d (wun Track A): bow declares the equip-bonus EffectSpec with +1 power on-equip', () => {
    const bow = KID_CARDS.find((c) => c.id === 'bow');
    expect(bow, 'bow missing from KID_CARDS').toBeDefined();
    // The migration's locked authoring shape: g4 supply item that grants
    // the equipping player +1 power the moment it slots into the Items
    // zone. Combat behaviour stays sourced from EXPLICIT_OVERRIDES (see
    // src/data/combatEffects.ts → combat-multishot 2 × 2).
    expect(bow?.effects.kind).toBe('equip-bonus');
    if (bow?.effects.kind === 'equip-bonus') {
      expect(bow.effects.resource).toBe('power');
      expect(bow.effects.amount).toBe(1);
      expect(bow.effects.trigger).toBe('on-equip');
    }
  });

  it("embertide-91p (b): registers blacksmith-forge + ritual-relic as role=item cards declaring 'banish-from-hand'", () => {
    const forge = KID_CARDS.find((c) => c.id === 'blacksmith-forge');
    const relic = KID_CARDS.find((c) => c.id === 'ritual-relic');
    expect(forge, 'blacksmith-forge missing from KID_CARDS').toBeDefined();
    expect(relic, 'ritual-relic missing from KID_CARDS').toBeDefined();
    // role=item so the equip / play paths route them through the items
    // zone like any other item-active.
    expect(forge?.role).toBe('item');
    expect(relic?.role).toBe('item');
    // Both declare the banish-from-hand discriminant — playCard's
    // reducer detects this via `effects.kind` and surfaces the
    // CardSelectionModal.
    expect(forge?.effects.kind).toBe('banish-from-hand');
    expect(relic?.effects.kind).toBe('banish-from-hand');
    if (forge?.effects.kind === 'banish-from-hand') {
      expect(forge.effects.amount).toBeGreaterThanOrEqual(1);
    }
    if (relic?.effects.kind === 'banish-from-hand') {
      expect(relic.effects.amount).toBeGreaterThanOrEqual(1);
    }
  });

  it('embertide-ppf9.6: blacksmith-forge and ritual-relic carry distinct Card.passive layers (no longer identical shapes)', () => {
    // ppf9.6 design ruling 2026-04-30 (memory embertide-designer-ruling-
    // ppf9-6-items-2026-04-30): both cards keep banish-from-hand 1 as the on-
    // play active but layer a distinct `Card.passive` so they no longer share
    // an identical effect shape. Forge = sustainability (start-of-turn gem);
    // relic = post-combat draw (on-monster-defeated). Routes through the
    // existing `applyItemPassivesForTrigger` dispatch — no framework changes.
    const forge = KID_CARDS.find((c) => c.id === 'blacksmith-forge');
    const relic = KID_CARDS.find((c) => c.id === 'ritual-relic');
    expect(forge?.passive, 'blacksmith-forge missing Card.passive').toBeDefined();
    expect(relic?.passive, 'ritual-relic missing Card.passive').toBeDefined();
    // Forge: start-of-turn gain green:1.
    expect(forge?.passive?.trigger).toBe('start-of-turn');
    expect(forge?.passive?.effect.kind).toBe('gain');
    if (forge?.passive?.effect.kind === 'gain') {
      expect(forge.passive.effect.green).toBe(1);
    }
    // Relic: on-monster-defeated draw 1.
    expect(relic?.passive?.trigger).toBe('on-monster-defeated');
    expect(relic?.passive?.effect.kind).toBe('draw');
    if (relic?.passive?.effect.kind === 'draw') {
      expect(relic.passive.effect.amount).toBe(1);
    }
    // Distinct triggers OR distinct effect kinds — the load-bearing
    // assertion is that the two cards no longer share an identical
    // (effects, passive) shape pair.
    expect(forge?.passive?.trigger).not.toBe(relic?.passive?.trigger);
  });

  it('embertide-ppf9.6: ancient-blade equip-bonus is power+2 (legendary read distinct from short-sword power+1)', () => {
    // ppf9.6 design ruling 2026-04-30: ancient-blade (g=5, role=legendary-
    // sword) bumped from power+1 to power+2 so the on-equip main-board fire
    // is no longer identical to short-sword (g=3, power+1). Combat-attack
    // damage:5 in EXPLICIT_OVERRIDES and the legacy +2 red per-turn fire in
    // applyItemTrigger are both unchanged. No Card.passive — sword flavour
    // fails the ppf9.1 always-on test.
    const blade = KID_CARDS.find((c) => c.id === 'ancient-blade');
    expect(blade, 'ancient-blade missing from KID_CARDS').toBeDefined();
    expect(blade?.role).toBe('legendary-sword');
    expect(blade?.effects.kind).toBe('equip-bonus');
    if (blade?.effects.kind === 'equip-bonus') {
      expect(blade.effects.resource).toBe('power');
      expect(blade.effects.amount).toBe(2);
      expect(blade.effects.trigger).toBe('on-equip');
    }
    expect(blade?.passive, 'ancient-blade should NOT carry Card.passive').toBeUndefined();
    // Distinct equip-bonus shape from short-sword: same resource+trigger
    // but different amount.
    const shortSword = KID_CARDS.find((c) => c.id === 'short-sword');
    expect(shortSword?.effects.kind).toBe('equip-bonus');
    if (blade?.effects.kind === 'equip-bonus' && shortSword?.effects.kind === 'equip-bonus') {
      expect(blade.effects.amount).not.toBe(shortSword.effects.amount);
    }
  });

  it('embertide-gm0.10 (v2.1 REQ-6): forest-sage declares a roll-die EffectSpec with all six faces authored', () => {
    // gm0.10: forest-sage is the FIRST player-visible roll site in
    // v2.1. The card's `effects` field is a `roll-die` discriminant
    // with a total `outcomes` map keyed 1..6 — the
    // RollDieEffect['outcomes'] type is a total Record<DieFace,
    // RollDieOutcomeEffect>, so a partial map fails tsc. This test
    // mirrors that invariant at runtime so anyone reading the test
    // suite without the type in view sees the same guarantee, AND
    // asserts the per-face outcome shapes the omen dispatcher reads
    // (semantic dispatch lives in FOREST_SAGE_OMEN_TABLE in
    // src/store/gameStore.ts; the EffectSpec surface here is the
    // authoring + balance-test fence).
    const forestSage = KID_CARDS.find((c) => c.id === 'forest-sage');
    expect(forestSage, 'forest-sage missing from KID_CARDS').toBeDefined();
    expect(forestSage?.role).toBe('hero');
    expect(forestSage?.effects.kind).toBe('roll-die');
    if (forestSage?.effects.kind !== 'roll-die') return;
    const { outcomes } = forestSage.effects;
    // Total map fence — every face 1..6 must be present and carry a
    // discriminant kind (the type already enforces this; the runtime
    // assertion is belt-and-suspenders against `as any` authoring
    // routes).
    for (const face of [1, 2, 3, 4, 5, 6] as const) {
      expect(outcomes[face]).toBeDefined();
      expect(typeof outcomes[face].kind).toBe('string');
    }
    // No outcome may carry a embertide shard (REQ-14 denylist + REQ-7b
    // greedy-shard simulation invariant — forest-sage's omen is
    // explicitly cut from any shard-acquisition path).
    for (const face of [1, 2, 3, 4, 5, 6] as const) {
      expect(outcomes[face].kind).not.toBe('shard-grant');
    }
  });

  it('has chest pool weights that sum to 100 for every chest card', () => {
    const chestRoles: readonly CardRole[] = ['chest-std', 'chest-mid', 'chest-boss'];

    for (const role of chestRoles) {
      const chest = KID_CARDS.find((c) => c.role === role) as
        | (Card & {
            pool?: { weights?: ReadonlyArray<{ reward: string; weight: number }> };
          })
        | undefined;

      expect(chest, `missing chest card with role="${role}"`).toBeDefined();
      expect(chest?.pool).toBeDefined();
      expect(Array.isArray(chest?.pool?.weights)).toBe(true);

      const weights = chest?.pool?.weights ?? [];
      expect(weights.length).toBeGreaterThan(0);

      const total = weights.reduce((sum, w) => sum + w.weight, 0);
      expect(total, `pool weights for "${chest?.id}" must sum to 100`).toBe(100);
    }
  });
});

// ---------------------------------------------------------------------------
// v2.1 gm0.17 (embertide-0jf) — ember-shard drop tier constants.
// Validates that every id in GRUNT_HEART_METER_IDS / TOUGH_EMBER_SHARD_IDS
// resolves to an actual KID_CARDS entry and that the two sets are
// disjoint (see `applyHeartDropHooks` precedence contract).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// REQ-13 Phase 2d (gm0.4) — `shard-grant` EffectSpec discriminant. The
// sample card declares a single 'wisdom' grant; tests assert the schema
// shape, registry isolation (NOT in KID_CARDS / supply / chest pools),
// and that the discriminant value matches the shared `'shard-grant'`
// literal already used by `CombatOnDefeatShardGrant` so the existing
// rerollTokens denylist (`outcomeProducesShard`) catches both shapes.
// ---------------------------------------------------------------------------

describe('TEST_SHARD_GRANT_SAMPLE_CARD (REQ-13 Phase 2d / gm0.4)', () => {
  it('declares the shard-grant EffectSpec discriminant with a non-empty shards array', () => {
    expect(TEST_SHARD_GRANT_SAMPLE_CARD.effects.kind).toBe('shard-grant');
    if (TEST_SHARD_GRANT_SAMPLE_CARD.effects.kind !== 'shard-grant') {
      throw new Error('expected shard-grant effects');
    }
    expect(TEST_SHARD_GRANT_SAMPLE_CARD.effects.shards.length).toBeGreaterThan(0);
    // Every shard id must be one of the three canonical Embertide pieces.
    for (const shard of TEST_SHARD_GRANT_SAMPLE_CARD.effects.shards) {
      expect(['wisdom', 'courage', 'power']).toContain(shard);
    }
  });

  it('does NOT leak into KID_CARDS (test-only fixture, mirrors TEST_PASSIVE / ROLL_DIE samples)', () => {
    expect(KID_CARDS.find((c) => c.id === TEST_SHARD_GRANT_SAMPLE_CARD.id)).toBeUndefined();
  });

  it('uses the same kind literal as CombatOnDefeatShardGrant ("shard-grant") so the rerollTokens denylist catches it', () => {
    // The denylist (`outcomeProducesShard` in src/store/gameStore.ts)
    // matches `outcome.kind === 'shard-grant'` literally; aligning the
    // EffectSpec discriminant on the same string keeps the runtime
    // denylist effective without widening.
    expect(TEST_SHARD_GRANT_SAMPLE_CARD.effects.kind).toBe('shard-grant');
  });
});

describe('ember-shard drop tier constants (v2.1 gm0.17)', () => {
  // Gilded-cage regulars (`bubble`, `wardeye`, `bone-knight`,
  // `gulpmaw`, `hexrobe`) live in `GILDED_CAGE_REGULARS`, NOT in
  // `KID_CARDS` — they're accessed through `ZONE_METADATA` rather than
  // the market supply. z9xq added `wild-wolf` to GRUNT_HEART_METER_IDS;
  // wild-wolf lives in `ALWAYS_AVAILABLE`, NOT KID_CARDS. The validation
  // below unions all three sources when resolving allowlist ids.
  const ALL_MONSTER_CARDS = [...KID_CARDS, ...GILDED_CAGE_REGULARS, ...ALWAYS_AVAILABLE];

  it('every GRUNT_HEART_METER_IDS entry resolves to a real monster card', () => {
    for (const id of GRUNT_HEART_METER_IDS) {
      const card = ALL_MONSTER_CARDS.find((c) => c.id === id);
      expect(card, `GRUNT_HEART_METER_IDS has unknown id "${id}"`).toBeDefined();
    }
  });

  it('every TOUGH_EMBER_SHARD_IDS entry resolves to a real monster card', () => {
    for (const id of TOUGH_EMBER_SHARD_IDS) {
      const card = ALL_MONSTER_CARDS.find((c) => c.id === id);
      expect(card, `TOUGH_EMBER_SHARD_IDS has unknown id "${id}"`).toBeDefined();
    }
  });

  it('GRUNT and TOUGH id sets are disjoint (grunt-precedence would otherwise hide kills)', () => {
    for (const id of GRUNT_HEART_METER_IDS) {
      expect(TOUGH_EMBER_SHARD_IDS.has(id), `id "${id}" appears in both GRUNT and TOUGH sets`).toBe(
        false,
      );
    }
  });

  it('every TOUGH / GRUNT entry is role=monster (drops fire only on defeated monsters)', () => {
    const allIds = [...GRUNT_HEART_METER_IDS, ...TOUGH_EMBER_SHARD_IDS];
    for (const id of allIds) {
      const card = ALL_MONSTER_CARDS.find((c) => c.id === id);
      expect(card?.role, `id "${id}" must be role=monster`).toBe('monster');
    }
  });
});

// ---------------------------------------------------------------------------
// r94e — monster defeat-drop variety (gems / cardDraw beyond hearts).
//
// Lock the four+ tuned drop tiers so the v2.1 monster economy stays
// recognizable across future balance passes:
//  - generic regulars (thorn-scrub / jellet): +1 heart + +1 gem
//  - tougher regular  (ashjaw)            : +2 hearts + +1 gem
//  - mini-boss        (mini-boss-slime)    : +2 hearts + +2 gems
//  - wild boss        (craghorn)              : +3 hearts + cardDraw 1
//  - wild boss        (boulderkin)        : +2 hearts + +2 gems + cardDraw 1
//
// Region-boss `shard-grant` flow (gm0.4) is asserted intact alongside —
// region-boss kills still land their shards via the
// `CombatOnDefeatShardGrant` payload on `BossAttackPattern`, NOT via
// `monster-drop`, and ashen-tyrant / broodmaw / cagewright-vurmox must
// continue to ship `monster-drop` (no shards leaking into the loot
// table).
// ---------------------------------------------------------------------------

describe('r94e — monster-drop defeat-variety (gems + cardDraw)', () => {
  function dropOf(id: string): {
    readonly hearts: number;
    readonly keys?: number;
    readonly gems?: number;
    readonly cardDraw?: number;
  } {
    const card = KID_CARDS.find((c) => c.id === id);
    if (!card) throw new Error(`r94e: missing card ${id}`);
    if (card.effects.kind !== 'monster-drop') {
      throw new Error(`r94e: ${id} is not a monster-drop, got ${card.effects.kind}`);
    }
    return card.effects;
  }

  it('thorn-scrub (generic regular) ships +1 heart + 1 gem', () => {
    const drop = dropOf('thorn-scrub');
    expect(drop.hearts).toBe(1);
    expect(drop.gems).toBe(1);
    expect(drop.cardDraw).toBeUndefined();
  });

  it('jellet (generic regular) ships +1 heart + 1 gem', () => {
    const drop = dropOf('jellet');
    expect(drop.hearts).toBe(1);
    expect(drop.gems).toBe(1);
  });

  it('ashjaw (tougher regular) ships +2 hearts + 1 gem', () => {
    const drop = dropOf('ashjaw');
    expect(drop.hearts).toBe(2);
    expect(drop.gems).toBe(1);
  });

  it('mini-boss-slime ships +2 hearts + 2 gems', () => {
    const drop = dropOf('mini-boss-slime');
    expect(drop.hearts).toBe(2);
    expect(drop.gems).toBe(2);
  });

  it('craghorn (wild boss) ships +3 hearts + cardDraw 1', () => {
    const drop = dropOf('craghorn');
    expect(drop.hearts).toBe(3);
    expect(drop.cardDraw).toBe(1);
    // Wild bosses never grant shards via monster-drop — those flow
    // through the dedicated CombatOnDefeatShardGrant payload (gm0.4).
    expect(drop.gems).toBeUndefined();
  });

  it('boulderkin (wild boss) ships +2 hearts + 2 gems + cardDraw 1', () => {
    const drop = dropOf('boulderkin');
    expect(drop.hearts).toBe(2);
    expect(drop.gems).toBe(2);
    expect(drop.cardDraw).toBe(1);
  });

  it('region-boss shard-grant flow is intact — region bosses do NOT carry monster-drop gems/cardDraw/keys', () => {
    // Region bosses (broodmaw / ashen-tyrant / cagewright-vurmox) ship
    // their shards via CombatOnDefeatShardGrant payloads in
    // BossAttackPattern, not via monster-drop. Their monster-drop
    // payload stays a clean hearts-only heal so the r94e loot
    // extension does NOT bleed into the shard path.
    const regionBossIds = ['broodmaw', 'ashen-tyrant', 'cagewright-vurmox'];
    for (const id of regionBossIds) {
      const drop = dropOf(id);
      expect(drop.gems).toBeUndefined();
      expect(drop.cardDraw).toBeUndefined();
      expect(drop.hearts).toBeGreaterThanOrEqual(1);
    }
  });

  it('at least 4 monster cards declare gems or cardDraw drops (variety floor)', () => {
    const tunedCount = KID_CARDS.filter((c) => {
      if (c.effects.kind !== 'monster-drop') return false;
      const drop = c.effects;
      return (drop.gems ?? 0) > 0 || (drop.cardDraw ?? 0) > 0;
    }).length;
    expect(tunedCount).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// embertide-4uyn — chest-pool item-passive variety expansion.
//
// Lock the new item-passive roster + the CHEST_ITEM_POOL_IDS allowlist
// shape so the chest-mid 'item' reward (15% weight) and chest-std 'item'
// reward (15% weight) draw from a curated pool. The legacy
// pickNonLegendaryItem broadcast over EVERY role='item' card; the
// allowlist fixes that leak (heirlooms / freed-princess / banish-from-
// hand catalog items can no longer drop from generic 'item' rewards) and
// makes the pool's authoring intent explicit.
// ---------------------------------------------------------------------------

import { CHEST_ITEM_POOL_IDS } from './cards';

describe('embertide-4uyn — item-passive roster + chest pool allowlist', () => {
  const FOUR_UYN_CONSTRUCTS = [
    'forge-of-power',
    'well-of-vitality',
    'merchants-charm',
    'scholars-tome',
    'sylvani-talisman',
    'iron-ward',
  ] as const;

  const FOUR_UYN_RELICS = [
    'bandits-cache',
    'bloodlust-pendant',
    'valor-pendant',
    'surge-totem',
  ] as const;

  it('registers all 6 Ascension-style construct passives (start-of-turn / on-combat-enter / on-damage)', () => {
    for (const id of FOUR_UYN_CONSTRUCTS) {
      const card = KID_CARDS.find((c) => c.id === id);
      expect(card, `construct "${id}" missing from KID_CARDS`).toBeDefined();
      expect(card?.role).toBe('item');
      expect(card?.itemKind).toBe('item-passive');
      expect(card?.effects.kind).toBe('item-passive');
    }
  });

  it('registers all 4 StS-style event-trigger relic passives', () => {
    for (const id of FOUR_UYN_RELICS) {
      const card = KID_CARDS.find((c) => c.id === id);
      expect(card, `relic "${id}" missing from KID_CARDS`).toBeDefined();
      expect(card?.role).toBe('item');
      expect(card?.itemKind).toBe('item-passive');
      expect(card?.effects.kind).toBe('item-passive');
    }
  });

  it('every 4uyn card declares a non-empty description and a valid trigger', () => {
    const allIds = [...FOUR_UYN_CONSTRUCTS, ...FOUR_UYN_RELICS];
    const validTriggers = new Set([
      'start-of-turn',
      'on-combat-enter',
      'on-damage',
      'on-monster-defeated',
    ]);
    for (const id of allIds) {
      const card = KID_CARDS.find((c) => c.id === id);
      if (!card || card.effects.kind !== 'item-passive') {
        throw new Error(`expected item-passive on ${id}`);
      }
      expect(card.effects.description.length).toBeGreaterThan(0);
      expect(validTriggers.has(card.effects.trigger)).toBe(true);
    }
  });

  it('every 4uyn card carries no cooldownTurns / lastUsedTurn (passives never activate manually)', () => {
    const allIds = [...FOUR_UYN_CONSTRUCTS, ...FOUR_UYN_RELICS];
    for (const id of allIds) {
      const card = KID_CARDS.find((c) => c.id === id);
      expect(card?.cooldownTurns).toBeUndefined();
      expect(card?.lastUsedTurn).toBeUndefined();
    }
  });

  it('mix of triggers across the 10 cards: 4 start-of-turn, 3 on-combat-enter, 1 on-damage, 2 on-monster-defeated', () => {
    const allIds = [...FOUR_UYN_CONSTRUCTS, ...FOUR_UYN_RELICS];
    const counts: Record<string, number> = {};
    for (const id of allIds) {
      const card = KID_CARDS.find((c) => c.id === id);
      if (card?.effects.kind !== 'item-passive') continue;
      counts[card.effects.trigger] = (counts[card.effects.trigger] ?? 0) + 1;
    }
    // 4 SoT (forge-of-power, well-of-vitality, merchants-charm, scholars-tome).
    expect(counts['start-of-turn']).toBe(4);
    // 3 on-combat-enter (sylvani-talisman, valor-pendant, surge-totem).
    expect(counts['on-combat-enter']).toBe(3);
    // 1 on-damage (iron-ward).
    expect(counts['on-damage']).toBe(1);
    // 2 on-monster-defeated (bandits-cache, bloodlust-pendant).
    expect(counts['on-monster-defeated']).toBe(2);
  });

  it('CHEST_ITEM_POOL_IDS allowlist contains every 4uyn passive id', () => {
    const allIds = [...FOUR_UYN_CONSTRUCTS, ...FOUR_UYN_RELICS];
    for (const id of allIds) {
      expect(CHEST_ITEM_POOL_IDS.has(id), `${id} missing from CHEST_ITEM_POOL_IDS`).toBe(true);
    }
  });

  it('CHEST_ITEM_POOL_IDS allowlist contains every v2.0/v2.1 supply item (chest preserves buyable-item drops)', () => {
    const supplyItemIds = [
      'short-sword',
      'tower-shield',
      'short-bow',
      'curved-throwing-blade',
      'bow',
      'boomerang',
      'elysian-shield',
      'cinder-bloom',
      'ancient-sword',
    ];
    for (const id of supplyItemIds) {
      expect(CHEST_ITEM_POOL_IDS.has(id), `${id} missing from CHEST_ITEM_POOL_IDS`).toBe(true);
    }
  });

  it('CHEST_ITEM_POOL_IDS excludes drop-only items (fairies / heirlooms / freed-princess / banish catalog / legendary)', () => {
    const dropOnlyIds = [
      // Wisp variants — own dedicated 'wisp' chest reward path.
      'wisp',
      'great-wisp',
      'wisp-in-bottle',
      // Boss-chest seers-omen — own dedicated 'seers-omen' reward path.
      'seers-omen',
      // Wild-boss heirlooms — drop on wild-boss defeat, never via chest.
      'craghorn-tusk',
      'boulderkin-core',
      'sentinel-eye',
      'chimera-sword',
      'rainbow-ancient-chimera-sword',
      // Crystal-break grant.
      'freed-princess',
      // Catalog-only banish items.
      'blacksmith-forge',
      'ritual-relic',
      // Legendary — routed through 'premium-item' reward path.
      'ancient-blade',
    ];
    for (const id of dropOnlyIds) {
      expect(CHEST_ITEM_POOL_IDS.has(id), `${id} should NOT be in CHEST_ITEM_POOL_IDS`).toBe(false);
    }
  });

  it('CHEST_ITEM_POOL_IDS only contains ids that resolve to a real role=item card in KID_CARDS', () => {
    for (const id of CHEST_ITEM_POOL_IDS) {
      const card = KID_CARDS.find((c) => c.id === id);
      expect(card, `CHEST_ITEM_POOL_IDS has unknown id "${id}"`).toBeDefined();
      expect(card?.role).toBe('item');
    }
  });

  it('NONE of the 4uyn cards appear in SUPPLY_PLAN (drop-only)', () => {
    const allIds = new Set<string>([...FOUR_UYN_CONSTRUCTS, ...FOUR_UYN_RELICS]);
    const supply = buildSupply(createSeededRng(99));
    for (const card of supply) {
      expect(allIds.has(baseIdOf(card)), `${card.id} should not appear in market supply`).toBe(
        false,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// embertide-bq9b / ppf9-7a — heirloom combatEffect schema invariant.
//
// The five u-9b heirloom items declare their in-combat behaviour in-card
// via `Card.combatEffect` rather than the `EXPLICIT_OVERRIDES` map in
// `src/data/combatEffects.ts`. Lock the invariant so future heirloom
// additions don't silently regress to the keyed-override authoring shape.
// ---------------------------------------------------------------------------

describe('heirloom combatEffect declarations (embertide-bq9b)', () => {
  it('every heirloom declares an in-card Card.combatEffect', () => {
    const heirloomIds = Object.values(HEIRLOOM_DROPS);
    expect(heirloomIds.length).toBeGreaterThan(0);
    for (const heirloomId of heirloomIds) {
      const card = KID_CARDS.find((c) => c.id === heirloomId);
      expect(card, `heirloom "${heirloomId}" missing from KID_CARDS`).toBeDefined();
      expect(
        card?.combatEffect,
        `heirloom "${heirloomId}" must declare Card.combatEffect (in-card)`,
      ).toBeDefined();
    }
  });
});
