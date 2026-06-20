import { describe, it, expect } from 'vitest';
import { createSeededRng } from '../rules/chestPool';
import { KID_CARDS, findAlwaysAvailable } from '../data/cards';
import type { Card } from '../types/card';
import type { KidGameState, KidPlayer } from './types';
import { createGameStore } from './gameStore';
import { fightMonster } from './slices/combat';
import {
  PRINCESS_CRYSTAL_INITIAL_CHARGES,
  crystalDamageFor,
  decrementCrystalCharges,
  initialPrincessCrystalState,
  strikePrincessCrystal,
} from './slices/crystal';
import { makeKidPlayer, makeKidGameState } from '../testing/stateFixtures';

/**
 * u-2e: Princess-in-Crystal → shared Wisdom shard tests (REQ-8, amendment
 * A2; tier-tuned per embertide-vj52).
 *
 *   (a) Initial state is (charges: 8, freed: false). vj52 bumped 5 → 8
 *       alongside the tier-aware decrement.
 *   (b) decrementCrystalCharges decrements by `crystalDamageFor(monster)`
 *       (regular → 1, wild-boss → 2, region-boss → 3), clamps at 0,
 *       no-op once freed.
 *   (c) strikePrincessCrystal at charges > 0 is a no-op.
 *   (d) strikePrincessCrystal at charges === 0 flips freed + shared
 *       wisdom + wisdomsLight on BOTH players.
 *   (e) Re-striking a freed crystal is idempotent (no-op).
 *   (f) fightMonster end-to-end path: 8 regular-monster kills decrement
 *       charges to 0, then strikePrincessCrystal() flips the shared
 *       wisdom shard + both players' wisdomsLight.
 *   (g) defeatAlwaysAvailable (wild-wolf) decrements the crystal counter
 *       the same way — covers the secondary kill path.
 *   (h) Kill paths are no-op on the crystal counter once the Princess is
 *       freed (charges stay at 0, freed stays true).
 */

// ---------------------------------------------------------------------------
// Minimal pure-helper fixtures.
// ---------------------------------------------------------------------------

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer => makeKidPlayer(overrides);

function makeState(overrides: Partial<KidGameState> = {}): KidGameState {
  return makeKidGameState({
    players: [makePlayer({ id: 'p0' }), makePlayer({ id: 'p1' })],
    seed: 1,
    rng: createSeededRng(1),
    ...overrides,
  });
}

const GRUNT_ORC = KID_CARDS.find((c) => c.id === 'grunt-orc')!;

// ---------------------------------------------------------------------------
// Pure helpers: initial state + decrement + strike.
// ---------------------------------------------------------------------------

