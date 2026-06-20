import { describe, expect, it } from 'vitest';
import {
  ALWAYS_AVAILABLE,
  HEIRLOOM_DROPS,
  KID_CARDS,
  GILDED_CAGE_REGULARS,
  buildSupply,
} from './cards';
import { combatEffectFor } from './combatEffects';
import type { Card } from '../types/card';
import type { CombatEffectKind } from '../types/combatEffect';
import { createSeededRng } from '../rules/chestPool';

/**
 * Full v2.0 card universe for the iteration contract. `combatEffectFor`
 * must resolve every one of these without throwing and without returning
 * `undefined`.
 */
const CARD_UNIVERSE: readonly Card[] = [
  ...KID_CARDS,
  ...ALWAYS_AVAILABLE,
  ...GILDED_CAGE_REGULARS,
];

const VALID_KINDS: readonly CombatEffectKind[] = [
  'combat-attack',
  'combat-absorb',
  'combat-heal',
  'combat-draw',
  'combat-multishot',
  'combat-attack-stun',
  'combat-weaken',
  'combat-vulnerable',
];

function findCard(id: string): Card {
  const hit = CARD_UNIVERSE.find((c) => c.id === id);
  if (!hit) {
    throw new Error(`Test setup error: card "${id}" not found in universe`);
  }
  return hit;
}

describe('combatEffectFor', () => {
  it('resolves a valid CombatEffect for every card in the game universe', () => {
    expect(CARD_UNIVERSE.length).toBeGreaterThan(0);

    for (const card of CARD_UNIVERSE) {
      const effect = combatEffectFor(card);
      expect(effect, `card "${card.id}" returned undefined`).toBeDefined();
      expect(VALID_KINDS, `card "${card.id}" returned unknown kind "${effect.kind}"`).toContain(
        effect.kind,
      );
    }
  });

  it('never throws for any card in the universe', () => {
    for (const card of CARD_UNIVERSE) {
      expect(() => combatEffectFor(card)).not.toThrow();
    }
  });

  it('provides at least one shield-like and one heal-like explicit override', () => {
    const towerShield = findCard('tower-shield');
    const shieldEffect = combatEffectFor(towerShield);
    expect(shieldEffect.kind).toBe('combat-absorb');
    if (shieldEffect.kind === 'combat-absorb') {
      expect(shieldEffect.hp).toBeGreaterThan(0);
    }

    const wisp = findCard('wisp');
    const wispEffect = combatEffectFor(wisp);
    expect(wispEffect.kind).toBe('combat-heal');
    if (wispEffect.kind === 'combat-heal') {
      expect(wispEffect.amount).toBeGreaterThan(0);
    }
  });

  it('v2.1 gm0.16: great-wisp resolves to combat-heal amount:5 (enhanced vs plain wisp)', () => {
    const greatWisp = findCard('great-wisp');
    const effect = combatEffectFor(greatWisp);
    expect(effect.kind).toBe('combat-heal');
    if (effect.kind === 'combat-heal') {
      expect(effect.amount).toBe(5);
    }
  });

  it('v2.1 gm0.16: wisp-in-bottle resolves to combat-heal amount:3 (same as plain wisp)', () => {
    const bottle = findCard('wisp-in-bottle');
    const effect = combatEffectFor(bottle);
    expect(effect.kind).toBe('combat-heal');
    if (effect.kind === 'combat-heal') {
      expect(effect.amount).toBe(3);
    }
  });

  it('falls back to combat-attack with damage = cost.red for non-overridden cards', () => {
    // Scrabling has cost.red = 5 — the default branch reads from cost.red.
    const scrabling = findCard('scrabling');
    const scrablingEffect = combatEffectFor(scrabling);
    expect(scrablingEffect.kind).toBe('combat-attack');
    if (scrablingEffect.kind === 'combat-attack') {
      expect(scrablingEffect.damage).toBe(5);
    }

    // Monsters (like grunt-orc, cost.red=3) remain non-overridden — the
    // embertide-2gp pass intentionally only overrides market cards
    // that can land in the combat deck. Main-board monsters are never
    // drawn into combatHand so their default combat-attack value is only
    // ever exercised via fallthrough/fixture paths.
    const gruntOrc = findCard('grunt-orc');
    const gruntEffect = combatEffectFor(gruntOrc);
    expect(gruntEffect.kind).toBe('combat-attack');
    if (gruntEffect.kind === 'combat-attack') {
      expect(gruntEffect.damage).toBe(3);
    }
  });
});

