import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { createSeededRng, type ChestVariant } from '../rules/chestPool';
import {
  baseIdOf,
  buildChestSupply,
  buildSupply,
  findAlwaysAvailable,
  HEIRLOOM_DROPS,
  mintAlwaysAvailable,
} from '../data/cards';
import type { KidGameState, KidPlayer, PendingDungeonBossRoll, ZoneId } from './types';
import type { CombatState } from '../types/combat';
import type { TutorialBubbleId, TutorialTrigger } from '../tutorial/v20';
import { buildStarterDeck, drawCards, drawFiveFor } from './slices/deck';
import {
  defeatAlwaysAvailableMonster,
  fightMonster as fightMonsterSlice,
  grantHeirloom,
} from './slices/combat';
import {
  applyEquipBonusOnEquip,
  applyHeirloomOnEquip,
  equipAsItem,
  routesToItemsZone,
} from './slices/inventory';
import { openChestFor, refillChestRow } from './slices/chests';
import { refillField } from './slices/market';
import {
  banishFromDiscardSlice,
  banishFromHandSlice,
  cancelBanishChoiceSlice,
} from './slices/banish';
import {
  clearCombatTutorialBubbleSlice,
  fireCombatTutorialBubbleSlice,
  fireTutorialBubbleOnceSlice,
} from './slices/tutorial';
import {
  EXTRA_DRAW_CHAMPION_ID,
  advanceTurn,
  applyChampionPower,
  applyItemPassivesForTrigger,
  applyStartOfTurnItems,
  checkCoopVictory,
} from './slices/endgame';
import {
  decrementCrystalCharges,
  initialPrincessCrystalState,
  strikePrincessCrystal as strikePrincessCrystalPure,
} from './slices/crystal';
import {
  advanceZone,
  applySkullfishFragility,
  canSpawnRegionBoss,
  incrementTideGauge,
  incrementShadowCreep,
  incrementSandstormCounter,
  initialZoneFields,
  isColosseumUnlocked,
  recordBossDefeat,
  recordBossKey,
} from './slices/zones';
import { resolveChampionSlot } from './slices/setup';
import { canSpawnRegionBossByPhase, canSpawnWildBossInZone, sessionPhase } from './slices/session';
import {
  baseIdOf as baseIdOfString,
  combatTurnReducer,
  determineDefeatingHero,
  type CombatTurnAction,
  type CombatTurnState,
} from '../core/combatEngine';
import { applyHeartReward } from '../core/vitalEmber';
import { d6, d20 } from '../rules/dice';
import { GENERIC_BASE_ID_THEME } from '../theme/generic';
import {
  PRISM_CHIMERA_ID,
  computeGoldenRainbowLynelSpawnChance,
  currentRegionBossForZone,
  currentWildBossForZone,
} from '../rules/zones';
import {
  WISP_BASE_IDS,
  applyHeroPlay,
  checkCoopLoss,
  pendingBanishChoiceFor,
  replacePlayer,
  requireMainPhase,
} from './_shared';
import {
  commitDungeonBossRewardSlice,
  commitForestSageOmenSlice,
  rollDungeonBossRewardSlice,
  rollForestSageOmenSlice,
} from './slices/dice';
import { tradeWithKeyVendorSlice } from './slices/vendor';
import {
  initialColosseumProgression,
  nextTierAfter,
  pickColosseumBoss,
  rewardsForTier,
  tierForColosseumBoss,
  unlockTier,
} from '../core/colosseum';
import { useColosseumMetaStore } from './colosseumMetaStore';

// Re-export the dice-table public surface so consumers
// (`../data/dice-tables`-equivalent imports were originally pulled from
// here) keep resolving against this module path.
export type {
  DungeonBossRewardOutcome,
  DungeonBossRewardTier,
  ForestSageOmenOutcome,
} from '../data/dice-tables';
export { DUNGEON_BOSS_REWARD_TABLE, FOREST_SAGE_OMEN_TABLE } from '../data/dice-tables';

export interface InitGameArgs {
  readonly players: number;
  readonly championIds: readonly string[];
  readonly names?: readonly string[];
  /**
   * Optional RNG seed. When omitted, `initGame` reuses the store's
   * current seed (the factory-time seed, `INITIAL_SEED=0` by default).
   *
   * Tests and debug-seed fixtures use the default path for
   * reproducibility. Runtime new-game dispatches from App.tsx pass a
   * fresh `Date.now()`-derived seed so different playthroughs produce
   * different shuffles — without this, every fresh start hits the
   * same deterministic sequence (one symptom: the seed-0 chest
   * supply happens to land all three `chest-boss` copies in the
   * initial 3-slot chestRow for 3 of the 4 champions).
   */
  readonly seed?: number;
}

