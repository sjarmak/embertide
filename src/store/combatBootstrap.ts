/**
 * Combat entry/exit glue (u-8c, PRD §B6).
 *
 * Two responsibilities:
 *   1. Action interface declarations for the combat reducer
 *      (COMBAT_ENTER / COMBAT_RESOLVE_WIN / COMBAT_RESOLVE_LOSS).
 *   2. Pure builder helpers for assembling those action payloads from
 *      a `KidGameState` snapshot (enterCombatAction, buildResolveWinAction)
 *      plus a small kit of CombatState / log helpers used by the store's
 *      dispatchCombat reducer.
 *
 * No store imports — every helper takes state as input and returns a
 * value or new state shape. The reducer wiring lives back in
 * `src/store/gameStore.ts::dispatchCombat`.
 */

import type { Card } from '../types/card';
import type { ArenaState, CombatBoss, CombatEntryContext, CombatState } from '../types/combat';
import type { KidGameState, KidPlayer, ZoneId } from './types';
import {
  buildCombatDeck,
  initialCombatDraw,
  baseIdOf as baseIdOfString,
  type CombatTurnAction,
  type CombatTurnState,
} from '../core/combatEngine';
import { COMBAT_HAND_CAP } from '../core/balance';
import { tierCombatHpFor } from '../core/bossHp';
import { applyHeartReward } from '../core/vitalEmber';
import { GENERIC_BASE_ID_THEME } from '../theme/generic';
import { attackPatternFor, bossHpFor } from '../data/bossAttackPatterns';
import { ZONE_METADATA } from '../rules/zones';
import { ZONE_BOSS_SPECS } from '../data/zones/bossSpecs';
import { baseIdOf, KID_CARDS } from '../data/cards';
import { arenaForColosseumBoss } from '../data/colosseum/arenas';
import { getBubbleById, renderBubbleTemplate, type TutorialBubbleId } from '../tutorial/v20';
import { grantWildBossFairy } from './slices/combat';

// ---------------------------------------------------------------------------
// Combat reducer action union (v2.1 combat layer, u-8a, PRD §B1).
// ---------------------------------------------------------------------------

/**
 * Dispatched by `fightMonster` / `defeatAlwaysAvailableMonster` when the
 * engaged beast has `bossTier === 'wild-boss' | 'region-boss'` (PRD §B6).
 * Carries the fully-built combat context, the boss snapshot, and the
 * deterministically-shuffled combat deck — u-8b's reducer hydrates
 * `state.activeCombat` from this payload in one shot.
 */
export interface CombatEnterAction {
  readonly type: 'COMBAT_ENTER';
  readonly context: CombatEntryContext;
  readonly boss: CombatBoss;
  readonly combatDeck: readonly Card[];
  /**
   * Snapshot of `state.tideGauge` at COMBAT_ENTER time
   * (embertide-gdd.1.2). Frozen into `combat.tideGaugeSnapshot`
   * so the `tidewraith-tentacle-grab` resolver can scale dpt for the
   * duration of the combat. Defaults to 0 when omitted (every combat
   * outside Tidehold).
   */
  readonly tideGaugeSnapshot?: number;
  /**
   * Colosseum arena spec (embertide-lhlo.26). Present ONLY for
   * `entrySource === 'colosseum-slot'` entries whose engaged slot
   * declares an arena (looked up by boss `sourceCardId` in
   * `enterCombatAction`). Frozen onto `combat.arena` by the
   * `COMBAT_ENTER` reducer. Omitted for every other entry path, so
   * `CombatState.arena` stays undefined for map-zone combats.
   */
  readonly arena?: ArenaState;
}

/**
 * Dispatched when `boss.hp` reaches 0 and the combat loop exits
 * successfully. Payload pre-computes every downstream effect so the
 * reducer is a mechanical splat.
 */
