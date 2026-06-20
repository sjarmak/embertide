import type { Card } from '../types/card';
import type { ChestReward } from '../rules/chestPool';
import type { CombatState } from '../types/combat';
import type { ColosseumProgression } from '../core/colosseum';
import type { TutorialBubbleId } from '../tutorial/v20';

/**
 * Store-internal Kid Mode player shape. Intentionally richer than the
 * shared `Player` interface in `src/types/game.ts`, which does not yet
 * model shards, keys, slotted inventory, HP, or chest counts. This
 * type stays in the store layer so the shared type surface is untouched.
 */
/**
 * Typed champion identity (u-2c, REQ-3). Narrows the loose `championId: string`
 * contract to the four Kid Mode Champions. `championId` retains a loose
 * string type for backward compatibility with existing tests and the game-
 * config setup payload; the new `championSlot` tray field uses this tighter
 * type so UI code can switch exhaustively on it.
 */
export type ChampionId =
  | 'champion-courage'
  | 'champion-wisdom'
  | 'champion-power'
  | 'champion-sword';

export interface KidPlayer {
  readonly id: string;
  readonly name: string;
  readonly championId: string;
  /**
   * Dedicated passive-slot identity (u-2c / REQ-3). Populated at initGame
   * from `championId` via `resolveChampionSlot` in `slices/setup.ts`; null
   * only if the seat has not yet selected a valid champion (future-proofing
   * for v2.1 mid-game champion swap). Read by `src/ui/ChampionSlot.tsx` to
   * render the always-visible tray tile and gate the pulse-on-passive-fire
   * animation.
   */
  readonly championSlot: ChampionId | null;
  /**
   * Monotonic pulse counter for the ChampionSlot tray tile (u-2c). Bumps
   * every time THIS player's champion passive fires (power/sword SOT
   * resource grants, wisdom extra-draw, courage mini/final-boss HP heal).
   * Drives `key={player.championPassivePulse}` in ChampionSlot.tsx so the
   * glow + particle replays on every fire; value itself is opaque.
   */
  readonly championPassivePulse: number;
  /**
   * Current HP. v2 co-op pivot (amendment A2/A3): hearts became HP. 0 HP
   * enters DOWNED state (see `downed`) rather than immediately ending the
   * game. HP is clamped to `[0, hpMax]`; heals above `hpMax` are wasted.
   */
  readonly hp: number;
  /** Maximum HP for this player (default 5 at initGame). */
  readonly hpMax: number;
  /**
   * True when this player's HP reached 0 and they have not been revived
   * yet. Downed players cannot take main-phase actions (see §A3). Reset
   * to false when HP rises back above 0 (via teammate revive or wisp).
   */
  readonly downed: boolean;
  /**
   * Has this player already been teammate-revived during the CURRENT
   * downed incident? One teammate-revive per incident (amendment A3);
   * resets to false when the player becomes downed again (new incident)
   * and is set true by the teammate-revive action (u-1d).
   */
  readonly revivedThisIncident: boolean;
  readonly green: number;
  readonly red: number;
  readonly keys: number;
  readonly deck: readonly Card[];
  readonly hand: readonly Card[];
  readonly discard: readonly Card[];
  /**
   * Cards played this turn sitting face-up in front of the player
   * (Ascension-style "in play" zone, embertide-7c1). Flushed to
   * `discard` by `endTurn`. Items that successfully slot do NOT pass
   * through `inPlay` — they move straight to `slots`.
   */
  readonly inPlay: readonly Card[];
  /**
   * @deprecated (embertide-9yu) Legacy 2-slot inventory. Items are now
   * stored in `items` with no slot cost. The array is retained solely so
   * existing tests keep working while the migration settles; new code
   * MUST NOT write new items here.
   */
  readonly slots: readonly (Card | null)[];
  /**
   * Persistent Items zone (REQ-4 / amendment A6, u-2d — renamed from
   * `constructs` in §4.2 / embertide-9yu). Items and legendary-items
   * acquired by the player live here across turns and fire their
   * start-of-turn trigger every time the player's turn begins. Items are
   * unbounded per embertide-nmmc (2026-04-26) — every drop / buy
   * lands in the items zone with no upper cap.
   *
   * v2.0 populates this zone with item-active cards only; item-passive
   * is schema-allowed but no v2.0 card declares it (REQ-4 premortem L5).
   */
  readonly items: readonly Card[];
  readonly chestsOpened: number;
  /**
   * Wild-wolf kills already resolved this turn (embertide-1uh). Wild
   * Wolf grants its +1 HP-heal drop only on the FIRST kill of the turn;
   * subsequent kills still consume red and count as combat, but award no
   * heal. Reset to 0 for the outgoing player at end of turn.
   */
  readonly wildWolfKillsThisTurn: number;
  /**
   * Whether this player has already traded with Pell (key-vendor) this
   * seat-turn (embertide-5y13). Capped at 1 trade per active player
   * per turn so the green→key→chest treadmill no longer dominates the
   * field-buy economy. Reset to `false` for the outgoing player at end
   * of turn, mirroring the `wildWolfKillsThisTurn` reset.
   */
  readonly usedKeyVendorThisTurn: boolean;
  /**
   * True after the Princess is freed (REQ-8). Shared buff — both players
   * receive it in the same event, even though each player's flag is
   * per-player for implementation convenience. Read-only effect for v2.0;
   * v2.1 may hang derived mechanics off it.
   */
  readonly wisdomsLight: boolean;
  /**
   * Ember-shard accumulator (v2.1 gm0.16). Chest `ember-shard` rewards
   * increment this 0..3 counter; the 4th piece auto-promotes to a heart
   * container and resets to 0 while growing `hp` + `hpMax` via
   * `applyHeartReward`. Heart pieces are NOT cards and never enter the
   * items / discard / deck zones — this counter IS the authoritative
   * store of "pieces held".
   */
  readonly heartPieces: number;
  /**
   * Ember-shard meter accumulator (v2.1 gm0.17). 0..2 invariant — counts
   * grunt-tier monster defeats toward the next ember shard. Every 3rd
   * grunt kill (meter transitions 2 → 0 AND bumps `heartPieces` by 1 via
   * `addHeartPiece`) promotes a piece. Resets to 0 on promotion. Not
   * consumed by tough-tier kills (those grant a piece directly) or
   * slot-boss defeats (those grant a full vital ember via
   * `applyHeartReward`). See `GRUNT_HEART_METER_IDS` in
   * `src/data/cards.ts` for the grunt-tier allowlist.
   */
  readonly heartPieceMeter: number;
  /**
   * Ids of wisp-in-bottle copies that have ALREADY been consumed this
   * combat (v2.1 gm0.16). `playFairyOn` re-equips a wisp-in-bottle on
   * first revive, then records its id here so a second revive in the
   * same combat does NOT re-equip (one bottle, one refill per combat).
   * Reset to `[]` at every `COMBAT_ENTER` dispatch.
   */
  readonly usedFairyInBottleIds: readonly string[];
  /**
   * Permanent banish pile for deck-thinning (embertide-91p framework).
   * Cards moved here via `banishFromHand` / `banishFromDiscard` leave the
   * player's active rotation for the rest of the game. Retained as a
   * pile (not dropped to /dev/null) so future mechanics — "return N
   * banished cards", banished-card viewers, debug surfaces — can read
   * it without a schema migration.
   *
   * Initialized to `[]` at `initGame`. Not reset on zone advance or
   * combat boundaries — banish is permanent by design.
   */
  readonly banished: readonly Card[];
  /**
   * "Next chest item revealed" foresight flag (v2.1 REQ-9d, embertide-4hz6).
   * Set to `true` when this player commits a Dungeon-Boss reward roll on
   * face 2 or 3 — a peek-at-next-chest atmospheric reward. Consumed
   * (flipped back to false) the next time this player opens a chest, so
   * the foresight is a one-shot. UI surfaces the flag as a "next chest
   * item is revealed early" hint in the chest row; the underlying
   * mechanical effect on chest opening is intentionally minimal in this
   * landing (the bead's scope is the roll site, not the chest UI
   * rework). Initialized to `false` at `initGame`.
   */
  readonly nextChestItemRevealed: boolean;
}

