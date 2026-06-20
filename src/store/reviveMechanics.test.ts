import { describe, it, expect } from 'vitest';
import { createGameStore, applyDamage } from './gameStore';
import { KID_CARDS } from '../data/cards';

/**
 * u-1d: downed/revive/wisp mechanic tests (amendment A3 + A6).
 *
 * Covers:
 *  (a) reviveTeammate restores the downed teammate to 1 HP, clears downed,
 *      and consumes the reviver's per-incident budget
 *  (b) reviveTeammate throws when the reviver has already revived this
 *      incident (revivedThisIncident=true)
 *  (c) reviveTeammate throws when the target is not downed
 *  (d) revivedThisIncident resets on the NEXT time that player becomes
 *      downed (a new incident, not the same one)
 *  (e) playFairyOn consumes a wisp from the active player's items zone
 *      and restores the target to hpMax
 *  (f) playFairyOn is a no-op (card NOT consumed) when the target is
 *      not downed
 *  (g) both revive paths are gated on state.outcome (no-op when the game
 *      has already ended)
 */

const WISP = KID_CARDS.find((c) => c.id === 'wisp');
if (!WISP) throw new Error('wisp card fixture missing');

function freshStore() {
  const store = createGameStore(1);
  store.getState().initGame({
    players: 2,
    championIds: ['champion-power', 'champion-courage'],
  });
  return store;
}

describe('reviveTeammate (amendment A3)', () => {
  it('(a) revives a downed teammate to 1 HP and consumes the reviver budget', () => {
    const store = freshStore();
    // Down player p1 (non-active). Active player p0 revives.
    store.setState((s) => {
      const players = s.players.slice();
      players[1] = { ...players[1], hp: 0, downed: true };
      return { ...s, players };
    });
    store.getState().reviveTeammate('p1');

    const after = store.getState();
    expect(after.players[1].hp).toBe(1);
    expect(after.players[1].downed).toBe(false);
    expect(after.players[0].revivedThisIncident).toBe(true);
    // The target's revivedThisIncident flag is unchanged (that's the
    // reviver's budget, not the target's).
    expect(after.players[1].revivedThisIncident).toBe(false);
  });

  it('(b) throws when the reviver has already revived this incident', () => {
    const store = freshStore();
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], revivedThisIncident: true };
      players[1] = { ...players[1], hp: 0, downed: true };
      return { ...s, players };
    });
    expect(() => store.getState().reviveTeammate('p1')).toThrow(/already revived/i);
  });

  it('(c) throws when the target is not downed', () => {
    const store = freshStore();
    // p1 is at full HP, not downed.
    expect(() => store.getState().reviveTeammate('p1')).toThrow(/not downed/i);
  });

  it('throws when trying to revive yourself', () => {
    const store = freshStore();
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], hp: 0, downed: true };
      return { ...s, players };
    });
    expect(() => store.getState().reviveTeammate('p0')).toThrow(/cannot revive yourself/i);
  });

  it('throws on unknown playerId', () => {
    const store = freshStore();
    expect(() => store.getState().reviveTeammate('p99')).toThrow(/unknown playerId/i);
  });

  it('(d) a new downed incident resets the reviver budget for that player', () => {
    // After a revive, p0's revivedThisIncident is true. When p0 themselves
    // become downed (new incident for p0), their revivedThisIncident resets
    // to false. The reset is performed by applyDamage (u-1a), so here we
    // drive the end-to-end scenario: p0 revives p1, p0 then takes damage
    // to 0, then — crucially — p0's budget is fresh again.
    const store = freshStore();
    store.setState((s) => {
      const players = s.players.slice();
      players[1] = { ...players[1], hp: 0, downed: true };
      return { ...s, players };
    });
    store.getState().reviveTeammate('p1');
    expect(store.getState().players[0].revivedThisIncident).toBe(true);

    // Now damage p0 to 0 using the pure applyDamage helper. The store
    // doesn't yet expose a damage-emitting action (u-7 adds Wild-Boss AoE);
    // for u-1d we assert the reset invariant via the helper directly.
    const p0Damaged = applyDamage(store.getState().players[0], 5);
    expect(p0Damaged.hp).toBe(0);
    expect(p0Damaged.downed).toBe(true);
    expect(p0Damaged.revivedThisIncident).toBe(false);
  });
});

