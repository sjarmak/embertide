import { describe, it, expect } from 'vitest';
import { createGameStore } from './gameStore';

/**
 * embertide-1eby: Pell (the Key Vendor) is a vendor service, not a
 * buyable hero. `tradeWithKeyVendor()` swaps 4 green for 1 key on the
 * spot — no card mints, no draw cycle.
 *
 * embertide-5y13 knob 2 (2026-04-25): rate-limited to 1 trade per
 * seat-turn so the green→key→chest treadmill no longer dominates the
 * field-buy economy. Flag resets at End-phase rotation.
 *
 * Coverage:
 *
 *   (a) happy path: 4g → +1 key, no card mints anywhere.
 *   (b) throws when active player has insufficient green.
 *   (c) throws when active player is downed.
 *   (d) no-op once outcome is set.
 *   (e) second trade same seat-turn throws (knob 2 cap).
 *   (f) does not touch the inactive player's resources.
 *   (g) usedKeyVendorThisTurn flag resets at End-phase rotation.
 *   (h) per-player flag — p0 trading does not consume p1's trade.
 */

function bootstrap() {
  const store = createGameStore(1);
  store.getState().initGame({
    players: 2,
    championIds: ['champion-power', 'champion-courage'],
  });
  return store;
}

function pumpGreen(store: ReturnType<typeof bootstrap>, amount: number, playerIdx = 0): void {
  store.setState((s) => {
    const players = s.players.slice();
    players[playerIdx] = { ...players[playerIdx], green: amount };
    return { ...s, players };
  });
}

describe('tradeWithKeyVendor (embertide-1eby)', () => {
  it('(a) trades 4 green for +1 key with no card mint', () => {
    const store = bootstrap();
    pumpGreen(store, 5);
    const before = store.getState().players[0];
    const beforeDeckSize = before.deck.length + before.hand.length + before.discard.length;

    store.getState().tradeWithKeyVendor();

    const after = store.getState().players[0];
    expect(after.green).toBe(1);
    expect(after.keys).toBe(before.keys + 1);
    const afterDeckSize = after.deck.length + after.hand.length + after.discard.length;
    expect(afterDeckSize).toBe(beforeDeckSize);
    expect(after.banished).toHaveLength(0);
  });

  it('(b) throws when the active player has insufficient green', () => {
    const store = bootstrap();
    pumpGreen(store, 3);
    expect(() => store.getState().tradeWithKeyVendor()).toThrow(
      /tradeWithKeyVendor: insufficient green/,
    );
  });

  it('(c) throws when the active player is downed', () => {
    const store = bootstrap();
    pumpGreen(store, 10);
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], downed: true, hp: 0 };
      return { ...s, players };
    });
    expect(() => store.getState().tradeWithKeyVendor()).toThrow(
      /tradeWithKeyVendor: active player is downed/,
    );
  });

  it('(d) is a no-op once the game outcome is set', () => {
    const store = bootstrap();
    pumpGreen(store, 10);
    store.setState((s) => ({ ...s, outcome: 'win' }));
    const before = store.getState().players[0];
    store.getState().tradeWithKeyVendor();
    const after = store.getState().players[0];
    expect(after.green).toBe(before.green);
    expect(after.keys).toBe(before.keys);
  });

  it('(e) second trade in the same seat-turn throws (5y13 knob 2 cap)', () => {
    const store = bootstrap();
    pumpGreen(store, 9);
    store.getState().tradeWithKeyVendor();
    expect(() => store.getState().tradeWithKeyVendor()).toThrow(/already traded this turn/);
    // Resources from the first trade are intact; the second throw has no side-effects.
    const after = store.getState().players[0];
    expect(after.green).toBe(5);
    expect(after.keys).toBe(1);
    expect(after.usedKeyVendorThisTurn).toBe(true);
  });

  it('(f) does not touch the inactive player', () => {
    const store = bootstrap();
    pumpGreen(store, 5);
    const p1Before = store.getState().players[1];
    store.getState().tradeWithKeyVendor();
    const p1After = store.getState().players[1];
    expect(p1After).toBe(p1Before);
  });

  // Walk Main → BossResolve → End → (rotation + Upkeep) — that's 3
  // advancePhase calls. The End-block fires when phase is END at call
  // time, so the rotation lands on the third hop.
  function rotateToNextPlayer(store: ReturnType<typeof bootstrap>): void {
    store.setState((s) => ({ ...s, phase: 'Main' as const }));
    store.getState().advancePhase(); // Main → BossResolve
    store.getState().advancePhase(); // BossResolve → End
    store.getState().advancePhase(); // End → rotate + Upkeep
  }

  it('(g) usedKeyVendorThisTurn flag resets at End-phase rotation (5y13 knob 2)', () => {
    const store = bootstrap();
    pumpGreen(store, 5);
    store.getState().tradeWithKeyVendor();
    expect(store.getState().players[0].usedKeyVendorThisTurn).toBe(true);
    rotateToNextPlayer(store);
    // p0 is now the OUTGOING player whose flag was reset in End-block.
    const p0After = store.getState().players[0];
    expect(p0After.usedKeyVendorThisTurn).toBe(false);
  });

  it('(h) per-player flag — p0 trading does not consume p1 trade (5y13 knob 2)', () => {
    const store = bootstrap();
    pumpGreen(store, 5, 0);
    pumpGreen(store, 5, 1);
    store.getState().tradeWithKeyVendor(); // p0
    expect(store.getState().players[0].usedKeyVendorThisTurn).toBe(true);
    expect(store.getState().players[1].usedKeyVendorThisTurn).toBe(false);
    rotateToNextPlayer(store);
    expect(store.getState().currentPlayerIndex).toBe(1);
    // After rotation, phase is Upkeep — walk Upkeep→Draw→Main so p1's
    // tradeWithKeyVendor passes requireMainPhase.
    store.getState().advancePhase(); // Upkeep → Draw
    store.getState().advancePhase(); // Draw → Main
    store.getState().tradeWithKeyVendor(); // p1's first trade should succeed
    const p1After = store.getState().players[1];
    expect(p1After.usedKeyVendorThisTurn).toBe(true);
    // p1 paid 4g; pumpGreen seeded 5 → 1 left.
    expect(p1After.green).toBe(1);
  });
});
