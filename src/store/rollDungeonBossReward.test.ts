import { describe, it, expect } from 'vitest';
import {
  DUNGEON_BOSS_REWARD_TABLE,
  buildResolveWinAction,
  createGameStore,
  type DungeonBossRewardOutcome,
} from './gameStore';
import { KID_CARDS } from '../data/cards';

/**
 * v2.1 REQ-9d — Dungeon Boss onDefeat reward roll (embertide-4hz6
 * + embertide-3wd6 d20 tier-curve redesign 2026-04-25).
 *
 * Locked design (per 3wd6 designer ruling 2026-04-25):
 *   - Trigger: COMBAT_RESOLVE_WIN where the defeated boss has
 *     `bossTier === 'region-boss'` (Dungeon Boss in design language).
 *     Wild Boss + Demon King paths are explicitly excluded.
 *   - Outcomes: every face resolves to a CARD grant (no bare gems, no
 *     peek flag, no HP heal). d20 face → loot tier:
 *       1-10  → std       (50/50 hero ↔ standard supply item)
 *       11-17 → mid       (50/50 hero ↔ premium item)
 *       18-20 → legendary (premium item)
 *   - Per-encounter cap (REQ-9f): only one roll per kill.
 *   - Modal-stack ordering: chest reveal renders FIRST when both fire.
 */

const BROODMAW = KID_CARDS.find((c) => c.id === 'broodmaw')!; // region-boss
const CRAGHORN = KID_CARDS.find((c) => c.id === 'craghorn')!; // wild-boss

function twoPlayerGame(seed = 1) {
  const store = createGameStore(seed);
  store.getState().initGame({
    players: 2,
    championIds: ['champion-power', 'champion-wisdom'],
    seed,
  });
  return store;
}

/**
 * Stage a region-boss in the field with enough resources for the
 * active player to engage via fightMonster.
 */
function seedRegionBoss(store: ReturnType<typeof twoPlayerGame>) {
  store.setState((s) => {
    const players = s.players.slice();
    players[0] = { ...players[0], red: 20, keys: 5 };
    players[1] = { ...players[1], red: 20, keys: 5 };
    return { ...s, players, field: [BROODMAW] };
  });
}

/**
 * Trigger a region-boss WIN through the standard fightMonster +
 * dispatchCombat(buildResolveWinAction(...)) path so the reward-roll
 * fires via the COMBAT_RESOLVE_WIN reducer. Does not commit the roll
 * itself — caller does that.
 */
function defeatRegionBoss(store: ReturnType<typeof twoPlayerGame>) {
  seedRegionBoss(store);
  store.getState().fightMonster(BROODMAW.id);
  store.getState().dispatchCombat(buildResolveWinAction(BROODMAW, ['p0', 'p1'], 'sylvani'));
}

describe('v2.1 REQ-9d — Dungeon Boss reward outcome table', () => {
  it('snapshot: every d20 face 1..20 maps to a card-tier outcome (std / mid / legendary)', () => {
    const expected: Record<number, DungeonBossRewardOutcome> = {};
    for (let face = 1; face <= 10; face++) {
      expected[face] = { kind: 'card-tier', tier: 'std' };
    }
    for (let face = 11; face <= 17; face++) {
      expected[face] = { kind: 'card-tier', tier: 'mid' };
    }
    for (let face = 18; face <= 20; face++) {
      expected[face] = { kind: 'card-tier', tier: 'legendary' };
    }
    expect(DUNGEON_BOSS_REWARD_TABLE).toEqual(expected);
  });

  it('every outcome is a card-tier (no heal / peek / gems / shard kinds)', () => {
    for (const outcome of Object.values(DUNGEON_BOSS_REWARD_TABLE)) {
      expect(outcome.kind).toBe('card-tier');
    }
  });

  it('tier distribution sums to the locked 50/35/15 curve across 1..20', () => {
    const counts = { std: 0, mid: 0, legendary: 0 };
    for (let face = 1; face <= 20; face++) {
      const tier = DUNGEON_BOSS_REWARD_TABLE[face].tier;
      counts[tier]++;
    }
    expect(counts.std).toBe(10);
    expect(counts.mid).toBe(7);
    expect(counts.legendary).toBe(3);
  });
});