/**
 * v2 co-op Embertide shard pool (amendment A2). Shared across both
 * players; each shard is granted from exactly one path:
 *  - wisdom:  free Princess Aurelia from crystal (u-2e)
 *  - courage: complete map exploration (u-5b)
 *  - power:   defeat Cagewright Vurmox (u-6c)
 * Never granted by beasts, chests, market, or Wild Bosses.
 */
export interface SharedTriforce {
  readonly wisdom: boolean;
  readonly courage: boolean;
  readonly power: boolean;
}

/**
 * Princess-in-Crystal kill-counter zone (REQ-8, amendment A2).
 *
 *  - `charges`: remaining hits needed before a Strike can free the
 *    Princess. Starts at PRINCESS_CRYSTAL_INITIAL_CHARGES = 8 (vj52).
 *    Any player's monster kill (from any slot) decrements `charges`
 *    by `crystalDamageFor(monster)` (regular → 1, wild-boss → 2,
 *    region-boss → 3), floored at 0.
 *  - `freed`: true once the Princess has been freed by a Strike at
 *    charges === 0. Freed is a terminal state — further Strikes are
 *    no-ops. When freed flips from false → true:
 *      (a) `sharedTriforce.wisdom` is set to true (shared pool, NOT
 *          granted to the striker specifically)
 *      (b) both players gain `wisdomsLight: true` (shared buff)
 */