describe('playFairyOn (amendment A6)', () => {
  it('(e) consumes a wisp from the items zone and restores the target to hpMax', () => {
    const store = freshStore();
    store.setState((s) => {
      const players = s.players.slice();
      // Put a wisp in p0's items zone and down p1.
      players[0] = { ...players[0], items: [WISP] };
      players[1] = { ...players[1], hp: 0, downed: true, hpMax: 5 };
      return { ...s, players };
    });
    store.getState().playFairyOn('p1');

    const after = store.getState();
    expect(after.players[1].hp).toBe(5);
    expect(after.players[1].downed).toBe(false);
    // Wisp removed from p0's items zone.
    expect(after.players[0].items.some((c) => c.id === 'wisp')).toBe(false);
    // Teammate-revive budget NOT consumed by wisp (orthogonal path).
    expect(after.players[0].revivedThisIncident).toBe(false);
  });

  it('(f) is a no-op when the target is not downed — wisp NOT consumed', () => {
    const store = freshStore();
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], items: [WISP] };
      // p1 at full HP, not downed.
      return { ...s, players };
    });
    store.getState().playFairyOn('p1');

    const after = store.getState();
    // Wisp still in the items zone.
    expect(after.players[0].items.some((c) => c.id === 'wisp')).toBe(true);
    // p1 unchanged.
    expect(after.players[1].hp).toBe(5);
    expect(after.players[1].downed).toBe(false);
  });

  it('throws when the active player has no wisp to play', () => {
    const store = freshStore();
    store.setState((s) => {
      const players = s.players.slice();
      // p1 downed, but p0 has no wisp.
      players[1] = { ...players[1], hp: 0, downed: true };
      return { ...s, players };
    });
    expect(() => store.getState().playFairyOn('p1')).toThrow(/no wisp to play/i);
  });

  it('throws on unknown playerId', () => {
    const store = freshStore();
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], items: [WISP] };
      return { ...s, players };
    });
    expect(() => store.getState().playFairyOn('p99')).toThrow(/unknown playerId/i);
  });

  it('restores to the actual hpMax (not a hard-coded 5) — honors variable hpMax', () => {
    const store = freshStore();
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], items: [WISP] };
      players[1] = { ...players[1], hp: 0, hpMax: 8, downed: true };
      return { ...s, players };
    });
    store.getState().playFairyOn('p1');
    expect(store.getState().players[1].hp).toBe(8);
  });
});

describe('(g) revive paths respect terminal outcome', () => {
  it('reviveTeammate is a no-op when outcome is set', () => {
    const store = freshStore();
    store.setState((s) => {
      const players = s.players.slice();
      players[1] = { ...players[1], hp: 0, downed: true };
      return { ...s, players, outcome: 'win' };
    });
    store.getState().reviveTeammate('p1');
    // p1 stays downed; outcome is the authoritative terminal state.
    expect(store.getState().players[1].downed).toBe(true);
    expect(store.getState().players[1].hp).toBe(0);
  });

  it('playFairyOn is a no-op when outcome is set', () => {
    const store = freshStore();
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], items: [WISP] };
      players[1] = { ...players[1], hp: 0, downed: true };
      return { ...s, players, outcome: 'loss' };
    });
    store.getState().playFairyOn('p1');
    // Wisp NOT consumed; target NOT revived.
    expect(store.getState().players[0].items.some((c) => c.id === 'wisp')).toBe(true);
    expect(store.getState().players[1].downed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// v2.1 gm0.16: wisp-variant revive contracts.
// ---------------------------------------------------------------------------

const GREAT_WISP = KID_CARDS.find((c) => c.id === 'great-wisp');
if (!GREAT_WISP) throw new Error('great-wisp card fixture missing');

const WISP_IN_BOTTLE = KID_CARDS.find((c) => c.id === 'wisp-in-bottle');
if (!WISP_IN_BOTTLE) throw new Error('wisp-in-bottle card fixture missing');

describe('playFairyOn — great-wisp revive (v2.1 gm0.16)', () => {
  it('consumes a great-wisp and restores the downed teammate to hpMax', () => {
    const store = freshStore();
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], items: [GREAT_WISP] };
      players[1] = { ...players[1], hp: 0, downed: true, hpMax: 5 };
      return { ...s, players };
    });
    store.getState().playFairyOn('p1');
    const after = store.getState();
    expect(after.players[1].hp).toBe(5);
    expect(after.players[1].downed).toBe(false);
    // Great Wisp is consumed, NOT refilled (only wisp-in-bottle
    // refills).
    expect(after.players[0].items.some((c) => c.id === 'great-wisp')).toBe(false);
  });
});