describe('combatEffectFor — embertide-2gp market overrides', () => {
  it('sage-keeper resolves to combat-absorb hp 3', () => {
    const effect = combatEffectFor(findCard('sage-keeper'));
    expect(effect.kind).toBe('combat-absorb');
    if (effect.kind === 'combat-absorb') expect(effect.hp).toBe(3);
  });

  it('water-warrior resolves to combat-attack damage 3', () => {
    const effect = combatEffectFor(findCard('water-warrior'));
    expect(effect.kind).toBe('combat-attack');
    if (effect.kind === 'combat-attack') expect(effect.damage).toBe(3);
  });

  it('scholar-princess resolves to combat-draw count 2', () => {
    const effect = combatEffectFor(findCard('scholar-princess'));
    expect(effect.kind).toBe('combat-draw');
    if (effect.kind === 'combat-draw') expect(effect.count).toBe(2);
  });

  it('wandering-merchant resolves to combat-attack damage 2', () => {
    const effect = combatEffectFor(findCard('wandering-merchant'));
    expect(effect.kind).toBe('combat-attack');
    if (effect.kind === 'combat-attack') expect(effect.damage).toBe(2);
  });

  it('ranch-keeper resolves to combat-heal amount 3', () => {
    const effect = combatEffectFor(findCard('ranch-keeper'));
    expect(effect.kind).toBe('combat-heal');
    if (effect.kind === 'combat-heal') expect(effect.amount).toBe(3);
  });

  it('forest-sage resolves to combat-multishot damage 2 × 2 shots', () => {
    const effect = combatEffectFor(findCard('forest-sage'));
    expect(effect.kind).toBe('combat-multishot');
    if (effect.kind === 'combat-multishot') {
      expect(effect.damage).toBe(2);
      expect(effect.shots).toBe(2);
    }
  });

  it('mountain-king resolves to combat-attack-stun damage 2 + stun 1', () => {
    const effect = combatEffectFor(findCard('mountain-king'));
    expect(effect.kind).toBe('combat-attack-stun');
    if (effect.kind === 'combat-attack-stun') {
      expect(effect.damage).toBe(2);
      expect(effect.stunTurns).toBe(1);
    }
  });

  it('mystic resolves to combat-absorb hp 2', () => {
    const effect = combatEffectFor(findCard('mystic'));
    expect(effect.kind).toBe('combat-absorb');
    if (effect.kind === 'combat-absorb') expect(effect.hp).toBe(2);
  });

  it('militia-grunt resolves to combat-attack damage 2', () => {
    const effect = combatEffectFor(findCard('militia-grunt'));
    expect(effect.kind).toBe('combat-attack');
    if (effect.kind === 'combat-attack') expect(effect.damage).toBe(2);
  });

  it('short-sword resolves to combat-attack damage 2', () => {
    const effect = combatEffectFor(findCard('short-sword'));
    expect(effect.kind).toBe('combat-attack');
    if (effect.kind === 'combat-attack') expect(effect.damage).toBe(2);
  });

  it('short-bow resolves to combat-multishot damage 1 × 3 shots', () => {
    const effect = combatEffectFor(findCard('short-bow'));
    expect(effect.kind).toBe('combat-multishot');
    if (effect.kind === 'combat-multishot') {
      expect(effect.damage).toBe(1);
      expect(effect.shots).toBe(3);
    }
  });

  it('curved-throwing-blade resolves to combat-attack-stun damage 2 + stun 1', () => {
    const effect = combatEffectFor(findCard('curved-throwing-blade'));
    expect(effect.kind).toBe('combat-attack-stun');
    if (effect.kind === 'combat-attack-stun') {
      expect(effect.damage).toBe(2);
      expect(effect.stunTurns).toBe(1);
    }
  });

  it('ancient-blade resolves to combat-attack damage 5', () => {
    const effect = combatEffectFor(findCard('ancient-blade'));
    expect(effect.kind).toBe('combat-attack');
    if (effect.kind === 'combat-attack') expect(effect.damage).toBe(5);
  });

  it('every market hero role (heroes + always-available) has a non-default override', () => {
    // Each hero a player can acquire through the market or the always-
    // available row should return something other than the default
    // combat-attack damage=1 fallback — the whole point of this pass.
    const marketHeroIds = [
      'sage-keeper',
      'water-warrior',
      'scholar-princess',
      'wandering-merchant',
      'ranch-keeper',
      'forest-sage',
      'mountain-king',
      'mystic',
      'militia-grunt',
    ];
    for (const id of marketHeroIds) {
      const effect = combatEffectFor(findCard(id));
      // Fail if a market hero resolves to the filler default:
      //   combat-attack damage=1 (cost.red absent).
      const isFillerDefault = effect.kind === 'combat-attack' && effect.damage === 1;
      expect(
        isFillerDefault,
        `market hero "${id}" resolves to filler default combat-attack 1 — needs an override`,
      ).toBe(false);
    }
  });
});

