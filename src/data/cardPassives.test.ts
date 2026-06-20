import { describe, it, expect } from 'vitest';
import { getPassives } from './cardPassives';
import { KID_CARDS } from './cards';
import { effectTextFor } from '../ui/effectText';
import type { Card } from '../types/card';
import type { ItemPassiveEffect } from '../types/effectSpec';

// ---------------------------------------------------------------------------
// Synthetic fixtures. ppf9.4.1 lands the SCHEMA only — no real card uses
// `Card.passive` yet, so the second-slot path is exercised here with hand-
// rolled cards. Fixtures live alongside the unit tests so a future ppf9.4.2
// author can copy the shape verbatim.
// ---------------------------------------------------------------------------

const SOT_PASSIVE: ItemPassiveEffect = {
  kind: 'item-passive',
  description: '+1 power at the start of your turn',
  trigger: 'start-of-turn',
  effect: { kind: 'gain', red: 1 },
};

const ON_DAMAGE_PASSIVE: ItemPassiveEffect = {
  kind: 'item-passive',
  description: 'Reduce damage taken by 1',
  trigger: 'on-damage',
  effect: { kind: 'damage-reduction', amount: 1 },
};

// effects-slot passive (mirrors the existing 4uyn shape).
const passiveOnlyCard: Card = {
  id: 'test-passive-only',
  role: 'item',
  cost: { green: 5 },
  effects: SOT_PASSIVE,
  itemKind: 'item-passive',
};

// passive-slot only — effects is a non-passive on-equip-style spec, the
// item-passive lives in the new second slot. This is the shape ppf9.4.2
// will use for dual-behaviour items.
const secondSlotOnlyCard: Card = {
  id: 'test-second-slot-only',
  role: 'item',
  cost: { green: 4 },
  effects: { kind: 'equip-bonus', resource: 'power', amount: 1, trigger: 'on-equip' },
  itemKind: 'item-active',
  passive: SOT_PASSIVE,
};

// dual-behaviour-shaped fixture: a non-passive on-equip in Card.effects
// AND a separate on-damage passive in Card.passive. NOT both-slots-as-
// passives (that's the malformed case). Shape ppf9.4.2 will use for
// items like a future elysian-shield (gem on-equip + damage-reduction
// passive). Distinct from `secondSlotOnlyCard` because the passive
// trigger differs ('on-damage' vs. 'start-of-turn'), exercising both
// the SOT firing site (applyItemPassivesForTrigger) and the on-damage
// firing site (totalOnDamageReduction) through getPassives.
const secondSlotOnDamageCard: Card = {
  id: 'test-second-slot-on-damage',
  role: 'item',
  cost: { green: 3 },
  effects: { kind: 'equip-bonus', resource: 'gem', amount: 1, trigger: 'on-equip' },
  itemKind: 'item-active',
  passive: ON_DAMAGE_PASSIVE,
};

// no passive at all (typical item-active card).
const nonPassiveCard: Card = {
  id: 'test-non-passive',
  role: 'item',
  cost: { green: 2 },
  effects: { kind: 'equip-bonus', resource: 'power', amount: 1, trigger: 'on-equip' },
  itemKind: 'item-active',
};

// MALFORMED — both slots populated. getPassives must throw because the
// authoring contract is "mutually exclusive". The test-time invariant
// downstream guarantees no real card ever hits this path.
const bothSlotMalformedCard: Card = {
  id: 'test-malformed',
  role: 'item',
  cost: { green: 5 },
  effects: SOT_PASSIVE,
  itemKind: 'item-passive',
  passive: ON_DAMAGE_PASSIVE,
};