export interface CombatResolveWinAction {
  readonly type: 'COMBAT_RESOLVE_WIN';
  readonly heartsToAttackers: Readonly<Record<string, number>>;
  readonly fairyDropTarget: string | null;
  readonly shardGrants: ReadonlyArray<'power' | 'courage' | 'wisdom'>;
  readonly zoneAdvance: boolean;
  /**
   * Boss-key drop payload (v2.1 REVERSE-Q8, gm0.12). Populated only
   * when the defeated boss's `bossTier === 'wild-boss'`. `keyId` is
   * the wild's `baseId` (e.g. 'craghorn', 'boulderkin', 'sentinel',
   * 'silver-chimera'); the reducer appends it to
   * `state.bossKeys[zoneId]` via `recordBossKey`. Additive to the
   * existing heirloom drop — both fire on every wild-boss WIN.
   */
  readonly bossKey: {
    readonly zoneId: ZoneId;
    readonly keyId: string;
  } | null;
}

/**
 * Dispatched when the combat loop exits with both players downed and
 * no revive available. Damage was already applied in-combat via
 * `applyDamage` + `checkCoopLoss`, so the reducer's only responsibility
 * is clearing `state.activeCombat` and letting `outcome === 'loss'`
 * drive the main-board loss screen.
 */
export interface CombatResolveLossAction {
  readonly type: 'COMBAT_RESOLVE_LOSS';
}

/**
 * Discriminated union of every combat-layer action. Consumers narrow via
 * an exhaustive `type` switch.
 */
export type CombatAction = CombatEnterAction | CombatResolveWinAction | CombatResolveLossAction;

// ---------------------------------------------------------------------------
// Combat-state builders.
// ---------------------------------------------------------------------------

/**
 * Default per-boss combat HP (PRD §B3, u-9f tuning pass).
 *
 * Resolution order:
 *   1. `BOSS_HP[card.id]` — the u-9f authoritative per-boss table in
 *      `src/data/bossAttackPatterns.ts`. Tuned so combat-length medians
 *      land in the wild [4,6] / region [5,8] / Vurmox [7,10] bands.
 *   2. `card.power` — legacy defensive read (no boss currently declares
 *      this, but the balance sim uses it for synthetic mocks).
 *   3. Tier fallback — 12 for region, 8 for wild, 5 for non-boss cards.
 *
 * u-9f wired #1; the lower branches are kept for backward compatibility
 * with any card that doesn't yet appear in BOSS_HP.
 */
export function defaultCombatHpFor(card: Card): number {
  const tuned = bossHpFor(card.id);
  if (tuned !== null) return tuned;
  // Tier fallback + legacy `card.power` read are shared with the UI slot
  // readout via `src/core/bossHp.ts` (embertide-bw6 unification).
  return tierCombatHpFor(card);
}

/**
 * Build a `CombatState` from a fresh `CombatEnterAction` payload.
 * Called by the `COMBAT_ENTER` reducer case; decoupled so tests can
 * assemble the state shape independently.
 */
export function buildInitialCombatState(
  boss: CombatBoss,
  combatDeck: readonly Card[],
  entryContext: CombatEntryContext,
  tideGaugeSnapshot: number = 0,
  arena?: ArenaState,
): CombatState {
  const { combatDeck: deckAfterDraw, combatHand, combatDiscard } = initialCombatDraw(combatDeck);
  return {
    boss,
    combatDeck: deckAfterDraw,
    combatHand,
    combatDiscard,
    battlefield: [],
    turnIndex: 0,
    activeActor: 'players',
    entryContext,
    // embertide-lhlo.26: colosseum arena spec, threaded from the
    // COMBAT_ENTER action. `undefined` (key spread out) for every
    // non-colosseum entry so map-zone combats carry no arena state.
    ...(arena !== undefined ? { arena } : {}),
    // nz8-d designer feedback 2026-04-24: the "X appears — ready for
    // combat" entry is redundant with the visible boss stage and was
    // flagged as UI clutter. Combat log starts empty; the first real
    // event (player play, boss attack) surfaces organically.
    combatLog: [],
    playsThisTurn: 0,
    // gdd.1.2: snapshot tide-gauge so tidewraith-tentacle-grab can scale
    // dpt without reaching back into KidGameState. Frozen for the
    // duration of the combat. Outside Maren the snapshot is 0 by
    // construction (state.tideGauge is 0 in any non-Maren zone).
    tideGaugeSnapshot,
    // gdd.1.2 substrate for hollow-effigy-mirror + knell-drum
    // resolvers (gdd.2.4 + embertide-x1qg). Always null at combat
    // entry; resolvers populate / clear as their pattern semantics
    // require.
    echoQueue: null,
  };
}