/**
 * u-9b / REQ-32 heirloom wiring. Each heirloom has an explicit
 * `EXPLICIT_OVERRIDES` entry in src/data/combatEffects.ts; these tests
 * lock the shape of each resolver in isolation so future balance passes
 * can't silently drop or alter the effect.
 */
describe('combatEffectFor — u-9b heirlooms', () => {
  it('resolves craghorn-tusk to combat-attack-stun (damage 4, stunTurns 1)', () => {
    const card = findCard('craghorn-tusk');
    const effect = combatEffectFor(card);
    expect(effect.kind).toBe('combat-attack-stun');
    if (effect.kind === 'combat-attack-stun') {
      expect(effect.damage).toBe(4);
      expect(effect.stunTurns).toBe(1);
    }
  });

  it('resolves boulderkin-core to combat-absorb (hp 4)', () => {
    const card = findCard('boulderkin-core');
    const effect = combatEffectFor(card);
    expect(effect.kind).toBe('combat-absorb');
    if (effect.kind === 'combat-absorb') {
      expect(effect.hp).toBe(4);
    }
  });

  it('resolves sentinel-eye to combat-attack (damage 6)', () => {
    const card = findCard('sentinel-eye');
    const effect = combatEffectFor(card);
    expect(effect.kind).toBe('combat-attack');
    if (effect.kind === 'combat-attack') {
      expect(effect.damage).toBe(6);
    }
  });

  it('resolves rainbow-ancient-chimera-sword to combat-attack (damage 8) — embertide-044', () => {
    const card = findCard('rainbow-ancient-chimera-sword');
    const effect = combatEffectFor(card);
    expect(effect.kind).toBe('combat-attack');
    if (effect.kind === 'combat-attack') {
      expect(effect.damage).toBe(8);
    }
  });

  it('HEIRLOOM_DROPS maps the 5 wild-boss ids to the right heirlooms (4 core + golden-rainbow)', () => {
    expect(HEIRLOOM_DROPS).toEqual({
      craghorn: 'craghorn-tusk',
      'boulderkin': 'boulderkin-core',
      sentinel: 'sentinel-eye',
      // v2.1 gm0.17 (embertide-0jf): Silver Chimera now drops
      // `chimera-sword` as its sole wild-boss heirloom (retiring
      // `silver-chimera-mane`).
      'silver-chimera': 'chimera-sword',
      // embertide-044 (2026-04-24): rare post-completion heirloom.
      'prism-chimera': 'rainbow-ancient-chimera-sword',
    });
  });

  it('every HEIRLOOM_DROPS value exists in KID_CARDS', () => {
    for (const heirloomId of Object.values(HEIRLOOM_DROPS)) {
      const hit = KID_CARDS.find((c) => c.id === heirloomId);
      expect(hit, `heirloom "${heirloomId}" missing from KID_CARDS`).toBeDefined();
    }
  });

  it('every heirloom is role=item + itemKind=item-active', () => {
    for (const heirloomId of Object.values(HEIRLOOM_DROPS)) {
      const card = findCard(heirloomId);
      expect(card.role).toBe('item');
      expect(card.itemKind).toBe('item-active');
    }
  });

  it('starter-green-shard resolves to combat-draw 1 (rev-2 2026-04-22)', () => {
    // Starter cards live in src/store/slices/deck.ts (not KID_CARDS),
    // so we look up via combatEffectFor directly from a minted copy.
    // Designer playtest 2026-04-22 (rev-2) re-included gem-generator
    // starters in the combat deck with distinct combat effects so they
    // aren't inert filler. See combatEngine.isCombatEligibleStarterRole.
    const greenShard: Card = {
      id: 'starter-green-shard',
      role: 'starter-green',
      cost: {},
      effects: { kind: 'shard', green: 1 },
    };
    const effect = combatEffectFor(greenShard);
    expect(effect.kind).toBe('combat-draw');
    if (effect.kind === 'combat-draw') {
      expect(effect.count).toBe(1);
    }
  });

  it('starter-red-shard resolves to combat-attack damage 2 (rev-2 2026-04-22)', () => {
    const redShard: Card = {
      id: 'starter-red-shard',
      role: 'starter-red',
      cost: {},
      effects: { kind: 'shard', red: 1 },
    };
    const effect = combatEffectFor(redShard);
    expect(effect.kind).toBe('combat-attack');
    if (effect.kind === 'combat-attack') {
      // Damage 2 is one step above the 1-damage default so drawing
      // red feels like a clean swing relative to generic fallback.
      expect(effect.damage).toBe(2);
    }
  });

  it('no heirloom id appears in the market supply (SUPPLY_PLAN)', () => {
    const rng = createSeededRng(42);
    const supply = buildSupply(rng);
    const supplyIds = new Set(
      supply.map((c) => {
        const withBase = c as Card & { readonly baseId?: string };
        return withBase.baseId ?? c.id;
      }),
    );
    for (const heirloomId of Object.values(HEIRLOOM_DROPS)) {
      expect(
        supplyIds.has(heirloomId),
        `heirloom "${heirloomId}" must not appear in SUPPLY_PLAN`,
      ).toBe(false);
    }
  });
});