describe('Princess Crystal pure helpers (u-2e + vj52)', () => {
  it('(a) initial state is charges=8, freed=false (vj52 bump)', () => {
    const initial = initialPrincessCrystalState();
    expect(initial.charges).toBe(8);
    expect(initial.freed).toBe(false);
    expect(PRINCESS_CRYSTAL_INITIAL_CHARGES).toBe(8);
  });

  it('(b) crystalDamageFor — region-boss → 3, wild-boss → 2, default → 1', () => {
    // vj52: tier-aware decrement mirrors the monster-drop hearts curve.
    const REGION_BOSS = KID_CARDS.find((c) => c.bossTier === 'region-boss')!;
    const WILD_BOSS = KID_CARDS.find((c) => c.bossTier === 'wild-boss')!;
    expect(crystalDamageFor(REGION_BOSS)).toBe(3);
    expect(crystalDamageFor(WILD_BOSS)).toBe(2);
    expect(crystalDamageFor(GRUNT_ORC)).toBe(1);
  });

  // Tier-decrement assertions below use `PRINCESS_CRYSTAL_INITIAL_CHARGES - N`
  // rather than literals — vj52 schema is provisional, so the form survives
  // re-tuning of the constant (sibling pattern: zones.test.ts:422).
  it('(b) decrementCrystalCharges drops charges by 1 per regular kill', () => {
    const state = makeState();
    const once = decrementCrystalCharges(state, GRUNT_ORC);
    expect(once.princessCrystal.charges).toBe(PRINCESS_CRYSTAL_INITIAL_CHARGES - 1);
    const twice = decrementCrystalCharges(once, GRUNT_ORC);
    expect(twice.princessCrystal.charges).toBe(PRINCESS_CRYSTAL_INITIAL_CHARGES - 2);
  });

  it('(b) decrementCrystalCharges drops charges by 2 per wild-boss kill', () => {
    const WILD_BOSS = KID_CARDS.find((c) => c.bossTier === 'wild-boss')!;
    const state = makeState();
    const once = decrementCrystalCharges(state, WILD_BOSS);
    expect(once.princessCrystal.charges).toBe(PRINCESS_CRYSTAL_INITIAL_CHARGES - 2);
  });

  it('(b) decrementCrystalCharges drops charges by 3 per region-boss kill', () => {
    const REGION_BOSS = KID_CARDS.find((c) => c.bossTier === 'region-boss')!;
    const state = makeState();
    const once = decrementCrystalCharges(state, REGION_BOSS);
    expect(once.princessCrystal.charges).toBe(PRINCESS_CRYSTAL_INITIAL_CHARGES - 3);
  });

  it('(b) decrementCrystalCharges clamps at 0 — no negative charges', () => {
    const REGION_BOSS = KID_CARDS.find((c) => c.bossTier === 'region-boss')!;
    let state = makeState({
      princessCrystal: { charges: 1, freed: false },
    });
    // Region-boss damage of 3 against 1 charge clamps at 0.
    state = decrementCrystalCharges(state, REGION_BOSS);
    expect(state.princessCrystal.charges).toBe(0);
    // Subsequent decrements are no-ops at the floor regardless of tier.
    state = decrementCrystalCharges(state, GRUNT_ORC);
    expect(state.princessCrystal.charges).toBe(0);
    // Freed still false — charges=0 alone doesn't free the Princess.
    expect(state.princessCrystal.freed).toBe(false);
  });

  it('(b) decrementCrystalCharges is a no-op once the Princess is freed', () => {
    const state = makeState({
      princessCrystal: { charges: 0, freed: true },
    });
    const next = decrementCrystalCharges(state, GRUNT_ORC);
    expect(next).toBe(state);
  });

  it('(c) strikePrincessCrystal at charges > 0 is a no-op', () => {
    const state = makeState({
      princessCrystal: { charges: 3, freed: false },
    });
    const next = strikePrincessCrystal(state);
    expect(next).toBe(state);
    expect(next.princessCrystal.freed).toBe(false);
    expect(next.sharedTriforce.wisdom).toBe(false);
  });

  it('(d) strikePrincessCrystal at charges=0 flips freed + shared wisdom + both players wisdomsLight', () => {
    const state = makeState({
      princessCrystal: { charges: 0, freed: false },
    });
    const next = strikePrincessCrystal(state);
    expect(next.princessCrystal.freed).toBe(true);
    expect(next.princessCrystal.charges).toBe(0);
    expect(next.sharedTriforce.wisdom).toBe(true);
    // The other shards are untouched — only the wisdom flag flips.
    expect(next.sharedTriforce.courage).toBe(false);
    expect(next.sharedTriforce.power).toBe(false);
    // BOTH players receive the shared wisdomsLight buff.
    expect(next.players[0].wisdomsLight).toBe(true);
    expect(next.players[1].wisdomsLight).toBe(true);
  });

  it('(d+princess) strikePrincessCrystal grants a Freed Princess hero card to BOTH players discard', () => {
    // fix-aurelia 2026-04-22 + embertide-ajx1 (2026-04-26): the freed
    // princess is now a HERO card (not an item), and on crystal break
    // both players get a fresh copy in their discard pile (Ascension-
    // canonical "card joins your deck, cycles in next shuffle"). Card
    // id is generic ('freed-princess') per IP-safety; the runtime
    // theme surfaces it as "Princess Aurelia". The pre-ajx1 grant
    // landed in `items`; this test pins the post-ajx1 contract.
    const state = makeState({
      princessCrystal: { charges: 0, freed: false },
    });
    const next = strikePrincessCrystal(state);

    for (const player of next.players) {
      // Items zone gets NO copy under the new ajx1 contract.
      const itemsCopies = player.items.filter((card) => {
        const baseId = (card as { baseId?: string }).baseId ?? card.id;
        return baseId === 'freed-princess';
      });
      expect(itemsCopies).toHaveLength(0);

      const discardCopies = player.discard.filter((card) => {
        const baseId = (card as { baseId?: string }).baseId ?? card.id;
        return baseId === 'freed-princess';
      });
      expect(discardCopies).toHaveLength(1);
      // Each minted copy carries the canonical base id for effect lookup.
      expect((discardCopies[0] as { baseId?: string }).baseId).toBe('freed-princess');
      // Role flips item → hero per ajx1.
      expect(discardCopies[0].role).toBe('hero');
    }

    // Unique ids per copy so the two players' grants don't collide in
    // buildCombatDeck (same contract as heirloom/wisp mints).
    expect(next.players[0].discard.at(-1)?.id).not.toBe(next.players[1].discard.at(-1)?.id);
  });

  it('(e) strikePrincessCrystal on an already-freed crystal is idempotent', () => {
    const state = makeState({
      princessCrystal: { charges: 0, freed: true },
      sharedTriforce: { wisdom: true, courage: false, power: false },
      players: [
        makePlayer({ id: 'p0', wisdomsLight: true }),
        makePlayer({ id: 'p1', wisdomsLight: true }),
      ],
    });
    const next = strikePrincessCrystal(state);
    expect(next).toBe(state);
  });

  it('decrementCrystalCharges returns new state (immutability)', () => {
    const state = makeState();
    const next = decrementCrystalCharges(state, GRUNT_ORC);
    expect(next).not.toBe(state);
    expect(next.princessCrystal).not.toBe(state.princessCrystal);
  });

  it('strikePrincessCrystal returns a new state with a fresh players array (immutability)', () => {
    const state = makeState({
      princessCrystal: { charges: 0, freed: false },
    });
    const next = strikePrincessCrystal(state);
    expect(next).not.toBe(state);
    expect(next.players).not.toBe(state.players);
    // Original state unchanged.
    expect(state.princessCrystal.freed).toBe(false);
    expect(state.players[0].wisdomsLight).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// fightMonster kill-path integration.
// ---------------------------------------------------------------------------

describe('fightMonster decrements the Princess Crystal counter (u-2e + vj52)', () => {
  it('each regular field-monster kill decrements charges by 1 (8 kills → 0)', () => {
    const monsterCopies: Card[] = Array.from({ length: 8 }, (_, i) => ({
      ...GRUNT_ORC,
      id: `grunt-orc-${i}`,
    }));
    let state = makeState({
      players: [makePlayer({ id: 'p0', red: 30, hp: 5, hpMax: 5 }), makePlayer({ id: 'p1' })],
      field: monsterCopies.slice(),
    });
    expect(state.princessCrystal.charges).toBe(8);
    for (let i = 0; i < 8; i += 1) {
      state = fightMonster(state, 0, `grunt-orc-${i}`);
      expect(state.princessCrystal.charges).toBe(8 - (i + 1));
    }
    // At 8 regular kills, charges floor at 0 and freed is still false —
    // a Strike is required to actually claim the Wisdom shard.
    expect(state.princessCrystal.charges).toBe(0);
    expect(state.princessCrystal.freed).toBe(false);
    expect(state.sharedTriforce.wisdom).toBe(false);
  });

  it('(h) kills past freed=true do NOT further decrement charges (idempotent)', () => {
    // Crystal already freed — fightMonster must NOT clobber it.
    let state = makeState({
      players: [makePlayer({ id: 'p0', red: 20 }), makePlayer({ id: 'p1' })],
      field: [{ ...GRUNT_ORC, id: 'grunt-orc-post' }],
      princessCrystal: { charges: 0, freed: true },
      sharedTriforce: { wisdom: true, courage: false, power: false },
    });
    state = fightMonster(state, 0, 'grunt-orc-post');
    expect(state.princessCrystal.charges).toBe(0);
    expect(state.princessCrystal.freed).toBe(true);
    expect(state.sharedTriforce.wisdom).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// End-to-end via the Zustand store: 5 fightMonster kills → Strike → win.
// ---------------------------------------------------------------------------

describe('end-to-end: store-driven kill path + strikePrincessCrystal (u-2e + vj52)', () => {
  it('8 regular fightMonster kills drop charges to 0, then strikePrincessCrystal() grants the shared wisdom shard', () => {
    const store = createGameStore(1);
    store.getState().initGame({
      players: 2,
      championIds: ['champion-power', 'champion-courage'],
    });
    expect(store.getState().princessCrystal.charges).toBe(8);
    expect(store.getState().princessCrystal.freed).toBe(false);

    // Seed the active player with enough red + manufacture a field of
    // kill-worthy monsters. We replace the store's field wholesale so we
    // aren't fighting market RNG — this isolates the crystal-decrement
    // contract.
    const monsterCopies: Card[] = Array.from({ length: 8 }, (_, i) => ({
      ...GRUNT_ORC,
      id: `crystal-test-grunt-${i}`,
    }));
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], red: 30 };
      return { ...s, players, field: monsterCopies };
    });

    for (let i = 0; i < 8; i += 1) {
      store.getState().fightMonster(`crystal-test-grunt-${i}`);
    }
    expect(store.getState().princessCrystal.charges).toBe(0);
    expect(store.getState().princessCrystal.freed).toBe(false);
    expect(store.getState().sharedTriforce.wisdom).toBe(false);
    // Both players start with wisdomsLight=false — confirm the Strike is
    // what lights them up, not the kills.
    expect(store.getState().players[0].wisdomsLight).toBe(false);
    expect(store.getState().players[1].wisdomsLight).toBe(false);

    store.getState().strikePrincessCrystal();
    const after = store.getState();
    expect(after.princessCrystal.freed).toBe(true);
    expect(after.sharedTriforce.wisdom).toBe(true);
    expect(after.players[0].wisdomsLight).toBe(true);
    expect(after.players[1].wisdomsLight).toBe(true);
  });

  it('defeatAlwaysAvailable (wild-wolf) decrements the crystal counter same as field kills', () => {
    const store = createGameStore(1);
    store.getState().initGame({
      players: 2,
      championIds: ['champion-power', 'champion-courage'],
    });
    // Sanity: wild-wolf template must exist under the always-available id.
    expect(findAlwaysAvailable('wild-wolf')).toBeTruthy();

    // Each wild-wolf kill costs 2 red; give p0 enough red for 3 kills.
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], red: 10 };
      return { ...s, players };
    });

    // wild-wolf is `role: monster` with no `bossTier` (regular tier) →
    // crystalDamageFor(wolf) === 1. Three kills decrement 8 → 7 → 6 → 5.
    store.getState().defeatAlwaysAvailable('wild-wolf');
    expect(store.getState().princessCrystal.charges).toBe(7);
    store.getState().defeatAlwaysAvailable('wild-wolf');
    expect(store.getState().princessCrystal.charges).toBe(6);
    store.getState().defeatAlwaysAvailable('wild-wolf');
    expect(store.getState().princessCrystal.charges).toBe(5);
    // Wild-wolf isn't banished — p0 still hasn't freed the Princess.
    expect(store.getState().princessCrystal.freed).toBe(false);
    expect(store.getState().sharedTriforce.wisdom).toBe(false);
  });

  it('strikePrincessCrystal is a no-op when charges > 0 (defensive guard)', () => {
    const store = createGameStore(1);
    store.getState().initGame({
      players: 2,
      championIds: ['champion-power', 'champion-courage'],
    });
    // Fresh state: 8 charges (vj52), no kills landed.
    store.getState().strikePrincessCrystal();
    const after = store.getState();
    expect(after.princessCrystal.charges).toBe(8);
    expect(after.princessCrystal.freed).toBe(false);
    expect(after.sharedTriforce.wisdom).toBe(false);
    expect(after.players[0].wisdomsLight).toBe(false);
    expect(after.players[1].wisdomsLight).toBe(false);
  });

  it('strikePrincessCrystal respects the terminal outcome gate', () => {
    const store = createGameStore(1);
    store.getState().initGame({
      players: 2,
      championIds: ['champion-power', 'champion-courage'],
    });
    // Force charges to 0 and outcome='loss' — the Strike must NOT flip
    // wisdom (and must not overwrite the terminal loss outcome).
    store.setState((s) => ({
      ...s,
      princessCrystal: { charges: 0, freed: false },
      outcome: 'loss' as const,
    }));
    store.getState().strikePrincessCrystal();
    const after = store.getState();
    expect(after.outcome).toBe('loss');
    expect(after.princessCrystal.freed).toBe(false);
    expect(after.sharedTriforce.wisdom).toBe(false);
  });

  it('strikePrincessCrystal throws outside Main phase (phase guard)', () => {
    const store = createGameStore(1);
    store.getState().initGame({
      players: 2,
      championIds: ['champion-power', 'champion-courage'],
    });
    store.setState((s) => ({
      ...s,
      phase: 'Upkeep' as const,
      princessCrystal: { charges: 0, freed: false },
    }));
    expect(() => store.getState().strikePrincessCrystal()).toThrow(/main-phase action/i);
  });

  it('Strike completing the 3-shard pool flips outcome=win via checkCoopVictory', () => {
    const store = createGameStore(1);
    store.getState().initGame({
      players: 2,
      championIds: ['champion-power', 'champion-courage'],
    });
    // Pre-stage: other two shards already in the pool, crystal fully
    // drained. The Strike should complete the shared three-shard win.
    store.setState((s) => ({
      ...s,
      princessCrystal: { charges: 0, freed: false },
      sharedTriforce: { wisdom: false, courage: true, power: true },
    }));
    store.getState().strikePrincessCrystal();
    expect(store.getState().outcome).toBe('win');
    expect(store.getState().sharedTriforce.wisdom).toBe(true);
  });

  it('kills by BOTH players decrement the shared counter (amendment A2 — striker identity irrelevant)', () => {
    // Core co-op invariant: the crystal counter is SHARED. A mix of
    // p0 kills and p1 kills hitting 8 total regular kills (vj52) should
    // drop charges to 0 regardless of who killed what.
    const store = createGameStore(1);
    store.getState().initGame({
      players: 2,
      championIds: ['champion-power', 'champion-courage'],
    });
    const monsterCopies: Card[] = Array.from({ length: 8 }, (_, i) => ({
      ...GRUNT_ORC,
      id: `mixed-grunt-${i}`,
    }));
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], red: 30 };
      players[1] = { ...players[1], red: 30 };
      return { ...s, players, field: monsterCopies };
    });

    // p0 kills three.
    store.getState().fightMonster('mixed-grunt-0');
    store.getState().fightMonster('mixed-grunt-1');
    store.getState().fightMonster('mixed-grunt-2');
    expect(store.getState().princessCrystal.charges).toBe(5);

    // Switch active player to p1 (bypass endTurn so we stay in Main for
    // the next fightMonster call — endTurn would cycle phases).
    store.setState((s) => ({ ...s, currentPlayerIndex: 1 }));

    // p1 kills five.
    store.getState().fightMonster('mixed-grunt-3');
    store.getState().fightMonster('mixed-grunt-4');
    store.getState().fightMonster('mixed-grunt-5');
    store.getState().fightMonster('mixed-grunt-6');
    store.getState().fightMonster('mixed-grunt-7');
    expect(store.getState().princessCrystal.charges).toBe(0);
    expect(store.getState().princessCrystal.freed).toBe(false);
  });

  it('Strike by p1 grants wisdomsLight to BOTH players (striker identity irrelevant)', () => {
    // Amendment A2: "Wisdom shard goes to the SHARED pool regardless of
    // which player strikes the Crystal." Same for wisdomsLight — both
    // players get it, whoever triggers the Strike.
    const store = createGameStore(1);
    store.getState().initGame({
      players: 2,
      championIds: ['champion-power', 'champion-courage'],
    });
    store.setState((s) => ({
      ...s,
      currentPlayerIndex: 1, // p1 is the striker
      princessCrystal: { charges: 0, freed: false },
    }));
    store.getState().strikePrincessCrystal();
    const after = store.getState();
    expect(after.princessCrystal.freed).toBe(true);
    expect(after.sharedTriforce.wisdom).toBe(true);
    // BOTH players receive wisdomsLight — not just the striker.
    expect(after.players[0].wisdomsLight).toBe(true);
    expect(after.players[1].wisdomsLight).toBe(true);
  });

  it('downed active player cannot Strike the crystal (amendment A3 contract)', () => {
    // Downed players cannot take main-phase actions. Even if the crystal
    // is at charges=0 and phase=Main, a downed active player's Strike
    // must be a no-op. Reviewer finding from the u-2e review pass.
    const store = createGameStore(1);
    store.getState().initGame({
      players: 2,
      championIds: ['champion-power', 'champion-courage'],
    });
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], hp: 0, downed: true };
      return {
        ...s,
        players,
        princessCrystal: { charges: 0, freed: false },
      };
    });
    store.getState().strikePrincessCrystal();
    const after = store.getState();
    // Crystal state unchanged.
    expect(after.princessCrystal.freed).toBe(false);
    expect(after.sharedTriforce.wisdom).toBe(false);
    expect(after.players[0].wisdomsLight).toBe(false);
    expect(after.players[1].wisdomsLight).toBe(false);
  });
});
