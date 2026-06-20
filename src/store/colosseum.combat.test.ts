import { describe, it, expect, beforeEach } from 'vitest';
import { buildResolveWinAction, buildResolveWinForCombat, createGameStore } from './gameStore';
import {
  initialColosseumProgression,
  isTierUnlocked,
  rewardsForTier,
  unlockTier,
} from '../core/colosseum';
import { useColosseumMetaStore } from './colosseumMetaStore';
import { KID_CARDS } from '../data/cards';
import { TIER_1_ROSTER } from '../data/colosseum/tier1';
import { TIER_2_ROSTER } from '../data/colosseum/tier2';
import { recordBossDefeat } from './slices/zones';

/**
 * embertide-4hr1.5 — combat-loop integration for colosseum mode.
 *
 * Acceptance coverage:
 *   A2: entering colosseum invokes the engine's slot router for boss
 *       selection (verified by checking the active combat's
 *       sourceCardId lives in the colosseum tier roster, not the
 *       current zone's wild-boss queue).
 *   A3 (a): tier-1 WIN advances `colosseumProgression` to include
 *           tier 2.
 *   A3 (b): a colosseum LOSS does NOT advance tier-progression state.
 *
 * A1 (existing combat tests pass unchanged) is verified by the rest of
 * the suite — this file only exercises the new colosseum-slot branch.
 */

const CRAGHORN = KID_CARDS.find((c) => c.id === 'craghorn')!;
const BROODMAW = KID_CARDS.find((c) => c.id === 'broodmaw')!;

type Store = ReturnType<typeof createGameStore>;

/**
 * Two-player game with the colosseum-unlock gate satisfied. The unlock
 * gate (`isColosseumUnlocked`) reads `defeatedBossIds` for the Sylvani
 * wild + region pair (craghorn + broodmaw); seeding both lets `enterColosseum`
 * route past the backstop without going through full main-game combat
 * each time.
 */
function colosseumUnlockedGame(seed = 1): Store {
  const store = createGameStore(seed);
  store.getState().initGame({
    players: 2,
    championIds: ['champion-power', 'champion-wisdom'],
    seed,
  });
  store.setState((s) => recordBossDefeat(recordBossDefeat(s, 'craghorn'), 'broodmaw'));
  return store;
}

/**
 * Resolve the active combat as a colosseum-slot WIN by routing through
 * the same `buildResolveWinForCombat` helper that the engine's
 * `dispatchCombatAction` terminal='win' chain calls in production. If
 * the colosseum branch of that function grows new fields, this helper
 * picks them up automatically — synthesizing a hardcoded payload here
 * would let the tests pass with stale zeros while production diverged
 * (embertide-4hr1.15).
 *
 * The colosseum branch skips `cardByIdOrThrow` so it's safe for
 * unshipped roster entries (e.g. `coilworm`, `bonereaver`) that don't have
 * a main-game `Card` counterpart yet.
 */
function dispatchColosseumWin(
  store: Store,
  combat?: NonNullable<ReturnType<Store['getState']>['activeCombat']>,
): void {
  const c = combat ?? activeCombatOrThrow(store);
  store.getState().dispatchCombat(buildResolveWinForCombat(c, store.getState().currentZone));
}

/**
 * Read `activeCombat` and throw if null. Vitest's
 * `expect(...).not.toBeNull()` passes the assertion but does NOT narrow
 * the type, so callers reaching for `.boss` / `.entryContext` were
 * forced into `combat!` non-null assertions that mask future regressions.
 * The if-throw form narrows and produces a clear failure message.
 */
function activeCombatOrThrow(
  store: Store,
): NonNullable<ReturnType<Store['getState']>['activeCombat']> {
  const combat = store.getState().activeCombat;
  if (combat === null) {
    throw new Error('expected activeCombat after enterColosseum()');
  }
  return combat;
}