/**
 * Look up a card template by id. Used by dispatchCombatAction to
 * resolve the boss card when building COMBAT_RESOLVE_WIN payloads.
 * Throws on unknown id — the combat entry path guarantees the id
 * exists, so a miss is a programming error.
 */
export function cardByIdOrThrow(id: string): Card {
  const match = KID_CARDS.find((c) => c.id === id);
  if (!match) throw new Error(`cardByIdOrThrow: id not found in KID_CARDS: ${id}`);
  return match;
}

/**
 * Draw cards from `combatDeck` into `combatHand` up to COMBAT_HAND_CAP.
 * Pure: returns a new CombatState. Stops early if the deck is empty
 * (v2.1 design Q2: no re-shuffle).
 */
export function drawToCombatHandCap(combat: CombatState): CombatState {
  if (combat.combatHand.length >= COMBAT_HAND_CAP) return combat;
  const deck = combat.combatDeck.slice();
  const hand = combat.combatHand.slice();
  while (hand.length < COMBAT_HAND_CAP && deck.length > 0) {
    const card = deck.shift();
    if (card) hand.push(card);
  }
  return { ...combat, combatDeck: deck, combatHand: hand };
}

/**
 * Produce a plain-language log line summarizing the effect of a
 * combat-turn action. Used by `dispatchCombatAction` to populate
 * `CombatState.combatLog` so the CombatLog UI has something to show.
 */
export function describeAction(
  action: CombatTurnAction,
  before: CombatTurnState,
  after: CombatTurnState,
): string {
  switch (action.type) {
    case 'PLAYER_PLAY_CARD': {
      const bossDelta = before.combat.boss.hp - after.combat.boss.hp;
      const card = before.combat.combatHand.find((c) => c.id === action.cardId);
      const baseId = card ? baseIdOfString(card.id) : '';
      const name = GENERIC_BASE_ID_THEME[baseId] ?? baseId ?? 'A card';
      if (bossDelta > 0) return `${name} hits the boss for ${bossDelta}.`;
      return `${name} played.`;
    }
    case 'PLAYER_PASS':
      return "You pass — boss's turn.";
    case 'BOSS_RESOLVE': {
      const dmg = before.combat.boss.attackPattern.damagePerTurn;
      const targeting = before.combat.boss.attackPattern.targeting;
      return `Boss attacks (${targeting}) for ${dmg}.`;
    }
  }
}

/**
 * Apply the hearts-drop heal to each attacker, using the shared
 * vital-ember helper so COMBAT_RESOLVE_WIN heart rewards grow
 * hpMax (up to HP_CAP) once the player is already at the cap —
 * matches monster-drop / chest-reward semantics.
 */
export function applyHeartsHeal(
  state: KidGameState,
  heartsToAttackers: Readonly<Record<string, number>>,
): KidGameState {
  const entries = Object.entries(heartsToAttackers);
  if (entries.length === 0) return state;
  const players = state.players.map((p) => {
    const amount = heartsToAttackers[p.id] ?? 0;
    return applyHeartReward(p, amount);
  });
  return { ...state, players };
}

/**
 * Display name for a boss card referenced by sourceCardId. Falls back
 * to the base id string when the theme has no entry — shows up as e.g.
 * "ashen-tyrant" rather than an empty or `undefined` template value.
 *
 * Deliberately lightweight so it can be reused by both the combat-
 * bubble templater below and any future store-side render paths
 * without pulling in UI-layer helpers like CardTemplate.cardDisplayName.
 */
export function bossDisplayName(sourceCardId: string): string {
  const baseId = baseIdOfString(sourceCardId);
  return GENERIC_BASE_ID_THEME[baseId] ?? baseId;
}

/**
 * Render a combat tutorial bubble's body template with the runtime
 * vars it expects. Returns the substituted string, or `null` when the
 * bubble id has no declaration (unknown id) — callers use `null` as
 * the signal to fall back to the static `bubble.body`.
 *
 * embertide-07h — keeps the template contract in one place so the
 * three fire-point call-sites stay a one-liner.
 */