/**
 * v2.1 gm0.15 (embertide-9hy): six new weapon/tool item overrides.
 * Each lock the shape of the in-combat effect so future balance passes
 * can't silently alter the card's combat behaviour.
 *
 * Five are supply items (bow, boomerang, elysian-shield, cinder-bloom,
 * ancient-sword); the sixth (chimera-sword) is a silver-chimera wild-boss
 * heirloom (sole drop per v2.1 gm0.17 retiring `silver-chimera-mane`).
 */
describe('combatEffectFor — v2.1 gm0.15 new items (embertide-9hy)', () => {
  it('bow resolves to combat-multishot damage 2 × 2 shots', () => {
    const effect = combatEffectFor(findCard('bow'));
    expect(effect.kind).toBe('combat-multishot');
    if (effect.kind === 'combat-multishot') {
      expect(effect.damage).toBe(2);
      expect(effect.shots).toBe(2);
    }
  });

  it('boomerang resolves to combat-attack-stun damage 2 + stun 1', () => {
    const effect = combatEffectFor(findCard('boomerang'));
    expect(effect.kind).toBe('combat-attack-stun');
    if (effect.kind === 'combat-attack-stun') {
      expect(effect.damage).toBe(2);
      expect(effect.stunTurns).toBe(1);
    }
  });

  it('elysian-shield resolves to combat-absorb hp 4', () => {
    const effect = combatEffectFor(findCard('elysian-shield'));
    expect(effect.kind).toBe('combat-absorb');
    if (effect.kind === 'combat-absorb') {
      expect(effect.hp).toBe(4);
    }
  });

  it('cinder-bloom resolves to combat-attack damage 4', () => {
    const effect = combatEffectFor(findCard('cinder-bloom'));
    expect(effect.kind).toBe('combat-attack');
    if (effect.kind === 'combat-attack') {
      expect(effect.damage).toBe(4);
    }
  });

  it('ancient-sword resolves to combat-attack damage 5', () => {
    const effect = combatEffectFor(findCard('ancient-sword'));
    expect(effect.kind).toBe('combat-attack');
    if (effect.kind === 'combat-attack') {
      expect(effect.damage).toBe(5);
    }
  });

  it('chimera-sword resolves to combat-attack damage 7 (silver-chimera sole heirloom)', () => {
    const effect = combatEffectFor(findCard('chimera-sword'));
    expect(effect.kind).toBe('combat-attack');
    if (effect.kind === 'combat-attack') {
      expect(effect.damage).toBe(7);
    }
  });

  it('each new item has the expected role / cost / effects.kind / itemKind', () => {
    // Supply items — role=item, cost.green set, itemKind=item-active,
    // effects.kind is `equip-bonus` (embertide-s2ub completed
    // wun Track A by migrating every gm0.15 supply item from the
    // legacy combat-bonus / damage-reduction rules-text shim to the
    // live equip-bonus dispatcher). Combat behaviour stays sourced
    // from EXPLICIT_OVERRIDES; this assertion locks the main-phase
    // schema only.
    const supplyExpectations: readonly {
      id: string;
      green: number;
      effectsKind: 'equip-bonus';
    }[] = [
      { id: 'bow', green: 3, effectsKind: 'equip-bonus' },
      { id: 'boomerang', green: 3, effectsKind: 'equip-bonus' },
      { id: 'elysian-shield', green: 4, effectsKind: 'equip-bonus' },
      { id: 'cinder-bloom', green: 3, effectsKind: 'equip-bonus' },
      { id: 'ancient-sword', green: 5, effectsKind: 'equip-bonus' },
    ];
    for (const { id, green, effectsKind } of supplyExpectations) {
      const card = findCard(id);
      expect(card.role).toBe('item');
      expect(card.itemKind).toBe('item-active');
      expect(card.cost.green).toBe(green);
      const effects = card.effects as { readonly kind: string };
      expect(effects.kind).toBe(effectsKind);
    }
    // chimera-sword — heirloom shape: cost.green=0, effects.kind='gain'.
    const chimeraSword = findCard('chimera-sword');
    expect(chimeraSword.role).toBe('item');
    expect(chimeraSword.itemKind).toBe('item-active');
    expect(chimeraSword.cost.green).toBe(0);
    const chimeraEffects = chimeraSword.effects as { readonly kind: string };
    expect(chimeraEffects.kind).toBe('gain');
  });
});
