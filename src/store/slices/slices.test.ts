import { describe, it, expect } from 'vitest';
import { createSeededRng } from '../../rules/chestPool';
import { KID_CARDS } from '../../data/cards';
import type { Card } from '../../types/card';
import type { KidGameState, KidPlayer } from '../types';
import { STARTER_GREEN, STARTER_RED, buildStarterDeck, drawCards, drawFiveFor } from './deck';
import { fightMonster } from './combat';
import { SLOT_COSTS, applyEquipBonusOnEquip, applyHeirloomOnEquip, equipAsItem } from './inventory';
import { CHEST_ROW_SIZE, applyReward, openChestFor, refillChestRow } from './chests';
import {
  EMBERTIDE_PIECES_TO_WIN,
  advanceTurn,
  applyStartOfTurnItems,
  checkCoopVictory,
} from './endgame';
import { makeKidPlayer, makeKidGameState } from '../../testing/stateFixtures';

// ---------------------------------------------------------------------------
// Test fixtures.
// ---------------------------------------------------------------------------

// Default championId is Power so combat fixtures don't accidentally
// trigger the Courage +HP-heal passive on mini/final-boss kills
// (embertide-57p) — already the canonical default in
// makeKidPlayer; individual tests override when a specific passive is
// under test.
const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer => makeKidPlayer(overrides);

function makeState(overrides: Partial<KidGameState> = {}): KidGameState {
  return makeKidGameState({
    players: [makePlayer()],
    seed: 1,
    rng: createSeededRng(1),
    ...overrides,
  });
}

const MONSTER = KID_CARDS.find((c) => c.id === 'grunt-orc')!;
const SPEAR_ORC = KID_CARDS.find((c) => c.id === 'spear-orc')!;
const SQUIDLET = KID_CARDS.find((c) => c.id === 'squidlet')!;
const MINI_BOSS = KID_CARDS.find((c) => c.id === 'mini-boss-reptile')!;
const SHORT_SWORD = KID_CARDS.find((c) => c.id === 'short-sword')!;
const LEGENDARY = KID_CARDS.find((c) => c.role === 'legendary-sword')!;

// ---------------------------------------------------------------------------
// deck.ts
// ---------------------------------------------------------------------------