export function renderCombatBubbleBody(
  id: TutorialBubbleId,
  vars: Readonly<Record<string, string | number>>,
): string | null {
  const bubble = getBubbleById(id);
  return bubble ? renderBubbleTemplate(bubble.body, vars) : null;
}

/**
 * Augment a `heartsToAttackers` map with each attacker's Champion
 * combat-heal passive (embertide-g7f). Returns a new map with the
 * bonus added on top of the base monster-drop heal.
 *
 * Mirrors the Champion-passive branches in `fightMonsterSlice`
 * (src/store/slices/combat.ts) so wild-boss + region-boss combat wins
 * — which route through COMBAT_RESOLVE_WIN, NOT `fightMonsterSlice` —
 * still award the advertised bonus heal:
 *
 *   - champion-courage: +1 on any mini-boss / final-boss defeat
 *   - champion-sword:   +1 on region-boss / final-boss defeat (the
 *                       three zone-clear gatekeepers Broodmaw / King
 *                       Ashjaw / Vurmox, plus legacy dark-lord)
 *
 * Regular-monster combats never reach this path (they're resolved
 * synchronously via `fightMonsterSlice`). The helper is a pure data
 * transform — the caller is responsible for then passing the augmented
 * map to `applyHeartsHeal`.
 */
export function augmentHeartsWithChampionBonus(
  players: readonly KidPlayer[],
  heartsToAttackers: Readonly<Record<string, number>>,
  bossCard: Card,
): Record<string, number> {
  const isMiniOrFinalBoss = bossCard.role === 'mini-boss' || bossCard.role === 'final-boss';
  const isRegionOrFinalBoss = bossCard.bossTier === 'region-boss' || bossCard.role === 'final-boss';
  const augmented: Record<string, number> = { ...heartsToAttackers };
  for (const [attackerId, hearts] of Object.entries(heartsToAttackers)) {
    const player = players.find((p) => p.id === attackerId);
    if (!player) continue;
    let bonus = 0;
    if (player.championId === 'champion-courage' && isMiniOrFinalBoss) bonus += 1;
    if (player.championId === 'champion-sword' && isRegionOrFinalBoss) bonus += 1;
    augmented[attackerId] = hearts + bonus;
  }
  return augmented;
}

/**
 * Grant a wisp to a specific attacker by id (COMBAT_RESOLVE_WIN wild-
 * boss drop). Reuses `grantWildBossFairy` from the slice for the
 * 3-cap routing (defeater → teammate → warn+drop).
 */
export function applyFairyDrop(
  state: KidGameState,
  fairyDropTarget: string,
  defeatedBaseId: string,
): KidGameState {
  const idx = state.players.findIndex((p) => p.id === fairyDropTarget);
  if (idx === -1) return state;
  return grantWildBossFairy(state, idx, defeatedBaseId);
}

/**
 * Apply an array of shard grants to `sharedTriforce`. `OR`-s in each
 * flag so repeated grants are idempotent. Vurmox grants BOTH power AND
 * courage coincident per u-8e REQ-31 amendment.
 */
export function applyShardGrants(
  state: KidGameState,
  shards: ReadonlyArray<'power' | 'courage' | 'wisdom'>,
): KidGameState {
  if (shards.length === 0) return state;
  const nextShard = { ...state.sharedTriforce };
  for (const s of shards) nextShard[s] = true;
  return { ...state, sharedTriforce: nextShard };
}

/**
 * Discriminator for the combat-entry data source. embertide-4hr1.14
 * replaced a `(monsterCard: Card | null, bossOverride: CombatBoss | null)`
 * pair guarded by a runtime `(null, null)` throw with this union, so the
 * impossible state is unrepresentable at compile time.
 *
 * - `kind: 'card'` is the main-game path (wild / region / field). The
 *   card-id drives `attackPatternFor` / `defaultCombatHpFor`, and the
 *   shadow-creep / sandstorm flat adders fire when applicable.
 * - `kind: 'boss'` is the colosseum-slot path. The engine's slot router
 *   pre-computes a fully-specified `CombatBoss` (see
 *   `src/data/colosseum/tier1.ts` etc.) so this path bypasses the
 *   main-game lookups — necessary because some colosseum roster entries
 *   (coilworm, bonereaver, etc.) have no `KID_CARDS` counterpart.
 */