describe('v2.1 REQ-9d — COMBAT_RESOLVE_WIN trigger', () => {
  it('hydrates pendingDungeonBossRoll on a region-boss kill with a d20 face (1..20)', () => {
    const store = twoPlayerGame(2026);
    expect(store.getState().pendingDungeonBossRoll).toBeNull();
    defeatRegionBoss(store);
    const pending = store.getState().pendingDungeonBossRoll;
    expect(pending).not.toBeNull();
    expect(pending!.bossId).toBe(BROODMAW.id);
    expect(pending!.playerId).toBe('p0');
    expect(pending!.face).toBeGreaterThanOrEqual(1);
    expect(pending!.face).toBeLessThanOrEqual(20);
  });

  it('does NOT fire on a wild-boss kill (cut per locked design)', () => {
    const store = twoPlayerGame(2026);
    store.setState((s) => {
      const players = s.players.slice();
      players[0] = { ...players[0], red: 20, keys: 5 };
      players[1] = { ...players[1], red: 20, keys: 5 };
      return { ...s, players, field: [CRAGHORN] };
    });
    store.getState().fightMonster(CRAGHORN.id);
    store.getState().dispatchCombat(buildResolveWinAction(CRAGHORN, ['p0', 'p1'], 'sylvani'));
    expect(store.getState().pendingDungeonBossRoll).toBeNull();
  });

  it('face is deterministic from the seed (same seed → same face)', () => {
    const storeA = twoPlayerGame(7777);
    const storeB = twoPlayerGame(7777);
    defeatRegionBoss(storeA);
    defeatRegionBoss(storeB);
    expect(storeA.getState().pendingDungeonBossRoll!.face).toEqual(
      storeB.getState().pendingDungeonBossRoll!.face,
    );
  });

  it('per-encounter cap: only one roll per kill (REQ-9f)', () => {
    const store = twoPlayerGame(2026);
    defeatRegionBoss(store);
    const firstFace = store.getState().pendingDungeonBossRoll!.face;
    // Direct-dispatch a second roll attempt — the action must no-op
    // because a roll is already pending.
    store.getState().rollDungeonBossReward(BROODMAW.id);
    expect(store.getState().pendingDungeonBossRoll!.face).toEqual(firstFace);
  });

  it('rollDungeonBossReward throws on a wild-boss bossId', () => {
    const store = twoPlayerGame();
    expect(() => store.getState().rollDungeonBossReward(CRAGHORN.id)).toThrow(
      /not a Dungeon \(region\) Boss|wild-boss/i,
    );
  });

  it('rollDungeonBossReward throws on an unknown bossId', () => {
    const store = twoPlayerGame();
    expect(() => store.getState().rollDungeonBossReward('not-a-real-card')).toThrow(
      /unknown bossId/i,
    );
  });
});

