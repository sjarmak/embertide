import type { KidGameState, KidPlayer } from '../store/types';
import { initialColosseumProgression } from '../core/colosseum';
import { initialPrincessCrystalState } from '../store/slices/crystal';
import { initialZoneFields } from '../store/slices/zones';

/**
 * Canonical KidGameState / KidPlayer fixtures for tests (embertide-jfgh).
 *
 * Single source of truth for the default shape — when KidGameState gains a
 * new field, this file is the one place that needs to enumerate it. Test
 * files should call `makeKidPlayer` / `makeKidGameState` and override only
 * the fields relevant to the scenario under test.
 *
 * Defaults mirror `EMPTY_STATE` / `initGame` in `src/store/gameStore.ts`:
 *  - `mode: 'kid'`, `phase: 'Main'`, `seed: 0`, deterministic placeholder rng
 *  - empty hands / decks / field / supply / chests / void / defeated
 *  - fresh princess-crystal + zone fields (sylvani, no history, no keys)
 *  - all per-card / per-combat / tutorial surfaces null
 *
 * `players` defaults to `[]`. Most callers want to inject specific players
 * via the `players` override; a few helpers spread `{ players: [makeKidPlayer()] }`
 * to get a single-seat default.
 */

const placeholderRng = (): number => 0;

export function makeKidPlayer(overrides: Partial<KidPlayer> = {}): KidPlayer {
  return {
    id: 'p0',
    name: 'P0',
    championId: 'champion-power',
    championSlot: 'champion-power',
    championPassivePulse: 0,
    hp: 5,
    hpMax: 5,
    downed: false,
    revivedThisIncident: false,
    green: 0,
    red: 0,
    keys: 0,
    deck: [],
    hand: [],
    discard: [],
    inPlay: [],
    slots: [null, null],
    items: [],
    chestsOpened: 0,
    wildWolfKillsThisTurn: 0,
    usedKeyVendorThisTurn: false,
    wisdomsLight: false,
    heartPieces: 0,
    emberShardMeter: 0,
    usedWispInBottleIds: [],
    banished: [],
    nextChestItemRevealed: false,
    ...overrides,
  };
}

export function makeKidGameState(overrides: Partial<KidGameState> = {}): KidGameState {
  return {
    mode: 'kid',
    players: [],
    currentPlayerIndex: 0,
    turn: 1,
    phase: 'Main',
    seed: 0,
    rng: placeholderRng,
    field: [],
    supply: [],
    chestRow: [],
    chestSupply: [],
    defeated: [],
    voided: [],
    sharedEmbertide: { wisdom: false, courage: false, power: false },
    outcome: null,
    lastChestReward: null,
    lastChestRewardCard: null,
    princessCrystal: initialPrincessCrystalState(),
    activeCombat: null,
    combatsEntered: 0,
    combatTutorialBubble: null,
    tutorialBubblesFired: [],
    tutorialBubbleBodyOverride: null,
    centerRowKillCount: 0,
    prismChimeraSpawned: false,
    tideGauge: 0,
    shadowCreep: 0,
    sandstormCounter: 0,
    fangfishFieldWatchlist: [],
    pendingBanishChoice: null,
    pendingDungeonBossRoll: null,
    pendingForestSageRoll: null,
    colosseumProgression: initialColosseumProgression(),
    ...initialZoneFields(),
    ...overrides,
  };
}
