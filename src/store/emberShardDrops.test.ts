import { describe, expect, it } from 'vitest';
import type { Card } from '../types/card';
import type { KidGameState, KidPlayer } from './types';
import { applyHeartDropHooks } from './slices/combat';
import {
  ALWAYS_AVAILABLE,
  GRUNT_HEART_METER_IDS,
  KID_CARDS,
  GILDED_CAGE_REGULARS,
  TOUGH_EMBER_SHARD_IDS,
} from '../data/cards';
import { makeKidPlayer, makeKidGameState } from '../testing/stateFixtures';

/**
 * Unit coverage for the v2.1 gm0.17 three-tier ember-shard drop system
 * (embertide-0jf). The `applyHeartDropHooks` helper is called from
 * `fightMonster` and `defeatAlwaysAvailableMonster` after the boss-defeat
 * hooks have landed; slot-boss container drops live in the
 * COMBAT_RESOLVE_WIN reducer (covered by the integration test in
 * `gameStore.test.ts`).
 *
 * What's covered here:
 *   - Grunt meter: 1/3, 2/3, 3/3 → piece + reset.
 *   - Grunt meter auto-promotes heartPieces at 4 (gm0.16 contract).
 *   - Tough: 1 kill = 1 piece (direct `addEmberShard`).
 *   - Tough: 4th kill auto-promotes to a vital ember.
 *   - Out-of-tier cards (grunt-orc / wild-wolf / brute): no effect.
 *   - Grunt precedence rule (when an id would be in both sets, grunt
 *     wins — defensive; the constants are disjoint by construction).
 */

const makePlayer = (overrides: Partial<KidPlayer> = {}): KidPlayer =>
  makeKidPlayer({
    name: 'Player 1',
    championId: 'champion-courage',
    championSlot: 'champion-courage',
    ...overrides,
  });

const makeState = (player: KidPlayer): KidGameState => makeKidGameState({ players: [player] });

function cardById(id: string): Card {
  // Union of KID_CARDS + GILDED_CAGE_REGULARS + ALWAYS_AVAILABLE so
  // tough/grunt ids resolve regardless of which roster they live in.
  // z9xq added wild-wolf (ALWAYS_AVAILABLE) to GRUNT_HEART_METER_IDS.
  const c =
    KID_CARDS.find((card) => card.id === id) ??
    GILDED_CAGE_REGULARS.find((card) => card.id === id) ??
    ALWAYS_AVAILABLE.find((card) => card.id === id);
  if (!c) throw new Error(`test fixture missing card "${id}"`);
  return c;
}

describe('applyHeartDropHooks — Tier 1 (grunt meter)', () => {
  it('1st grunt defeat bumps emberShardMeter from 0 → 1 (no piece yet)', () => {
    const state = makeState(makePlayer({ emberShardMeter: 0, heartPieces: 0 }));
    const next = applyHeartDropHooks(state, cardById('thorn-scrub'), 0);
    expect(next.players[0].emberShardMeter).toBe(1);
    expect(next.players[0].heartPieces).toBe(0);
  });

  it('2nd grunt defeat bumps meter to 2 (no piece)', () => {
    const state = makeState(makePlayer({ emberShardMeter: 1, heartPieces: 0 }));
    const next = applyHeartDropHooks(state, cardById('jellet'), 0);
    expect(next.players[0].emberShardMeter).toBe(2);
    expect(next.players[0].heartPieces).toBe(0);
  });

  it('3rd grunt defeat promotes: meter resets 2 → 0 AND heartPieces += 1', () => {
    const state = makeState(makePlayer({ emberShardMeter: 2, heartPieces: 0 }));
    const next = applyHeartDropHooks(state, cardById('scrabling'), 0);
    expect(next.players[0].emberShardMeter).toBe(0);
    expect(next.players[0].heartPieces).toBe(1);
  });

  it('grunt meter 3rd kill at heartPieces=3 auto-promotes to container (gm0.16 contract)', () => {
    // heartPieces=3 + meter=2 → 3rd grunt kill bumps meter to 3 which
    // triggers addEmberShardLocal; that sees heartPieces=3 → next=4
    // → resets to 0 AND grows hp+hpMax by 1 via applyHeartReward.
    const state = makeState(makePlayer({ emberShardMeter: 2, heartPieces: 3, hp: 5, hpMax: 5 }));
    const next = applyHeartDropHooks(state, cardById('skittermite'), 0);
    expect(next.players[0].emberShardMeter).toBe(0);
    expect(next.players[0].heartPieces).toBe(0);
    expect(next.players[0].hpMax).toBe(6);
    expect(next.players[0].hp).toBe(6);
  });

  it('chains three grunt kills deterministically: meter 0→1→2→0 + piece', () => {
    let state = makeState(makePlayer());
    state = applyHeartDropHooks(state, cardById('snapvine'), 0);
    state = applyHeartDropHooks(state, cardById('snapvine'), 0);
    state = applyHeartDropHooks(state, cardById('snapvine'), 0);
    expect(state.players[0].emberShardMeter).toBe(0);
    expect(state.players[0].heartPieces).toBe(1);
  });

  it('all 8 GRUNT_HEART_METER_IDS entries route through the meter path', () => {
    for (const id of GRUNT_HEART_METER_IDS) {
      const state = makeState(makePlayer({ emberShardMeter: 0 }));
      const next = applyHeartDropHooks(state, cardById(id), 0);
      expect(next.players[0].emberShardMeter, `grunt id "${id}" must bump emberShardMeter`).toBe(1);
    }
  });
});