describe('playFairyOn — wisp-in-bottle reusability (v2.1 gm0.16)', () => {
  it('on first revive: consumes and RE-EQUIPS the bottle into the owner items zone', () => {
    const store = freshStore();
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], items: [WISP_IN_BOTTLE] };
      players[1] = { ...players[1], hp: 0, downed: true, hpMax: 5 };
      return { ...s, players };
    });
    store.getState().playFairyOn('p1');
    const after = store.getState();
    expect(after.players[1].hp).toBe(5);
    expect(after.players[1].downed).toBe(false);
    // Bottle re-equipped — still in items zone.
    expect(after.players[0].items.some((c) => c.id === 'wisp-in-bottle')).toBe(true);
    // Bottle id recorded in the used list.
    expect(after.players[0].usedFairyInBottleIds).toContain(WISP_IN_BOTTLE.id);
  });

  it('second revive using the SAME bottle in the SAME combat does NOT re-equip (bottle spent)', () => {
    const store = freshStore();
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], items: [WISP_IN_BOTTLE] };
      players[1] = { ...players[1], hp: 0, downed: true, hpMax: 5 };
      return { ...s, players };
    });
    // First revive refills the bottle.
    store.getState().playFairyOn('p1');
    // Down p1 again.
    store.setState((s) => {
      const players = s.players.slice();
      players[1] = { ...players[1], hp: 0, downed: true };
      return { ...s, players };
    });
    // Second revive should consume WITHOUT refilling.
    store.getState().playFairyOn('p1');
    const after = store.getState();
    expect(after.players[1].hp).toBe(5);
    expect(after.players[1].downed).toBe(false);
    // Bottle gone from items.
    expect(after.players[0].items.some((c) => c.id === 'wisp-in-bottle')).toBe(false);
  });

  it('prefers a plain wisp over a wisp-in-bottle when both are held (avoid wasting the bottle refill)', () => {
    const store = freshStore();
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], items: [WISP_IN_BOTTLE, WISP] };
      players[1] = { ...players[1], hp: 0, downed: true, hpMax: 5 };
      return { ...s, players };
    });
    store.getState().playFairyOn('p1');
    const after = store.getState();
    // Plain wisp consumed (gone). Bottle untouched.
    expect(after.players[0].items.some((c) => c.id === 'wisp')).toBe(false);
    expect(after.players[0].items.some((c) => c.id === 'wisp-in-bottle')).toBe(true);
    // Bottle was never used, so no id in the used list.
    expect(after.players[0].usedFairyInBottleIds).toHaveLength(0);
  });
});

describe('co-op loss guard recognises all three wisp baseIds (v2.1 gm0.16)', () => {
  it('great-wisp in items prevents the co-op loss from firing', () => {
    const store = freshStore();
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = {
        ...players[0],
        hp: 0,
        downed: true,
        revivedThisIncident: true,
        items: [GREAT_WISP],
      };
      players[1] = {
        ...players[1],
        hp: 0,
        downed: true,
        revivedThisIncident: true,
        items: [],
      };
      return { ...s, players };
    });
    // Advance into End phase via endTurn so checkCoopLoss fires.
    store.getState().endTurn();
    // Co-op loss guard held — either player still having a wisp-like
    // item blocks the shared loss. Outcome stays null.
    expect(store.getState().outcome).toBe(null);
  });

  it('wisp-in-bottle in items prevents the co-op loss from firing', () => {
    const store = freshStore();
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = {
        ...players[0],
        hp: 0,
        downed: true,
        revivedThisIncident: true,
        items: [],
      };
      players[1] = {
        ...players[1],
        hp: 0,
        downed: true,
        revivedThisIncident: true,
        items: [WISP_IN_BOTTLE],
      };
      return { ...s, players };
    });
    store.getState().endTurn();
    expect(store.getState().outcome).toBe(null);
  });
});
