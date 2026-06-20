/**
 * Combat — typed schema for the v2.1 boss-combat sub-state (PRD §B1).
 *
 * Phase 1 / u-8a: TYPES ONLY. No reducer logic, no helper functions. The
 * reducer (u-8b), combat-deck builder (u-8b), combat-effect lookup
 * (u-8d), and boss attack-pattern lookup (u-8e) each import from this
 * module as their schema source of truth.
 *
 * Every type is pure data — no timers, no async, no React references.
 * Consumers narrow discriminated unions via an exhaustive `kind` switch
 * with a compiler-level `never` check in the default branch (see
 * `effectTextFor` in `src/ui/effectText.tsx` for the canonical pattern).
 */

import type { Card } from './card';
import type { BossArchetype, BossStateTag } from './combatBossState';
import type { ArenaState } from './arena';

/**
 * Context captured at combat entry. Populated by `fightMonster` /
 * `defeatAlwaysAvailableMonster` when the engaged beast has
 * `bossTier === 'wild-boss' | 'region-boss'` (PRD §B6). Immutable for
 * the duration of the combat — drives the deterministic combat-shuffle
 * seed (`state.seed + combatEntryTurn`) and the drop-routing list in
 * `COMBAT_RESOLVE_WIN`.
 */
export interface CombatEntryContext {
  /** Source card id of the boss being fought. */
  readonly bossCardId: string;
  /** Main-board `state.turn` value at the moment combat was entered. */
  readonly combatEntryTurn: number;
  /**
   * `KidPlayer.id` values of the players attacking this boss. Used by
   * `COMBAT_RESOLVE_WIN` to route heart / wisp / shard drops back to
   * the right seats on victory.
   */
  readonly attackerPlayerIds: readonly string[];
  /**
   * Which main-board action dispatched `COMBAT_ENTER`. Kept for
   * bookkeeping so downstream resolvers can branch on entry path
   * without re-deriving it from state.
   */
  readonly engagementSource: 'fightMonster' | 'defeatAlwaysAvailableMonster';
  /**
   * REQ-32 u-9c slot-engagement discriminant. Differentiates the
   * three entry paths that hydrate `activeCombat`:
   *
   *  - `'wild-boss-slot'`: dispatched via `engageWildBossSlot` — no
   *    red/keys cost, no field mutation (slot bosses post-u-9a do
   *    NOT live in `state.field`). `COMBAT_RESOLVE_WIN` routes the
   *    heirloom from `HEIRLOOM_DROPS[bossBaseId]` into the defeating
   *    hero's `items` zone (3-cap routing mirrors the wisp path).
   *  - `'region-boss-slot'`: dispatched via `engageRegionBossSlot`.
   *    No cost check. On WIN, preserves the u-8c shard-grant + zone-
   *    advance behavior — no heirloom drop (heirlooms are wild-boss
   *    only per u-9b's HEIRLOOM_DROPS keying).
   *  - `'field'`: legacy u-8c center-row path (regular monsters
   *    through `fightMonster` / `defeatAlwaysAvailableMonster`). For
   *    u-8 regression safety, every existing call site lands here by
   *    default when no explicit entrySource is threaded through
   *    `enterCombatAction`.
   *  - `'colosseum-slot'`: dispatched via `enterColosseum`
   *    (embertide-4hr1.4 entry + 4hr1.5 WIN routing). Boss is
   *    selected by the colosseum engine's slot router. On WIN, the
   *    reducer advances the player's `colosseumProgression.unlockedTiers`
   *    per the engine's `unlockTier` semantics and SKIPS every main-game-
   *    only drop branch (heirloom, wisp, shard, zone advance,
   *    recordBossDefeat, bossKey, vital ember, dungeon-boss roll,
   *    crystal decrement, Golden Rainbow counter). The void mirror is
   *    also skipped — the colosseum boss was never on the main board.
   */
  readonly entrySource: 'wild-boss-slot' | 'region-boss-slot' | 'field' | 'colosseum-slot';
}

// ---------------------------------------------------------------------------
// Boss on-defeat effect (PRD §B1, minimum schema; u-8e / u-8c may extend).
// ---------------------------------------------------------------------------

/**
 * Drops a wisp into the defeating player's `items` zone on boss defeat.
 * Wild-boss default (amendment A6).
 */