describe('embertide-4hr1.5 — initial colosseum-progression state', () => {
  it('is empty at game-start (no tiers unlocked)', () => {
    const store = createGameStore(1);
    store.getState().initGame({
      players: 2,
      championIds: ['champion-power', 'champion-wisdom'],
    });
    expect(store.getState().colosseumProgression).toEqual(initialColosseumProgression());
    expect(store.getState().colosseumProgression.unlockedTiers).toEqual([]);
  });
});

describe('embertide-4hr1.5 — enterColosseum routing (A2)', () => {
  it('throws when the colosseum is locked (gate backstop)', () => {
    const store = createGameStore(1);
    store.getState().initGame({
      players: 2,
      championIds: ['champion-power', 'champion-wisdom'],
    });
    expect(() => store.getState().enterColosseum()).toThrow(/locked/);
  });

  it('seeds tier 1 on first entry (engine slot-router policy)', () => {
    const store = colosseumUnlockedGame(7);
    expect(store.getState().colosseumProgression.unlockedTiers).toEqual([]);
    store.getState().enterColosseum();
    expect(isTierUnlocked(store.getState().colosseumProgression, 1)).toBe(true);
  });

  it('routes the boss-selection path through the engine slot router', () => {
    const store = colosseumUnlockedGame(7);
    store.getState().enterColosseum();
    const combat = activeCombatOrThrow(store);
    // The selected boss must come from the tier-1 colosseum roster —
    // i.e. the engine's slotRouter, NOT the main-game wild-boss FIFO
    // for the current zone.
    const tier1Ids = TIER_1_ROSTER.map((b) => b.sourceCardId);
    expect(tier1Ids).toContain(combat.boss.sourceCardId);
    // The combat MUST mark itself as a colosseum-slot entry so the
    // resolve-WIN reducer takes the tier-progression branch (not the
    // main-game wild-boss-slot drops branch).
    expect(combat.entryContext.entrySource).toBe('colosseum-slot');
  });
});

describe('embertide-4hr1.5 — tier-progression advance on WIN (A3 a)', () => {
  it('tier-1 WIN unlocks tier 2', () => {
    const store = colosseumUnlockedGame(7);
    store.getState().enterColosseum();

    dispatchColosseumWin(store);

    const progression = store.getState().colosseumProgression;
    expect(isTierUnlocked(progression, 2)).toBe(true);
    expect(store.getState().activeCombat).toBeNull();
  });

  it('tier-1 WIN does NOT advance the main-game defeatedBossIds ledger', () => {
    // Colosseum bosses share `sourceCardId` with main-zone wild-bosses
    // (e.g. 'craghorn'). If the reducer accidentally fed a colosseum kill
    // through `recordBossDefeat`, it would advance the wild-boss FIFO
    // queue and (in the seed-state we use) leave duplicate entries in
    // `defeatedBossIds`. Snapshot the ledger before/after to lock the
    // separation.
    const store = colosseumUnlockedGame(7);
    const beforeDefeated = [...store.getState().defeatedBossIds].sort();

    store.getState().enterColosseum();
    dispatchColosseumWin(store);

    const afterDefeated = [...store.getState().defeatedBossIds].sort();
    expect(afterDefeated).toEqual(beforeDefeated);
  });

  it('tier-1 WIN does NOT advance the main-game zone', () => {
    const store = colosseumUnlockedGame(7);
    const beforeZone = store.getState().currentZone;
    store.getState().enterColosseum();
    dispatchColosseumWin(store);
    expect(store.getState().currentZone).toBe(beforeZone);
  });

  it('tier-2 WIN unlocks tier 3 (next-tier successor)', () => {
    // The shipping tier set is {1, 2, 3, 4, 5} (wacl widened TierId
    // and authored the T3/T4 rosters). `nextTierAfter(2)` returns 3 —
    // a T2 clear advances exactly one rung up the ladder. Pre-seeding
    // tier 2 here exercises the WIN-side advance branch directly.
    const store = colosseumUnlockedGame(13);
    store.setState((s) => ({
      ...s,
      colosseumProgression: unlockTier(s.colosseumProgression, 2),
    }));
    store.getState().enterColosseum();

    const combat = activeCombatOrThrow(store);
    const tier2Ids = TIER_2_ROSTER.map((b) => b.sourceCardId);
    expect(tier2Ids).toContain(combat.boss.sourceCardId);

    dispatchColosseumWin(store);

    expect(isTierUnlocked(store.getState().colosseumProgression, 3)).toBe(true);
  });
});