export interface PrincessCrystalState {
  readonly charges: number;
  readonly freed: boolean;
}

/**
 * Terminal game outcome. `null` during ongoing play; `'win'` when all
 * three shared shards are granted; `'loss'` when both players are downed
 * with no revive available (amendment A3).
 */
export type GameOutcome = 'win' | 'loss' | null;

/**
 * v2 map-zone sequence (amendment A5, u-5a). Three zones ship in v2.0:
 *  - sylvani:         starting zone (Sylvanwood)
 *  - emberpeak: second zone (Emberpeak)
 *  - gilded-cage: final zone (Gilded Cage — Vurmox fight)
 *
 * v2.1 inserts maren / hollow-shrine / dune-sanctum between emberpeak
 * and gilded-cage without changing this module's shape. Callers that
 * care about ordering MUST use `ZONE_ORDER` from `src/rules/zones.ts`
 * instead of re-encoding the sequence.
 */
export type ZoneId =
  | 'sylvani'
  | 'emberpeak'
  | 'maren'
  | 'hollow-shrine'
  | 'dune-sanctum'
  | 'gilded-cage';

/**
 * Boss tier taxonomy has moved to src/types/card.ts (dissolves the
 * circular import that was previously flagged in review — `BossTier` is
 * consumed at the card-type declaration site, not by store state).
 * Re-export from here for backward compatibility.
 */
export type { BossTier } from '../types/card';

/**
 * Explicit 5-phase turn structure (REQ-18, u-1c).
 *
 *  - Upkeep:      SOT construct triggers + champion passive fire.
 *  - Draw:        active player draws 5 (6 for champion-wisdom).
 *  - Main:        active player's action window — playCard / buyFromField /
 *                 buyAlwaysAvailable / fightMonster / defeatAlwaysAvailable
 *                 / openChest all require phase === 'Main'. Downed players
 *                 auto-pass Main (advancePhase immediately moves to
 *                 BossResolve without granting an action window).
 *  - BossResolve: reserved for u-7 (softclock + Boss/Climax phase rules).
 *                 Empty in v2.0 — advancePhase passes straight through.
 *  - End:         flush hand/inPlay → discard, zero green/red, reset
 *                 wildWolfKills; run co-op victory + loss checks. On
 *                 End→(next Upkeep), advanceTurn bumps currentPlayerIndex
 *                 (and the turn counter when it wraps).
 */
export type Phase = 'Upkeep' | 'Draw' | 'Main' | 'BossResolve' | 'End';

/**
 * Store-internal Kid Mode game state. Shared `GameState` in `src/types/game.ts`
 * lacks the fields Kid Mode requires (per-player resources, field cards,
 * seed, RNG reference, shared-pool co-op state). This extended shape lives
 * only in the store layer.
 */