export interface CombatOnDefeatWispDrop {
  readonly kind: 'wisp-drop';
}

/**
 * Grants one or more shared Embertide shards on boss defeat. Region-boss
 * default (e.g. Power on Vurmox defeat; Courage on Gilded-cage clear).
 */
export interface CombatOnDefeatShardGrant {
  readonly kind: 'shard-grant';
  readonly shards: ReadonlyArray<'power' | 'courage' | 'wisdom'>;
}

/**
 * Explicit no-op — boss defeat grants neither wisp nor shard. Kept as
 * an explicit kind (rather than `null`) so downstream switches stay
 * exhaustive and future tiers can be added without widening `null`.
 */
export interface CombatOnDefeatNone {
  readonly kind: 'none';
}

/**
 * Discriminated union of on-defeat effects. Extended by u-8e / u-8c as
 * new boss reward shapes land (e.g. vital-ember drops). `null` on
 * `BossAttackPattern.onDefeatEffect` means "pattern defined, on-defeat
 * not wired yet"; `{kind:'none'}` means "explicitly nothing on defeat".
 */
export type CombatOnDefeatEffect =
  | CombatOnDefeatWispDrop
  | CombatOnDefeatShardGrant
  | CombatOnDefeatNone;

// ---------------------------------------------------------------------------
// Boss + battlefield shapes (PRD §B1 / §B3).
// ---------------------------------------------------------------------------

/**
 * Optional discriminator that routes the boss-turn through a NAMED
 * dynamic resolver instead of the static `damagePerTurn` field
 * (embertide-gdd.1.2 / gdd.2.4).
 *
 * When `bossAttackResolver` is set, the combat engine dispatches the
 * boss-turn into a resolver function keyed by this string. The resolver
 * produces a damage value (and any side-effect state delta) for the
 * current turn from `CombatState` plus the static pattern fields. When
 * absent, behaviour falls back to the legacy static `damagePerTurn`
 * path — every pre-gdd.1.2 pattern is byte-identical at runtime.
 *
 * Resolver names ship one-per-implementing-bead:
 *   - `'tidewraith-tentacle-grab'`: Maren region-boss tidewraith. Dynamic dpt
 *     scales with `state.tideGauge` (snapshotted into CombatState at
 *     COMBAT_ENTER); chain-discard side effect at the high-tide
 *     threshold. Lands in gdd.1.2.
 *   - `'hollow-effigy-mirror'`: Hollow Shrine wild-boss hollow-effigy
 *     delayed-echo (spec'd in `docs/design/hollow-effigy-attack-pattern.md`,
 *     reads CombatState.echoQueue). Wiring deferred to a follow-up bead.
 *   - `'knell-drum'`: Hollow Shrine region-boss knell
 *     drum-telegraph + double-slam. 2-turn cycle keyed off
 *     `combat.turnIndex % 2`: telegraph turn (0 dmg, log-forecast),
 *     slam turn (full dpt to player-hp). Lands in `embertide-x1qg`.
 *   - `'hextwins-fire-ice'`: Dune Sanctum region-boss hextwins.
 *     3-turn fire/ice/fire cycle keyed off `combat.turnIndex % 3`:
 *     fire turns deal pattern dpt; ice turn deals 0 damage and
 *     discards 1 hand-card from each non-downed attacker. Lands in
 *     `embertide-jghb`.
 *   - `'iron-sentinel-stagger'`: Dune Sanctum wild-boss iron-sentinel.
 *     3-turn wind-up / heavy-swing / stagger cycle keyed off
 *     `combat.turnIndex % 3`: wind-up turn deals base dpt with a
 *     forecast log; heavy-swing turn deals base dpt + 1 (the burst);
 *     stagger turn deals 0 damage with an armor-cracks log. Lands in
 *     `embertide-2iyv`.
 *   - `'phantom-vurmox-volley'`: Colosseum tier-2 Phantom Vurmox. Reads
 *     the boss's sequence stateTag `currentIndex` to dispatch the
 *     2-step ball-volley: charge turn (0 dmg + forecast log), fire
 *     turn (base dpt + 1, cackling-volley flavor). Lands in
 *     `embertide-nlr8`.
 *   - `'trinity-aurogax-heads'`: Colosseum tier-5 capstone Trinity
 *     Aurogax. Reads the boss's sequence stateTag `currentIndex` to
 *     dispatch the 3-head rotation: gloom-head / umbra-head /
 *     auren-head all deal base dpt with per-head log flavor (per-head
 *     targeting variance deferred — see resolver doc-comment). Lands
 *     in `embertide-nlr8`.
 *
 * String literal union (rather than open `string`) so adding a new
 * id surfaces every consumer (spec sites + resolver registration) at
 * compile time. NOTE: the engine's dispatch table in
 * `bossResolvers/index.ts` is `Partial<Record<BossAttackResolverId,
 * BossResolver>>` — an unwired id compiles cleanly and falls through
 * to the legacy static-dpt path. The completeness test in
 * `bossResolvers/index.test.ts` asserts the registry covers every id.
 */