export type CombatEntry =
  | { readonly kind: 'card'; readonly card: Card }
  | { readonly kind: 'boss'; readonly boss: CombatBoss };

// ---------------------------------------------------------------------------
// Keyword-vocabulary activation gate (embertide-lhlo.7).
// ---------------------------------------------------------------------------

/**
 * Per-zone allowlist that gates whether `ZONE_BOSS_SPECS[card.id]` is
 * merged into the constructed `CombatBoss` for `kind:'card'` entries.
 *
 * **OFF BY DEFAULT.** lhlo Phase 2 was decomposed under user ruling
 * 2026-05-04 (Option 4: ship metadata first, gate consumers). Each
 * zone's flip is its own designer/playtest checkpoint — adding a zone
 * to this set turns on the keyword-vocabulary archetype tick (and any
 * future tag consumers) for that zone's bosses, which DOES change
 * combat math. Per-zone flips ship as `kw.zone-boss-activate-<zone>`
 * sub-beads with their own playtest sign-off.
 *
 * The set is `readonly` here at the type level; it is a plain `Set`
 * at runtime to keep `keywordVocabularyActive` a cheap `O(1)` lookup
 * across the combat hot-path. Tests that need to exercise an
 * activation path build a separate `Set` and pass it to
 * `enterCombatAction`'s `keywordVocabularyAllowlist` parameter; the
 * production constant never flips during a session.
 */
export const KEYWORD_VOCABULARY_ZONE_ALLOWLIST: ReadonlySet<ZoneId> = new Set<ZoneId>();

/**
 * Returns true when the keyword-vocabulary spec at
 * `ZONE_BOSS_SPECS[card.id]` should be merged into the constructed
 * `CombatBoss`. Currently keyed solely on `card.zone` — the bead's
 * scope is per-zone activation. Cards without a `zone` affinity
 * (heroes, items, starters, legacy v1 monsters that predate zones)
 * are never active.
 *
 * Pure function; no `KidGameState` dependency. Production callers
 * pass nothing for `allowlist` and pick up the (empty) production
 * constant; tests pass a custom set to drive activation paths.
 */
export function keywordVocabularyActive(
  card: Card,
  allowlist: ReadonlySet<ZoneId> = KEYWORD_VOCABULARY_ZONE_ALLOWLIST,
): boolean {
  if (!card.zone) return false;
  return allowlist.has(card.zone);
}

/**
 * Build a `CombatEnterAction` payload from the engaging state and a
 * `CombatEntry` discriminant. Defers to `buildCombatDeck` +
 * `initialCombatDraw` for the deterministic combat-deck shuffle in
 * either branch.
 *
 * Consistency invariant: `entry.kind === 'boss'` ⇔
 * `entrySource === 'colosseum-slot'`. The boss-only data path exists
 * exclusively to serve the colosseum slot router, and `colosseum-slot`
 * cannot service main-game cards (their attack patterns must come from
 * BOSS_ATTACK_PATTERNS via the card-id lookup). Mismatched pairs throw
 * here rather than silently drifting downstream.
 */