describe('applyHeartDropHooks — Tier 2 (tough piece direct)', () => {
  it('1 tough defeat = 1 ember shard directly (heartPieces 0 → 1, meter unchanged)', () => {
    const state = makeState(makePlayer({ emberShardMeter: 1 }));
    const next = applyHeartDropHooks(state, cardById('saurian'), 0);
    expect(next.players[0].heartPieces).toBe(1);
    // Meter is untouched — tough drops bypass the meter entirely.
    expect(next.players[0].emberShardMeter).toBe(1);
  });

  it('4th tough kill auto-promotes to vital ember (gm0.16 contract)', () => {
    const state = makeState(makePlayer({ heartPieces: 3, hp: 5, hpMax: 5 }));
    const next = applyHeartDropHooks(state, cardById('ashjaw'), 0);
    expect(next.players[0].heartPieces).toBe(0);
    expect(next.players[0].hpMax).toBe(6);
    expect(next.players[0].hp).toBe(6);
  });

  it('all 6 TOUGH_EMBER_SHARD_IDS entries grant a piece per defeat', () => {
    for (const id of TOUGH_EMBER_SHARD_IDS) {
      const state = makeState(makePlayer({ heartPieces: 0 }));
      const next = applyHeartDropHooks(state, cardById(id), 0);
      expect(next.players[0].heartPieces, `tough id "${id}" must grant a piece`).toBe(1);
    }
  });
});

describe('applyHeartDropHooks — Tier fallback (no effect)', () => {
  it('grunt-orc (generic monster, not grunt-tier) does NOT bump meter or pieces', () => {
    const state = makeState(makePlayer({ emberShardMeter: 1, heartPieces: 2 }));
    const next = applyHeartDropHooks(state, cardById('grunt-orc'), 0);
    expect(next.players[0].emberShardMeter).toBe(1);
    expect(next.players[0].heartPieces).toBe(2);
    // Returns same reference when both sets miss — immutability contract.
    expect(next).toBe(state);
  });

  it('wild-wolf (always-available "Scrabling" tile) routes through grunt meter (z9xq)', () => {
    // z9xq (2026-04-25): wild-wolf was outside both sets pre-fix. Adding
    // it to GRUNT_HEART_METER_IDS converts the always-available kill
    // from a +1 hp grant into a meter contribution (3 kills = 1 piece).
    const state = makeState(makePlayer({ emberShardMeter: 0, heartPieces: 0 }));
    const next = applyHeartDropHooks(state, cardById('wild-wolf'), 0);
    expect(next.players[0].emberShardMeter).toBe(1);
    expect(next.players[0].heartPieces).toBe(0);
  });

  it('no grunt id is also in the tough set (disjointness invariant)', () => {
    for (const gid of GRUNT_HEART_METER_IDS) {
      expect(TOUGH_EMBER_SHARD_IDS.has(gid), `id "${gid}" in both sets`).toBe(false);
    }
  });

  it('missing defeater index returns state unchanged', () => {
    const state = makeState(makePlayer());
    const next = applyHeartDropHooks(state, cardById('scrabling'), 5);
    expect(next).toBe(state);
  });
});