export type BossAttackResolverId =
  | 'tidewraith-tentacle-grab'
  | 'hollow-effigy-mirror'
  | 'knell-drum'
  | 'hextwins-fire-ice'
  | 'iron-sentinel-stagger'
  | 'phantom-vurmox-volley'
  | 'trinity-aurogax-heads';

/**
 * Boss attack pattern (PRD §B3). Pure data; the reducer (u-8b) resolves
 * damage routing via the `targeting` discriminant.
 *
 *  - 'player-hp': split damage evenly across non-downed players.
 *  - 'battlefield-then-player': front-to-back absorption; residual
 *    spills to `player-hp`.
 *  - 'aoe': damage every battlefield card AND every non-downed player
 *    simultaneously. Desperation mode (`boss.hp < DESPERATION_HP_PCT *
 *    hpMax`) also switches into this mode.
 */
export interface BossAttackPattern {
  readonly damagePerTurn: number;
  readonly targeting: 'player-hp' | 'battlefield-then-player' | 'aoe';
  /**
   * Reward applied when `boss.hp` reaches 0. `null` is a schema-valid
   * "not wired yet" placeholder (u-8a leaves every pattern un-wired);
   * `{kind:'none'}` is an explicit "no reward" assertion.
   */
  readonly onDefeatEffect: CombatOnDefeatEffect | null;
  /**
   * Optional dispatch key for the boss-turn dynamic resolver
   * (embertide-gdd.1.2). When present, the engine routes
   * `reduceBossResolve` through `BOSS_ATTACK_RESOLVERS[bossAttackResolver]`
   * rather than reading `damagePerTurn` directly. When absent, behaviour
   * is identical to the legacy static-dpt path (`damagePerTurn` consumed
   * verbatim). See `BossAttackResolverId` for the per-resolver contracts.
   */
  readonly bossAttackResolver?: BossAttackResolverId;
}

// ---------------------------------------------------------------------------
// Phase-threshold primitive (embertide-lhlo.17 — kw.phase-thresholds).
// ---------------------------------------------------------------------------

/**
 * A single phase transition that fires the FIRST TIME the boss's HP
 * fraction drops at or below `atHpFraction`.
 *
 * ### Remix-only invariant (type-enforced)
 *
 * A phase transition may ONLY re-point already-defined fields on the boss —
 * either `stateTags` (swapping which keyword tags are active) or
 * `attackPattern` (swapping targeting/damage shape). It CANNOT inject a
 * brand-new field that doesn't already exist on `CombatBoss`.
 *
 * This is enforced at the TYPE level by limiting `BossPhaseTransition` to
 * exactly these two optional override fields, both typed as subsets of the
 * corresponding `CombatBoss` fields:
 *   - `stateTags` replaces the boss's tag array with remixed tags.
 *   - `attackPattern` replaces the boss's attack-pattern object.
 *
 * Any other mechanic (e.g. adding a "freeze", adding a new property to
 * `CombatBoss`, adding a side-effect callback) is UNREPRESENTABLE in this
 * type — there is no field to put it in. The `applyPhaseThresholds` resolver
 * spreads only these two keys, so unknown mechanic fields can't slip through
 * at runtime either.
 *
 * ### Usage
 *
 * Omit a field to leave it unchanged. Set `stateTags` to remap the active
 * keyword tags (e.g. flip `guarded` to `exposed`, shift a sequence step,
 * tighten an adaptive penalty). Set `attackPattern` to ramp damage or switch
 * targeting. Both can be set together for a compound remix.
 */