export function enterCombatAction(
  state: KidGameState,
  entry: CombatEntry,
  engagementSource: CombatEntryContext['engagementSource'],
  entrySource: CombatEntryContext['entrySource'] = 'field',
  /**
   * **TEST SEAM.** Override the keyword-vocabulary allowlist for this
   * call; defaults to the (empty) production constant. Production
   * callers MUST NOT pass this — the per-zone activation contract
   * (embertide-lhlo.7) is that the production allowlist is the
   * single point of designer control. Tests pass a custom set to
   * exercise activation paths without mutating module-level state.
   */
  keywordVocabularyAllowlist: ReadonlySet<ZoneId> = KEYWORD_VOCABULARY_ZONE_ALLOWLIST,
): CombatEnterAction {
  // embertide-4hr1.5 + 4hr1.14: the boss-only data path exists
  // exclusively to serve the colosseum slot router (see CombatEntry
  // docstring), and colosseum entries opt out of zone-mechanic adders
  // because colosseum mode is parallel to (not in) the current map
  // zone. Both invariants collapse into a single consistency assertion:
  // `entry.kind === 'boss' ⇔ entrySource === 'colosseum-slot'`.
  const isColosseumEntry = entrySource === 'colosseum-slot';

  if (entry.kind === 'boss' && !isColosseumEntry) {
    throw new Error(
      `enterCombatAction: kind='boss' is only valid with entrySource='colosseum-slot' (got entrySource='${entrySource}')`,
    );
  }
  if (entry.kind === 'card' && isColosseumEntry) {
    throw new Error(
      `enterCombatAction: entrySource='colosseum-slot' requires kind='boss' (got kind='card', cardId='${entry.card.id}')`,
    );
  }

  let boss: CombatBoss;
  if (entry.kind === 'boss') {
    boss = entry.boss;
  } else {
    const monsterCard = entry.card;
    const basePattern = attackPatternFor(monsterCard.id);
    // embertide-gdd.2 (designer ruling 2026-04-25): Hollow Shrine
    // zone-mechanic consumer. While in 'hollow-shrine', boss
    // damagePerTurn is bumped by `state.shadowCreep` (snapshot at
    // combat-entry time). Pure clone — leaves the canonical pattern in
    // BOSS_ATTACK_PATTERNS untouched. Snapshot semantics are safe:
    // shadow-creep ticks at End-phase, AFTER combat resolves within a
    // single Main, so the value is stable for the duration of any
    // single combat. Outside hollow-shrine this is identity-preserving.
    //
    // embertide-gdd.3 (designer ruling 2026-04-25): Dune Sanctum
    // zone-mechanic consumer mirrors the shadow-creep flat-adder shape
    // one-for-one. While in 'dune-sanctum', boss damagePerTurn is
    // bumped by `state.sandstormCounter`. Same clone-not-mutate
    // contract; same End-phase snapshot semantics.
    //
    // No colosseum opt-out guard is needed here: the kind/entrySource
    // assertion above guarantees this branch only runs for non-colosseum
    // entries.
    let zoneAdder = 0;
    if (state.currentZone === 'hollow-shrine') {
      zoneAdder = state.shadowCreep;
    } else if (state.currentZone === 'dune-sanctum') {
      zoneAdder = state.sandstormCounter;
    }
    const pattern =
      zoneAdder > 0
        ? { ...basePattern, damagePerTurn: basePattern.damagePerTurn + zoneAdder }
        : basePattern;
    const hp = defaultCombatHpFor(monsterCard);
    boss = {
      hp,
      hpMax: hp,
      attackPattern: pattern,
      sourceCardId: monsterCard.id,
    };
    // embertide-lhlo.7: opt-in keyword-vocabulary activation. When
    // the card's zone is on the allowlist AND a `ZONE_BOSS_SPECS`
    // entry exists for the card-id, merge `archetype` + `stateTags`
    // into the constructed boss so downstream consumers
    // (`applyArchetypeTick`, future archetype damage paths) fire.
    // Identity-preserving when allowlist is empty (production default)
    // OR when no spec entry exists — the merge is explicit per-field
    // (no spread of unknowns) so a new ZoneBossSpec field requires a
    // touch here instead of leaking through silently. The kind/
    // entrySource invariant above guarantees we only run for non-
    // colosseum entries; colosseum mode has its own pre-built
    // CombatBoss with archetype already populated.
    if (keywordVocabularyActive(monsterCard, keywordVocabularyAllowlist)) {
      const spec = ZONE_BOSS_SPECS[monsterCard.id];
      if (spec) {
        boss = {
          ...boss,
          archetype: spec.archetype,
          stateTags: spec.stateTags,
        };
      }
    }
  }
  // Both seats participate by default in v2.1 — co-op combat (§B6).
  // The active player is the "defeater" for drop routing (first id);
  // teammate is the fallback wisp recipient inside grantWildBossFairy.
  const attackerPlayerIds = [
    state.players[state.currentPlayerIndex]?.id ?? 'p0',
    ...state.players.filter((_p, i) => i !== state.currentPlayerIndex).map((p) => p.id),
  ];
  const context: CombatEntryContext = {
    bossCardId: boss.sourceCardId,
    combatEntryTurn: state.turn,
    attackerPlayerIds,
    engagementSource,
    entrySource,
  };
  const combatDeck = buildCombatDeck(state, context);
  // gdd.1.2: snapshot state.tideGauge so tidewraith-tentacle-grab's
  // resolver scales dpt off the at-entry value. Outside Maren the
  // gauge is 0 by construction; the snapshot is identity-preserving.
  //
  // embertide-4hr1.18: colosseum is parallel to the current map
  // zone, so zone-mechanic state must not bleed into colosseum combats.
  // shadowCreep + sandstormCounter already opt out by virtue of the
  // kind/entrySource invariant above (their adder branch runs only for
  // kind='card', which is forbidden with entrySource='colosseum-slot').
  // tideGaugeSnapshot lives outside that branch, so it needs an explicit
  // colosseum gate to honor the same parallel-mode contract.
  const tideGaugeSnapshot = isColosseumEntry ? 0 : state.tideGauge;
  // embertide-lhlo.26: arena lookup runs ONLY for colosseum slots,
  // keyed by the engaged boss `sourceCardId`. Field / wild-boss /
  // region-boss entries never touch this table, so their CombatState
  // stays arena-free by construction. A colosseum slot with no arena
  // entry resolves to `undefined` (no arena), same as any other path.
  const arena = isColosseumEntry ? arenaForColosseumBoss(boss.sourceCardId) : undefined;
  return { type: 'COMBAT_ENTER', context, boss, combatDeck, tideGaugeSnapshot, arena };
}