describe('embertide-4hr1.5 — LOSS does NOT advance tier-progression (A3 b)', () => {
  it('a colosseum-slot LOSS leaves unlockedTiers unchanged', () => {
    const store = colosseumUnlockedGame(7);
    store.getState().enterColosseum();
    const tiersBefore = [...store.getState().colosseumProgression.unlockedTiers];
    expect(tiersBefore).toEqual([1]);

    // Trigger the LOSS path the same way the engine's terminal='loss'
    // chain does — `dispatchCombat` with a `COMBAT_RESOLVE_LOSS`
    // action. The reducer clears `activeCombat` and runs the coop
    // loss check; it must NOT touch `colosseumProgression`.
    store.getState().dispatchCombat({ type: 'COMBAT_RESOLVE_LOSS' });

    expect(store.getState().colosseumProgression.unlockedTiers).toEqual(tiersBefore);
    expect(store.getState().activeCombat).toBeNull();
  });
});

describe('embertide-4hr1.5 — main-game side-effects suppressed on colosseum WIN', () => {
  it('does NOT decrement princessCrystal.charges (colosseum is orthogonal to main-game progression)', () => {
    const store = colosseumUnlockedGame(7);
    const chargesBefore = store.getState().princessCrystal.charges;

    store.getState().enterColosseum();
    dispatchColosseumWin(store);

    expect(store.getState().princessCrystal.charges).toBe(chargesBefore);
  });

  it('does NOT increment centerRowKillCount (Prism Chimera formula domain is wild-boss-slot only)', () => {
    const store = colosseumUnlockedGame(7);
    const beforeCount = store.getState().centerRowKillCount;

    store.getState().enterColosseum();
    dispatchColosseumWin(store);

    expect(store.getState().centerRowKillCount).toBe(beforeCount);
  });

  it('does NOT void-mirror the colosseum boss (it was never on the main board)', () => {
    const store = colosseumUnlockedGame(7);
    const beforeVoided = store.getState().voided.length;

    store.getState().enterColosseum();
    dispatchColosseumWin(store);

    expect(store.getState().voided.length).toBe(beforeVoided);
  });

  it('does NOT hydrate pendingDungeonBossRoll on a tier-5 (Trinity Aurogax) WIN', () => {
    // Pre-seed tier 5 so the slot router picks the Trinity Aurogax (T5)
    // boss whose source card 'trinity-aurogax' is a main-game card —
    // exactly the case where the dungeon-boss roll would otherwise
    // fire if the colosseum gating regressed.
    const store = colosseumUnlockedGame(11);
    store.setState((s) => ({
      ...s,
      colosseumProgression: unlockTier(s.colosseumProgression, 5),
    }));

    store.getState().enterColosseum();
    const combat = activeCombatOrThrow(store);
    expect(combat.boss.sourceCardId).toBe('trinity-aurogax');

    dispatchColosseumWin(store);

    expect(store.getState().pendingDungeonBossRoll).toBeNull();
  });
});