export interface KidGameState {
  readonly mode: 'kid';
  readonly players: readonly KidPlayer[];
  readonly currentPlayerIndex: number;
  readonly turn: number;
  /**
   * Current phase within the active player's turn (REQ-18). See {@link Phase}.
   */
  readonly phase: Phase;
  readonly seed: number;
  readonly rng: () => number;
  readonly field: readonly Card[];
  readonly supply: readonly Card[];
  /**
   * Dedicated 3-slot chest display (embertide-7c1). Refilled from
   * `chestSupply` when a slot empties via `openChest`. Separate from the
   * main `field` so chests are always visible and never mix with heroes/
   * items/monsters.
   */
  readonly chestRow: readonly Card[];
  /** Top-of-deck chest draw pile that refills `chestRow`. */
  readonly chestSupply: readonly Card[];
  readonly defeated: readonly Card[];
  /**
   * Visible "Void" sink (embertide-g294). UI mirror that captures
   * EVERY card the player just lost permanent access to — defeated
   * monsters from the field AND banished cards from a player's hand
   * or discard — in append order. The VoidPane component reads the
   * tail (`voided[voided.length - 1]`) as the face-up top card so the
   * kid sees the most-recent void, plus a count badge for the rest.
   *
   * Why a separate array (not a derived selector across `defeated` +
   * each player's `banished`)? Two reasons:
   *  - Ordering. `defeated` and `banished` are written from different
   *    code paths with no shared timestamp; a derived "most recent"
   *    can't be reconstructed reliably.
   *  - Stability. Existing `defeated` and `banished` semantics are
   *    load-bearing for game logic (boss-defeat hooks, "return banished
   *    cards" future mechanics, victory checks). The Void pane is a
   *    pure visual surface; mirroring keeps the data shape one append
   *    away from each existing push site without touching downstream
   *    consumers.
   *
   * Shared, not per-player — the Void is a single board surface and the
   * 2-player co-op view shows both players' losses on the same pane.
   * Reset to `[]` only at `initGame`. Never trimmed.
   */
  readonly voided: readonly Card[];
  /**
   * Shared co-op shard pool (amendment A2). Both players win together
   * when all three flags are true.
   */
  readonly sharedTriforce: SharedTriforce;
  /**
   * Terminal outcome (amendment A1/A3). `null` during play.
   */
  readonly outcome: GameOutcome;
  /**
   * Most recent chest reward awaiting UI acknowledgement (embertide-z3z).
   * Set by `openChest`, cleared by `clearLastChestReward` once ChestReveal
   * finishes its animation. Null whenever no reveal is pending.
   */
  readonly lastChestReward: ChestReward | null;
  /**
   * Resolved Card minted alongside `lastChestReward` for card-grant
   * rewards (embertide-ymgc). Populated for `'hero'`, `'item'`,
   * `'premium-item'`, and `'wisp'` rolls — these surface the rolled
   * card's actual illustration in the ChestReveal popup so a kid sees
   * the card they just earned, not a generic placeholder icon.
   *
   * `null` for non-card rewards (`'heart'`, `'double-heart'`,
   * `'ember-shard'`, `'vital-ember'`) which retain the bespoke
   * raster / icon path in the reveal. Cleared by `clearLastChestReward`
   * in lockstep with `lastChestReward`.
   */
  readonly lastChestRewardCard: Card | null;
  /**
   * Princess-in-Crystal kill-counter zone (REQ-8, amendment A2). See
   * {@link PrincessCrystalState}. Orthogonal to the map-zone pipeline —
   * the Crystal is a permanent zone that co-exists with whichever map
   * zone is currently active. The shared wisdom shard lands only when a
   * Strike fires at charges === 0.
   */
  readonly princessCrystal: PrincessCrystalState;
  /**
   * Current zone in the map-exploration spine (amendment A5, u-5a).
   * Starts at 'sylvani'; advances via `advanceZone` on region-boss defeat.
   */
  readonly currentZone: ZoneId;
  /**
   * Zones already cleared (in clearance order). Appended to by
   * `advanceZone` when a zone's region boss is defeated. Read by u-5b's
   * Courage-unlock gate to detect full-map completion.
   */
  readonly zoneHistory: readonly ZoneId[];
  /**
   * Ids of every boss card defeated in this game. Read by the slot
   * selectors `currentWildBossForZone` / `currentRegionBossForZone` in
   * src/rules/zones.ts: the wild slot advances FIFO through
   * `wildBossIds` as entries land here, and the region slot clears to
   * `null` once its `regionBossId` is in the list. REQ-32 (u-9a)
   * retired the prior "region-boss gated on all wilds cleared" rule.
   */
  readonly defeatedBossIds: readonly string[];
  /**
   * Per-zone boss-key inventory (v2.1 REVERSE-Q8, gm0.12). Wild-boss
   * defeats drop BOTH the existing heirloom AND a zone-scoped boss key
   * keyed by the wild's `baseId`. The region slot is LOCKED until every
   * required wild boss for the zone has its key present here —
   * `canSpawnRegionBoss(state, zoneId)` is the authoritative predicate.
   *
   * Sylvani + Emberpeak each require one key (craghorn / boulderkin).
   * Gilded Cage requires BOTH Sentinel + Silver Chimera keys before
   * Vurmox unlocks; the rare post-completion `prism-chimera`
   * is a dynamic-spawn wild boss (not part of the zone's FIFO queue)
   * and is excluded from the gate.
   *
   * Initialized to `{ sylvani: [], 'emberpeak': [], 'gilded-cage': [] }`
   * at `initGame`. Appended to by `recordBossKey` from the
   * `COMBAT_RESOLVE_WIN` reducer when the defeated boss's `bossTier`
   * is `wild-boss`.
   */
  readonly bossKeys: Readonly<Record<ZoneId, readonly string[]>>;
  /**
   * Active wild-boss / region-boss combat sub-state (v2.1 combat layer,
   * u-8a, PRD §B1). `null` whenever the main board is in control;
   * non-null while a boss combat is resolving. Populated by the
   * `COMBAT_ENTER` action path (u-8b) and cleared on
   * `COMBAT_RESOLVE_WIN` / `COMBAT_RESOLVE_LOSS`. Ordinary monsters
   * keep their existing instant-resolution path and never touch this
   * field.
   */
  readonly activeCombat: CombatState | null;
  /**
   * Monotonically-incrementing counter of combat engagements this game
   * (v2.1 combat tutorial, u-8g). Bumped by 1 at every `COMBAT_ENTER`
   * dispatch before `activeCombat` is hydrated. Reset only at
   * `initGame` — NOT at `COMBAT_RESOLVE_WIN` / `COMBAT_RESOLVE_LOSS`,
   * since the tutorial's progressive-disclosure gate needs to observe
   * "second+ combat" across the whole session.
   */
  readonly combatsEntered: number;
  /**
   * Last-fired combat-tutorial bubble id, if any (v2.1 combat tutorial,
   * u-8g). Set by the combat-entry / card-play / boss-turn triggers
   * inside `CombatScreen` and by the `COMBAT_RESOLVE_WIN` /
   * `COMBAT_RESOLVE_LOSS` reducer cases. Cleared when the player
   * dismisses the overlay (`clearCombatTutorialBubble`). Null whenever
   * no combat bubble is active. Persists across `activeCombat → null`
   * transitions so win/loss bubbles can survive the combat teardown.
   */
  readonly combatTutorialBubble: TutorialBubbleId | null;
  /**
   * Ids of every tutorial bubble that has already fired via
   * `fireTutorialBubbleOnce` this run (REQ-32 u-9e). Used to enforce
   * at-most-once semantics for the wild / region slot + heirloom +
   * destiny bubbles. Reset only at `initGame`. Combat bubbles fire
   * every combat (u-8g) and do NOT append here.
   */
  readonly tutorialBubblesFired: readonly TutorialBubbleId[];
  /**
   * Optional body override for the currently-displayed combat tutorial
   * bubble. Populated when a bubble's copy is templated at fire time —
   * e.g. the u-9e `heirloom-drop` bubble embeds the heirloom's display
   * name. Null when the raw body from `V20_TUTORIAL_BUBBLES` should
   * render as-is. Cleared alongside the bubble on dismiss.
   */
  readonly tutorialBubbleBodyOverride: string | null;
  /**
   * Tide-gauge zone-mechanic counter for Tidehold (embertide-gdd.1).
   *
   * Increments by +1 at every End-phase pass-through while
   * `state.currentZone === 'maren'` (capped at TIDE_GAUGE_MAX = 4). Reset
   * to 0 on `advanceZone` whenever `currentZone` changes — including
   * tidewraith's defeat-driven advance from 'maren' to 'gilded-cage'.
   * Value is 0 in any non-Maren zone.
   *
   * gdd.1 ships this field substrate-only. The downstream consumers
   * called out in the roster memo (tidewraith tentacle-grab strength;
   * fangfish fragility window) wire in z5e (the dynamic-pattern
   * resolver tuning bead) — until then the gauge is a HUD-visible but
   * non-mechanically-consumed accumulator.
   */
  readonly tideGauge: number;
  /**
   * Shadow-creep zone-mechanic counter for the Hollow Shrine
   * (embertide-gdd.2 / gdd.2.3 designer ruling 2026-04-25).
   *
   * Increments by +1 at every End-phase pass-through while
   * `state.currentZone === 'hollow-shrine'` (capped at SHADOW_CREEP_MAX
   * = 3). Reset to 0 on `advanceZone` whenever `currentZone` changes —
   * including knell's defeat-driven advance from 'hollow-shrine'
   * to 'gilded-cage'. Value is 0 in any non-hollow-shrine zone.
   *
   * Consumer: at `enterCombatAction`, when entering a wild- or
   * region-boss combat in the hollow-shrine zone, the boss's
   * `attackPattern.damagePerTurn` is bumped by `state.shadowCreep`
   * (snapshot at combat-entry time). Mirrors Maren's tide-gauge slice
   * shape one-for-one; differs in that the consumer is a flat damage
   * adder rather than a deferred dynamic-pattern resolver.
   */
  readonly shadowCreep: number;
  /**
   * Sandstorm-discard zone-mechanic counter for the Dune Sanctum
   * (embertide-gdd.3 / designer ruling 2026-04-25).
   *
   * Increments by +1 at every End-phase pass-through while
   * `state.currentZone === 'dune-sanctum'` (capped at
   * SANDSTORM_COUNTER_MAX = 3). Reset to 0 on `advanceZone` whenever
   * `currentZone` changes — including hextwins's defeat-driven advance
   * from 'dune-sanctum' to 'gilded-cage'. Value is 0 in any
   * non-dune-sanctum zone.
   *
   * Consumer: at `enterCombatAction`, when entering a wild- or
   * region-boss combat in the dune-sanctum zone, the boss's
   * `attackPattern.damagePerTurn` is bumped by
   * `state.sandstormCounter` (snapshot at combat-entry time). Mirrors
   * Hollow Shrine's shadow-creep slice shape one-for-one. Substrate
   * ships flat-adder semantics only; full discard-from-hand semantics
   * (memo: "every 3 turns the wind blows, discard one hand-card")
   * defer to a follow-up bead alongside playtest data.
   */
  readonly sandstormCounter: number;
  /**
   * Watchlist of fangfish card-ids currently sitting in `state.field`,
   * used by the fangfish fragility window (embertide-gdd.1.2).
   *
   * Lifecycle (mirrors a "this is your second turn-end here" tracker):
   *  1. End-phase: scan `state.field` for fangfish cards.
   *  2. For every id ALREADY in the watchlist → discard it from the
   *     field into `state.defeated` (auto-banished — fits the
   *     "school of fish darts away" thematic from the roster memo).
   *  3. Replace the watchlist with the ids of the fangfish that are
   *     still in the field (i.e. those that just appeared this turn).
   *
   * Net effect: a fangfish that enters the field is discarded on the
   * NEXT End-phase if it hasn't been bought / fought between the two
   * end-phases. If it gets re-engaged via `fightMonster`, it leaves
   * the field naturally and never re-appears in the watchlist on the
   * next scan.
   *
   * Empty array on any state where no fangfish has been seen yet
   * (the common case in non-Maren zones). Reset to `[]` only at
   * `initGame`. Watchlist can carry stale ids briefly between Buy and
   * End-phase — that's fine because the End-phase scan re-derives the
   * set from `state.field` every tick.
   */
  readonly skullfishFieldWatchlist: readonly string[];
  /**
   * Cumulative run-total of center-row monster kills (embertide-044).
   * Increments on every regular-monster kill resolved through
   * `fightMonster` (slices/combat.ts) and every wild-boss kill resolved
   * through `COMBAT_RESOLVE_WIN`. Region-boss wins and always-available
   * (Wild Wolf) kills do NOT increment.
   *
   * Feeds `computeGoldenRainbowLynelSpawnChance` in src/rules/zones.ts,
   * which drives the one-shot Rainbow spawn roll fired at Silver Chimera's
   * defeat transaction. Never decremented; reset only at `initGame`.
   */
  readonly centerRowKillCount: number;
  /**
   * Has the Prism Chimera successfully spawned this run
   * (embertide-044)? Flipped from false → true when the one-shot
   * spawn roll succeeds in `COMBAT_RESOLVE_WIN` at the moment Silver
   * Chimera is defeated. Read by `currentWildBossForZone` to decide
   * whether the Temple's post-completion wild slot should surface
   * `'prism-chimera'` or remain empty.
   *
   * One-shot semantics: the roll fires exactly once per run at Silver
   * Chimera's defeat; a failed roll means Rainbow never spawns this run
   * (matches the 85% cap's intent — ~15% of runs see no Rainbow).
   */
  readonly goldenRainbowLynelSpawned: boolean;
  /**
   * Per-card banish choice surface (embertide-91p, commit b). When a
   * card whose `effects.kind === 'banish-from-hand'` resolves on play and
   * the active player has at least one banishable card in hand, the
   * `playCard` reducer pauses by writing this field; the UI mounts
   * `CardSelectionModal` and routes the player's tap to
   * `banishFromHand(cardId)` (which clears this field). Cancelling the
   * modal (ESC / backdrop) clears the field with no banish — the effect
   * fizzles, matching the framework's "soft" choice contract (the player
   * is never forced to banish a card they don't want to part with).
   *
   * Shape:
   *  - `playerId`: the player whose hand surfaced for choice. Used by the
   *    UI to render the correct hand and by the cancel path to verify
   *    the active player still owns the choice.
   *  - `cardIds`: snapshot of banishable card ids at the moment the
   *    effect fired. The UI renders only these; if the player rearranges
   *    state in some other way before choosing, the snapshot keeps the
   *    selection set stable.
   *
   * `null` whenever no choice is pending. Reset to `null` by both the
   * `banishFromHand` reducer (on chosen banish) and the dedicated
   * `cancelBanishChoice` action (on dismiss).
   */
  readonly pendingBanishChoice: PendingBanishChoice | null;
  /**
   * Forest-Sage on-play omen roll surface (v2.1 REQ-6, embertide-gm0.10).
   *
   * Populated by `rollForestSageOmen(playerId)` when forest-sage is played
   * from a player's hand (the card moves hand → inPlay first, then the
   * roll fires). Carries the pre-rolled d6 face that the UI animates via
   * `DieRollReveal`; on dismiss `commitForestSageOmen()` applies the
   * resolved outcome (heal / gem / peek / power / draw / rare-item) and
   * clears this surface back to `null`.
   *
   * Per-encounter cap REQ-9f: only one omen roll per forest-sage play.
   * The EffectSpec roll-die resolves once per play and the pending
   * surface is cleared on commit, so a second `playCard('forest-sage-2')`
   * later in the run rolls a fresh omen — this matches the bead's
   * "on-play once, NOT a recurring effect" constraint.
   *
   * Modal-stack ordering: when both `lastChestReward` and
   * `pendingForestSageRoll` would mount at the same tick, the chest
   * reveal renders FIRST (parity with the dungeon-boss reward modal —
   * see GameBoard.tsx).
   *
   * @see {@link PendingForestSageRoll}
   */
  readonly pendingForestSageRoll: PendingForestSageRoll | null;
  /**
   * Dungeon-Boss onDefeat reward roll surface (v2.1 REQ-9d, embertide-4hz6).
   *
   * Populated by `rollDungeonBossReward(bossId)` after a Dungeon (region)
   * Boss defeat settles via `COMBAT_RESOLVE_WIN`. Carries the pre-rolled
   * d20 face that the UI animates via `DieRollReveal`; on dismiss
   * `commitDungeonBossReward()` applies the resolved card-tier outcome
   * (always a hero / item / premium-item card per embertide-3wd6)
   * and clears this surface back to `null`.
   *
   * Per-encounter cap: only one roll per Dungeon Boss defeat. The
   * `COMBAT_RESOLVE_WIN` reducer fires the roll AT MOST ONCE per
   * resolution event — re-entry is guarded by checking that
   * `pendingDungeonBossRoll === null` before firing.
   *
   * Modal-stack ordering: when both `lastChestReward` and
   * `pendingDungeonBossRoll` are non-null at the same tick (boss
   * defeat with an attached chest), the chest reveal renders FIRST.
   * The roll modal is rendered only when `lastChestReward === null`,
   * so the player sees "chest first, then scroll" in two distinct
   * beats.
   *
   * @see {@link PendingDungeonBossRoll}
   */
  readonly pendingDungeonBossRoll: PendingDungeonBossRoll | null;
  /**
   * Per-run colosseum tier-progression state (embertide-4hr1.4
   * entry seat + 4hr1.5 WIN-side mutator). Shape owned by
   * `src/core/colosseum/progression.ts` (embertide-4hr1.3, closed);
   * this field is the store-side seat that the HUD reads (4hr1.4) and
   * the combat-WIN reducer mutates (4hr1.5).
   *
   * Empty (`unlockedTiers: []`) at `initGame`. The HUD's
   * `enterColosseum` action seeds tier 1 explicitly on first colosseum
   * entry, per the engine docstring contract that keeps the entry-tier
   * policy in the caller (single grep target). Each colosseum-slot WIN
   * advances `unlockedTiers` to include `tier + 1` via `unlockTier`.
   *
   * Independent of the main-game `defeatedBossIds` ledger — colosseum
   * bosses share `sourceCardId`s with main-zone bosses (e.g. 'craghorn'),
   * and a colosseum kill must NOT register as a main-game wild-boss
   * defeat (would advance the zone FIFO queue / satisfy the
   * `isColosseumUnlocked` gate spuriously). The COMBAT_RESOLVE_WIN
   * reducer branches on `entryContext.entrySource === 'colosseum-slot'`
   * to keep the two ledgers separate.
   */
  readonly colosseumProgression: ColosseumProgression;
}