/**
 * Build a `COMBAT_RESOLVE_WIN` payload from the engaging state and the
 * defeated boss card. Encodes the drop-routing contract:
 *  - hearts (monster-drop.hearts) heal each attacker up to hpMax
 *  - wild-boss → wisp drop to the first attacker id
 *  - region-boss → shard grants from `attackPattern.onDefeatEffect`
 *  - region-boss whose id matches zone.regionBossId → zoneAdvance=true
 */
export function buildResolveWinAction(
  monsterCard: Card,
  attackerPlayerIds: readonly string[],
  currentZone: KidGameState['currentZone'],
): CombatResolveWinAction {
  const monsterDrop = monsterCard.effects as
    | { readonly kind?: string; readonly hearts?: number }
    | undefined;
  const dropHearts =
    monsterDrop?.kind === 'monster-drop' && typeof monsterDrop.hearts === 'number'
      ? monsterDrop.hearts
      : 0;

  const heartsToAttackers: Record<string, number> = {};
  for (const id of attackerPlayerIds) {
    heartsToAttackers[id] = dropHearts;
  }

  const attackPattern = attackPatternFor(monsterCard.id);
  const onDefeat = attackPattern.onDefeatEffect;
  const tier = monsterCard.bossTier ?? null;

  // Wild-boss: wisp drop to the first attacker (defeater). The
  // slice's `grantWildBossFairy` handles 3-cap routing internally; we
  // pass the defeater id and let the reducer's applyFairyDrop run the
  // cap check.
  const fairyDropTarget =
    tier === 'wild-boss' && attackerPlayerIds.length > 0 ? attackerPlayerIds[0] : null;

  // Region-boss: shard grants per attackPattern.onDefeatEffect.
  const shardGrants: ReadonlyArray<'power' | 'courage' | 'wisdom'> =
    onDefeat !== null && onDefeat.kind === 'shard-grant' ? onDefeat.shards : [];

  // Region-boss zone advance: defeat advances zone iff the boss's id
  // matches the current zone's regionBossId gatekeeper (mirrors the
  // instant-resolution path in `applyBossDefeatHooks`).
  const zoneAdvance =
    tier === 'region-boss' && ZONE_METADATA[currentZone].regionBossId === monsterCard.id;

  // gm0.12: wild-boss defeat drops a boss-key additive to the heirloom.
  // Keyed by the wild's baseId so duplicate-suffix mints (e.g. a
  // future copies path) resolve to the canonical id.
  const bossKey: CombatResolveWinAction['bossKey'] =
    tier === 'wild-boss' ? { zoneId: currentZone, keyId: baseIdOf(monsterCard) } : null;

  return {
    type: 'COMBAT_RESOLVE_WIN',
    heartsToAttackers,
    fairyDropTarget,
    shardGrants,
    zoneAdvance,
    bossKey,
  };
}