export interface BossPhaseTransition {
  /**
   * Replacement `stateTags` array. MUST only reference tag kinds that are
   * already present on the boss at combat entry — the runtime invariant in
   * `assertPhaseTransitionRemixOnly` enforces this by checking that every
   * `kind` in this array appears in the boss's entry-time tag set. Omit to
   * leave `stateTags` unchanged.
   */
  readonly stateTags?: readonly BossStateTag[];
  /**
   * Replacement `attackPattern`. MUST only re-use `BossAttackPattern` fields
   * (damagePerTurn, targeting, onDefeatEffect, bossAttackResolver) — no new
   * mechanic fields are possible because `BossAttackPattern` is a closed
   * interface. Omit to leave `attackPattern` unchanged.
   */
  readonly attackPattern?: BossAttackPattern;
}

/**
 * One entry in a boss's ordered `phaseThresholds` list. When the boss's
 * `hp / hpMax` first falls at or below `atHpFraction` the `transition`
 * is applied exactly once and the threshold is recorded in
 * `crossedPhaseThresholds` so it cannot fire again.
 *
 * Thresholds are evaluated in DESCENDING order of `atHpFraction` (highest
 * fraction first) so that a single burst of damage crossing multiple
 * thresholds fires each transition in sequence from the top down.
 *
 * Canonical values: `0.75`, `0.50`, `0.25` (75 / 50 / 25 %).
 */
export interface BossPhaseThreshold {
  /** HP fraction (0 < atHpFraction ≤ 1) that triggers this transition. */
  readonly atHpFraction: number;
  /** The remix to apply when this threshold is first crossed. */
  readonly transition: BossPhaseTransition;
}

/**
 * In-combat boss. `hp` / `hpMax` live here (not on the source card) so
 * combat state stays isolated from the main-board card registry. The
 * `sourceCardId` points back to the authoring card for UI theming /
 * on-defeat reward routing.
 */
export interface CombatBoss {
  readonly hp: number;
  readonly hpMax: number;
  readonly attackPattern: BossAttackPattern;
  readonly sourceCardId: string;
  /**
   * 2026-05-02 keyword-vocabulary substrate (embertide-k08m, sub
   * of lhlo). Discriminated-union tags drawn from the
   * `bd memories embertide-keyword-glossary-2026-05-02` glossary —
   * `guarded`, `exposed`, `cycle`, `break`, `layered`, `sequence`,
   * `adaptive`. Multiple tags can coexist (Eye boss = guarded+cycle
   * until trip; Layered Item-Check = guarded+layered; etc.).
   *
   * Optional + readonly so every existing CombatBoss literal in tests
   * and reducers stays valid without churn — the resolver bead that
   * consumes these tags lands separately. Read sites default to `[]`.
   */
  readonly stateTags?: readonly BossStateTag[];
  /**
   * Six-archetype taxonomy from the 2026-05-02 designer ruling
   * (embertide-auft, sub of lhlo). One of `'eye' | 'item-check' |
   * 'layered' | 'sequence' | 'duel' | 'swarm'`. Drives engine
   * resolver-routing decisions and UI telegraph affordances. Optional
   * so pre-vocabulary boss literals stay valid without churn; read
   * sites default to "no archetype declared yet."
   */
  readonly archetype?: BossArchetype;
  /**
   * Ordered phase-threshold list (embertide-lhlo.17). Each entry fires
   * exactly ONCE when the boss's `hp / hpMax` first drops at or below
   * `atHpFraction`. Transitions are REMIX-ONLY: they may only re-point
   * existing `stateTags` or `attackPattern` — brand-new mechanic injection
   * is unrepresentable in the `BossPhaseTransition` type.
   *
   * Optional + readonly. Bosses without `phaseThresholds` behave exactly as
   * before — no regression. Read sites default to `[]`.
   */
  readonly phaseThresholds?: readonly BossPhaseThreshold[];
  /**
   * Set of `atHpFraction` values whose transitions have already fired
   * (embertide-lhlo.17). Used by `applyPhaseThresholds` to enforce
   * exactly-once-per-crossing idempotency — once a fraction value is
   * recorded here that threshold never fires again even if the boss is
   * somehow healed back above it. Kept as a sorted, deduplicated
   * `readonly number[]` for JSON-safety and deterministic equality.
   *
   * Optional + defaults to `[]` at read sites. Bosses without
   * `phaseThresholds` never write this field.
   */
  readonly crossedPhaseThresholds?: readonly number[];
}