/**
 * Active per-card banish prompt surface (embertide-91p, commit b).
 * See {@link KidGameState.pendingBanishChoice} for lifecycle docs.
 */
export interface PendingBanishChoice {
  readonly playerId: string;
  readonly cardIds: readonly string[];
}

/**
 * Pending Forest-Sage on-play omen roll surface (embertide-gm0.10
 * + ynn4 die-roll-animation pass 2026-04-25).
 *
 *  - `cardId`: the just-played forest-sage card's instance id. Recorded
 *    so debug / audit surfaces can correlate the roll to its origin
 *    play, and so the per-play idempotency check has a stable handle
 *    if forest-sage ever gains a sibling card with the same omen
 *    semantics.
 *  - `playerId`: the player who played the card. Resolved at fire time
 *    as the active player at `playCard` dispatch.
 *  - `face`: pre-rolled d6 result (1..6) frozen at fire time. The UI
 *    consumes this via the DieRollReveal animation — the die rolls and
 *    settles on this face deterministically. Single face replaced the
 *    pre-9lj6/ynn4 3-tuple chooser when the reroll-token system was
 *    retired and the choice surface lost its meaning.
 *
 * See {@link KidGameState.pendingForestSageRoll} for the lifecycle
 * contract.
 */
export interface PendingForestSageRoll {
  readonly cardId: string;
  readonly playerId: string;
  readonly face: number;
}

/**
 * Pending Dungeon-Boss reward roll surface (embertide-4hz6 + ynn4
 * die-roll-animation pass 2026-04-25 + embertide-3wd6 d20 tier-
 * curve redesign 2026-04-25).
 *
 *  - `bossId`: the defeated Dungeon (region) Boss's source card id. Recorded
 *    so debug / audit surfaces can correlate the roll to its origin combat.
 *  - `playerId`: the player who will receive the resolved outcome. Resolved
 *    at fire time as the active player at `COMBAT_RESOLVE_WIN`.
 *  - `face`: pre-rolled d20 result (1..20) frozen at fire time. The face
 *    selects the loot tier (std / mid / legendary) per the table in
 *    gameStore.ts. The UI consumes this via the DieRollReveal animation
 *    (single die rolls and settles on this face).
 *
 * See {@link KidGameState.pendingDungeonBossRoll} for the lifecycle
 * contract.
 */
export interface PendingDungeonBossRoll {
  readonly bossId: string;
  readonly playerId: string;
  readonly face: number;
}
