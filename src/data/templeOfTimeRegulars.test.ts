import { describe, it, expect } from 'vitest';
import { GILDED_CAGE_REGULARS } from './cards';
import { createSeededRng } from '../rules/chestPool';
import { ZONE_METADATA } from '../rules/zones';
import { fightMonster } from '../store/slices/combat';
import type { Card } from '../types/card';
import type { KidGameState, KidPlayer } from '../store/types';
import { makeKidPlayer, makeKidGameState } from '../testing/stateFixtures';

/**
 * u-6c-gilded-cage-regulars acceptance coverage.
 *
 * (a) all 5 regulars exist with zone affinity='gilded-cage' and the
 *     expected stats (role='monster', cost.red in 3-6, monster-drop
 *     hearts >= 1 so +1 HP heal per REQ-2 fires on defeat)
 * (b) none carry bossTier — these are regulars, not wild/region bosses
 * (c) each has a unique defeat effect (no shard grant) — effects-by-id
 *     distinctness check
 * (d) +1 HP heal fires on defeat (via fightMonster on a fixture state,
 *     asserting player.hp rises by at least 1 for every regular)
 */

const EXPECTED_IDS = ['wardeye', 'emberskull', 'bone-knight', 'gulpmaw', 'hexrobe'] as const;

// ---------------------------------------------------------------------------
// Fixtures (lifted from src/store/zones.test.ts shape, trimmed for this
// suite — the combat path only reads hp/hpMax/red/keys and ignores the
// rest, but the full KidPlayer shape is required by the KidGameState
// type so each field is explicit).
// ---------------------------------------------------------------------------

// Defaults: hp=3 (so +1 HP heal delta is observable below hpMax=5);
// red=10 / keys=2 over-provision combat resources so fight cost never
// drives test noise — we assert heal delta, not economy.
const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer =>
  makeKidPlayer({ hp: 3, red: 10, keys: 2, ...overrides });

function makeState(overrides: Partial<KidGameState> = {}): KidGameState {
  return makeKidGameState({
    players: [makePlayer({ id: 'p0' }), makePlayer({ id: 'p1' })],
    seed: 1,
    rng: createSeededRng(1),
    currentZone: 'gilded-cage',
    // gdd.3: pre-temple zoneHistory now includes the full v2.1 chain
    // up to dune-sanctum.
    zoneHistory: ['sylvani', 'emberpeak', 'maren', 'hollow-shrine', 'dune-sanctum'],
    ...overrides,
  });
}

describe('Gilded-cage regulars (u-6c)', () => {
  it('(a) exports exactly the 5 expected regulars with gilded-cage zone affinity', () => {
    const ids = GILDED_CAGE_REGULARS.map((c) => c.id);
    expect(ids).toHaveLength(5);
    expect(new Set(ids)).toEqual(new Set(EXPECTED_IDS));

    // Zone affinity is asserted via ZONE_METADATA membership (option
    // (ii) from the u-6c spec — minimal Card type-surface change).
    // Every Temple regular's id must appear in the zone's
    // regularEnemyIds list, and the list must match exactly (no drift,
    // no stragglers from u-6a/u-6b bleed-over).
    expect(ZONE_METADATA['gilded-cage'].regularEnemyIds).toEqual([
      'wardeye',
      'emberskull',
      'bone-knight',
      'gulpmaw',
      'hexrobe',
    ]);
    for (const card of GILDED_CAGE_REGULARS) {
      expect(ZONE_METADATA['gilded-cage'].regularEnemyIds).toContain(card.id);
    }
  });

  it('(a) stats: role=monster, cost.red in 3-6, monster-drop with hearts >= 1 (REQ-2 baseline)', () => {
    for (const card of GILDED_CAGE_REGULARS) {
      expect(card.role).toBe('monster');
      const redCost = card.cost.red ?? 0;
      expect(redCost).toBeGreaterThanOrEqual(3);
      expect(redCost).toBeLessThanOrEqual(6);
      expect(card.effects.kind).toBe('monster-drop');
      // Narrow so TypeScript resolves `hearts`.
      if (card.effects.kind !== 'monster-drop') {
        throw new Error(`Unexpected effect kind on ${card.id}`);
      }
      expect(card.effects.hearts).toBeGreaterThanOrEqual(1);
    }
  });

  it('(b) none carry bossTier (regulars are not wild/region bosses)', () => {
    for (const card of GILDED_CAGE_REGULARS) {
      expect(card.bossTier).toBeUndefined();
    }
  });

  it('(c) each has a unique defeat effect — effects-by-id distinctness', () => {
    // Serialize each effect to a stable key. If any two cards share an
    // identical effect shape, the Set size would be less than the card
    // count. This enforces the "thematically-distinct" acceptance
    // without requiring a new EffectSpec kind per enemy.
    const signatures = GILDED_CAGE_REGULARS.map((c) => JSON.stringify(c.effects));
    expect(new Set(signatures).size).toBe(GILDED_CAGE_REGULARS.length);

    // And none of the effects is a shard grant — Temple regulars drop
    // HP heals (+ optional keys), never shards. Shard grants would use
    // a different EffectSpec kind, so this is a belt-and-braces guard
    // at the data layer.
    for (const card of GILDED_CAGE_REGULARS) {
      expect(card.effects.kind).toBe('monster-drop');
    }
  });

  it('(d) +1 HP heal fires on defeat for every regular (fightMonster fixture)', () => {
    for (const template of GILDED_CAGE_REGULARS) {
      // Each fixture gets its own state so prior fights don't bleed
      // into the next assertion. Starting hp is 3 of 5 — leaves room
      // for a heal up to +2 before clamp-at-hpMax obscures the delta.
      const monster: Card = { ...template, id: `${template.id}-fx` };
      const state = makeState({
        players: [makePlayer({ id: 'p0', hp: 2 }), makePlayer({ id: 'p1' })],
        field: [monster],
      });
      const before = state.players[0].hp;
      const next = fightMonster(state, 0, monster.id);
      const after = next.players[0].hp;
      // REQ-2: defeating a regular produces +1 HP heal minimum. Some
      // Temple regulars heal more (hearts=2/3); we assert the floor so
      // the test is stable across hearts tuning.
      expect(
        after - before,
        `expected +1 HP heal after defeating ${template.id}, got ${after - before}`,
      ).toBeGreaterThanOrEqual(1);
      // And no shard is granted — shards only come from Princess (u-2e),
      // Map completion (u-5b), and Vurmox (u-6c-bosses, Layer 7).
      expect(next.sharedTriforce).toEqual({
        wisdom: false,
        courage: false,
        power: false,
      });
      // Sanity: the monster was removed from the field on defeat.
      expect(next.field.find((c) => c.id === monster.id)).toBeUndefined();
    }
  });
});