describe('embertide-4hr1.6 — colosseum reward emission on tier-N WIN (A1)', () => {
  beforeEach(() => {
    // The reward ledger is the shared singleton meta store; reset it so
    // each test starts from an empty per-run ledger.
    useColosseumMetaStore.getState().reset();
  });

  it('tier-1 WIN emits the tier-1 reward set into the meta-store ledger', () => {
    const store = colosseumUnlockedGame(7);
    store.getState().enterColosseum();
    const combat = activeCombatOrThrow(store);
    expect(combat.entryContext.entrySource).toBe('colosseum-slot');

    dispatchColosseumWin(store);

    const ledger = useColosseumMetaStore.getState().claimedRewards;
    expect(ledger.length).toBeGreaterThan(0);
    expect(ledger.every((row) => row.tier === 1)).toBe(true);
    // Structural lock: the recorded rewards must be exactly the
    // tier-1 set returned by the pure table — no extras, no drift.
    expect(ledger.map((row) => row.reward)).toEqual([...rewardsForTier(1)]);
  });

  it('tier-5 WIN emits the golden-rainbow heirloom + unique cosmetic (top-tier loot)', () => {
    // Pre-seed tier 5 so the slot router picks Trinity Aurogax (T5).
    const store = colosseumUnlockedGame(11);
    store.setState((s) => ({
      ...s,
      colosseumProgression: unlockTier(s.colosseumProgression, 5),
    }));

    store.getState().enterColosseum();
    const combat = activeCombatOrThrow(store);
    expect(combat.boss.sourceCardId).toBe('trinity-aurogax');

    dispatchColosseumWin(store);

    const ledger = useColosseumMetaStore.getState().claimedRewards;
    const t5Rows = ledger.filter((row) => row.tier === 5);
    expect(t5Rows.length).toBeGreaterThan(0);

    const kinds = t5Rows.map((row) => row.reward.kind);
    expect(kinds).toContain('golden-rainbow-heirloom');
    expect(kinds).toContain('unique-cosmetic');

    // The 044 GR Chimera precedent — heirloomId is the rainbow ancient
    // chimera sword (matches HEIRLOOM_DROPS).
    const grRow = t5Rows.find((row) => row.reward.kind === 'golden-rainbow-heirloom');
    expect(grRow).toBeDefined();
    if (grRow !== undefined && grRow.reward.kind === 'golden-rainbow-heirloom') {
      expect(grRow.reward.heirloomId).toBe('rainbow-ancient-chimera-sword');
    }
  });

  it('a colosseum-slot LOSS does NOT emit any reward', () => {
    const store = colosseumUnlockedGame(7);
    store.getState().enterColosseum();
    expect(useColosseumMetaStore.getState().claimedRewards).toEqual([]);

    store.getState().dispatchCombat({ type: 'COMBAT_RESOLVE_LOSS' });

    expect(useColosseumMetaStore.getState().claimedRewards).toEqual([]);
  });

  it('a second COMBAT_RESOLVE_WIN dispatch on the same combat does NOT double-record (idempotent)', () => {
    const store = colosseumUnlockedGame(7);
    store.getState().enterColosseum();
    const combat = activeCombatOrThrow(store);
    const expectedRewards = [...rewardsForTier(1)];

    dispatchColosseumWin(store, combat);
    const afterFirst = [...useColosseumMetaStore.getState().claimedRewards];

    dispatchColosseumWin(store, combat);
    const afterSecond = useColosseumMetaStore.getState().claimedRewards;

    expect(afterFirst.map((r) => r.reward)).toEqual(expectedRewards);
    expect(afterSecond).toEqual(afterFirst);
  });
});

describe('embertide-4hr1.6 — A3 (lower tiers cannot drop top-tier loot)', () => {
  beforeEach(() => {
    useColosseumMetaStore.getState().reset();
  });

  it('tier-1 WIN does NOT record a golden-rainbow-heirloom or unique-cosmetic reward', () => {
    const store = colosseumUnlockedGame(7);
    store.getState().enterColosseum();
    dispatchColosseumWin(store);

    const ledger = useColosseumMetaStore.getState().claimedRewards;
    const kinds = ledger.map((row) => row.reward.kind);
    expect(kinds).not.toContain('golden-rainbow-heirloom');
    expect(kinds).not.toContain('unique-cosmetic');
  });

  it('tier-2 WIN does NOT record a golden-rainbow-heirloom or unique-cosmetic reward', () => {
    const store = colosseumUnlockedGame(13);
    store.setState((s) => ({
      ...s,
      colosseumProgression: unlockTier(s.colosseumProgression, 2),
    }));
    store.getState().enterColosseum();
    dispatchColosseumWin(store);

    const ledger = useColosseumMetaStore.getState().claimedRewards;
    const kinds = ledger.map((row) => row.reward.kind);
    expect(kinds).not.toContain('golden-rainbow-heirloom');
    expect(kinds).not.toContain('unique-cosmetic');
  });
});