/**
 * A card that has entered the battlefield (front-line absorption) via a
 * `combat-absorb` effect (PRD §B5). `combatEffectId` is the looked-up
 * id in `combatEffects.ts` (u-8d) — kept as a string here so this
 * module doesn't depend on the data-layer lookup table.
 */
export interface BattlefieldCard {
  readonly cardId: string;
  readonly hp: number;
  readonly hpMax: number;
  readonly combatEffectId: string;
}

// ---------------------------------------------------------------------------
// Combat effect discriminated union (PRD §B5).
// ---------------------------------------------------------------------------
// The CombatEffect family lives in `./combatEffect.ts` (embertide-bq9b)
// so `Card.combatEffect` can reference it without card.ts pulling in the
// rest of the combat sub-state shape. Re-exported here so existing
// `import { CombatEffect, ... } from '../types/combat'` sites stay valid.
export type {
  CombatAttackEffect,
  CombatAbsorbEffect,
  CombatHealEffect,
  CombatDrawEffect,
  CombatMultishotEffect,
  CombatAttackStunEffect,
  CombatWeakenEffect,
  CombatVulnerableEffect,
  CombatEffect,
  CombatEffectKind,
} from './combatEffect';

// Re-export the BossStateTag family (embertide-k08m, sub of lhlo)
// from this module so existing `import { ... } from '../types/combat'`
// sites can pull boss-state tags without a second import path. The
// discriminated-union family lives in `./combatBossState.ts`.
export type {
  BossLayer,
  BossStateGuarded,
  BossStateExposed,
  BossStateCycle,
  BossStateBreak,
  BossStateLayered,
  BossStateSequence,
  BossStateAdaptive,
  BossStateSwarm,
  BossStateTag,
  BossStateTagKind,
  BossArchetype,
} from './combatBossState';

// Re-export the Arena family (embertide-lhlo.26) so existing
// `import { ... } from '../types/combat'` sites can pull arena types
// without a second import path. The discriminated-union family lives
// in `./arena.ts`.
export type {
  ArenaGlobalDamageModifier,
  ArenaEffect,
  ArenaEffectKind,
  ArenaEotDamageHazard,
  Hazard,
  HazardKind,
  ArenaState,
} from './arena';

// ---------------------------------------------------------------------------
// Top-level combat sub-state (PRD §B1).
// ---------------------------------------------------------------------------

/**
 * Sub-state inserted into `KidGameState.activeCombat` while a wild-boss
 * or region-boss combat is resolving. `null` elsewhere.
 *
 *  - `combatDeck` / `combatHand` / `combatDiscard`: shared pools across
 *    both players (single deck built from starters + heroes inPlay +
 *    active items; see PRD §B2). Fairies are excluded; they remain
 *    main-board-revive only.
 *  - `battlefield`: cards that have entered the front-line via
 *    `combat-absorb`. Front-to-back damage absorption.
 *  - `activeActor`: whose sub-turn is resolving. `'players'` = shared
 *    play window; `'boss'` = boss attack resolves per `attackPattern`.
 *  - `turnIndex`: combat-local turn counter; increments after each
 *    boss-turn. Drives desperation / telemetry.
 */