export interface GameStore extends KidGameState {
  initGame(args: InitGameArgs): void;
  drawFive(): void;
  playCard(cardId: string): void;
  /**
   * Drag-to-play entry point for the in-play drop zone (embertide-0qby).
   * Plays `cardId` only when it routes into the in-play area (heroes /
   * starters). Cards that equip into the Items zone (items /
   * legendary-swords) are an invalid drop for this zone and stay in hand,
   * so a dragged card never silently leaves the player's sightline. Tap-to-
   * play (`playCard`) is unchanged and still equips items.
   */
  playCardFromInPlayDrop(cardId: string): void;
  buyFromField(cardId: string): void;
  /**
   * Purchase an Always Available hero (mystic / militia-grunt, displayed as
   * Oracle / Elysian Soldier — embertide-9yu / §12). Mints a fresh copy
   * with a unique id and adds it to the current player's discard pile.
   * Throws when the baseId is not an always-available hero, or when the
   * player cannot pay the card cost.
   */
  buyAlwaysAvailable(baseId: string): void;
  fightMonster(monsterId: string): void;
  /**
   * Engage the current wild-boss slot for a zone (u-9c / REQ-32 slot
   * engagement). Dispatches `COMBAT_ENTER` with
   * `entryContext.entrySource === 'wild-boss-slot'` — no red or keys
   * cost, no field mutation (slot bosses post-u-9a do NOT live in
   * `state.field`). On `COMBAT_RESOLVE_WIN`, the heirloom identified by
   * `HEIRLOOM_DROPS[baseIdOf(bossId)]` is appended to the defeating
   * hero's items zone with the same 3-cap routing as wisp drops.
   *
   * Throws when the bossId does not match
   * `currentWildBossForZone(state, zoneId)` — defensive gate so the UI
   * layer (u-9d) can't dispatch a stale slot click after the wild
   * queue has advanced.
   */
  engageWildBossSlot(zoneId: ZoneId, bossId: string): void;
  /**
   * Engage the current region-boss slot for a zone (u-9c / REQ-32 slot
   * engagement). Dispatches `COMBAT_ENTER` with
   * `entryContext.entrySource === 'region-boss-slot'` — no red or keys
   * cost, no field mutation. On `COMBAT_RESOLVE_WIN`, preserves u-8c's
   * A5/B6 flow: shard grant + zone advance via the existing
   * `buildResolveWinAction` path. No heirloom drop — heirlooms are
   * wild-boss only per `HEIRLOOM_DROPS` keying.
   *
   * Throws when the bossId does not match
   * `currentRegionBossForZone(state, zoneId)`.
   */
  engageRegionBossSlot(zoneId: ZoneId, bossId: string): void;
  /**
   * Enter colosseum mode (embertide-4hr1.4 HUD entry +
   * 4hr1.5 WIN-side routing). Routes the boss-selection path through
   * the colosseum engine's slot router rather than the standard
   * zone-progression path. The `currentZone` is untouched — colosseum
   * is a parallel mode that co-exists with the main map.
   *
   * Behavior:
   *  - Throws when `isColosseumUnlocked(state)` is false (UI must
   *    suppress the entry surface until the gate is met; this is a
   *    backstop).
   *  - On first entry (empty `unlockedTiers`), seeds tier 1 via the
   *    engine's `unlockTier` per the engine docstring contract that
   *    keeps entry-tier policy in the caller (single grep target).
   *    Subsequent entries pick from whatever the player has unlocked.
   *  - Calls `pickColosseumBoss(progression, rng)` to select a boss
   *    from the highest-unlocked tier, then dispatches `COMBAT_ENTER`
   *    with `entrySource === 'colosseum-slot'`.
   *
   * Throws when the picker returns `null` after the seed step — that
   * is a programming error (every tier roster must have ≥1 entry).
   */
  enterColosseum(): void;
  /**
   * Defeat an Always Available monster (Wild Wolf, embertide-9yu / §12).
   * Deducts the monster's red cost and applies the monster-drop reward —
   * the monster is NOT banished to the Void (stays buyable next turn).
   */
  defeatAlwaysAvailable(baseId: string): void;
  openChest(variant: ChestVariant): void;
  /**
   * Clear `lastChestReward` once the ChestReveal animation finishes
   * (embertide-z3z). No-op when no reveal is pending.
   */
  clearLastChestReward(): void;
  /**
   * Advance a single phase transition (REQ-18, u-1c). Thin dispatcher:
   *
   *   Upkeep     → apply SOT items + champion passive, then → Draw
   *   Draw       → draw 5/6 cards for active player, then → Main
   *   Main       → if active player is downed, auto-pass to BossResolve;
   *                otherwise this call is a no-op (Main is the player's
   *                action window — the caller (UI / endTurn) advances
   *                explicitly when actions are done)
   *   BossResolve → placeholder in v2.0 (u-7 populates softclock +
   *                 boss-phase logic), advances straight to → End
   *   End        → flush hand/inPlay → discard, zero green/red, reset
   *                wildWolfKills, run coop victory/loss checks, then
   *                advanceTurn + reset phase to Upkeep
   *
   * Idempotent wrt `state.outcome`: when the game is over, all phase
   * transitions are no-ops.
   */
  advancePhase(): void;
  endTurn(): void;
  /**
   * Revive a downed teammate (amendment A3). The active player spends a
   * main-phase action to revive target `playerId` to 1 HP. Rules:
   *
   *  - Target MUST currently be `downed: true`; else throws.
   *  - The REVIVING player (active player) must NOT have already consumed
   *    their per-incident teammate-revive budget (`revivedThisIncident
   *    === true`); else throws. Budget resets to false when THAT player
   *    next becomes downed (the resetting transition is handled by
   *    `applyDamage`).
   *  - On success: target.hp = 1, target.downed = false, active
   *    player.revivedThisIncident = true. Target's `revivedThisIncident`
   *    stays whatever it was — teammate-revive is the REVIVER's budget,
   *    not the reviver's prior-state.
   *
   *  Fairies (see `playFairyOn`) are the orthogonal full-revive path —
   *  they do NOT consume the teammate-revive budget.
   */
  reviveTeammate(playerId: string): void;
  /**
   * Play a wisp item on a downed teammate (amendment A6). Consumes one
   * wisp from the active player's `items` zone and fully revives the
   * target to `hpMax`. If the target is NOT downed the action is a no-op
   * AND the wisp is NOT consumed (soft UX — prevents accidental burn).
   * Throws if the active player has no wisp to play.
   */
  playFairyOn(playerId: string): void;
  /**
   * Strike the Princess-in-Crystal (REQ-8 / u-2e, amendment A2). When
   * `princessCrystal.charges === 0` and the Princess has not yet been
   * freed, the Strike flips `princessCrystal.freed = true`, grants the
   * SHARED `sharedTriforce.wisdom` shard (not tied to the striking
   * player), and flips `wisdomsLight: true` on both players. Runs
   * `checkCoopVictory` at the tail — a wisdom flip can complete the
   * three-shard shared win.
   *
   * Defensive no-op when charges > 0 or the Princess is already freed
   * (UI should disable the button in those cases). Respects the
   * `outcome !== null` and `phase !== 'Main'` guards like every other
   * main-phase action.
   */
  strikePrincessCrystal(): void;
  /**
   * Banish a single card from the active player's hand to their banished
   * pile (embertide-91p framework). The card is identified by its
   * instance id (Card.id). Deck-thinning mechanic — banished cards leave
   * the player's active rotation for the rest of the game; the pile is
   * retained so future "return banished cards" mechanics don't require a
   * schema migration.
   *
   * Main-phase action (same guards as `playCard`). Throws when the card
   * is not in hand (defensive — UI should pass an authoritative id). No
   * cost, no resource change — cost framing belongs on the banishing
   * card's effect, not the banish action itself.
   */
  banishFromHand(cardId: string): void;
  /**
   * Banish a single card from the active player's discard pile to their
   * banished pile (embertide-91p framework). Same contract as
   * `banishFromHand` except the source pile is `discard` instead of
   * `hand`. Throws when the card is not in discard.
   */
  banishFromDiscard(cardId: string): void;
  /**
   * Dismiss the pending banish choice surface without banishing a card
   * (embertide-91p, commit b). Idempotent — a no-op when
   * `state.pendingBanishChoice` is already null. The triggering card's
   * resource deltas / inPlay placement are NOT rolled back; the banish
   * effect simply fizzles. Mirrors the "soft cancel" contract used by
   * other v2.1 modal surfaces (chest reveal, tutorial dismiss).
   */
  cancelBanishChoice(): void;
  /**
   * Trade with the Key Vendor (Pell, embertide-1eby): pay 4 green
   * directly and gain +1 key on the spot. No card mints, no draw cycle,
   * no combat-effect side surface — Pell is a vendor service, not a
   * buyable hero. Cost + grant are read from the `key-vendor` template
   * in `VENDORS` so the rates stay declarative.
   *
   * Main-phase action with the same guards as `buyAlwaysAvailable`:
   * outcome must be null, phase must be 'Main', active player must not
   * be downed, active player must have at least 4 green. Throws on
   * insufficient green so the UI's disabled-state contract is the
   * primary defense and this is the backstop.
   */
  tradeWithKeyVendor(): void;
  /**
   * Dispatch a boss-combat action (u-8c, PRD §B6). The combat layer is
   * decoupled from ordinary main-board actions via the explicit
   * `CombatAction` union declared in u-8a; this method is the seam that
   * applies those actions to the store.
   *
   * Three action types are handled:
   *  - `COMBAT_ENTER`: hydrates `activeCombat` with a fresh CombatState
   *    built from the payload context + deck + boss.
   *  - `COMBAT_RESOLVE_WIN`: clears `activeCombat`, applies hearts heal
   *    (respecting each attacker's hpMax), drops a wisp to the tier's
   *    attacker-team, grants sharded shards (region-boss only), advances
   *    zone (region-boss only), and runs the crystal-decrement +
   *    coop-victory checks.
   *  - `COMBAT_RESOLVE_LOSS`: clears `activeCombat` and runs
   *    `checkCoopLoss` idempotently.
   *
   * Both resolve actions assume combat damage has already been applied
   * to players via the combat engine's `applyDamage` call-sites (§B3);
   * the reducer's only responsibility is the drop-rules + state-cleanup
   * transaction.
   */
  dispatchCombat(action: CombatAction): void;
  /**
   * Dispatch an in-combat turn action (PLAYER_PLAY_CARD / PLAYER_PASS).
   * Wraps the current `activeCombat + players` into a CombatTurnState
   * envelope, runs the pure `combatTurnReducer`, then unwraps back to
   * store state. On PLAYER_PASS, auto-runs BOSS_RESOLVE so the boss
   * acts immediately (single click = end your turn + take the hit).
   * After each action, draws the players' combat hand up to
   * COMBAT_HAND_CAP. If the engine signals terminal='win' or 'loss',
   * chains into the matching COMBAT_RESOLVE_* dispatch so main-board
   * drops + activeCombat cleanup happen in the same click.
   *
   * Appends a plain-language line to `activeCombat.combatLog` per
   * action so `CombatLog` has something to render.
   *
   * No-op when activeCombat is null or outcome is already resolved.
   */
  dispatchCombatAction(action: CombatTurnAction): void;
  /**
   * Surface a v2.1 combat-tutorial bubble (u-8g, PRD §B8). Called from
   * `CombatScreen` in response to in-combat events (card played, boss
   * turn transition) and from the combat reducer for entry / win /
   * loss. Writes through `pickCombatBubble` so the progressive-
   * disclosure gate (first-combat vs second-combat) is honored
   * centrally. A null `trigger` is a no-op; a trigger whose bubble is
   * gated off (e.g. `combat-boss-turn` in the first combat) also
   * becomes a no-op.
   */
  fireCombatTutorialBubble(trigger: TutorialTrigger | null): void;
  /**
   * Dismiss the currently-visible combat-tutorial bubble by clearing
   * `state.combatTutorialBubble` (u-8g). Called by the tutorial
   * overlay's dismiss button. Idempotent — no-op when already null.
   */
  clearCombatTutorialBubble(): void;
  /**
   * Fire a main-board tutorial bubble AT MOST ONCE per run (REQ-32 u-9e).
   * Used by the wild / region / destiny slot mount effects and the
   * heirloom-drop hook in `COMBAT_RESOLVE_WIN`. No-op when the bubble
   * id is already in `state.tutorialBubblesFired` — this is the
   * idempotency primitive for one-shot overlays.
   *
   * Optional `bodyOverride` templates the bubble's rendered body at
   * fire time (heirloom-drop embeds the heirloom's display name).
   */
  fireTutorialBubbleOnce(id: TutorialBubbleId, bodyOverride?: string): void;
  /**
   * Stage a Dungeon-Boss onDefeat reward roll (v2.1 REQ-9d, embertide-4hz6
   * + embertide-3wd6 d20 tier-curve redesign 2026-04-25).
   *
   * Called from the `COMBAT_RESOLVE_WIN` reducer AFTER the standard
   * region-boss settlement (heart heal / shard grants / zone advance /
   * vital-ember / crystal decrement) has landed. Pre-rolls a single
   * d20 face via `d20(rng)` using the store's seeded RNG, hydrates
   * `pendingDungeonBossRoll`, and leaves the reveal-mount decision to
   * the UI layer (GameBoard renders DieRollReveal).
   *
   * Per-encounter cap (REQ-9f): no-op when `pendingDungeonBossRoll` is
   * already non-null OR when the game is already over — only one roll
   * per Dungeon Boss defeat. Authoring-side defense: throws when the
   * defeated boss card's `bossTier !== 'region-boss'` (a Wild Boss
   * defeat is NOT a Dungeon Boss; the bead explicitly cuts wild-boss
   * reward rolls).
   */
  rollDungeonBossReward(bossId: string): void;
  /**
   * Commit the pending Dungeon-Boss reward roll. The face is read from
   * `pendingDungeonBossRoll.face` (the die-roll animation has no
   * player choice — the face was deterministically rolled at fire time).
   *
   * Outcome table (face → loot tier; tier dispatch grants a card via
   * the existing chest-pool `applyReward` helper):
   *   1-10  → 'std'       (50/50 hero ↔ standard supply item)
   *   11-17 → 'mid'       (50/50 hero ↔ premium item)
   *   18-20 → 'legendary' (premium item)
   *
   * The reward is ALWAYS a card — no bare gems, peek flags, or HP
   * heals (embertide-3wd6 designer ruling 2026-04-25).
   *
   * Throws when no roll is pending (`pendingDungeonBossRoll === null`).
   * Clears `pendingDungeonBossRoll` on success.
   */
  commitDungeonBossReward(): void;
  /**
   * Stage a Forest-Sage on-play omen roll (v2.1 REQ-6, embertide-gm0.10).
   *
   * Called from `playCard` when the player plays a forest-sage card —
   * the card has already moved hand → inPlay (no resource deltas) at
   * call time, and this action pre-rolls a single d6 face via `d6(rng)`
   * using the store's seeded RNG, hydrating `pendingForestSageRoll` so
   * the UI can mount DieRollReveal.
   *
   * Per-encounter cap (REQ-9f): no-op when `pendingForestSageRoll` is
   * already non-null OR when the game is already over — only one omen
   * roll per forest-sage play. The standard fire path is `playCard`
   * itself; this action is exposed primarily for tests + future debug
   * surfaces, mirroring `rollDungeonBossReward`'s contract.
   */
  rollForestSageOmen(playerId: string): void;
  /**
   * Commit the pending Forest-Sage omen roll. The face is read from
   * `pendingForestSageRoll.face` — single-die animation, no choice.
   *
   * Outcome table (face → effect on the player who played the card):
   *   1 → heal 1 HP (clamped at hpMax)
   *   2 → +1 gem (green += 1)
   *   3 → set `nextChestItemRevealed = true` (peek next chest item)
   *   4 → +1 power for current turn (red += 1)
   *   5 → draw 1 card from deck
   *   6 → rare-item draw (premium-item from chest pool — legendary-sword
   *        7/8, great-wisp 1/8). Symmetric with dungeon-boss face 6.
   *
   * Throws when no roll is pending (`pendingForestSageRoll === null`).
   * Clears `pendingForestSageRoll` on success.
   */
  commitForestSageOmen(): void;
}

const INITIAL_SEED = 0;
const STARTING_HP = 5;

function placeholderRng(): number {
  return 0;
}

const EMPTY_STATE: KidGameState = {
  mode: 'kid',
  players: [],
  currentPlayerIndex: 0,
  turn: 1,
  // initGame lands on 'Main' so its opening pipeline (Upkeep + Draw already
  // applied inline) matches the running game's "player is taking actions"
  // state. See initGame below. After an endTurn cycle the next player also
  // lands on 'Main' for the same reason.
  phase: 'Main',
  seed: INITIAL_SEED,
  rng: placeholderRng,
  field: [],
  supply: [],
  chestRow: [],
  chestSupply: [],
  defeated: [],
  voided: [],
  sharedTriforce: { wisdom: false, courage: false, power: false },
  outcome: null,
  lastChestReward: null,
  lastChestRewardCard: null,
  princessCrystal: initialPrincessCrystalState(),
  activeCombat: null,
  combatsEntered: 0,
  combatTutorialBubble: null,
  tutorialBubblesFired: [],
  tutorialBubbleBodyOverride: null,
  // embertide-044: center-row kill counter feeds the Golden
  // Rainbow Chimera one-shot spawn roll at Silver Chimera's defeat.
  centerRowKillCount: 0,
  goldenRainbowLynelSpawned: false,
  // embertide-gdd.1: per-run tide-gauge counter, 0..TIDE_GAUGE_MAX.
  // Increments at End-phase while currentZone === 'maren'; resets to 0
  // on every advanceZone-driven currentZone change.
  tideGauge: 0,
  // embertide-gdd.2: per-run shadow-creep counter, 0..SHADOW_CREEP_MAX.
  // Increments at End-phase while currentZone === 'hollow-shrine'; resets
  // to 0 on every advanceZone-driven currentZone change. Snapshotted at
  // enterCombatAction time as a flat +N adder on boss damagePerTurn.
  shadowCreep: 0,
  // embertide-gdd.3: per-run sandstorm-counter, 0..SANDSTORM_COUNTER_MAX.
  // Increments at End-phase while currentZone === 'dune-sanctum'; resets
  // to 0 on every advanceZone-driven currentZone change. Snapshotted at
  // enterCombatAction time as a flat +N adder on boss damagePerTurn.
  sandstormCounter: 0,
  // embertide-gdd.1.2: fangfish fragility-window watchlist.
  // End-phase scans `state.field` for fangfish; ids already present
  // here auto-discard ("school darts away" thematic). See KidGameState
  // docstring for the full lifecycle.
  skullfishFieldWatchlist: [],
  // embertide-91p (b): per-card banish choice surface. Null until
  // a card whose `effects.kind === 'banish-from-hand'` resolves on play
  // and the active player has banishable cards in hand. See
  // {@link PendingBanishChoice} for lifecycle docs.
  pendingBanishChoice: null,
  // embertide-4hz6: Dungeon Boss onDefeat reward roll surface. Null
  // until a region-boss combat resolves; set by COMBAT_RESOLVE_WIN +
  // `rollDungeonBossReward`; cleared by `commitDungeonBossReward`. See
  // {@link PendingDungeonBossRoll} for lifecycle docs.
  pendingDungeonBossRoll: null,
  // embertide-gm0.10: Forest-Sage on-play omen roll surface. Null
  // until forest-sage is played; set by `playCard` →
  // `rollForestSageOmen`; cleared by `commitForestSageOmen`. See
  // {@link PendingForestSageRoll} for lifecycle docs.
  pendingForestSageRoll: null,
  // embertide-4hr1.4 entry seat + 4hr1.5 WIN mutator. Empty
  // unlockedTiers at game-start; first `enterColosseum` seeds tier 1
  // (engine 4hr1.3 docstring contract — entry-tier policy lives in
  // the caller). Each colosseum-slot WIN advances unlockedTiers per
  // the engine's `unlockTier` semantics.
  colosseumProgression: initialColosseumProgression(),
  ...initialZoneFields(),
};