describe('getPassives()', () => {
  it('returns [effects] when card.effects is an item-passive (no second slot)', () => {
    const result = getPassives(passiveOnlyCard);
    expect(result).toEqual([SOT_PASSIVE]);
  });

  it('returns [passive] when only Card.passive is defined', () => {
    const result = getPassives(secondSlotOnlyCard);
    expect(result).toEqual([SOT_PASSIVE]);
  });

  it('returns [passive] for second-slot card whose effects is a non-passive spec', () => {
    const result = getPassives(secondSlotOnDamageCard);
    expect(result).toEqual([ON_DAMAGE_PASSIVE]);
    // Asserting the equip-bonus effects-slot is NOT in the output —
    // proves the accessor reads ONLY item-passive shapes, never the
    // sibling on-equip spec.
    expect(result.some((p) => p.kind !== 'item-passive')).toBe(false);
  });

  it('returns [] for a card with no passive in either slot', () => {
    const result = getPassives(nonPassiveCard);
    expect(result).toEqual([]);
  });

  it('throws on the malformed both-slots-populated case', () => {
    expect(() => getPassives(bothSlotMalformedCard)).toThrow(
      /both Card\.effects \(item-passive\) and Card\.passive/i,
    );
  });

  it('returns a readonly array (immutability)', () => {
    const result = getPassives(passiveOnlyCard);
    expect(Array.isArray(result)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
  });
});

describe('getPassives() — migration parity for existing 4uyn cards', () => {
  // Sanity check that the 10 4uyn passive cards (forge-of-power, etc.)
  // still surface their passive through the new accessor — proves the
  // migration is a no-op for the current authored set.
  const FOUR_UYN_IDS = [
    'forge-of-power',
    'well-of-vitality',
    'merchants-charm',
    'scholars-tome',
    'sylvani-talisman',
    'valor-pendant',
    'surge-totem',
    'iron-ward',
    'bandits-cache',
    'bloodlust-pendant',
  ];

  for (const id of FOUR_UYN_IDS) {
    it(`${id}: getPassives surfaces the authored passive`, () => {
      const card = KID_CARDS.find((c) => c.id === id);
      if (!card) throw new Error(`fixture missing: ${id}`);
      const passives = getPassives(card);
      expect(passives).toHaveLength(1);
      expect(passives[0]?.kind).toBe('item-passive');
    });
  }
});

describe('render-policy invariant — every card carrying a passive must surface it in effectTextFor', () => {
  // Phase 4 review HIGH gate. effectText.tsx still reads `card.effects.kind
  // === 'item-passive'` directly (allowlisted via eslint.config.js, owned
  // by ppf9.4.4). That render path correctly handles the legacy 4uyn shape
  // (passive in Card.effects) but DROPS the description for a dual-
  // behaviour card with `effects: <non-passive>` and `passive: <ItemPassive>`.
  //
  // This invariant is the load-bearing gate: the moment ppf9.4.2 lands a
  // real card with `Card.passive` set, this test fails — forcing ppf9.4.4
  // to ship before the dual-behaviour card can merge. Today (no real
  // dual-behaviour cards yet) the assertion is vacuously satisfied for
  // the second-slot path; the 4uyn cards exercise the legacy path so the
  // test is non-vacuous overall.
  it('every card whose getPassives() is non-empty has "Passive" in effectTextFor output', () => {
    for (const card of KID_CARDS) {
      const passives = getPassives(card);
      if (passives.length === 0) continue;
      const text = effectTextFor(card);
      if (!text.toLowerCase().includes('passive')) {
        throw new Error(
          `Card ${card.id} carries a passive (via getPassives) but effectTextFor omits the description: "${text}". If this card was just authored with Card.passive set, ppf9.4.4 (effectText.tsx render-policy migration) must ship first.`,
        );
      }
    }
  });
});

describe('card-author invariant — no card sets BOTH effects(item-passive) and passive', () => {
  // Test-time gate per ppf9.4.1 plan-review M1. This is the load-bearing
  // enforcement: failing here at build time is strictly preferable to a
  // runtime crash mid-combat. The runtime throw in getPassives is a
  // backstop for the same condition.
  it('every card in KID_CARDS satisfies the mutual-exclusion contract', () => {
    for (const card of KID_CARDS) {
      const both = card.effects.kind === 'item-passive' && card.passive !== undefined;
      if (both) {
        throw new Error(
          `Malformed card ${card.id}: declares both Card.effects (item-passive) and Card.passive — these are mutually exclusive per ppf9.4 schema lock-in.`,
        );
      }
    }
  });
});