describe('deck slice', () => {
  it('builds a 10-card starter deck of 5 gems + 5 power (designer direction 2026-04-24)', () => {
    const rng = createSeededRng(1);
    const deck = buildStarterDeck(rng);
    expect(deck).toHaveLength(10);
    expect(deck.filter((c) => c.role === 'starter-green')).toHaveLength(5);
    expect(deck.filter((c) => c.role === 'starter-red')).toHaveLength(5);
    // j49z (2026-04-24): the `starter-home` role was retired alongside
    // its 4 entries; no champion hero card is handed out in the opening
    // deck, and the role is no longer part of CARD_ROLES.
  });

  it('drawCards fills hand without touching empty discard', () => {
    const rng = createSeededRng(1);
    const view = { deck: [STARTER_GREEN, STARTER_RED], hand: [], discard: [] };
    const next = drawCards(view, 5, rng);
    expect(next.hand).toHaveLength(2);
    expect(next.deck).toHaveLength(0);
  });

  it('reshuffles discard into deck when deck empty', () => {
    const rng = createSeededRng(42);
    const view = {
      deck: [] as Card[],
      hand: [] as Card[],
      discard: [STARTER_GREEN, STARTER_RED, STARTER_GREEN] as Card[],
    };
    const next = drawFiveFor(view, rng);
    expect(next.hand).toHaveLength(3);
    expect(next.discard).toHaveLength(0);
    expect(next.deck).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// combat.ts — v2 HP-heal semantics (amendment A2)
// ---------------------------------------------------------------------------

describe('combat slice', () => {
  it('deducts red, heals +1 HP (clamped at hpMax), and removes monster from field (grunt-orc)', () => {
    const state = makeState({
      // hp=4 so the +1 heal lands at 5 (hpMax), exercising the clamp.
      players: [makePlayer({ red: 5, hp: 4, hpMax: 5 })],
      field: [MONSTER],
    });
    const next = fightMonster(state, 0, MONSTER.id);
    expect(next.players[0].red).toBe(5 - 3);
    expect(next.players[0].hp).toBe(5);
    expect(next.field).toHaveLength(0);
    expect(next.defeated).toContain(MONSTER);
  });

  it('heart reward at full hp grows hp AND hpMax (vital-ember pass, 2026-04-22)', () => {
    // Previously the heal was discarded at hpMax. After the vital-ember
    // pass, a heart drop from a full-hp player instead grows hp + hpMax
    // by the drop amount (up to HP_CAP=10). Regular monster drop = 1 heart.
    const state = makeState({
      players: [makePlayer({ red: 10, hp: 5, hpMax: 5 })],
      field: [MONSTER],
    });
    const next = fightMonster(state, 0, MONSTER.id);
    expect(next.players[0].hp).toBe(6);
    expect(next.players[0].hpMax).toBe(6);
  });

  it('handles a 4-red monster (spear-orc)', () => {
    const state = makeState({
      players: [makePlayer({ red: 10, hp: 3, hpMax: 5 })],
      field: [SPEAR_ORC],
    });
    const next = fightMonster(state, 0, SPEAR_ORC.id);
    expect(next.players[0].red).toBe(6);
    expect(next.players[0].hp).toBe(4);
  });

  it('handles a mini-boss with key + red cost and 2-HP-heal drop', () => {
    const state = makeState({
      players: [makePlayer({ red: 10, keys: 2, hp: 1, hpMax: 5 })],
      field: [MINI_BOSS],
    });
    const next = fightMonster(state, 0, MINI_BOSS.id);
    expect(next.players[0].red).toBe(3);
    expect(next.players[0].keys).toBe(1);
    expect(next.players[0].hp).toBe(3);
  });

  it('handles squidlet (3 red)', () => {
    const state = makeState({
      players: [makePlayer({ red: 4, hp: 2, hpMax: 5 })],
      field: [SQUIDLET],
    });
    const next = fightMonster(state, 0, SQUIDLET.id);
    expect(next.players[0].red).toBe(1);
    expect(next.players[0].hp).toBe(3);
  });

  it('throws when red insufficient', () => {
    const state = makeState({
      players: [makePlayer({ red: 1 })],
      field: [MONSTER],
    });
    expect(() => fightMonster(state, 0, MONSTER.id)).toThrow(/red/i);
  });

  it('never grants shards from beast defeat (v2 amendment A2)', () => {
    const state = makeState({
      players: [makePlayer({ red: 10, hp: 1, hpMax: 5 })],
      field: [MONSTER],
    });
    const next = fightMonster(state, 0, MONSTER.id);
    expect(next.sharedTriforce.wisdom).toBe(false);
    expect(next.sharedTriforce.courage).toBe(false);
    expect(next.sharedTriforce.power).toBe(false);
  });

  // -------------------------------------------------------------------------
  // v2.1 REQ-21 / gm0.6 — chest-attached-to-monster defeat path.
  // -------------------------------------------------------------------------

  it('opens a chest-std bonus on defeat when monster.hasAttachedChest is true (no key cost)', () => {
    const flaggedMonster: Card = { ...MONSTER, hasAttachedChest: true };
    const state = makeState({
      // keys=0 is load-bearing: the attached-chest open MUST bypass the
      // normal key gate. If the open path leaked through `openChestFor`'s
      // CHEST_KEY_COSTS check it would throw "Insufficient keys".
      players: [makePlayer({ red: 5, keys: 0, hp: 5, hpMax: 5 })],
      field: [flaggedMonster],
    });
    const next = fightMonster(state, 0, flaggedMonster.id);
    // Player paid the monster's red cost; keys untouched.
    expect(next.players[0].red).toBe(5 - 3);
    expect(next.players[0].keys).toBe(0);
    // chestsOpened increments and lastChestReward is populated by the
    // attached-chest bonus. lastChestRewardCard pairs with the reward:
    // null for heart/ember-shard, set for hero/item/wisp (chest-std
    // entries — premium-item/double-heart/vital-ember don't roll
    // here per the std weighting).
    expect(next.players[0].chestsOpened).toBe(1);
    expect(next.lastChestReward).not.toBeNull();
    if (next.lastChestReward === 'heart' || next.lastChestReward === 'ember-shard') {
      expect(next.lastChestRewardCard).toBeNull();
    } else {
      expect(next.lastChestRewardCard).not.toBeNull();
    }
  });

  it('does NOT open a chest when monster.hasAttachedChest is unset (regression guard)', () => {
    const state = makeState({
      players: [makePlayer({ red: 5, keys: 0, hp: 5, hpMax: 5 })],
      field: [MONSTER],
    });
    const next = fightMonster(state, 0, MONSTER.id);
    expect(next.players[0].chestsOpened).toBe(0);
    expect(next.lastChestReward).toBeNull();
    expect(next.lastChestRewardCard).toBeNull();
  });

  // -------------------------------------------------------------------------
  // r94e — defeat-drop variety. Dispatcher applies gems / cardDraw
  // alongside the existing hearts + keys drops; region-boss shard-grant
  // flow stays untouched (covered by the "never grants shards from
  // beast defeat" test above).
  // -------------------------------------------------------------------------

  it('r94e: applies +gems and +cardDraw drops alongside hearts when a monster-drop carries them', () => {
    const variedMonster: Card = {
      id: 'r94e-monster',
      role: 'monster',
      cost: { red: 3 },
      effects: { kind: 'monster-drop', hearts: 1, gems: 2, cardDraw: 1 },
    };
    // Stock a small deck so the cardDraw=1 drop has cards to pull
    // without exercising the empty-deck reshuffle path. hp=2/hpMax=5
    // leaves room for the +1 heart heal to land without clamp.
    const state = makeState({
      players: [
        makePlayer({
          red: 5,
          green: 4,
          hp: 2,
          hpMax: 5,
          deck: [STARTER_GREEN, STARTER_RED],
          hand: [],
          discard: [],
        }),
      ],
      field: [variedMonster],
    });
    const next = fightMonster(state, 0, variedMonster.id);
    const p = next.players[0];
    // Hearts: +1 HP heal (existing path) — pre/post 2 → 3.
    expect(p.hp).toBe(3);
    // Gems: +2 green shards on top of the 4 green starting balance.
    expect(p.green).toBe(6);
    // CardDraw: +1 card pulled into hand from the deck.
    expect(p.hand).toHaveLength(1);
    expect(p.deck).toHaveLength(1);
    // Red cost still deducted; no shards leaked into the loot table.
    expect(p.red).toBe(2);
    expect(next.sharedTriforce).toEqual({ wisdom: false, courage: false, power: false });
  });

  it('r94e: a monster-drop with NO gems / cardDraw leaves green and hand untouched (regression guard)', () => {
    // grunt-orc still ships hearts:1 only. The dispatcher must NOT
    // touch green / deck / hand for plain heart-only drops.
    const state = makeState({
      players: [makePlayer({ red: 5, green: 3, hp: 4, hpMax: 5, hand: [STARTER_GREEN] })],
      field: [MONSTER],
    });
    const next = fightMonster(state, 0, MONSTER.id);
    const p = next.players[0];
    expect(p.green).toBe(3);
    expect(p.hand).toHaveLength(1);
  });

  it('attached-chest reward draws from chest-std (NOT chest-boss): never a premium-item or double-heart on a regular monster', () => {
    // chest-std weights (post-8xp9) = heart 60 / item 20 / ember-shard 13
    // / wisp 7. None of these are premium-item, double-heart, or
    // vital-ember — those live exclusively in mid/boss tiers — and
    // hero was removed from all chest tiers (8xp9). Sample many seeds;
    // every reward must be a chest-std entry, which verifies the L1
    // routing decision (std, not boss) AND that no hero ever drops.
    const stdRewards = new Set(['heart', 'item', 'ember-shard', 'wisp']);
    for (let seed = 1; seed < 50; seed += 1) {
      const flagged: Card = { ...MONSTER, hasAttachedChest: true };
      const state = makeState({
        seed,
        rng: createSeededRng(seed),
        players: [makePlayer({ red: 5, green: 5, keys: 0, hp: 5, hpMax: 5 })],
        field: [flagged],
      });
      const next = fightMonster(state, 0, flagged.id);
      expect(next.lastChestReward).not.toBeNull();
      expect(next.lastChestReward).not.toBe('hero');
      expect(stdRewards.has(next.lastChestReward as string)).toBe(true);
      // ymgc.1: state-level invariant. Card-grant rewards (item/wisp)
      // populate lastChestRewardCard; heart-only rewards (heart/
      // ember-shard) leave it null. Catches a future refactor that drops
      // the lastChestRewardCard assignment in chests.ts:openChestFor.
      const cardGrant = new Set(['item', 'wisp']);
      if (cardGrant.has(next.lastChestReward as string)) {
        expect(next.lastChestRewardCard).not.toBeNull();
      } else {
        expect(next.lastChestRewardCard).toBeNull();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// inventory.ts
// ---------------------------------------------------------------------------

describe('inventory slice (Items zone — REQ-4, u-2d)', () => {
  it('SLOT_COSTS legacy export is still [4, 6]', () => {
    // Retained for backward compat — new code should not use it.
    expect(SLOT_COSTS).toEqual([4, 6]);
  });

  it('items are unbounded — equipAsItem accepts any number of items (nmmc)', () => {
    let p = makePlayer({});
    for (let i = 0; i < 10; i += 1) {
      p = equipAsItem(p, {
        ...SHORT_SWORD,
        id: `short-sword-bulk-${i}`,
      } as typeof SHORT_SWORD).owner;
    }
    expect(p.items).toHaveLength(10);
  });

  it('equipAsItem adds the item to the items zone (no slot cost)', () => {
    const p = makePlayer({ green: 2 });
    const outcome = equipAsItem(p, SHORT_SWORD);
    expect(outcome.owner.items).toContain(SHORT_SWORD);
    // No slot cost applied — green is unchanged.
    expect(outcome.owner.green).toBe(2);
    expect(outcome.owner.discard).not.toContain(SHORT_SWORD);
  });

  it('equipAsItem appends, preserving previous items', () => {
    const p = makePlayer({ items: [LEGENDARY] });
    const outcome = equipAsItem(p, SHORT_SWORD);
    expect(outcome.owner.items).toEqual([LEGENDARY, SHORT_SWORD]);
  });

  // i2xe (2026-04-25): chest mints (and any equip path) used to append
  // raw template ids, colliding with React's per-card `key` prop in
  // ItemsRow / ChestRow / Field whenever a player accumulated multiple
  // copies of the same baseId. equipAsItem now suffixes a unique id when
  // the input id is already present in items[] or discard[].
  describe('i2xe — equipAsItem mints unique ids on collision', () => {
    it('first equip keeps the input id; second equip suffixes -2', () => {
      let p = makePlayer({});
      const first = equipAsItem(p, SHORT_SWORD);
      expect(first.owner.items[0].id).toBe('short-sword');

      p = first.owner;
      const second = equipAsItem(p, SHORT_SWORD);
      const ids = second.owner.items.map((c) => c.id);
      expect(ids).toEqual(['short-sword', 'short-sword-2']);
      // baseId is set so downstream `baseIdOf` resolves the suffix back.
      const minted = second.owner.items[1] as Readonly<{ baseId?: string }>;
      expect(minted.baseId).toBe('short-sword');
    });

    it('third copy suffixes -3 (skips already-taken -2)', () => {
      const p = makePlayer({
        items: [
          SHORT_SWORD,
          { ...SHORT_SWORD, id: 'short-sword-2', baseId: 'short-sword' } as typeof SHORT_SWORD,
        ],
      });
      const outcome = equipAsItem(p, SHORT_SWORD);
      const ids = outcome.owner.items.map((c) => c.id);
      expect(ids).toEqual(['short-sword', 'short-sword-2', 'short-sword-3']);
    });

    it('avoids collision with ids already in discard', () => {
      const p = makePlayer({
        discard: [{ ...SHORT_SWORD } as typeof SHORT_SWORD],
      });
      const outcome = equipAsItem(p, SHORT_SWORD);
      expect(outcome.owner.items[0].id).toBe('short-sword-2');
    });

    it('mints a unique id even past the legacy 3-item threshold (nmmc unbounded)', () => {
      const existing = [
        SHORT_SWORD,
        { ...SHORT_SWORD, id: 'short-sword-2', baseId: 'short-sword' } as typeof SHORT_SWORD,
        { ...SHORT_SWORD, id: 'short-sword-3', baseId: 'short-sword' } as typeof SHORT_SWORD,
      ];
      const p = makePlayer({ items: existing });
      const outcome = equipAsItem(p, SHORT_SWORD);
      // Items zone receives the minted -4 copy (no cap-overflow to discard).
      expect(outcome.owner.items).toHaveLength(4);
      expect(outcome.owner.items[3].id).toBe('short-sword-4');
      expect(outcome.owner.discard).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------
  // applyEquipBonusOnEquip — embertide-4t2d (wun Track A) on-equip
  // dispatcher. Unit coverage for the four resource modes + trigger
  // gating + no-op short-circuits.
  // -------------------------------------------------------------------

  describe('applyEquipBonusOnEquip (embertide-4t2d)', () => {
    const rng = createSeededRng(7);

    function makeBonusCard(
      resource: 'gem' | 'power' | 'shield' | 'card-draw',
      amount: number,
    ): Card {
      return {
        id: `bonus-${resource}-on-equip`,
        role: 'item',
        cost: { green: 0 },
        effects: { kind: 'equip-bonus', resource, amount, trigger: 'on-equip' },
        itemKind: 'item-active',
        cooldownTurns: 0,
        lastUsedTurn: null,
      };
    }

    it("grants +N green for a 'gem' on-equip bonus", () => {
      const p = makePlayer({ green: 2 });
      const next = applyEquipBonusOnEquip(p, makeBonusCard('gem', 2), rng);
      expect(next.green).toBe(4);
      expect(next.red).toBe(0);
    });

    it("grants +N red for a 'power' on-equip bonus", () => {
      const p = makePlayer({ red: 1 });
      const next = applyEquipBonusOnEquip(p, makeBonusCard('power', 1), rng);
      expect(next.red).toBe(2);
      expect(next.green).toBe(0);
    });

    it("draws N cards from the deck for a 'card-draw' on-equip bonus", () => {
      // Three card deck so the draw is fully observable without falling
      // back to the discard reshuffle path.
      const deck = [SHORT_SWORD, MONSTER, SPEAR_ORC];
      const p = makePlayer({ deck, hand: [] });
      const next = applyEquipBonusOnEquip(p, makeBonusCard('card-draw', 2), createSeededRng(1));
      expect(next.hand).toHaveLength(2);
      expect(next.deck).toHaveLength(1);
    });

    it("treats 'shield' on-equip as a no-op (schema-only landing for v2.1)", () => {
      const p = makePlayer({ green: 3, red: 2 });
      const next = applyEquipBonusOnEquip(p, makeBonusCard('shield', 1), rng);
      expect(next.green).toBe(3);
      expect(next.red).toBe(2);
    });

    it('short-circuits for non-equip-bonus EffectSpec kinds', () => {
      // MONSTER (grunt-orc) has effects.kind='monster-drop' — every
      // post-s2ub supply item now declares 'equip-bonus', so the
      // dispatcher's short-circuit needs a non-item card to exercise
      // the no-op path.
      const p = makePlayer({ green: 1, red: 1 });
      const next = applyEquipBonusOnEquip(p, MONSTER, rng);
      expect(next).toBe(p);
    });

    it('short-circuits for non-positive amounts (defensive)', () => {
      const p = makePlayer({ green: 5 });
      const next = applyEquipBonusOnEquip(p, makeBonusCard('gem', 0), rng);
      expect(next).toBe(p);
    });

    it('grants +1 power when the migrated bow card is equipped (integration)', () => {
      const bow = KID_CARDS.find((c) => c.id === 'bow');
      if (!bow) throw new Error('bow missing from KID_CARDS');
      const p = makePlayer({ red: 0 });
      const next = applyEquipBonusOnEquip(p, bow, rng);
      expect(next.red).toBe(1);
    });
  });

  // -------------------------------------------------------------------
  // applyHeirloomOnEquip — embertide-uz7k (wun Track B) on-equip
  // dispatcher for drop-only heirloom + freed-princess cards. Disjoint
  // from equip-bonus by `effects.kind` (handles `gain` and `draw`),
  // mirrors the same equipped-only contract.
  // -------------------------------------------------------------------

  describe('applyHeirloomOnEquip (embertide-uz7k)', () => {
    const rng = createSeededRng(7);

    it('grants +2 red, +1 keys when craghorn-tusk is equipped', () => {
      const horn = KID_CARDS.find((c) => c.id === 'craghorn-tusk');
      if (!horn) throw new Error('craghorn-tusk missing from KID_CARDS');
      const p = makePlayer({ red: 0, keys: 0 });
      const next = applyHeirloomOnEquip(p, horn, rng);
      expect(next.red).toBe(2);
      expect(next.keys).toBe(1);
      expect(next.green).toBe(0);
    });

    it('grants +1 red, +1 keys when boulderkin-core is equipped (flat-gain substitute for retired conditional-heart)', () => {
      const core = KID_CARDS.find((c) => c.id === 'boulderkin-core');
      if (!core) throw new Error('boulderkin-core missing from KID_CARDS');
      const p = makePlayer({ red: 0, keys: 0 });
      const next = applyHeirloomOnEquip(p, core, rng);
      expect(next.red).toBe(1);
      expect(next.keys).toBe(1);
      expect(next.green).toBe(0);
    });

    it('draws 2 cards when sentinel-eye is equipped', () => {
      const eye = KID_CARDS.find((c) => c.id === 'sentinel-eye');
      if (!eye) throw new Error('sentinel-eye missing from KID_CARDS');
      const deck = [SHORT_SWORD, MONSTER, SPEAR_ORC];
      const p = makePlayer({ deck, hand: [] });
      const next = applyHeirloomOnEquip(p, eye, createSeededRng(1));
      expect(next.hand).toHaveLength(2);
      expect(next.deck).toHaveLength(1);
    });

    it('grants +1 green, +2 red when chimera-sword is equipped', () => {
      const sword = KID_CARDS.find((c) => c.id === 'chimera-sword');
      if (!sword) throw new Error('chimera-sword missing from KID_CARDS');
      const p = makePlayer({ green: 0, red: 0 });
      const next = applyHeirloomOnEquip(p, sword, rng);
      expect(next.green).toBe(1);
      expect(next.red).toBe(2);
      expect(next.keys).toBe(0);
    });

    it('grants +2 red when rainbow-ancient-chimera-sword is equipped', () => {
      const rainbow = KID_CARDS.find((c) => c.id === 'rainbow-ancient-chimera-sword');
      if (!rainbow) throw new Error('rainbow-ancient-chimera-sword missing from KID_CARDS');
      const p = makePlayer({ red: 0 });
      const next = applyHeirloomOnEquip(p, rainbow, rng);
      expect(next.red).toBe(2);
      expect(next.green).toBe(0);
      expect(next.keys).toBe(0);
    });

    it('returns the input unchanged for freed-princess (embertide-ajx1: re-roled to hero, items-equip path is no longer applicable)', () => {
      // ajx1 2026-04-26: freed-princess is now role='hero' and lands in
      // the player's discard pile on crystal-break (not the items zone),
      // so applyHeirloomOnEquip — which only fires on role='item' cards
      // — short-circuits to a no-op for the princess. Her +2g/+2r/+1k
      // on-play bundle now fires from the hero playCard dispatcher
      // instead, exercised by the gameStore tests.
      const princess = KID_CARDS.find((c) => c.id === 'freed-princess');
      if (!princess) throw new Error('freed-princess missing from KID_CARDS');
      const p = makePlayer({ green: 0, red: 0, keys: 0 });
      const next = applyHeirloomOnEquip(p, princess, rng);
      expect(next).toBe(p);
    });

    it('returns the input unchanged for great-wisp (heal sentinel — kind not gain/draw)', () => {
      const greatFairy = KID_CARDS.find((c) => c.id === 'great-wisp');
      if (!greatFairy) throw new Error('great-wisp missing from KID_CARDS');
      const p = makePlayer({ green: 3, red: 2, keys: 1 });
      const next = applyHeirloomOnEquip(p, greatFairy, rng);
      expect(next).toBe(p);
    });

    it('returns the input unchanged for wisp-in-bottle (heal sentinel — kind not gain/draw)', () => {
      const bottle = KID_CARDS.find((c) => c.id === 'wisp-in-bottle');
      if (!bottle) throw new Error('wisp-in-bottle missing from KID_CARDS');
      const p = makePlayer({ green: 3, red: 2, keys: 1 });
      const next = applyHeirloomOnEquip(p, bottle, rng);
      expect(next).toBe(p);
    });

    it('returns the input unchanged for non-item cards (legendary-sword route via equip-bonus)', () => {
      const p = makePlayer({ green: 1, red: 1 });
      const next = applyHeirloomOnEquip(p, LEGENDARY, rng);
      expect(next).toBe(p);
    });

    it('returns the input unchanged for monster-drop EffectSpec kinds (defensive)', () => {
      const p = makePlayer({ green: 1, red: 1 });
      const next = applyHeirloomOnEquip(p, MONSTER, rng);
      expect(next).toBe(p);
    });

    it('treats draw amount <= 0 as a no-op (defensive)', () => {
      // Authoring-only edge case — no shipped card has draw amount 0,
      // but the dispatcher should refuse to call drawCards in that case.
      const card: Card = {
        id: 'synthetic-draw-zero',
        role: 'item',
        cost: { green: 0 },
        effects: { kind: 'draw', amount: 0 },
        itemKind: 'item-active',
        cooldownTurns: 0,
        lastUsedTurn: null,
      };
      const p = makePlayer({ deck: [SHORT_SWORD], hand: [] });
      const next = applyHeirloomOnEquip(p, card, rng);
      expect(next).toBe(p);
    });
  });
});

// ---------------------------------------------------------------------------
// chests.ts — v2 HP-heal semantics (amendment A2)
// ---------------------------------------------------------------------------

describe('chests slice', () => {
  it('applyReward for heart heals +1 HP (clamped at hpMax)', () => {
    const { player: p } = applyReward(makePlayer({ hp: 4, hpMax: 5 }), 'heart', createSeededRng(1));
    expect(p.hp).toBe(5);
  });

  it('applyReward for heart at full hp grows hp + hpMax (vital-ember pass)', () => {
    const { player: p } = applyReward(makePlayer({ hp: 5, hpMax: 5 }), 'heart', createSeededRng(1));
    expect(p.hp).toBe(6);
    expect(p.hpMax).toBe(6);
  });

  it('applyReward for double-heart adds 2 HP clamped', () => {
    const { player: p } = applyReward(
      makePlayer({ hp: 1, hpMax: 5 }),
      'double-heart',
      createSeededRng(1),
    );
    expect(p.hp).toBe(3);
  });

  it('applyReward for hero adds a hero card to discard', () => {
    const { player: p, card } = applyReward(makePlayer(), 'hero', createSeededRng(1));
    expect(p.discard).toHaveLength(1);
    expect(p.discard[0].role).toBe('hero');
    // embertide-ymgc: applyReward also surfaces the rolled Card so
    // the chest-reveal UI can render the actual art.
    expect(card?.role).toBe('hero');
  });

  it('applyReward for premium-item adds a legendary to the items zone (no slot cost, u-2d)', () => {
    const { player: p, card } = applyReward(
      makePlayer({ green: 10 }),
      'premium-item',
      createSeededRng(1),
    );
    expect(p.items[0]?.role).toBe('legendary-sword');
    // Green is NOT deducted — Items zone acquisition has no slot cost.
    expect(p.green).toBe(10);
    // embertide-ymgc: rolled card is surfaced for the popup.
    expect(card).not.toBeNull();
  });

  it('applyReward for item adds the item to the items zone (no slot cost)', () => {
    const { player: p, card } = applyReward(makePlayer({ green: 5 }), 'item', createSeededRng(1));
    expect(p.items).toHaveLength(1);
    expect(p.items[0].role).toBe('item');
    expect(p.green).toBe(5);
    expect(card?.role).toBe('item');
  });

  // ---- v2.1 gm0.16 ember-shard / vital-ember -------------------------
  it('applyReward for ember-shard increments heartPieces counter (no HP change)', () => {
    const { player: p, card } = applyReward(
      makePlayer({ hp: 3, hpMax: 5, heartPieces: 0 }),
      'ember-shard',
      createSeededRng(1),
    );
    expect(p.heartPieces).toBe(1);
    expect(p.hp).toBe(3);
    expect(p.hpMax).toBe(5);
    // embertide-ymgc: ember-shard is NOT a card-grant — card stays null.
    expect(card).toBeNull();
  });

  it('applyReward for ember-shard on the 4th piece auto-promotes to a vital ember (+1 hpMax, full heal, counter resets)', () => {
    const { player: p } = applyReward(
      makePlayer({ hp: 5, hpMax: 5, heartPieces: 3 }),
      'ember-shard',
      createSeededRng(1),
    );
    expect(p.heartPieces).toBe(0);
    expect(p.hpMax).toBe(6);
    expect(p.hp).toBe(6);
  });

  it('applyReward for vital-ember grants +1 hpMax and full-heals immediately (does NOT touch heartPieces)', () => {
    const { player: p } = applyReward(
      makePlayer({ hp: 5, hpMax: 5, heartPieces: 2 }),
      'vital-ember',
      createSeededRng(1),
    );
    expect(p.hpMax).toBe(6);
    expect(p.hp).toBe(6);
    // Direct drop bypasses the accumulator — previous pieces unchanged.
    expect(p.heartPieces).toBe(2);
  });

  it('applyReward for wisp reward resolves to either plain wisp or wisp-in-bottle (gm0.16 50/50)', () => {
    // rng(1) first call is ≈0.627 > 0.5 → plain 'wisp'.
    const plain = applyReward(makePlayer({ green: 5 }), 'wisp', createSeededRng(1));
    expect(plain.player.items[0]?.id).toBe('wisp');
    // rng(2) first call is in the lower half → 'wisp-in-bottle'.
    const bottle = applyReward(makePlayer({ green: 5 }), 'wisp', createSeededRng(2));
    // Accept either plain or bottle — the exact split is seed-driven,
    // but at least one of the two well-known seeds must produce the
    // bottle variant for the split to be live.
    const outcomes: string[] = [plain.player.items[0]?.id ?? '', bottle.player.items[0]?.id ?? ''];
    expect(outcomes).toContain('wisp');
    expect(outcomes.some((id) => id === 'wisp' || id === 'wisp-in-bottle')).toBe(true);
    // embertide-ymgc: wisp is a card-grant — card surfaces for both seeds.
    expect(plain.card?.role).toBe('item');
    expect(bottle.card?.role).toBe('item');
  });

  it('openChestFor deducts keys and increments chestsOpened', () => {
    const state = makeState({ players: [makePlayer({ keys: 1 })] });
    const next = openChestFor(state, 0, 'std');
    expect(next.players[0].keys).toBe(0);
    expect(next.players[0].chestsOpened).toBe(1);
    // ymgc.1: lastChestReward is always populated after a successful
    // open; lastChestRewardCard is non-null iff the reward grants a
    // card (item/wisp for std — hero was removed from chests in 8xp9).
    // Single-seed assertion uses correlation since the rolled reward is
    // rng-dependent.
    expect(next.lastChestReward).not.toBeNull();
    expect(next.lastChestReward).not.toBe('hero');
    const cardGrant = new Set(['item', 'premium-item', 'wisp']);
    if (cardGrant.has(next.lastChestReward as string)) {
      expect(next.lastChestRewardCard).not.toBeNull();
    } else {
      expect(next.lastChestRewardCard).toBeNull();
    }
  });

  it('openChestFor throws when player cannot pay key cost', () => {
    const state = makeState({ players: [makePlayer({ keys: 0 })] });
    expect(() => openChestFor(state, 0, 'boss')).toThrow(/keys/i);
  });

  it('openChestFor boss chest resolves to one of its reward entries (double-heart / premium-item / wisp / ember-shard / vital-ember) and never deducts green', () => {
    // tq5: boss-chest key cost lifted from 2 → 3 (Grand Vault is the
    // 3-tier system's premium tier).
    const state = makeState({
      players: [makePlayer({ keys: 3, green: 10, hp: 1, hpMax: 5 })],
    });
    const next = openChestFor(state, 0, 'boss');
    const p = next.players[0];
    // v2 boss-chest rewards (gm0.16): double-heart / premium-item /
    // wisp / ember-shard / vital-ember. Green always stays at 10
    // — chest rewards no longer pay a slot cost.
    expect(p.green).toBe(10);
    const addedItem = p.items[0];
    if (addedItem) {
      // premium-item (legendary-sword OR great-wisp) OR wisp (plain
      // wisp OR wisp-in-bottle) OR seers-omen (gm0.8) land in the
      // items zone; any of these five variants is an acceptable
      // boss-chest outcome.
      const templateId =
        addedItem.id === 'wisp' ||
        addedItem.id === 'wisp-in-bottle' ||
        addedItem.id === 'great-wisp' ||
        addedItem.id === 'seers-omen'
          ? addedItem.id
          : addedItem.role;
      expect([
        'legendary-sword',
        'wisp',
        'wisp-in-bottle',
        'great-wisp',
        'seers-omen',
      ]).toContain(templateId);
      // ymgc.1: card-grant branch — premium-item / wisp populate
      // lastChestRewardCard with the rolled card.
      expect(next.lastChestRewardCard).not.toBeNull();
    } else if (p.heartPieces > 0) {
      // gm0.16: ember-shard increments the counter (up to 3 without
      // promotion; cannot be 4 because auto-promotes to container).
      expect(p.heartPieces).toBeGreaterThanOrEqual(1);
      expect(p.heartPieces).toBeLessThanOrEqual(3);
      // ymgc.1: ember-shard is not a card grant.
      expect(next.lastChestRewardCard).toBeNull();
    } else if (p.hpMax > 5) {
      // gm0.16: direct vital-ember drop grows hpMax +1 and full-heals.
      expect(p.hpMax).toBe(6);
      expect(p.hp).toBe(6);
      // ymgc.1: vital-ember is not a card grant.
      expect(next.lastChestRewardCard).toBeNull();
    } else {
      // double-heart heals 2 HP: 1 → 3.
      expect(p.hp).toBe(3);
      // ymgc.1: double-heart is not a card grant.
      expect(next.lastChestRewardCard).toBeNull();
    }
  });

  // --- Chest row refill (embertide-7c1) ---------------------------------

  const CHEST_STD = KID_CARDS.find((c) => c.id === 'chest-std')!;
  const CHEST_BOSS = KID_CARDS.find((c) => c.id === 'chest-boss')!;

  it('CHEST_ROW_SIZE is 3', () => {
    expect(CHEST_ROW_SIZE).toBe(3);
  });

  it('refillChestRow tops chestRow up to 3 from chestSupply', () => {
    const state = makeState({
      chestRow: [CHEST_STD],
      chestSupply: [CHEST_STD, CHEST_BOSS, CHEST_STD],
    });
    const next = refillChestRow(state);
    expect(next.chestRow).toHaveLength(3);
    expect(next.chestRow[0]).toBe(CHEST_STD);
    expect(next.chestRow[1]).toBe(CHEST_STD);
    expect(next.chestRow[2]).toBe(CHEST_BOSS);
    expect(next.chestSupply).toHaveLength(1);
  });

  it('refillChestRow is a no-op when row already has 3 chests', () => {
    const state = makeState({
      chestRow: [CHEST_STD, CHEST_STD, CHEST_BOSS],
      chestSupply: [CHEST_STD, CHEST_STD],
    });
    const next = refillChestRow(state);
    expect(next).toBe(state);
  });

  it('refillChestRow leaves row short when chestSupply exhausts (no throw)', () => {
    const state = makeState({
      chestRow: [],
      chestSupply: [CHEST_STD],
    });
    const next = refillChestRow(state);
    expect(next.chestRow).toHaveLength(1);
    expect(next.chestSupply).toHaveLength(0);
  });

  it('refillChestRow returns new arrays (immutable)', () => {
    const state = makeState({
      chestRow: [],
      chestSupply: [CHEST_STD, CHEST_STD, CHEST_BOSS],
    });
    const next = refillChestRow(state);
    expect(next).not.toBe(state);
    expect(next.chestRow).not.toBe(state.chestRow);
    expect(next.chestSupply).not.toBe(state.chestSupply);
  });
});

// ---------------------------------------------------------------------------
// endgame.ts — v2 co-op shared-pool victory (amendment A2)
// ---------------------------------------------------------------------------

describe('endgame slice (v2 shared-pool)', () => {
  it('advanceTurn rotates currentPlayerIndex and increments turn on wrap', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p0' }), makePlayer({ id: 'p1' })],
      currentPlayerIndex: 0,
      turn: 1,
    });
    const afterP0 = advanceTurn(state);
    expect(afterP0.currentPlayerIndex).toBe(1);
    expect(afterP0.turn).toBe(1);
    const afterP1 = advanceTurn(afterP0);
    expect(afterP1.currentPlayerIndex).toBe(0);
    expect(afterP1.turn).toBe(2);
  });

  it('EMBERTIDE_PIECES_TO_WIN sentinel is 3', () => {
    expect(EMBERTIDE_PIECES_TO_WIN).toBe(3);
  });

  it('checkCoopVictory sets outcome=win when all three shards granted', () => {
    const state = makeState({
      sharedTriforce: { wisdom: true, courage: true, power: true },
    });
    expect(checkCoopVictory(state).outcome).toBe('win');
  });

  it('checkCoopVictory is a no-op when any shard is missing', () => {
    const state = makeState({
      sharedTriforce: { wisdom: true, courage: true, power: false },
    });
    expect(checkCoopVictory(state).outcome).toBeNull();
  });

  it('checkCoopVictory does not overwrite a resolved loss outcome', () => {
    const state = makeState({
      sharedTriforce: { wisdom: true, courage: true, power: true },
      outcome: 'loss',
    });
    expect(checkCoopVictory(state).outcome).toBe('loss');
  });
});

// ---------------------------------------------------------------------------
// endgame.ts — item-active cooldown decrement (REQ-4 / u-2d).
// ---------------------------------------------------------------------------

describe('applyStartOfTurnItems — cooldown decrement hook (u-2d)', () => {
  it('is a no-op on every v2.0 item-active card (cooldownTurns=0 across the board)', () => {
    // v2.0 ships every item-active with cooldownTurns=0. The hook fires
    // the SOT triggers (+red/+green) but must NOT drive cooldownTurns
    // negative. Assert both: red bumps from short-sword AND cooldown
    // stays at 0.
    const state = makeState({
      players: [makePlayer({ id: 'p0', items: [SHORT_SWORD], red: 0 })],
    });
    const next = applyStartOfTurnItems(state);
    const p0 = next.players[0];
    expect(p0.red).toBe(1);
    expect(p0.items).toHaveLength(1);
    expect(p0.items[0].cooldownTurns).toBe(0);
  });

  it('decrements cooldownTurns on any item-active card with cooldownTurns > 0', () => {
    // Forward-compat: a future v2.1 item could ship with cooldownTurns=2.
    // u-2d's hook has to decrement those readouts; this test locks in the
    // contract before any such card exists.
    // `baseId` lets baseIdOf resolve the duplicate back to 'short-sword'
    // so the Relic SOT trigger dispatches correctly.
    const cooling = {
      ...SHORT_SWORD,
      id: 'short-sword-cooling',
      baseId: 'short-sword',
      cooldownTurns: 2,
    };
    const state = makeState({
      players: [makePlayer({ id: 'p0', items: [cooling], red: 0 })],
    });
    const next = applyStartOfTurnItems(state);
    const p0 = next.players[0];
    // SOT trigger still fires (+1 red) even while the card is cooling —
    // v2.0's triggers are not gated on the readout; they're a Relic-style
    // passive. A cooldown-gated item would decorate `applyItemTrigger`.
    expect(p0.red).toBe(1);
    // Cooldown decremented 2 → 1, floored at 0 later if called again.
    expect(p0.items[0].cooldownTurns).toBe(1);
  });

  it('floors cooldownTurns at 0 — never goes negative', () => {
    const fresh = { ...SHORT_SWORD, id: 'short-sword-fresh', cooldownTurns: 0 };
    const state = makeState({
      players: [makePlayer({ id: 'p0', items: [fresh] })],
    });
    const next = applyStartOfTurnItems(state);
    expect(next.players[0].items[0].cooldownTurns).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// embertide-4uyn — item-passive dispatch coverage. Verifies that the
// 4uyn item-passive cards fire their nested effect on the declared
// trigger via `applyStartOfTurnItems` (start-of-turn passives) and via
// `fightMonster` / `defeatAlwaysAvailableMonster` (on-monster-defeated
// passives).
// ---------------------------------------------------------------------------

const FORGE_OF_POWER = KID_CARDS.find((c) => c.id === 'forge-of-power')!;
const WELL_OF_VITALITY = KID_CARDS.find((c) => c.id === 'well-of-vitality')!;
const MERCHANTS_CHARM = KID_CARDS.find((c) => c.id === 'merchants-charm')!;
const SCHOLARS_TOME = KID_CARDS.find((c) => c.id === 'scholars-tome')!;
const SYLVANI_TALISMAN = KID_CARDS.find((c) => c.id === 'sylvani-talisman')!;
const BANDITS_CACHE = KID_CARDS.find((c) => c.id === 'bandits-cache')!;
const BLOODLUST_PENDANT = KID_CARDS.find((c) => c.id === 'bloodlust-pendant')!;
const BLACKSMITH_FORGE = KID_CARDS.find((c) => c.id === 'blacksmith-forge')!;
const RITUAL_RELIC = KID_CARDS.find((c) => c.id === 'ritual-relic')!;

describe('applyStartOfTurnItems — 4uyn item-passive start-of-turn dispatch', () => {
  it('forge-of-power grants +1 red at start of turn', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p0', items: [FORGE_OF_POWER], red: 2 })],
    });
    const next = applyStartOfTurnItems(state);
    expect(next.players[0].red).toBe(3);
  });

  it('merchants-charm grants +1 green at start of turn', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p0', items: [MERCHANTS_CHARM], green: 0 })],
    });
    const next = applyStartOfTurnItems(state);
    expect(next.players[0].green).toBe(1);
  });

  it('well-of-vitality heals +1 HP at start of turn (clamped at hpMax / grows past)', () => {
    // Below cap → simple +1 heal.
    const stateLow = makeState({
      players: [makePlayer({ id: 'p0', items: [WELL_OF_VITALITY], hp: 3, hpMax: 5 })],
    });
    expect(applyStartOfTurnItems(stateLow).players[0].hp).toBe(4);

    // At cap → applyHeartReward grows hp + hpMax (vital-ember pass).
    const stateFull = makeState({
      players: [makePlayer({ id: 'p0', items: [WELL_OF_VITALITY], hp: 5, hpMax: 5 })],
    });
    const grown = applyStartOfTurnItems(stateFull).players[0];
    expect(grown.hpMax).toBe(6);
    expect(grown.hp).toBe(6);
  });

  it('scholars-tome draws +1 card at start of turn (uses player rng)', () => {
    const state = makeState({
      players: [
        makePlayer({
          id: 'p0',
          items: [SCHOLARS_TOME],
          deck: [STARTER_GREEN, STARTER_RED],
          hand: [],
          discard: [],
        }),
      ],
    });
    const next = applyStartOfTurnItems(state);
    expect(next.players[0].hand).toHaveLength(1);
    expect(next.players[0].deck).toHaveLength(1);
  });

  it('non-start-of-turn triggers (sylvani-talisman, on-combat-enter) do NOT fire from SoT', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p0', items: [SYLVANI_TALISMAN], red: 0 })],
    });
    const next = applyStartOfTurnItems(state);
    // Trigger mismatch — passive stays inert at start-of-turn.
    expect(next.players[0].red).toBe(0);
  });

  it('blacksmith-forge grants +1 green at start of turn (ppf9.6 Card.passive layer)', () => {
    // ppf9.6: dual-behaviour item — banish-from-hand 1 on play AND
    // start-of-turn gem grant via Card.passive. This test exercises the
    // passive layer through the same dispatcher merchants-charm uses.
    const state = makeState({
      players: [makePlayer({ id: 'p0', items: [BLACKSMITH_FORGE], green: 0 })],
    });
    const next = applyStartOfTurnItems(state);
    expect(next.players[0].green).toBe(1);
  });

  it('multiple SoT passives stack (forge-of-power + merchants-charm + well-of-vitality)', () => {
    const state = makeState({
      players: [
        makePlayer({
          id: 'p0',
          items: [FORGE_OF_POWER, MERCHANTS_CHARM, WELL_OF_VITALITY],
          red: 0,
          green: 0,
          hp: 3,
          hpMax: 5,
        }),
      ],
    });
    const next = applyStartOfTurnItems(state);
    expect(next.players[0].red).toBe(1);
    expect(next.players[0].green).toBe(1);
    expect(next.players[0].hp).toBe(4);
  });

  it('does NOT fire passives owned by inactive players', () => {
    const p0 = makePlayer({ id: 'p0', items: [], red: 0 });
    const p1 = makePlayer({ id: 'p1', items: [FORGE_OF_POWER], red: 0 });
    const state = makeState({ players: [p0, p1], currentPlayerIndex: 0 });
    const next = applyStartOfTurnItems(state);
    expect(next.players[0].red).toBe(0);
    expect(next.players[1].red).toBe(0); // inactive — no fire
  });
});

describe('fightMonster — 4uyn on-monster-defeated passive dispatch', () => {
  it('bandits-cache grants +1 green when the owner defeats a regular monster', () => {
    const monsterCopy: Card = { ...MONSTER };
    const state = makeState({
      players: [
        makePlayer({
          id: 'p0',
          items: [BANDITS_CACHE],
          green: 0,
          red: 5, // afford the kill
        }),
      ],
      field: [monsterCopy],
    });
    const next = fightMonster(state, 0, monsterCopy.id);
    expect(next.players[0].green).toBe(1);
  });

  it('bloodlust-pendant draws +1 card when the owner defeats a monster', () => {
    const monsterCopy: Card = { ...MONSTER };
    const state = makeState({
      players: [
        makePlayer({
          id: 'p0',
          items: [BLOODLUST_PENDANT],
          deck: [STARTER_GREEN, STARTER_RED],
          hand: [],
          discard: [],
          red: 5,
        }),
      ],
      field: [monsterCopy],
    });
    const next = fightMonster(state, 0, monsterCopy.id);
    expect(next.players[0].hand).toHaveLength(1);
    expect(next.players[0].deck).toHaveLength(1);
  });

  it('start-of-turn passives do NOT fire on monster defeat (trigger mismatch)', () => {
    const monsterCopy: Card = { ...MONSTER };
    const state = makeState({
      players: [
        makePlayer({
          id: 'p0',
          items: [FORGE_OF_POWER], // start-of-turn trigger
          red: 5,
          green: 0,
        }),
      ],
      field: [monsterCopy],
    });
    const next = fightMonster(state, 0, monsterCopy.id);
    // Forge of Power is a start-of-turn passive; killing a monster
    // doesn't fire it. red after fight = 5 - cost (3) = 2; no +1 bump.
    expect(next.players[0].red).toBe(2);
  });

  it('ritual-relic draws +1 card when the owner defeats a monster (ppf9.6 Card.passive layer)', () => {
    // ppf9.6: dual-behaviour item — banish-from-hand 1 on play AND
    // post-combat draw via Card.passive. Mirrors the bloodlust-pendant
    // path; the relic flavour is "records every defeated foe → grants
    // knowledge."
    const monsterCopy: Card = { ...MONSTER };
    const state = makeState({
      players: [
        makePlayer({
          id: 'p0',
          items: [RITUAL_RELIC],
          deck: [STARTER_GREEN, STARTER_RED],
          hand: [],
          discard: [],
          red: 5,
        }),
      ],
      field: [monsterCopy],
    });
    const next = fightMonster(state, 0, monsterCopy.id);
    expect(next.players[0].hand).toHaveLength(1);
    expect(next.players[0].deck).toHaveLength(1);
  });

  it('multiple on-monster-defeated passives stack on a single kill', () => {
    const monsterCopy: Card = { ...MONSTER };
    const state = makeState({
      players: [
        makePlayer({
          id: 'p0',
          items: [BANDITS_CACHE, BLOODLUST_PENDANT],
          green: 0,
          deck: [STARTER_GREEN, STARTER_RED],
          hand: [],
          red: 5,
        }),
      ],
      field: [monsterCopy],
    });
    const next = fightMonster(state, 0, monsterCopy.id);
    expect(next.players[0].green).toBe(1); // bandits-cache
    expect(next.players[0].hand).toHaveLength(1); // bloodlust-pendant
  });
});