// Combat action interfaces + bootstrap helpers moved to
// ./combatBootstrap.ts. Re-export the public-API surface so existing
// consumers (and the dispatchCombat reducer below) keep resolving.
export type {
  CombatAction,
  CombatEnterAction,
  CombatResolveLossAction,
  CombatResolveWinAction,
} from './combatBootstrap';
export { buildResolveWinAction, enterCombatAction } from './combatBootstrap';

import type { CombatAction, CombatResolveWinAction } from './combatBootstrap';
import {
  applyFairyDrop,
  applyHeartsHeal,
  applyShardGrants,
  augmentHeartsWithChampionBonus,
  bossDisplayName,
  buildInitialCombatState,
  buildResolveWinAction,
  cardByIdOrThrow,
  describeAction,
  drawToCombatHandCap,
  enterCombatAction,
  renderCombatBubbleBody,
} from './combatBootstrap';

/**
 * Number of heart pieces that promote to a single vital ember
 * (v2.1 gm0.16). Four pieces → one container. Mirrors the classic
 * Aurelia ember-shard loop.
 */
export const HEART_PIECES_PER_CONTAINER = 4;

/**
 * Increment a player's ember-shard counter by 1 (v2.1 gm0.16). When the
 * counter reaches `HEART_PIECES_PER_CONTAINER`, the pieces auto-promote
 * to a vital ember: the counter resets to 0 and `applyHeartReward`
 * grows `hp` + `hpMax` by 1. Otherwise the player is returned with
 * `heartPieces + 1` and unchanged HP.
 *
 * Pure: returns a new `KidPlayer`.
 */
export function addHeartPiece(player: KidPlayer): KidPlayer {
  const next = player.heartPieces + 1;
  if (next >= HEART_PIECES_PER_CONTAINER) {
    const grown = applyHeartReward(player, 1);
    return { ...grown, heartPieces: 0 };
  }
  return { ...player, heartPieces: next };
}

/**
 * Centralized HP-damage helper (amendment A3). Damaging a player clamps
 * their HP at 0 and transitions them into the `downed` state if HP
 * reaches zero. A fresh downed incident resets `revivedThisIncident` to
 * false so the teammate-revive budget refreshes for this incident.
 *
 * Pure: returns a new `KidPlayer`.
 */
export function applyDamage(player: KidPlayer, amount: number): KidPlayer {
  if (amount <= 0) return player;
  const nextHp = Math.max(0, player.hp - amount);
  if (nextHp === 0) {
    return {
      ...player,
      hp: 0,
      downed: true,
      revivedThisIncident: false,
    };
  }
  return { ...player, hp: nextHp };
}

// Combat entry/exit glue moved to ./combatBootstrap.ts. enterCombatAction
// and buildResolveWinAction are re-exported for the 4 test-file consumers
// (sylvani/shadow/spirit Content + bossKeys); the rest of the kit is
// imported above for use inside dispatchCombat below.

// Dungeon Boss + Forest Sage dice tables and resolvers moved to
// src/data/dice-tables.ts. Their public types + tables are re-exported
// at the top of this file so existing consumers continue to resolve.

/**
 * Build a `COMBAT_RESOLVE_WIN` payload for the in-engine terminal='win'
 * chain (embertide-4hr1.5).
 *
 * Branches on `entryContext.entrySource`:
 *  - `'colosseum-slot'`: synthesize a minimal payload (no wisp / no
 *    shard / no zoneAdvance / no boss-key / hearts=0). The colosseum
 *    has its own reward routing (4hr1.6), and the COMBAT_RESOLVE_WIN
 *    reducer suppresses every main-game drop branch when the entry is
 *    a colosseum entry. Skipping `cardByIdOrThrow` here is necessary
 *    because some colosseum bosses (`coilworm`, `bonereaver`, etc.) don't
 *    have a main-game `Card` counterpart yet — looking them up would
 *    throw.
 *  - everything else: defer to the canonical `buildResolveWinAction`
 *    which derives drops from the boss card's tier + zone metadata.
 */
export function buildResolveWinForCombat(
  combat: CombatState,
  currentZone: ZoneId,
): CombatResolveWinAction {
  if (combat.entryContext.entrySource === 'colosseum-slot') {
    const heartsToAttackers: Record<string, number> = {};
    for (const id of combat.entryContext.attackerPlayerIds) {
      heartsToAttackers[id] = 0;
    }
    return {
      type: 'COMBAT_RESOLVE_WIN',
      heartsToAttackers,
      fairyDropTarget: null,
      shardGrants: [],
      zoneAdvance: false,
      bossKey: null,
    };
  }
  return buildResolveWinAction(
    cardByIdOrThrow(combat.boss.sourceCardId),
    combat.entryContext.attackerPlayerIds,
    currentZone,
  );
}

// ---------------------------------------------------------------------------
// Pure selectors (take a state, return a derived value).
// ---------------------------------------------------------------------------

export function currentPlayer(state: KidGameState): KidPlayer {
  const p = state.players[state.currentPlayerIndex];
  if (!p) throw new Error('No current player');
  return p;
}

// ---------------------------------------------------------------------------
// Store factory.
// ---------------------------------------------------------------------------