describe('embertide-4hr1.19 — per-run reset (no cross-run persistence)', () => {
  beforeEach(() => {
    useColosseumMetaStore.getState().reset();
  });

  it('a fresh run starts with an empty ledger (initGame clears prior rewards)', () => {
    // Run A — defeat tier-1 and emit the reward.
    const runA = colosseumUnlockedGame(7);
    runA.getState().enterColosseum();
    dispatchColosseumWin(runA);
    expect(useColosseumMetaStore.getState().claimedRewards.length).toBeGreaterThan(0);

    // Run B — fresh game store. Per the 2026-06-04 ruling, initGame
    // resets the reward ledger, so run B begins with no rewards. The
    // per-run colosseumProgression also resets (empty unlockedTiers).
    const runB = createGameStore(2);
    runB.getState().initGame({
      players: 2,
      championIds: ['champion-power', 'champion-wisdom'],
    });
    expect(runB.getState().colosseumProgression).toEqual(initialColosseumProgression());
    expect(useColosseumMetaStore.getState().claimedRewards).toEqual([]);
  });

  it('run-B rewards do not accumulate on top of run-A (T1 cleared, only T5 present)', () => {
    // Run A — tier-1.
    const runA = colosseumUnlockedGame(7);
    runA.getState().enterColosseum();
    dispatchColosseumWin(runA);
    expect(useColosseumMetaStore.getState().claimedRewards.some((row) => row.tier === 1)).toBe(
      true,
    );

    // Run B — pre-seed tier 5 and clear it. `colosseumUnlockedGame`
    // calls initGame, which resets the ledger, so run-A's T1 is gone
    // and only run-B's T5 rewards remain.
    const runB = colosseumUnlockedGame(11);
    runB.setState((s) => ({
      ...s,
      colosseumProgression: unlockTier(s.colosseumProgression, 5),
    }));
    runB.getState().enterColosseum();
    dispatchColosseumWin(runB);

    const ledger = useColosseumMetaStore.getState().claimedRewards;
    const tiers = new Set(ledger.map((row) => row.tier));
    expect(tiers.has(1)).toBe(false);
    expect(tiers.has(5)).toBe(true);
  });
});

describe('embertide-4hr1.5 — sanity: existing wild-boss-slot path unchanged (A1)', () => {
  it('a wild-boss WIN through fightMonster still records the defeat (control)', () => {
    // Sanity check — defeating CRAGHORN through the legacy `fightMonster`
    // path (entrySource='field') still advances the main-game ledger.
    // If the colosseum gating accidentally widened the suppression to
    // non-colosseum entries, this test surfaces the regression.
    const store = createGameStore(1);
    store.getState().initGame({
      players: 2,
      championIds: ['champion-power', 'champion-wisdom'],
    });
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], red: 20, keys: 5 };
      players[1] = { ...players[1], red: 20, keys: 5 };
      return { ...s, players, field: [CRAGHORN] };
    });
    store.getState().fightMonster(CRAGHORN.id);
    store.getState().dispatchCombat(buildResolveWinAction(CRAGHORN, ['p0', 'p1'], 'sylvani'));
    expect(store.getState().defeatedBossIds).toContain('craghorn');
  });

  it('a region-boss WIN through fightMonster still hydrates pendingDungeonBossRoll (control)', () => {
    const store = createGameStore(2026);
    store.getState().initGame({
      players: 2,
      championIds: ['champion-power', 'champion-wisdom'],
      seed: 2026,
    });
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], red: 20, keys: 5 };
      players[1] = { ...players[1], red: 20, keys: 5 };
      return { ...s, players, field: [BROODMAW] };
    });
    store.getState().fightMonster(BROODMAW.id);
    store.getState().dispatchCombat(buildResolveWinAction(BROODMAW, ['p0', 'p1'], 'sylvani'));
    expect(store.getState().pendingDungeonBossRoll).not.toBeNull();
  });
});