describe('v2.1 REQ-9d — commitDungeonBossReward (every face grants a card)', () => {
  function stageRoll(seed: number, face: number) {
    const store = twoPlayerGame(seed);
    store.setState((s) => ({
      ...s,
      pendingDungeonBossRoll: {
        bossId: BROODMAW.id,
        playerId: 'p0',
        face,
      },
    }));
    return store;
  }

  /**
   * 'card-tier' outcomes always grant exactly one card to the active
   * player — std/mid grants land in items zone (item / premium-item)
   * or discard (hero, or items-cap overflow), legendary always lands
   * in items zone (premium-item). The combined items + discard count
   * grows by exactly 1 across every face.
   */
  function expectExactlyOneCardGain(store: ReturnType<typeof stageRoll>) {
    const before = store.getState().players[0];
    const beforeTotal = before.items.length + before.discard.length;
    store.getState().commitDungeonBossReward();
    const after = store.getState().players[0];
    const afterTotal = after.items.length + after.discard.length;
    expect(afterTotal).toBe(beforeTotal + 1);
    expect(store.getState().pendingDungeonBossRoll).toBeNull();
  }

  it('face 1 (std tier) grants a card', () => {
    expectExactlyOneCardGain(stageRoll(11, 1));
  });

  it('face 5 (std tier) grants a card', () => {
    expectExactlyOneCardGain(stageRoll(12, 5));
  });

  it('face 10 (std tier, upper bound) grants a card', () => {
    expectExactlyOneCardGain(stageRoll(13, 10));
  });

  it('face 11 (mid tier, lower bound) grants a card', () => {
    expectExactlyOneCardGain(stageRoll(14, 11));
  });

  it('face 14 (mid tier) grants a card', () => {
    expectExactlyOneCardGain(stageRoll(15, 14));
  });

  it('face 17 (mid tier, upper bound) grants a card', () => {
    expectExactlyOneCardGain(stageRoll(16, 17));
  });

  it('face 18 (legendary tier, lower bound) grants a card', () => {
    expectExactlyOneCardGain(stageRoll(17, 18));
  });

  it('face 20 (legendary tier, max) grants a card', () => {
    expectExactlyOneCardGain(stageRoll(18, 20));
  });

  it('face 18-20 (legendary) always equips a premium item (legendary-sword 7/8 or great-wisp 1/8)', () => {
    // Sample a few seeds to cover both branches of pickPremiumItem.
    // The test asserts the equipped item id is one of the two legitimate
    // legendary outcomes.
    const PREMIUM_IDS = new Set(['ancient-blade', 'great-wisp']);
    const seeds = [21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
    let observed = 0;
    for (const seed of seeds) {
      const store = stageRoll(seed, 19);
      const beforeItemCount = store.getState().players[0].items.length;
      store.getState().commitDungeonBossReward();
      const after = store.getState().players[0];
      // Either the items zone grew by one (with a premium item) or the
      // zone was at cap and it landed in discard. Inspect items first.
      if (after.items.length === beforeItemCount + 1) {
        const newItem = after.items[after.items.length - 1];
        const baseId = newItem.id.replace(/-[0-9]+$/, '');
        expect(PREMIUM_IDS.has(baseId), `unexpected premium id "${baseId}"`).toBe(true);
        observed++;
      }
    }
    // At least one seed should have landed an item directly in the
    // items zone (the player starts empty so the cap is not in play).
    expect(observed).toBeGreaterThan(0);
  });

  it('throws when no roll is pending', () => {
    const store = twoPlayerGame();
    expect(() => store.getState().commitDungeonBossReward()).toThrow(
      /no Dungeon Boss reward roll is pending/i,
    );
  });
});

describe('v2.1 REQ-9d — modal-stack ordering with ChestReveal', () => {
  it('does not block the chest reveal — both fields can coexist', () => {
    // The store-layer contract is that BOTH `lastChestReward` and
    // `pendingDungeonBossRoll` are independently allowed to be
    // non-null. The UI (GameBoard) gates the roll modal behind
    // `lastChestReward === null` so the chest renders FIRST. This
    // test pins the store-layer contract — the UI test lives in
    // GameBoard.test.tsx, but the store must NOT clear one when
    // the other lands.
    const store = twoPlayerGame(2026);
    defeatRegionBoss(store);
    store.setState((s) => ({ ...s, lastChestReward: 'heart' }));
    expect(store.getState().lastChestReward).toBe('heart');
    expect(store.getState().pendingDungeonBossRoll).not.toBeNull();
    // Clearing the chest reveal does NOT clear the pending roll.
    store.getState().clearLastChestReward();
    expect(store.getState().lastChestReward).toBeNull();
    expect(store.getState().pendingDungeonBossRoll).not.toBeNull();
  });
});