export function createGameStore(seed: number): UseBoundStore<StoreApi<GameStore>> {
  return create<GameStore>((setRaw, get) => {
    // Zustand's `set` accepts a partial of the full store; our helpers return
    // a full `KidGameState` (state only). This local wrapper widens the type
    // so action bodies can pass either.
    const set = (next: KidGameState | Partial<GameStore>) => setRaw(next as Partial<GameStore>);

    return {
      ...EMPTY_STATE,
      seed,
      rng: createSeededRng(seed),

      initGame(args: InitGameArgs) {
        if (args.players < 1) {
          throw new Error('initGame: players must be >= 1');
        }
        if (args.championIds.length !== args.players) {
          throw new Error(
            `initGame: expected ${args.players} champion ids, got ${args.championIds.length}`,
          );
        }

        // Prefer an explicit `args.seed` (runtime new-game supplies a
        // fresh value so different playthroughs diverge); fall back to
        // the store's existing seed for tests and debug fixtures that
        // rely on reproducible state.
        const currentSeed = typeof args.seed === 'number' ? args.seed : get().seed;
        const rng = createSeededRng(currentSeed);

        const players: KidPlayer[] = [];
        for (let i = 0; i < args.players; i += 1) {
          const championId = args.championIds[i];
          const deck = buildStarterDeck(rng);
          players.push({
            id: `p${i}`,
            name: args.names?.[i] ?? `Player ${i + 1}`,
            championId,
            championSlot: resolveChampionSlot(championId),
            championPassivePulse: 0,
            hp: STARTING_HP,
            hpMax: STARTING_HP,
            downed: false,
            revivedThisIncident: false,
            green: 0,
            red: 0,
            keys: 0,
            deck,
            hand: [],
            discard: [],
            inPlay: [],
            slots: [null, null],
            items: [],
            chestsOpened: 0,
            wildWolfKillsThisTurn: 0,
            usedKeyVendorThisTurn: false,
            wisdomsLight: false,
            // v2.1 gm0.16: ember-shard accumulator + per-combat bottle
            // tracking. Both start empty at game-start; chests and
            // `COMBAT_ENTER` hydrate them at runtime.
            heartPieces: 0,
            heartPieceMeter: 0,
            usedFairyInBottleIds: [],
            // 91p framework: permanent banish pile (deck-thinning).
            // No v2.0/v2.1 card currently banishes; cards land in 91p
            // follow-up beads (commit sequence b).
            banished: [],
            // 4hz6: Dungeon Boss onDefeat foresight flag. Off at
            // game-start; flipped on by a face-2/3 reward roll commit,
            // consumed by the next chest opening.
            nextChestItemRevealed: false,
          });
        }

        // Auto-draw the opening hand for the active player (p0). The
        // Wisdom Champion draws 1 extra card per turn (embertide-57p),
        // so the first hand size respects that passive. u-2c: Wisdom's
        // extra-draw here IS its first passive fire — bump the slot pulse
        // in lockstep with the runtime Draw-phase branch in advancePhase.
        const p0 = players[0];
        const p0IsWisdom = p0.championId === EXTRA_DRAW_CHAMPION_ID;
        const p0DrawCount = p0IsWisdom ? 6 : 5;
        const drawn = drawCards(
          { deck: p0.deck, hand: p0.hand, discard: p0.discard },
          p0DrawCount,
          rng,
        );
        players[0] = {
          ...p0,
          deck: drawn.deck,
          hand: drawn.hand,
          discard: drawn.discard,
          championPassivePulse: p0IsWisdom ? p0.championPassivePulse + 1 : p0.championPassivePulse,
        };

        // Apply p0's champion start-of-turn passive (power/sword grant
        // resources on the opening turn as well). No-op for courage/wisdom.
        players[0] = applyChampionPower(players[0]);

        // embertide-4hr1.19: colosseum persistence is a FULL PER-RUN
        // RESET (designer ruling 2026-06-04). The reward ledger lives in
        // the singleton `useColosseumMetaStore` (separate from the main
        // store's per-run `colosseumProgression`), so clear it at run
        // start — a new run must never see a prior run's claimed rewards.
        useColosseumMetaStore.getState().reset();

        // Build the shuffled Ascension-style supply and deal the opening
        // center-row market. refillField tops the field up to FIELD_SIZE.
        // Chests live in their own dedicated chestSupply → chestRow pipeline
        // per embertide-7c1; they are not mixed into the main market.
        const initial: KidGameState = {
          ...EMPTY_STATE,
          seed: currentSeed,
          rng,
          players,
          currentPlayerIndex: 0,
          turn: 1,
          supply: buildSupply(rng),
          chestSupply: buildChestSupply(rng),
          princessCrystal: initialPrincessCrystalState(),
          activeCombat: null,
          combatsEntered: 0,
          combatTutorialBubble: null,
          tutorialBubblesFired: [],
          tutorialBubbleBodyOverride: null,
          // embertide-044: Reset kill counter + Rainbow spawn
          // flag on every fresh run so they stay per-game and never
          // leak across playthroughs.
          centerRowKillCount: 0,
          goldenRainbowLynelSpawned: false,
          // embertide-91p (b): banish-prompt surface starts null;
          // playCard hydrates it on a banish-from-hand resolve.
          pendingBanishChoice: null,
          // embertide-4hz6: Dungeon Boss reward-roll surface starts
          // null; COMBAT_RESOLVE_WIN hydrates it on a region-boss kill.
          pendingDungeonBossRoll: null,
          // embertide-gm0.10: Forest-Sage on-play omen roll surface
          // starts null; `playCard` hydrates it when forest-sage is
          // played.
          pendingForestSageRoll: null,
          ...initialZoneFields(),
        };
        set(refillChestRow(refillField(initial)));
      },

      drawFive() {
        const state = get();
        if (state.outcome !== null) return;
        const idx = state.currentPlayerIndex;
        const player = state.players[idx];
        if (!player) return;
        const next = drawFiveFor(player, state.rng);
        set(
          replacePlayer(state, idx, {
            ...player,
            deck: next.deck,
            hand: next.hand,
            discard: next.discard,
          }),
        );
      },

      playCard(cardId: string) {
        const state = get();
        if (state.outcome !== null) return;
        requireMainPhase(state, 'playCard');
        const idx = state.currentPlayerIndex;
        const player = state.players[idx];
        if (!player) return;
        const handIdx = player.hand.findIndex((c) => c.id === cardId);
        if (handIdx === -1) throw new Error(`Card not in hand: ${cardId}`);
        const card = player.hand[handIdx];

        // Items and legendary-items route into the Items zone (REQ-4,
        // u-2d — renamed from Constructs) rather than inPlay — resource
        // deltas and the forest-sage chain don't apply.
        if (routesToItemsZone(card)) {
          const hand = player.hand.slice();
          hand.splice(handIdx, 1);
          const outcome = equipAsItem({ items: player.items, discard: player.discard }, card);
          // nmmc (2026-04-26): items unbounded → equipAsItem always
          // slots the card; the legacy cap-overflow → inPlay branch is
          // gone. Equip-bonus + heirloom on-equip fires fire every
          // time, matching the always-equip contract.
          const equippedPlayer: KidPlayer = {
            ...player,
            hand,
            items: outcome.owner.items,
          };
          // embertide-uz7k (wun Track B): heirloom on-equip fire
          // (gain/draw) composes with equip-bonus on-equip fire — they
          // are disjoint by `effects.kind` so only one branch ever
          // applies per card, but we run both unconditionally so any
          // future card can opt into either pattern without re-wiring
          // the dispatcher.
          const nextPlayer: KidPlayer = applyEquipBonusOnEquip(
            applyHeirloomOnEquip(equippedPlayer, card, state.rng),
            card,
            state.rng,
          );
          // embertide-91p (b): per-card banish wiring also fires for
          // item cards whose EffectSpec declares `kind: 'banish-from-hand'`
          // (the v2.x `blacksmith-forge` / `ritual-relic` items). Snapshot
          // is taken AFTER the hand splice + equip so the just-played item
          // never appears in the choosable set.
          const pendingBanishChoice = pendingBanishChoiceFor(card, nextPlayer);
          if (pendingBanishChoice !== null) {
            set({
              ...replacePlayer(state, idx, nextPlayer),
              pendingBanishChoice,
            });
            return;
          }
          set(replacePlayer(state, idx, nextPlayer));
          return;
        }

        // Heroes / starters: apply the on-play deltas and move the card
        // from hand → inPlay via the shared helper.
        const nextPlayer = applyHeroPlay(player, card, state.rng);

        // embertide-91p (b): per-card banish wiring. Cards whose
        // EffectSpec declares `kind: 'banish-from-hand'` pause after
        // their normal on-play motion (resource deltas, inPlay
        // placement) and surface the active player's hand for choice.
        // The actual banish lands in the chosen card on
        // `banishFromHand(cardId)`; cancelling fizzles the effect.
        // Snapshot is taken AFTER `applyHeroPlay` so the just-played
        // card itself can never appear in the choosable set (it has
        // already moved hand → inPlay).
        const pendingBanishChoice = pendingBanishChoiceFor(card, nextPlayer);
        if (pendingBanishChoice !== null) {
          set({
            ...replacePlayer(state, idx, nextPlayer),
            pendingBanishChoice,
          });
          return;
        }

        // embertide-gm0.10 (v2.1 REQ-6) + ynn4 die-roll-animation
        // pass 2026-04-25: roll-die on-play wiring. After the card has
        // moved hand → inPlay (no resource deltas — `heroOnPlayDeltas`
        // returns NO_DELTAS for this baseId post-gm0.10), pre-roll a
        // single d6 face via `d6(rng)` and hydrate
        // `pendingForestSageRoll` so the UI can mount DieRollReveal.
        // Per-encounter cap (REQ-9f) is enforced implicitly: the
        // EffectSpec resolves once per play and the pending surface is
        // cleared on commit.
        //
        // Future roll-die heroes (none authored in v2.1 today, but the
        // discriminant is shared) can land here without a new branch:
        // the keyed handler is selected by `baseIdOf(card)` against a
        // module-level dispatch table when a second card lands.
        if (card.effects.kind === 'roll-die' && baseIdOf(card) === 'forest-sage') {
          const face = d6(state.rng);
          set({
            ...replacePlayer(state, idx, nextPlayer),
            pendingForestSageRoll: {
              cardId: card.id,
              playerId: nextPlayer.id,
              face,
            },
          });
          return;
        }

        set(replacePlayer(state, idx, nextPlayer));
      },

      playCardFromInPlayDrop(cardId: string) {
        const state = get();
        const player = state.players[state.currentPlayerIndex];
        const card = player?.hand.find((c) => c.id === cardId);
        // Items equip out-of-sight into the Items zone — an invalid drop
        // for the in-play zone, so leave them in hand (embertide-0qby).
        if (!card || routesToItemsZone(card)) return;
        get().playCard(cardId);
      },

      buyFromField(cardId: string) {
        const state = get();
        if (state.outcome !== null) return;
        requireMainPhase(state, 'buyFromField');
        const idx = state.currentPlayerIndex;
        const player = state.players[idx];
        if (!player) return;

        const fieldIdx = state.field.findIndex((c) => c.id === cardId);
        if (fieldIdx === -1) throw new Error(`Card not in field: ${cardId}`);
        const card = state.field[fieldIdx];

        const greenCost = card.cost.green ?? 0;
        if (player.green < greenCost) {
          throw new Error(`Insufficient green: need ${greenCost}, have ${player.green}`);
        }

        // Card cost is ALWAYS paid (embertide-9yu). All field
        // purchases — heroes AND items / legendary-swords — land in
        // discard so the card flows through the standard deck cycle
        // (embertide-zm28: Ascension Constructs pattern). The
        // items-zone equip + equip-bonus + heirloom-on-equip fire
        // when the card is later drawn into hand and PLAYED via
        // `playCard`. Chest item rewards (applyReward) and wild-boss
        // heirloom drops (grantHeirloom) keep their direct-equip
        // semantics — only the field-buy path joins the deck cycle.
        const finalPlayer: KidPlayer = {
          ...player,
          green: player.green - greenCost,
          discard: [...player.discard, card],
        };

        const field = state.field.slice();
        field.splice(fieldIdx, 1);

        const next: KidGameState = {
          ...replacePlayer(state, idx, finalPlayer),
          field,
        };
        set(checkCoopVictory(refillField(next)));
      },

      buyAlwaysAvailable(baseId: string) {
        const state = get();
        if (state.outcome !== null) return;
        requireMainPhase(state, 'buyAlwaysAvailable');
        const idx = state.currentPlayerIndex;
        const player = state.players[idx];
        if (!player) return;

        const template = findAlwaysAvailable(baseId);
        if (!template) {
          throw new Error(`Unknown always-available card: ${baseId}`);
        }
        if (template.role !== 'hero') {
          throw new Error(`buyAlwaysAvailable expects a hero template, got ${template.role}`);
        }

        const greenCost = template.cost.green ?? 0;
        if (player.green < greenCost) {
          throw new Error(`Insufficient green: need ${greenCost}, have ${player.green}`);
        }

        // Mint a fresh copy with a unique suffix id so repeat purchases don't
        // collide. baseId is preserved for `playCard` effect dispatch.
        const minted = mintAlwaysAvailable(baseId, state.rng);
        const finalPlayer: KidPlayer = {
          ...player,
          green: player.green - greenCost,
          discard: [...player.discard, minted],
        };
        set(checkCoopVictory(replacePlayer(state, idx, finalPlayer)));
      },

      defeatAlwaysAvailable(baseId: string) {
        const state = get();
        if (state.outcome !== null) return;
        requireMainPhase(state, 'defeatAlwaysAvailable');
        const idx = state.currentPlayerIndex;
        const player = state.players[idx];
        if (!player) return;

        const template = findAlwaysAvailable(baseId);
        if (!template) {
          throw new Error(`Unknown always-available card: ${baseId}`);
        }
        if (template.role !== 'monster') {
          throw new Error(`defeatAlwaysAvailable expects a monster template, got ${template.role}`);
        }

        // u-8c tier branch: always-available wild/region bosses dispatch
        // COMBAT_ENTER. v2.0 ships no always-available bosses (Wild Wolf
        // is the only entry and it's a regular beast), but the branch
        // stays symmetric for forward compatibility.
        if (template.bossTier === 'wild-boss' || template.bossTier === 'region-boss') {
          this.dispatchCombat(
            enterCombatAction(
              state,
              { kind: 'card', card: template },
              'defeatAlwaysAvailableMonster',
            ),
          );
          return;
        }

        const next = defeatAlwaysAvailableMonster(state, idx, template);
        set(checkCoopVictory(next));
      },

      fightMonster(monsterId: string) {
        const state = get();
        if (state.outcome !== null) return;
        requireMainPhase(state, 'fightMonster');
        const idx = state.currentPlayerIndex;
        const player = state.players[idx];
        if (!player) return;

        const fieldIdx = state.field.findIndex((c) => c.id === monsterId);
        if (fieldIdx === -1) {
          throw new Error(`Monster not in field: ${monsterId}`);
        }
        const monster = state.field[fieldIdx];

        // u-8c tier branch: wild-boss / region-boss engagement routes
        // through the combat sub-state (PRD §B6). Resource costs AND
        // field removal still happen at entry time — there is no
        // retreat in v2.1 (Q7), so paying the red + key cost to
        // engage commits the investment. Hearts heal / wisp drop /
        // shard grant / zone advance all land on COMBAT_RESOLVE_WIN.
        // Regular monsters keep the existing instant-resolution path.
        if (monster.bossTier === 'wild-boss' || monster.bossTier === 'region-boss') {
          const redCost = monster.cost.red ?? 0;
          const keyCost = monster.cost.keys ?? 0;
          if (player.red < redCost) {
            throw new Error(`Insufficient red: need ${redCost}, have ${player.red}`);
          }
          if (player.keys < keyCost) {
            throw new Error(`Insufficient keys: need ${keyCost}, have ${player.keys}`);
          }
          // Pay the engagement cost. Field removal happens alongside
          // — the boss card becomes an in-combat CombatBoss and is
          // NOT left in the field where a second player could also
          // engage.
          const paidPlayer: KidPlayer = {
            ...player,
            red: player.red - redCost,
            keys: player.keys - keyCost,
          };
          const nextField = state.field.slice();
          nextField.splice(fieldIdx, 1);
          const nextState: KidGameState = {
            ...replacePlayer(state, idx, paidPlayer),
            field: nextField,
          };
          // Re-bind state via setState so the dispatchCombat call below
          // reads the paid-up snapshot from get(). refillField does NOT
          // run at entry — refill is a post-combat concern and only
          // fires once the boss slot is semantically "gone" (resolved).
          set(nextState);
          this.dispatchCombat(
            enterCombatAction(nextState, { kind: 'card', card: monster }, 'fightMonster'),
          );
          return;
        }

        const next = fightMonsterSlice(state, idx, monsterId);
        set(checkCoopVictory(refillField(next)));
      },

      engageWildBossSlot(zoneId: ZoneId, bossId: string) {
        const state = get();
        if (state.outcome !== null) return;
        requireMainPhase(state, 'engageWildBossSlot');

        // gm0.9 REQ-19: phase gate — wild-boss engagement is only
        // eligible from the Rising phase onward (turn 3+). Stirring
        // turns 1-2 render a dormant slot that should not dispatch;
        // this backstops any UI/state drift.
        if (!canSpawnWildBossInZone(state, zoneId)) {
          throw new Error(
            `engageWildBossSlot: wild-boss slot is dormant — phase ${sessionPhase(state.turn)} (turn ${state.turn}) precedes Rising`,
          );
        }

        // Defensive gate: the bossId must match whichever wild-boss is
        // currently at the head of the zone's FIFO queue. UI (u-9d)
        // should already disable stale slot clicks; this backstops a
        // drift between UI state and the selector.
        const currentWild = currentWildBossForZone(state, zoneId);
        if (currentWild !== bossId) {
          throw new Error(
            `engageWildBossSlot: bossId="${bossId}" does not match current wild-boss for zone "${zoneId}" (expected ${currentWild ?? 'null'})`,
          );
        }

        const bossCard = cardByIdOrThrow(bossId);

        // u-9c: slot engagement bypasses the red/keys cost check and
        // the field-splice that `fightMonster` applies to center-row
        // engagements. Slot bosses post-u-9a do NOT live in
        // `state.field` — SUPPLY_PLAN pulled them per u-9a.
        //
        // NOTE: use `get().dispatchCombat` rather than `this.dispatchCombat`.
        // React selectors (`useGameStore((s) => s.engageWildBossSlot)`) drop
        // the `this` binding, so a React-dispatched call would throw
        // `Cannot read properties of undefined`. u-9e playtest scenarios
        // exercise this path — the store's own getter is the safe bind.
        get().dispatchCombat(
          enterCombatAction(
            state,
            { kind: 'card', card: bossCard },
            'fightMonster',
            'wild-boss-slot',
          ),
        );
      },

      engageRegionBossSlot(zoneId: ZoneId, bossId: string) {
        const state = get();
        if (state.outcome !== null) return;
        requireMainPhase(state, 'engageRegionBossSlot');

        // Defensive gate: the bossId must match the current region
        // boss selector. `currentRegionBossForZone` returns `null` once
        // the region boss has been defeated — re-engagement is a
        // programmer error, not a runtime branch.
        const currentRegion = currentRegionBossForZone(state, zoneId);
        if (currentRegion !== bossId) {
          throw new Error(
            `engageRegionBossSlot: bossId="${bossId}" does not match current region-boss for zone "${zoneId}" (expected ${currentRegion ?? 'null'})`,
          );
        }

        // gm0.9 REQ-19: region-boss phase gate — engagement is only
        // eligible from the Boss phase onward (turn 6+). Enforced
        // independently of the boss-key gate below; both must hold.
        if (!canSpawnRegionBossByPhase(state, zoneId)) {
          throw new Error(
            `engageRegionBossSlot: region-boss phase gate closed — phase ${sessionPhase(state.turn)} (turn ${state.turn}) precedes Boss`,
          );
        }

        // gm0.12: boss-key gate (reverses REQ-32 / u-9a's always-on
        // region slot). The region boss is SEALED until every core
        // wild-boss key for this zone has dropped. UI disables the
        // click when locked; this backstops any UI/state drift.
        if (!canSpawnRegionBoss(state, zoneId)) {
          throw new Error(
            `engageRegionBossSlot: region boss is sealed — zone "${zoneId}" requires all wild-boss keys before the region boss can be engaged`,
          );
        }

        const bossCard = cardByIdOrThrow(bossId);

        // u-9c: region-slot engagement also bypasses the cost check
        // (no red / keys required). Post-REQ-32 the region slot is
        // always engageable once the zone is active — the old
        // "wild-bosses-cleared" gate was retired with
        // `canSpawnRegionBoss` per u-9a. Shard grant + zone advance
        // on WIN land via the existing `buildResolveWinAction` path.
        //
        // NOTE: use `get().dispatchCombat` rather than `this.dispatchCombat`
        // — React selectors drop the `this` binding. See the matching note
        // in `engageWildBossSlot` above.
        get().dispatchCombat(
          enterCombatAction(
            state,
            { kind: 'card', card: bossCard },
            'fightMonster',
            'region-boss-slot',
          ),
        );
      },

      enterColosseum() {
        const state = get();
        if (state.outcome !== null) return;
        requireMainPhase(state, 'enterColosseum');

        // Backstop the unlock gate — UI surface (4hr1.4 HUD) is
        // expected to disable the entry click when
        // `isColosseumUnlocked` is false. Mirroring the defensive
        // throws in engageWildBossSlot / engageRegionBossSlot so a
        // stale dispatch surfaces as a programmer error rather than
        // silently routing into an empty roster.
        if (!isColosseumUnlocked(state)) {
          throw new Error(
            'enterColosseum: colosseum is locked — defeat the Sylvani wild + region bosses first',
          );
        }

        // Caller owns entry-tier policy per the engine's progression
        // docstring (embertide-4hr1.3) — single grep target for
        // "where does tier 1 land". `unlockTier` is a pure clone-or-
        // identity, so we can run the picker against the seeded value
        // before any state write.
        const seeded = unlockTier(state.colosseumProgression, 1);
        const boss = pickColosseumBoss(seeded, state.rng);
        if (boss === null) {
          // Reachable only if a future roster constant ships empty —
          // pickColosseumBoss is null-only on empty unlockedTiers, and
          // we just seeded tier 1 above.
          throw new Error(
            'enterColosseum: pickColosseumBoss returned null after tier-1 seed — empty roster?',
          );
        }

        // Persist the seed write only AFTER pickColosseumBoss succeeds —
        // a null pick (programming error) must not leave an orphan
        // tier-1 seed in state.
        if (seeded !== state.colosseumProgression) {
          set({ ...state, colosseumProgression: seeded });
        }

        // The engine slot router returns a fully-specified `CombatBoss`
        // (HP + attackPattern). Pass it via the `kind: 'boss'` arm of
        // `CombatEntry` so `enterCombatAction` skips the main-game
        // KID_CARDS / BOSS_ATTACK_PATTERNS lookups — some colosseum
        // source-card-ids (coilworm, bonereaver, etc.) have no main-game
        // Card counterpart. COMBAT_RESOLVE_WIN branches on
        // `entrySource === 'colosseum-slot'` to keep tier-progression
        // and main-game ledgers separate.
        get().dispatchCombat(
          enterCombatAction(get(), { kind: 'boss', boss }, 'fightMonster', 'colosseum-slot'),
        );
      },

      openChest(variant: ChestVariant) {
        const state = get();
        if (state.outcome !== null) return;
        requireMainPhase(state, 'openChest');
        const idx = state.currentPlayerIndex;
        // Chests live in the dedicated chestRow (embertide-7c1). Find a
        // physical chest card of the requested variant, resolve the open,
        // remove the chest from the row, and refill from chestSupply. The
        // main field refill does NOT run here — chests no longer live in
        // the main market.
        const chestRole = `chest-${variant}` as const;
        const rowIdx = state.chestRow.findIndex((c) => c.role === chestRole);
        const afterChest = openChestFor(state, idx, variant);
        let next: KidGameState = afterChest;
        if (rowIdx !== -1) {
          const chestRow = next.chestRow.slice();
          chestRow.splice(rowIdx, 1);
          next = { ...next, chestRow };
        }
        set(checkCoopVictory(refillChestRow(next)));
      },

      clearLastChestReward() {
        const state = get();
        if (state.outcome !== null) return;
        if (state.lastChestReward === null) return;
        // embertide-ymgc: clear the parallel card field in lockstep
        // so the reveal cannot leak a stale card art onto the next chest.
        set({ ...state, lastChestReward: null, lastChestRewardCard: null });
      },

      advancePhase() {
        let state: KidGameState = get();
        if (state.outcome !== null) return;

        switch (state.phase) {
          case 'Upkeep': {
            // SOT item triggers + champion passive fire (REQ-4 / u-2d:
            // the hook also decrements `cooldownTurns` on every
            // item-active card in the zone, floored at 0). Canonical TCG
            // ordering (v2 pivot); v1 fired these AFTER the draw, but the
            // phase structure puts them where they semantically belong —
            // before the player sees their new hand.
            state = applyStartOfTurnItems(state);
            const activeIdx = state.currentPlayerIndex;
            const active = state.players[activeIdx];
            if (active) {
              state = replacePlayer(state, activeIdx, applyChampionPower(active));
            }
            state = { ...state, phase: 'Draw' };
            set(state);
            return;
          }

          case 'Draw': {
            const activeIdx = state.currentPlayerIndex;
            const active = state.players[activeIdx];
            if (active) {
              const isWisdom = active.championId === EXTRA_DRAW_CHAMPION_ID;
              const drawCount = isWisdom ? 6 : 5;
              const drawn = drawCards(
                { deck: active.deck, hand: active.hand, discard: active.discard },
                drawCount,
                state.rng,
              );
              state = replacePlayer(state, activeIdx, {
                ...active,
                deck: drawn.deck,
                hand: drawn.hand,
                discard: drawn.discard,
                // Wisdom's extra-draw is its passive fire — pulse the slot
                // (u-2c). Non-wisdom champions pulse from applyChampionPower
                // in Upkeep for power/sword; courage pulses in combat.ts.
                championPassivePulse: isWisdom
                  ? active.championPassivePulse + 1
                  : active.championPassivePulse,
              });
            }
            state = { ...state, phase: 'Main' };
            set(state);
            return;
          }

          case 'Main': {
            // Downed players auto-pass Main. Otherwise Main is the player's
            // action window — advancePhase called from Main advances to
            // BossResolve (explicit end-of-main from UI or endTurn loop).
            state = { ...state, phase: 'BossResolve' };
            set(state);
            return;
          }

          case 'BossResolve': {
            // Reserved for u-7 (session-arc softclock, Boss/Climax gates).
            // v2.0: pass through.
            state = { ...state, phase: 'End' };
            set(state);
            return;
          }

          case 'End': {
            // Flush the outgoing player's hand/inPlay → discard, zero
            // green/red, reset wildWolfKills. HP, keys, items,
            // chestsOpened, deck all persist.
            const prevIdx = state.currentPlayerIndex;
            const prev = state.players[prevIdx];
            if (prev) {
              const cleared: KidPlayer = {
                ...prev,
                hand: [],
                inPlay: [],
                discard: [...prev.discard, ...prev.hand, ...prev.inPlay],
                green: 0,
                red: 0,
                wildWolfKillsThisTurn: 0,
                usedKeyVendorThisTurn: false,
              };
              state = replacePlayer(state, prevIdx, cleared);
            }
            // embertide-gdd.1: tide-gauge tick. Per-turn-end +1
            // while currentZone === 'maren'; clamped at TIDE_GAUGE_MAX.
            // Pure no-op outside Maren and at the cap. Fires before the
            // co-op victory/loss checks so a Maren-zone game-over
            // includes the final tick in the snapshot.
            state = incrementTideGauge(state);
            // embertide-gdd.2: shadow-creep tick — same contract,
            // gated on currentZone === 'hollow-shrine'. Pure no-op
            // outside the zone and at SHADOW_CREEP_MAX. Sequenced
            // alongside the tide-gauge tick so both gauges share the
            // same end-phase commit point.
            state = incrementShadowCreep(state);
            // embertide-gdd.3: sandstorm-counter tick — same
            // contract, gated on currentZone === 'dune-sanctum'. Pure
            // no-op outside the zone and at SANDSTORM_COUNTER_MAX.
            // Sequenced alongside the tide-gauge + shadow-creep ticks
            // so all three gauges share the same end-phase commit
            // point.
            state = incrementSandstormCounter(state);
            // embertide-gdd.1.2: fangfish fragility window. Any
            // fangfish that has been sitting in `state.field` since
            // the previous End-phase (id present in the watchlist)
            // discards into `state.defeated` ("school of fish darts
            // away" thematic). Fresh fangfish populate the watchlist
            // for a one-turn grace window. Pure no-op when no
            // fangfish is in the field.
            state = applySkullfishFragility(state);
            // Co-op shared-pool checks (amendment A2/A3).
            state = checkCoopVictory(state);
            state = checkCoopLoss(state);
            if (state.outcome !== null) {
              set(state);
              return;
            }
            // Advance to next player and cycle back to Upkeep.
            state = advanceTurn(state);
            state = { ...state, phase: 'Upkeep' };
            set(state);
            return;
          }

          default: {
            const _exhaustive: never = state.phase;
            throw new Error(`advancePhase: unhandled phase ${String(_exhaustive)}`);
          }
        }
      },

      endTurn() {
        // Thin wrapper: loop advancePhase from Main through End, around the
        // cycle, and stop at the next player's Main. A safety counter
        // guards against accidental infinite loops (should never fire —
        // the loop is bounded by a fixed number of phases).
        const api = get() as unknown as GameStore;
        const SAFETY = 20;
        for (let i = 0; i < SAFETY; i += 1) {
          const before = get();
          if (before.outcome !== null) return;
          api.advancePhase();
          const after = get();
          // Stop when we've cycled around to the next Main phase (past
          // End of previous → Upkeep + Draw of next). Also stop on the
          // same state to guard against Main-with-downed-looping when
          // both players are downed.
          if (after.phase === 'Main' && before.phase !== 'Main') return;
          if (after.phase === before.phase && after === before) return;
        }
        throw new Error('endTurn: phase loop did not converge within SAFETY iterations');
      },

      reviveTeammate(playerId: string): void {
        const state = get();
        if (state.outcome !== null) return;
        requireMainPhase(state, 'reviveTeammate');
        const targetIdx = state.players.findIndex((p) => p.id === playerId);
        if (targetIdx === -1) {
          throw new Error(`reviveTeammate: unknown playerId ${playerId}`);
        }
        const target = state.players[targetIdx];
        if (!target.downed) {
          throw new Error(`reviveTeammate: target ${playerId} is not downed`);
        }
        const reviverIdx = state.currentPlayerIndex;
        if (reviverIdx === targetIdx) {
          throw new Error('reviveTeammate: cannot revive yourself');
        }
        const reviver = state.players[reviverIdx];
        if (reviver.revivedThisIncident) {
          throw new Error('reviveTeammate: reviver has already revived this incident');
        }
        const players = state.players.slice();
        players[targetIdx] = { ...target, hp: 1, downed: false };
        players[reviverIdx] = { ...reviver, revivedThisIncident: true };
        set({ ...state, players });
      },

      playFairyOn(playerId: string): void {
        const state = get();
        if (state.outcome !== null) return;
        requireMainPhase(state, 'playFairyOn');
        const targetIdx = state.players.findIndex((p) => p.id === playerId);
        if (targetIdx === -1) {
          throw new Error(`playFairyOn: unknown playerId ${playerId}`);
        }
        const activeIdx = state.currentPlayerIndex;
        const active = state.players[activeIdx];
        // gm0.16: any of the three wisp baseIds counts. Prefer plain
        // 'wisp' / 'great-wisp' over 'wisp-in-bottle' — the bottle
        // has a reusable-once-per-combat refill contract, so consuming
        // it ahead of a single-use wisp would waste the refill. Falls
        // back to the first wisp of any kind when that's all that's
        // held.
        const preferSingleUse = active.items.findIndex(
          (c) => baseIdOf(c) === 'wisp' || baseIdOf(c) === 'great-wisp',
        );
        const fairyIdx =
          preferSingleUse !== -1
            ? preferSingleUse
            : active.items.findIndex((c) => WISP_BASE_IDS.has(baseIdOf(c)));
        if (fairyIdx === -1) {
          throw new Error('playFairyOn: active player has no wisp to play');
        }
        const target = state.players[targetIdx];
        // Soft UX (amendment A6): wisp is only consumed when it actually
        // revives a downed teammate. Outside that context, the action is a
        // no-op so the card is preserved for when it's really needed.
        if (!target.downed) return;
        const consumed = active.items[fairyIdx];
        const items = [...active.items.slice(0, fairyIdx), ...active.items.slice(fairyIdx + 1)];
        // gm0.16: Wisp-in-Bottle reusability. On first consumption of a
        // given bottle within a combat, re-equip it into the owner's
        // items zone so it can fuel ONE additional revive. The bottle's
        // id is recorded in the owner's `usedFairyInBottleIds` so the
        // second consumption does NOT re-equip (the bottle is spent).
        // The tracking set resets at COMBAT_ENTER.
        const isBottle = baseIdOf(consumed) === 'wisp-in-bottle';
        const alreadyUsed = isBottle && active.usedFairyInBottleIds.includes(consumed.id);
        const shouldRefill = isBottle && !alreadyUsed;
        const nextActiveItems = shouldRefill ? [...items, consumed] : items;
        const nextUsedIds = shouldRefill
          ? [...active.usedFairyInBottleIds, consumed.id]
          : active.usedFairyInBottleIds;
        const players = state.players.slice();
        players[activeIdx] = {
          ...active,
          items: nextActiveItems,
          usedFairyInBottleIds: nextUsedIds,
        };
        players[targetIdx] = { ...target, hp: target.hpMax, downed: false };
        set({ ...state, players });
      },

      strikePrincessCrystal(): void {
        const state = get();
        if (state.outcome !== null) return;
        requireMainPhase(state, 'strikePrincessCrystal');
        // Downed active players cannot take main-phase actions per
        // amendment A3. Phase can still be 'Main' while the active player
        // is downed (advancePhase auto-passes downed players, but only
        // when advancePhase is explicitly invoked). This guard backstops
        // the UI, which should already disable the Strike button.
        const activePlayer = state.players[state.currentPlayerIndex];
        if (activePlayer?.downed) return;
        // Pure helper is a no-op when charges > 0 or already freed — the
        // UI-level disabled state is the primary guard; this keeps the
        // store action safe if the UI ever drifts out of sync.
        const afterStrike = strikePrincessCrystalPure(state);
        if (afterStrike === state) return;
        // A wisdom flip can complete the three-shard shared win, so run
        // the co-op victory check at the tail. Loss checks aren't wired
        // here — striking doesn't damage anyone.
        set(checkCoopVictory(afterStrike));
      },

      banishFromHand(cardId: string): void {
        const state = get();
        const next = banishFromHandSlice(state, cardId);
        if (next === state) return;
        set(next);
      },

      cancelBanishChoice(): void {
        const state = get();
        const next = cancelBanishChoiceSlice(state);
        if (next === state) return;
        set(next);
      },

      banishFromDiscard(cardId: string): void {
        const state = get();
        const next = banishFromDiscardSlice(state, cardId);
        if (next === state) return;
        set(next);
      },

      tradeWithKeyVendor(): void {
        const state = get();
        const next = tradeWithKeyVendorSlice(state);
        if (next === state) return;
        set(next);
      },

      dispatchCombat(action: CombatAction): void {
        const state = get();
        if (state.outcome !== null) return;

        switch (action.type) {
          case 'COMBAT_ENTER': {
            // Hydrate activeCombat via the initial-draw helper. `combatDeck`
            // on the payload is the pre-shuffled full deck; initialCombatDraw
            // splits it into (remaining deck, hand, discard-overflow).
            const nextCombat = buildInitialCombatState(
              action.boss,
              action.combatDeck,
              action.context,
              action.tideGaugeSnapshot ?? 0,
              action.arena,
            );
            // Bump combatsEntered so the tutorial layer (u-8g) can gate
            // progressive-disclosure bubbles on "first combat" vs
            // "second+ combat". Counter is session-scoped — reset only
            // at initGame. `combat-entry` fires unconditionally on every
            // combat entry per §B8.
            //
            // embertide-07h: combat-entry body embeds {bossName};
            // render the template here so the player sees e.g. "You
            // engaged Ashen Tyrant!" instead of the generic "the boss".
            const entryBody = renderCombatBubbleBody('combat-entry', {
              bossName: bossDisplayName(action.boss.sourceCardId),
            });
            // gm0.16: reset per-player `usedFairyInBottleIds` at every
            // combat entry. Bottles are "once per combat" — a bottle
            // used in a prior combat gets a fresh refill in the next.
            const playersReset = state.players.map((p) =>
              p.usedFairyInBottleIds.length === 0 ? p : { ...p, usedFairyInBottleIds: [] },
            );
            // embertide-4uyn.3: fire every owned item-passive declaring
            // `trigger: 'on-combat-enter'` for each player. Applies
            // per-player (combat is 2-player shared-HP but items/resources
            // are per-seat, mirroring the per-player dispatch shape used
            // by `applyStartOfTurnItems` and `applyMonsterDefeatedPassives`).
            // Idempotency: `COMBAT_ENTER` is dispatched exactly once per
            // combat entry via `fightMonster` / `engageWildBossSlot` /
            // `engageRegionBossSlot`; revive flows (`reviveTeammate`,
            // `playFairyOn`) do NOT re-dispatch `COMBAT_ENTER`, and
            // `COMBAT_RESOLVE_WIN`/`_LOSS` both clear `activeCombat` to
            // null — so the passive fires exactly once per combat lifecycle
            // by construction. No runtime gate needed beyond the natural
            // reducer boundary.
            const playersWithPassives = playersReset.map((p) =>
              p.items.length === 0
                ? p
                : applyItemPassivesForTrigger(p, 'on-combat-enter', state.rng),
            );
            set({
              ...state,
              players: playersWithPassives,
              activeCombat: nextCombat,
              combatsEntered: state.combatsEntered + 1,
              combatTutorialBubble: 'combat-entry',
              tutorialBubbleBodyOverride: entryBody,
            });
            return;
          }

          case 'COMBAT_RESOLVE_WIN': {
            // Every applyDamage call-site during combat resolved through
            // the engine's routing (see combatEngine.ts routePlayerHpDamage /
            // routeAoePlayerDamage). Neither of those invokes checkCoopLoss,
            // so we fire it here defensively: a final-turn boss hit could
            // have downed the last standing player coincident with the
            // winning card play, and the contract at checkCoopLoss above
            // requires the check to run after every damage transaction.
            let next: KidGameState = state;
            // embertide-4hr1.5: colosseum-mode entries get a
            // separate post-WIN settlement — tier-progression advance
            // INSTEAD of the main-game drop pipeline (heirloom, wisp,
            // shard, zone advance, recordBossDefeat, bossKey, heart
            // container, dungeon-boss roll, crystal decrement, Golden
            // Rainbow counter). Colosseum bosses share `sourceCardId`
            // with main-zone bosses (e.g. 'craghorn'), so feeding them
            // through the wild-boss-slot pipeline would (a) advance
            // the wild-boss FIFO queue spuriously, (b) duplicate
            // heirloom / key drops, (c) decrement the princess crystal
            // off-mode, and (d) satisfy the `isColosseumUnlocked` gate
            // via the wrong path. The flag is read once here and
            // gated through the rest of the reducer.
            const isColosseumEntry =
              next.activeCombat !== null &&
              next.activeCombat.entryContext.entrySource === 'colosseum-slot';
            // 1. Hearts heal (respecting hpMax per player). Augmented
            // with each attacker's Champion combat-heal passive
            // (embertide-g7f) — Courage's mini/final-boss +1 and
            // Sword's region/final-boss +1 both fire HERE for wild +
            // region-boss combats, mirroring the same bonus logic in
            // `fightMonsterSlice` for the legacy field-resolution path.
            // Hearts heal applies to colosseum entries too — defeating
            // a colosseum boss is still a "win" for HP-recovery purposes.
            // embertide-4hr1.5: skip the KID_CARDS lookup for
            // colosseum entries — some colosseum boss source-card-ids
            // (`coilworm`, `bonereaver`, etc.) are not yet in KID_CARDS,
            // and the champion-bonus augmentation is a main-game-only
            // hook anyway. Colosseum reward routing lives in 4hr1.6.
            const bossCardForHearts =
              !isColosseumEntry && next.activeCombat !== null
                ? cardByIdOrThrow(next.activeCombat.boss.sourceCardId)
                : null;
            const heartsWithChampionBonus =
              bossCardForHearts !== null
                ? augmentHeartsWithChampionBonus(
                    next.players,
                    action.heartsToAttackers,
                    bossCardForHearts,
                  )
                : action.heartsToAttackers;
            next = applyHeartsHeal(next, heartsWithChampionBonus);

            // 1b. Heirloom drop (u-9c / REQ-32 slot engagement). Fires
            // ONLY when `entryContext.entrySource === 'wild-boss-slot'` —
            // the region-boss-slot path preserves u-8c's shard/zone
            // flow (no heirloom), and the legacy 'field' path never
            // had a heirloom drop. Routes the heirloom id from
            // HEIRLOOM_DROPS[bossBaseId] to the defeating hero's items
            // via `grantHeirloom` (3-cap: defeater → teammate →
            // warn+drop). Runs BEFORE the wisp drop so the defeating
            // hero's items zone is populated with the heirloom first
            // (cap-routing preference) and the wisp gets the
            // remaining cap slot / teammate seat as a secondary drop.
            // Track the heirloom id for the post-resolve tutorial bubble
            // (u-9e). Null means no heirloom dropped this combat.
            let grantedHeirloomId: string | null = null;
            if (
              next.activeCombat !== null &&
              next.activeCombat.entryContext.entrySource === 'wild-boss-slot'
            ) {
              const bossBaseId = baseIdOfString(next.activeCombat.boss.sourceCardId);
              const heirloomId = HEIRLOOM_DROPS[bossBaseId];
              if (heirloomId !== undefined) {
                const defeaterId = determineDefeatingHero(next.players, next.activeCombat);
                const defeaterIdx = next.players.findIndex((p) => p.id === defeaterId);
                if (defeaterIdx !== -1) {
                  next = grantHeirloom(next, defeaterIdx, heirloomId);
                  grantedHeirloomId = heirloomId;
                }
              }
            }

            // 2. Wisp drop (wild-boss only). Skipped for colosseum
            // entries — colosseum bosses share `sourceCardId` with
            // wild-bosses (e.g. 'craghorn') and `buildResolveWinAction`
            // populates `fairyDropTarget` based on the source card's
            // tier; the colosseum has its own reward routing in
            // 4hr1.6 (out of scope here).
            if (
              !isColosseumEntry &&
              action.fairyDropTarget !== null &&
              next.activeCombat !== null
            ) {
              const bossBaseId = baseIdOfString(next.activeCombat.boss.sourceCardId);
              next = applyFairyDrop(next, action.fairyDropTarget, bossBaseId);
            }

            // 3. Shard grants (region-boss only — empty array for
            // wild-boss). Skipped for colosseum entries: a colosseum
            // boss kill never grants a Embertide shard regardless of
            // the underlying card's main-game tier.
            if (!isColosseumEntry) {
              next = applyShardGrants(next, action.shardGrants);
            }

            // 4. Zone advance (region-boss whose id matches zone
            // gate). Skipped for colosseum entries: progressing
            // through colosseum tiers must NOT advance the
            // main-game map zone.
            if (!isColosseumEntry && action.zoneAdvance) {
              next = advanceZone(next);
            }

            // 5. Record the defeat so the wild/region slot selectors +
            // zone bookkeeping observe the kill. Mirrors the
            // instant-resolution applyBossDefeatHooks semantics —
            // idempotent on re-entry. Skipped for colosseum entries:
            // colosseum bosses share `sourceCardId` with main-zone
            // bosses, and recording a colosseum kill in
            // `defeatedBossIds` would advance the wild-boss FIFO queue
            // / spuriously satisfy the `isColosseumUnlocked` gate. The
            // void-pile mirror is also skipped — the colosseum boss
            // was never on the main board to be voided from.
            if (!isColosseumEntry && next.activeCombat !== null) {
              const slainBossSourceId = next.activeCombat.boss.sourceCardId;
              next = recordBossDefeat(next, slainBossSourceId);
              // embertide-g294: mirror the boss kill into the visible
              // Void pile. Boss cards never touch `state.defeated` (they
              // live in `activeCombat.boss` from COMBAT_ENTER until
              // resolution clears `activeCombat`), so the void mirror is
              // the only surface that holds the card object after the
              // win — feed it the resolved card so the kid sees the
              // boss they just killed face-up on the void pane.
              const slainBoss = cardByIdOrThrow(slainBossSourceId);
              next = { ...next, voided: [...next.voided, slainBoss] };
            }

            // 5x. embertide-044: wild-boss defeats feed the Golden
            // Rainbow Chimera spawn counter. Region-boss wins are
            // excluded (the formula is explicitly "regular enemies +
            // wild bosses defeated via center-row combat" per bead
            // direction). At Silver Chimera's defeat transaction, roll
            // the one-shot linear-ramp spawn chance — the slot
            // selector (`currentWildBossForZone`) will surface
            // Rainbow on the next tick if the flag flipped. Colosseum
            // entries are excluded — the formula's domain is
            // center-row + wild-boss-slot kills only.
            if (!isColosseumEntry && next.activeCombat !== null) {
              const defeatedSourceId = next.activeCombat.boss.sourceCardId;
              const defeatedBoss = cardByIdOrThrow(defeatedSourceId);
              if (defeatedBoss.bossTier === 'wild-boss') {
                next = { ...next, centerRowKillCount: next.centerRowKillCount + 1 };
                if (
                  baseIdOfString(defeatedSourceId) === 'silver-chimera' &&
                  !next.goldenRainbowLynelSpawned &&
                  !next.defeatedBossIds.includes(PRISM_CHIMERA_ID)
                ) {
                  const chance = computeGoldenRainbowLynelSpawnChance(next.centerRowKillCount);
                  if (next.rng() < chance) {
                    next = { ...next, goldenRainbowLynelSpawned: true };
                  }
                }
              }
            }

            // 5a. gm0.12: wild-boss defeat drops a boss-key into the
            // zone's key inventory. Fires AFTER recordBossDefeat so
            // downstream observers see both updates in the same
            // transaction. Heirloom drop above is unchanged — both
            // effects land additively on every wild-boss WIN. Skipped
            // for colosseum entries — the colosseum has no per-zone
            // key gate.
            if (!isColosseumEntry && action.bossKey !== null) {
              next = recordBossKey(next, action.bossKey.zoneId, action.bossKey.keyId);
            }

            // 5a-heart. v2.1 gm0.17 (embertide-0jf): slot-boss
            // defeat grants a full vital ember to the defeating
            // player (direct +1 hpMax + full heal via
            // `applyHeartReward`). Fires IN ADDITION to the existing
            // heirloom + key + wisp drops — the container is just
            // another reward on top. Only wild-boss and region-boss
            // tier defeats award the container; field/legacy 'field'
            // entries never reach this branch. Runs BEFORE the reroll
            // token grants so the vital ember lands in the same
            // "post-boss" transaction the UI animates as a single
            // beat. Skipped for colosseum entries — colosseum reward
            // routing lands in 4hr1.6 (out of scope here).
            if (!isColosseumEntry && next.activeCombat !== null) {
              const bossCardForContainer = cardByIdOrThrow(next.activeCombat.boss.sourceCardId);
              const tier = bossCardForContainer.bossTier;
              if (tier === 'wild-boss' || tier === 'region-boss') {
                const defeaterId = determineDefeatingHero(next.players, next.activeCombat);
                const defeaterIdx = next.players.findIndex((p) => p.id === defeaterId);
                if (defeaterIdx !== -1) {
                  const defeater = next.players[defeaterIdx];
                  const grown = applyHeartReward(defeater, 1);
                  if (grown !== defeater) {
                    next = replacePlayer(next, defeaterIdx, grown);
                  }
                }
              }
            }

            // 5c. v2.1 REQ-9d (embertide-4hz6): Dungeon Boss onDefeat
            // reward roll. Atmospheric / celebratory beat — fires AFTER
            // every other settlement step (heart heal, heirloom, wisp,
            // shards, zone advance, container) so the
            // player sees "boss falls → standard rewards land →
            // scroll moment". Only region-boss (Dungeon Boss) defeats
            // trigger it; wild-boss and field beasts are explicitly
            // excluded per the bead's locked design. Colosseum entries
            // also bypass the dungeon-boss roll — colosseum reward
            // routing is its own pipeline (4hr1.6).
            //
            // Captures the boss id + active player snapshot HERE,
            // before step 7's activeCombat clear, so the action
            // helper can stage the roll without re-reading
            // activeCombat.
            let dungeonBossPendingPayload: PendingDungeonBossRoll | null = null;
            if (!isColosseumEntry && next.activeCombat !== null) {
              const dungeonBossSourceId = next.activeCombat.boss.sourceCardId;
              const dungeonBossCard = cardByIdOrThrow(dungeonBossSourceId);
              if (dungeonBossCard.bossTier === 'region-boss') {
                // Active player at the moment the resolve lands —
                // matches every other "active player gets the reward"
                // hook (chest, gem grant). Falls back to p0 in the
                // theoretical edge case where currentPlayerIndex is
                // out of range.
                const activeForRoll =
                  next.players[next.currentPlayerIndex] ?? next.players[0] ?? null;
                if (activeForRoll !== null) {
                  const face = d20(next.rng);
                  dungeonBossPendingPayload = {
                    bossId: dungeonBossSourceId,
                    playerId: activeForRoll.id,
                    face,
                  };
                }
              }
            }

            // 6. Princess Crystal: every monster defeat decrements, floored
            // at 0 (REQ-8 + embertide-vj52). Tier-aware: wild-boss → 2,
            // region-boss → 3, regular → 1. `bossCardForHearts` is the
            // boss whose hearts were just awarded (computed at line ~1510);
            // it carries the bossTier the decrement reads via
            // `crystalDamageFor`. Guarded null-fallback because the type
            // is `Card | null` even though COMBAT_RESOLVE_WIN always has a
            // boss in scope; on the unreachable null branch we skip the
            // decrement rather than silently passing a wrong-tier card.
            // Skipped for colosseum entries — the princess crystal is a
            // main-game progression mechanic, orthogonal to colosseum.
            if (!isColosseumEntry && bossCardForHearts !== null) {
              next = decrementCrystalCharges(next, bossCardForHearts);
            }

            // 6b. embertide-4hr1.5: colosseum tier-progression
            // advance. On a colosseum-slot WIN, look up the defeated
            // boss's tier from the engine's roster mapping and unlock
            // the next tier (T1 → T2 → T3 → T4 → T5 — the full ladder
            // since wacl widened TierId). `nextTierAfter` returns null
            // at the highest tier and `unlockTier` is idempotent, so
            // re-clearing the highest tier is safely a no-op.
            //
            // 6c. embertide-4hr1.6: per-tier reward emission. On the
            // SAME branch, after the per-run tier unlock, route every
            // reward returned by `rewardsForTier(clearedTier)` into the
            // per-run reward ledger (`useColosseumMetaStore`). The ledger
            // is in-memory and reset by `initGame` each run (4hr1.19 —
            // FULL per-run reset, designer ruling 2026-06-04). Lower tiers
            // cannot drop top-tier loot (A3) because `rewardsForTier` is the single
            // source of truth and the `golden-rainbow-heirloom` /
            // `unique-cosmetic` kinds appear only in the tier-5 row.
            if (isColosseumEntry && next.activeCombat !== null) {
              const defeatedSourceId = next.activeCombat.boss.sourceCardId;
              const clearedTier = tierForColosseumBoss(defeatedSourceId);
              if (clearedTier !== null) {
                const successor = nextTierAfter(clearedTier);
                if (successor !== null) {
                  next = {
                    ...next,
                    colosseumProgression: unlockTier(next.colosseumProgression, successor),
                  };
                }
                const earned = rewardsForTier(clearedTier);
                const meta = useColosseumMetaStore.getState();
                for (const reward of earned) {
                  meta.recordReward(clearedTier, reward);
                }
              }
            }

            // 7. Clear activeCombat and refill field — the boss card was
            // removed at entry, so the market needs a refill event.
            next = { ...next, activeCombat: null };
            next = refillField(next);

            // 8. Run co-op victory + loss checks. Victory check lands
            // first because shard grants can trigger the win; loss fires
            // if a close-call hp-0 AoE left both players downed without
            // a wisp available.
            next = checkCoopVictory(next);
            next = checkCoopLoss(next);
            // 9. Fire the combat-win tutorial bubble (u-8g, §B8). The
            // bubble replaces any in-flight combat bubble (entry / card
            // played) at resolution time.
            //
            // embertide-07h: combat-win body embeds {bossName} +
            // {hearts}. `dropHearts` is the base monster-drop heal
            // (same per attacker by construction in buildResolveWinAction
            // — use any entry), pre Champion bonus; the bonus is the
            // player's ability, not the boss's gift, so the "You earned
            // X hearts" readout stays boss-facing.
            const winBossName = bossCardForHearts
              ? bossDisplayName(bossCardForHearts.id)
              : 'the boss';
            const dropHearts = Object.values(action.heartsToAttackers)[0] ?? 0;
            const winBody = renderCombatBubbleBody('combat-win', {
              bossName: winBossName,
              hearts: dropHearts,
            });
            next = {
              ...next,
              combatTutorialBubble: 'combat-win',
              tutorialBubbleBodyOverride: winBody,
            };

            // 9b. REQ-32 (u-9e) — Heirloom-drop bubble. Fires AT MOST
            // ONCE per run, only when a heirloom actually landed this
            // combat, and only when outcome is still interactive (the
            // main-board overlay preempts everything on win/loss).
            // Supersedes the combat-win bubble so the player sees the
            // heirloom-specific copy. Idempotency is tracked in
            // `tutorialBubblesFired`.
            if (
              grantedHeirloomId !== null &&
              next.outcome === null &&
              !next.tutorialBubblesFired.includes('heirloom-drop')
            ) {
              const heirloomName = GENERIC_BASE_ID_THEME[grantedHeirloomId] ?? grantedHeirloomId;
              const body = `You got the ${heirloomName}! It's now in your hero's deck — it'll show up in future combats.`;
              next = {
                ...next,
                combatTutorialBubble: 'heirloom-drop',
                tutorialBubbleBodyOverride: body,
                tutorialBubblesFired: [...next.tutorialBubblesFired, 'heirloom-drop'],
              };
            }

            // 9c. v2.1 REQ-9d (embertide-4hz6): hydrate the
            // Dungeon-Boss reward roll surface ONLY when the team is
            // still mid-game. If the region-boss kill triggered the
            // shared win (third shard), suppress the scroll moment —
            // the victory overlay preempts every UI surface and a
            // never-tapped roll modal would strand state. Per-encounter
            // cap is enforced by `pendingDungeonBossRoll === null` here:
            // re-entry of COMBAT_RESOLVE_WIN on the same kill (which
            // shouldn't happen, but is defensible) would be a no-op
            // rather than a duplicate roll. The actual modal mount
            // lives in GameBoard, gated behind `lastChestReward ===
            // null` so the chest reveal renders FIRST when both fire.
            if (
              dungeonBossPendingPayload !== null &&
              next.outcome === null &&
              next.pendingDungeonBossRoll === null
            ) {
              next = { ...next, pendingDungeonBossRoll: dungeonBossPendingPayload };
            }
            set(next);
            return;
          }

          case 'COMBAT_RESOLVE_LOSS': {
            // Damage was already applied during combat (engine's
            // routePlayerHpDamage routes through applyDamage). The
            // reducer's job is to (a) close the combat sub-state and
            // (b) re-run checkCoopLoss so outcome='loss' lands on the
            // main-board state. Idempotent: checkCoopLoss is a pure
            // guard that bails when outcome is already set.
            let next: KidGameState = { ...state, activeCombat: null };
            next = checkCoopLoss(next);
            // Fire the combat-loss tutorial bubble (u-8g AC #5, §B8)
            // ONLY when the team outcome is not already 'loss'. When
            // the LOSS action also triggered a team loss, the main-
            // board Defeat overlay takes over and the combat bubble
            // would be noise; suppress it.
            if (next.outcome !== 'loss') {
              next = { ...next, combatTutorialBubble: 'combat-loss' };
            }
            // Field refill is intentionally skipped on LOSS — the game
            // is over (or about to be), and a refill would leak a fresh
            // card into a state that is no longer interactive.
            set(next);
            return;
          }

          default: {
            const _exhaustive: never = action;
            throw new Error(
              `dispatchCombat: unhandled action type ${String((_exhaustive as { type?: string }).type)}`,
            );
          }
        }
      },

      dispatchCombatAction(action: CombatTurnAction): void {
        const state = get();
        if (state.outcome !== null) return;
        if (state.activeCombat === null) return;

        const envelope: CombatTurnState = {
          combat: state.activeCombat,
          players: state.players,
          terminal: null,
          // Persist playsThisTurn across dispatches so the engine's
          // per-turn play cap (COMBAT_PLAYS_PER_TURN) is actually
          // enforced. Default to 0 when CombatState doesn't carry one
          // (fresh combat / pre-wiring test mocks).
          playsThisTurn: state.activeCombat.playsThisTurn ?? 0,
        };

        // Run the requested action. Then if it was PLAYER_PASS and no
        // terminal fired, chain BOSS_RESOLVE so the boss acts in the
        // same click — a single Pass Turn is "end your turn AND take
        // the hit", not a two-step ceremony.
        let next = combatTurnReducer(envelope, action);
        const logLines: string[] = [];
        logLines.push(describeAction(action, envelope, next));

        if (action.type === 'PLAYER_PASS' && next.terminal === null) {
          const afterBoss = combatTurnReducer(next, { type: 'BOSS_RESOLVE' });
          logLines.push(describeAction({ type: 'BOSS_RESOLVE' }, next, afterBoss));
          next = afterBoss;
        }

        // Draw back up to the hand cap at the start of the players-turn
        // (i.e. after a successful BOSS_RESOLVE transition returned
        // activeActor to 'players'). Excess cards overflow to discard.
        if (next.terminal === null && next.combat.activeActor === 'players') {
          const drawn = drawToCombatHandCap(next.combat);
          next = { ...next, combat: drawn };
        }

        // Append log lines to the CombatState's log (cap at 10 entries
        // so the array never grows unbounded across long combats).
        const prevLog = next.combat.combatLog ?? [];
        const nextLog = [...prevLog, ...logLines].slice(-10);
        next = {
          ...next,
          combat: {
            ...next.combat,
            combatLog: nextLog,
            // Persist playsThisTurn back onto CombatState so the next
            // dispatch sees the accumulated count. Reduces to 0
            // naturally via reducePlayerPass / reduceBossResolve.
            playsThisTurn: next.playsThisTurn,
          },
        };

        // Unwrap the envelope back onto the store.
        set({
          ...state,
          players: next.players,
          activeCombat: next.terminal === null ? next.combat : state.activeCombat,
        });

        // Terminal chain: if the engine fired terminal='win' or 'loss',
        // dispatch the matching COMBAT_RESOLVE_* so main-board drop
        // rules + activeCombat cleanup fire in the same tick.
        if (next.terminal === 'win') {
          const resolveAction = buildResolveWinForCombat(next.combat, get().currentZone);
          this.dispatchCombat(resolveAction);
        } else if (next.terminal === 'loss') {
          this.dispatchCombat({ type: 'COMBAT_RESOLVE_LOSS' });
        }
      },

      fireCombatTutorialBubble(trigger: TutorialTrigger | null): void {
        const state = get();
        const next = fireCombatTutorialBubbleSlice(state, trigger);
        if (next === state) return;
        set(next);
      },

      clearCombatTutorialBubble(): void {
        const state = get();
        const next = clearCombatTutorialBubbleSlice(state);
        if (next === state) return;
        set(next);
      },

      fireTutorialBubbleOnce(id: TutorialBubbleId, bodyOverride?: string): void {
        const state = get();
        const next = fireTutorialBubbleOnceSlice(state, id, bodyOverride);
        if (next === state) return;
        set(next);
      },

      rollDungeonBossReward(bossId: string): void {
        const state = get();
        const next = rollDungeonBossRewardSlice(state, bossId, state.rng);
        if (next === state) return;
        set(next);
      },

      commitDungeonBossReward(): void {
        set(commitDungeonBossRewardSlice(get()));
      },

      rollForestSageOmen(playerId: string): void {
        const state = get();
        const next = rollForestSageOmenSlice(state, playerId, state.rng);
        if (next === state) return;
        set(next);
      },

      commitForestSageOmen(): void {
        set(commitForestSageOmenSlice(get()));
      },
    };
  });
}

/**
 * Default singleton store bound for hook-style consumption. Seeded with 0;
 * call `.getState().initGame(...)` to set up a game.
 */
export const useGameStore = createGameStore(INITIAL_SEED);