export interface CombatState {
  readonly boss: CombatBoss;
  readonly combatDeck: readonly Card[];
  readonly combatHand: readonly Card[];
  readonly combatDiscard: readonly Card[];
  readonly battlefield: readonly BattlefieldCard[];
  readonly turnIndex: number;
  readonly activeActor: 'players' | 'boss';
  readonly entryContext: CombatEntryContext;
  /**
   * Plain-language log of combat events, written by the store's
   * dispatchCombatAction wrapper as each action resolves. CombatLog
   * renders the last 3 entries. Optional so pre-wiring test mocks
   * stay valid; read sites default to `[]`.
   */
  readonly combatLog?: readonly string[];
  /**
   * Count of `PLAYER_PLAY_CARD` actions resolved during the current
   * players-turn. Persisted on CombatState so the engine's per-turn
   * play cap (COMBAT_PLAYS_PER_TURN) is enforced across dispatches.
   * Reset to 0 at PLAYER_PASS and at the end of BOSS_RESOLVE. Optional
   * so pre-wiring mocks stay valid; read sites default to 0.
   */
  readonly playsThisTurn?: number;
  /**
   * Count of upcoming boss-turns to skip (u-9b: heirloom stun wiring).
   * Incremented by `combat-attack-stun` effects (craghorn-tusk ships
   * stunTurns=1). Decremented by one inside `reduceBossResolve` when
   * the counter is positive — in that branch the boss's attack pattern
   * does NOT fire, but turnIndex still advances so desperation and
   * telemetry stay consistent. Optional + defaults to 0 so existing
   * mocks and pre-u-9b test fixtures remain valid without churn.
   */
  readonly bossStunTurns?: number;
  /**
   * Accumulated Weaken stacks applied to the boss by player card plays
   * this turn (lhlo.23 §WEAKEN keyword). `reduceBossResolve` subtracts
   * this value from the resolved boss damage (clamped at 0) and then
   * resets the counter to 0 at the start of the boss's next turn —
   * consumed on that one boss-turn regardless of whether the boss is
   * stunned. Additive: multiple Weaken plays in the same players-turn
   * stack. Optional + defaults to 0 so existing mocks stay valid.
   */
  readonly bossWeakenStacks?: number;
  /**
   * Accumulated Vulnerable bonus applied to the boss by player card
   * plays this turn (lhlo.23 §VULNERABLE keyword). Stacks onto
   * `exposedBonusFor` at every player→boss attack site during the same
   * players-turn. Cleared at the end of the boss's next turn (EOT) —
   * same cadence as `bossWeakenStacks`, set to 0 in `reduceBossResolve`
   * at turn-start. Additive: multiple Vulnerable plays stack. Optional
   * + defaults to 0 so existing mocks stay valid.
   */
  readonly vulnerableBonus?: number;
  /**
   * `KidPlayer.id` of whichever player most recently resolved a
   * `PLAYER_PLAY_CARD` action (u-9c / REQ-32 slot engagement).
   * Powers `determineDefeatingHero(players, combat)` so
   * `COMBAT_RESOLVE_WIN` can route the heirloom drop to the seat
   * that actually landed the finishing blow (last-card-played wins
   * the credit; player-1 tiebreak when unset). Optional + starts
   * undefined so existing mocks and test fixtures pre-u-9c stay
   * valid without churn.
   */
  readonly lastPlayerToPlay?: string;
  /**
   * Snapshot of `state.tideGauge` taken at COMBAT_ENTER time
   * (embertide-gdd.1.2). Frozen for the duration of the combat so
   * the `tidewraith-tentacle-grab` resolver can scale damage and side
   * effects without reaching back into the outer `KidGameState`.
   * `0` for any combat outside Tidehold (the gauge is zero outside
   * Maren by construction). Optional + defaults to 0 in read sites so
   * pre-gdd.1.2 mocks and tests stay valid without churn.
   */
  readonly tideGaugeSnapshot?: number;
  /**
   * Echo queue for hollow-effigy's delayed mirror attack pattern
   * (embertide-gdd.2.4 spec; substrate landed in gdd.1.2 alongside
   * the resolver discriminator). `power` is the player's highest
   * single-play power on the turn just ended; `sourceCardId` is the
   * card that produced it. Cleared each boss-turn after firing; updated
   * on PLAYER_PASS / players → boss flips. `null` on combat entry and
   * after a no-play / no-damage player turn.
   *
   * Field is added pre-emptively in gdd.1.2 so the
   * `hollow-effigy-mirror` follow-up resolver (gdd.2.4 implementation)
   * can read/write this slot without further schema churn. The tidewraith,
   * knell, hextwins, and iron-sentinel resolvers do NOT consume
   * echoQueue (they key off `turnIndex` cycles and pre-snapshotted
   * zone state instead).
   */
  readonly echoQueue?: { readonly power: number; readonly sourceCardId: string } | null;
  /**
   * Colosseum arena state (embertide-lhlo.26). Bundles global
   * combat modifiers (`effects`) and end-of-turn hazards (`hazards`)
   * for the colosseum's identity mechanic. Populated ONLY when the
   * combat was entered via the colosseum slot router
   * (`entryContext.entrySource === 'colosseum-slot'`) and the engaged
   * slot declares an arena. Left `undefined` for every field /
   * wild-boss / region-boss combat — arena state never bleeds into
   * map-zone combats by construction. Read sites default to "no arena."
   */
  readonly arena?: ArenaState;
}
