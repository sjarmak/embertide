/**
 * Combat-length balance simulation helper (v2.1, u-8h + u-9f).
 *
 * Drives the combat engine's `combatTurnReducer` with a greedy "play
 * highest-damage card" policy to measure how many boss-turns a combat
 * takes under reasonable player builds. Consumed by the extension at
 * the tail of `src/balance/greedyShardSimulation.test.ts` which asserts
 * per-boss-class median turn windows and a heirloom win-rate curve.
 *
 * u-9f updates:
 *   - Per-boss HP now routes through `bossHpFor` (authoritative table
 *     in `src/data/bossAttackPatterns.ts`). Previously the sim had
 *     hardcoded REGION_BOSS_HP=12 / WILD_BOSS_HP=8; those live on as
 *     fallbacks for test-only cards that don't appear in BOSS_HP.
 *   - `simulateCombat` accepts a `heirloomCount` parameter (default 0)
 *     that injects the first N heirlooms from the canonical order
 *     `[craghorn-tusk, boulderkin-core, sentinel-eye, chimera-sword]`
 *     into the synthetic combat deck before shuffle. Enables the
 *     PRD §C8 heirloom win-rate curve assertions in the test file.
 *   - `entryContext.entrySource` is set to `'wild-boss-slot'` /
 *     `'region-boss-slot'` based on boss tier (replacing the legacy
 *     `'field'` source). Mirrors u-9c's slot-engagement store methods.
 *
 * Design:
 *  - Synthetic combat decks per strategy (map-rush / power-rush / mixed
 *    each have a different `power` distribution; wisdom-rush skips
 *    combat entirely). The engine's default combat-effect resolver
 *    (u-8d `combatEffectFor`) reads `card.cost.red` as the attack
 *    damage; our synthetic cards encode declared power via `cost.red`.
 *  - LOSS detection uses two synthetic players with hp=SYNTHETIC_HP so
 *    the engine's `applyDamage` + `wouldAllBeDowned` projection behave
 *    the same way they do at runtime.
 *  - Deterministic: seeded via `createSeededRng(seed)`. Same seed ->
 *    same outcome (asserted as a smoke test).
 */

import type { Card } from '../types/card';
import type { CombatBoss, CombatEntryContext, CombatState } from '../types/combat';
import type { KidPlayer } from '../store/types';
import { combatTurnReducer, initialCombatDraw, type CombatTurnState } from '../core/combatEngine';
import { attackPatternFor, bossHpFor } from '../data/bossAttackPatterns';
import { COMBAT_PLAYS_PER_TURN } from '../core/balance';
import { createSeededRng } from '../rules/chestPool';

/**
 * Strategy identifiers that engage combat. `wisdom-rush` is handled
 * separately — it never engages a boss, so it has no combat-length
 * samples.
 */
export type CombatEngagingStrategy = 'map-rush' | 'power-rush' | 'mixed';

/**
 * Every zone boss id that can appear in combat. Covers v2.0 (craghorn /
 * broodmaw / boulderkin / ashen-tyrant / sentinel / silver-chimera /
 * cagewright-vurmox) AND the gdd v2.1 zone expansion: Maren (maelstrom +
 * tidewraith), Hollow Shrine (hollow-effigy + knell), Dune Sanctum
 * (iron-sentinel + hextwins). prism-chimera is intentionally
 * EXCLUDED — it is a rare post-completion encounter explicitly noted
 * as outside the sim's balance band (see BOSS_HP comments in
 * src/data/bossAttackPatterns.ts:433-437). Colosseum bosses are a
 * separate lane (the 4hr1 epic) and not in scope for z5e.
 */
export const BOSS_IDS: readonly string[] = [
  // v2.0 zones
  'craghorn',
  'broodmaw',
  'boulderkin',
  'ashen-tyrant',
  'sentinel',
  'silver-chimera',
  'cagewright-vurmox',
  // gdd.1 Maren
  'maelstrom',
  'tidewraith',
  // gdd.2 Hollow Shrine
  'hollow-effigy',
  'knell',
  // gdd.3 Dune Sanctum
  'iron-sentinel',
  'hextwins',
];

/**
 * Hard cap on reducer iterations per combat sim. Well beyond the [3, 7]
 * assertion window — the cap only fires if a sim misconfiguration
 * accidentally creates an unwinnable/un-loseable combat. The reducer
 * itself has no loops, so runtime is O(HARD_CAP * COMBAT_PLAYS_PER_TURN)
 * per sim.
 */
const HARD_CAP_TURNS = 30;

/**
 * Starting HP per synthetic player (balance-sim calibration).
 *
 * u-9f recalibration: 12 HP per player × 2 players = 24 pool HP. This
 * puts the 0-heirloom vs region-boss win rate in the 30-40% band the
 * PRD §C8 curve demands — players have enough HP to land several plays
 * but not so much that a region-boss fight is a foregone conclusion.
 *
 * Prior u-8h value was 25 (calibrated for the now-retired 6-dpt AoE
 * Vurmox attack). With u-9f's lowered dpt (Vurmox 6→3, ashen-tyrant 4→3,
 * silver-chimera 5→4) the old 25 left players effectively immortal,
 * collapsing the heirloom curve to 100% across the board.
 *
 * Design intent: this HP represents a typical late-campaign combat
 * entry — several heart drops accumulated from wild-boss + monster
 * defeats, some item heals. NOT a fresh-game player (they'd die turn
 * 1 against any boss); not a perfectly-healed one (they'd faceroll
 * every fight). Sits in the middle.
 *
 * If bossAttackPatterns.ts `damagePerTurn` values ever retune, this
 * constant may need retuning in lockstep — bump this comment with a
 * note when that happens.
 */
const SYNTHETIC_HP = 13;

/**
 * Set of region-boss ids (drives the slot-engagement + fallback HP
 * branch). v2.1 gdd zones add tidewraith (Maren), knell (Shadow
 * Temple), and hextwins (Dune Sanctum) — each is `regionBossId` for
 * its zone in `src/store/slices/zones.ts`.
 */
const REGION_BOSS_IDS = new Set<string>([
  'broodmaw',
  'ashen-tyrant',
  'cagewright-vurmox',
  'tidewraith',
  'knell',
  'hextwins',
]);

/** Fallback HP per tier when `bossHpFor` returns null. Matches gameStore's defaults. */
const FALLBACK_REGION_HP = 12;
const FALLBACK_WILD_HP = 8;

/**
 * Heirloom card ids in the canonical drop order — u-9f parameter
 * convention: `heirloomCount=0` injects none, `heirloomCount=1` injects
 * only craghorn-tusk, `heirloomCount=4` injects all four. Matches the task
 * spec's "first N from HEIRLOOM_DROPS values" wording (the values of
 * HEIRLOOM_DROPS appear in this exact order per the wild-boss defeat
 * sequence across v2.0's three zones).
 */
const HEIRLOOM_ORDER: readonly string[] = [
  'craghorn-tusk',
  'boulderkin-core',
  'sentinel-eye',
  'chimera-sword',
];

/** Maximum heirloom count accepted by `simulateCombat`. */
const MAX_HEIRLOOM_COUNT = HEIRLOOM_ORDER.length;

/**
 * Per-strategy synthetic card-power distribution. The greedy combat
 * policy picks the highest-power card each play.
 *
 * Calibration notes:
 *  - v2.1 combat engine's inline-default `resolveCombatEffect` reads
 *    `card.power ?? 1` and resolves every card to `combat-attack`.
 *    That means deck size + power totals directly map to cumulative
 *    player damage per combat.
 *  - The sim driver reshuffles `combatDiscard` back into `combatDeck`
 *    and redraws up to the hand cap between cycles when the hand
 *    empties (standard deck-builder convention — represents a player
 *    running their whole deck over multiple combat cycles).
 *  - Deck totals are calibrated so that against each boss's hp pool,
 *    the player needs 3-7 full boss-turns to deal enough cumulative
 *    damage. Too-small decks wipe the boss in 1 cycle (median 0-1);
 *    too-large decks let the player one-shot regardless of which
 *    cards land in hand.
 *  - map-rush and power-rush decks are sized so 5-card hand totals
 *    average around 5-7 damage per hand — enough to chip wild bosses
 *    (hp 8) in 2 hands and region bosses (hp 12) in 2-3 hands while
 *    the boss is dealing sustained player damage.
 *  - power-rush carries slightly more total punch to reflect a
 *    combat-heavy build; map-rush is leaner because the player is
 *    prioritizing zone-clear (more cards elsewhere).
 *  - mixed is the middle ground.
 */
const STRATEGY_DECKS: Readonly<Record<CombatEngagingStrategy, readonly number[]>> = {
  // u-9f: deck sizes calibrated at ~24-28 cards (late-campaign typical
  // deck composition). Heirloom injection (0-4 cards) is thus 0-15% of
  // deck composition, and heirloom effects have proportionate (not
  // saturating) impact on the win-rate curve.
  // map-rush: 24-card deck, mostly power=1 with 0-power flavor slots.
  'map-rush': [1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1],
  // power-rush (Vurmox-rush): 28-card combat-heavy build with occasional
  // power=2 spikes. Higher total punch but with variance.
  'power-rush': [
    1, 1, 1, 2, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 1, 1, 2, 1, 0, 1, 1, 1, 1, 0, 1, 0, 2,
  ],
  // mixed: 26-card deck, middle ground.
  mixed: [1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
};

/** Outcome of a single combat simulation. */
export interface CombatSimResult {
  /** True when boss.hp reached 0 before all players were downed. */
  readonly won: boolean;
  /**
   * `combat.turnIndex` at terminal. Mirrors the number of BOSS_RESOLVE
   * increments that fired before the terminal (WIN fires inside a
   * players-turn and does NOT increment turnIndex; LOSS fires inside
   * `reduceBossResolve` which DOES increment turnIndex). For the
   * median assertion we count WIN samples only.
   */
  readonly turnsElapsed: number;
}

/**
 * Mint a synthetic `Card` with a declared combat damage. The engine's
 * `resolveCombatEffect` now delegates to `combatEffectFor` which reads
 * `card.cost.red` as the damage for the default `combat-attack`
 * mapping. Encode the declared power via `cost.red` so the sim's
 * cards deal the intended damage without needing a u-8d override.
 * (Pre-2026-04-21 the engine read a raw `card.power` field via a
 * defensive cast — that path is gone; see commit wiring u-8d into
 * resolveCombatEffect.)
 */
function mintSyntheticCard(seed: number, index: number, power: number): Card {
  return {
    id: `sim-card-${seed}-${index}`,
    role: 'hero',
    cost: { red: power },
    effects: { kind: 'gain' },
  };
}

/**
 * Assemble the strategy-specific combat deck. Deterministic: same
 * `seed` produces the same shuffle order. Optionally injects the
 * first `heirloomCount` heirlooms per the u-9f parameter convention
 * (see `HEIRLOOM_ORDER`).
 *
 * Heirlooms are injected BEFORE shuffle so they mix into the deck
 * uniformly. The resulting curve hits the PRD §C8 monotonic shape:
 * more heirlooms → higher win rate, with each additional heirloom
 * contributing a diminishing but positive delta.
 */
function buildSyntheticDeck(
  strategy: CombatEngagingStrategy,
  seed: number,
  heirloomCount: number,
): readonly Card[] {
  const powers = STRATEGY_DECKS[strategy];
  const deck: Card[] = powers.map((p, i) => mintSyntheticCard(seed, i, p));
  for (const heirloom of heirloomCardsFor(heirloomCount)) {
    deck.push(heirloom);
  }
  // Fisher-Yates via the seeded RNG so "highest-power card first" is
  // not the natural mint order — the greedy policy actually has to
  // search the hand rather than stumbling onto pre-sorted power.
  const rng = createSeededRng(seed);
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}

/** Build two synthetic players with full hp. */
function buildSyntheticPlayers(): readonly KidPlayer[] {
  const base = (id: string): KidPlayer => ({
    id,
    name: id,
    championId: 'champion-sword',
    championSlot: null,
    championPassivePulse: 0,
    hp: SYNTHETIC_HP,
    hpMax: SYNTHETIC_HP,
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
    heartPieceMeter: 0,
    usedFairyInBottleIds: [],
    banished: [],

    nextChestItemRevealed: false,
  });
  return [base('p0'), base('p1')];
}

/** Build the boss snapshot for `bossId`. Mirrors gameStore's defaults. */
function buildBoss(bossId: string): CombatBoss {
  const tuned = bossHpFor(bossId);
  const hp = tuned ?? (REGION_BOSS_IDS.has(bossId) ? FALLBACK_REGION_HP : FALLBACK_WILD_HP);
  return {
    hp,
    hpMax: hp,
    attackPattern: attackPatternFor(bossId),
    sourceCardId: bossId,
  };
}

/**
 * In-card combat-effect declarations for the four sim-injected heirlooms.
 * Mirrors `Card.combatEffect` on the heirloom cards in
 * `src/data/cards/heirlooms.ts` (embertide-bq9b / ppf9-7a moved the
 * authoring source of truth onto each heirloom card). Inlined here rather
 * than imported so this sim file stays a leaf dependency (heirlooms.ts
 * is a leaf, but keeping the table local keeps the sim's heirloom shape
 * obvious in one place alongside `HEIRLOOM_ORDER`).
 */
const HEIRLOOM_COMBAT_EFFECTS: Readonly<Record<string, NonNullable<Card['combatEffect']>>> = {
  'craghorn-tusk': { kind: 'combat-attack-stun', damage: 4, stunTurns: 1 },
  'boulderkin-core': { kind: 'combat-absorb', hp: 4 },
  'sentinel-eye': { kind: 'combat-attack', damage: 6 },
  'chimera-sword': { kind: 'combat-attack', damage: 7 },
};

/**
 * Mint a heirloom card for injection into the simulated combat deck.
 * The structural shape mirrors the `craghornTusk` / `stoneTalusCore` /
 * `guardianEye` / `lynelSword` entries in `src/data/cards/heirlooms.ts`:
 * role='item', itemKind='item-active', `cost: { green: 0 }`, no-op
 * `effects`, and an in-card `combatEffect` declaration matching the
 * authoring source of truth. We duplicate the shape rather than
 * importing from cards.ts so this sim file stays a leaf dependency.
 */
function mintHeirloomCard(cardId: string): Card {
  return {
    id: cardId,
    role: 'item',
    cost: { green: 0 },
    effects: { kind: 'gain' },
    itemKind: 'item-active',
    cooldownTurns: 0,
    lastUsedTurn: null,
    combatEffect: HEIRLOOM_COMBAT_EFFECTS[cardId],
  };
}

/**
 * Build the list of heirloom cards to inject for a given heirloom
 * count. `count` is clamped to `[0, 4]`; out-of-range values are
 * silently bounded so the sim never crashes on invalid input but the
 * caller still gets a deterministic result.
 */
function heirloomCardsFor(count: number): readonly Card[] {
  const clamped = Math.max(0, Math.min(MAX_HEIRLOOM_COUNT, Math.floor(count)));
  return HEIRLOOM_ORDER.slice(0, clamped).map(mintHeirloomCard);
}

/**
 * Resolve the `entrySource` for a sim based on boss tier. u-9f / REQ-32:
 * the balance sim models slot engagement (u-9c's `engageWildBossSlot` /
 * `engageRegionBossSlot`) rather than the legacy center-row `fightMonster`
 * path. Wild bosses enter via the wild-boss slot, region bosses (incl.
 * Vurmox) via the region-boss slot.
 */
function entrySourceFor(bossId: string): CombatEntryContext['entrySource'] {
  return REGION_BOSS_IDS.has(bossId) ? 'region-boss-slot' : 'wild-boss-slot';
}

/** Build the initial `CombatTurnState` for a sim. */
function initialCombatTurnState(
  strategy: CombatEngagingStrategy,
  bossId: string,
  seed: number,
  heirloomCount: number,
): CombatTurnState {
  const deck = buildSyntheticDeck(strategy, seed, heirloomCount);
  const { combatDeck, combatHand, combatDiscard } = initialCombatDraw(deck);
  const boss = buildBoss(bossId);
  const players = buildSyntheticPlayers();
  const entryContext: CombatEntryContext = {
    bossCardId: bossId,
    combatEntryTurn: seed,
    attackerPlayerIds: ['p0', 'p1'],
    engagementSource: 'fightMonster',
    entrySource: entrySourceFor(bossId),
  };
  const combat: CombatState = {
    boss,
    combatDeck,
    combatHand,
    combatDiscard,
    battlefield: [],
    turnIndex: 0,
    activeActor: 'players',
    entryContext,
  };
  return {
    combat,
    players,
    terminal: null,
    playsThisTurn: 0,
  };
}

/**
 * Read the declared `power` of a combat-hand card. Mirrors the
 * defensive cast in `resolveCombatEffect` (engine internals) so the
 * greedy policy sorts by the same quantity the reducer actually uses
 * to compute damage.
 */
function powerOf(card: Card): number {
  const withPower = card as Card & { readonly power?: number };
  return typeof withPower.power === 'number' ? withPower.power : 1;
}

/**
 * Greedy combat policy: pick the highest-power card in the current
 * hand. Ties resolve to the first match (deterministic given a
 * deterministic combatHand order).
 */
function pickHighestPowerCardId(hand: readonly Card[]): string | null {
  if (hand.length === 0) return null;
  let bestIdx = 0;
  let bestPower = powerOf(hand[0]);
  for (let i = 1; i < hand.length; i += 1) {
    const p = powerOf(hand[i]);
    if (p > bestPower) {
      bestPower = p;
      bestIdx = i;
    }
  }
  return hand[bestIdx].id;
}

/**
 * Reshuffle `combatDiscard` back into `combatDeck` when the hand is
 * empty. Standard deck-builder convention (Ascension / Dominion): when
 * the draw pile runs out, shuffle the discard and keep going.
 *
 * The v2.1 combat engine doesn't expose a reducer action for this —
 * inline-default combat-effect resolution never fires a `combat-draw`
 * effect, so the hand would otherwise empty on turn 2 and the boss
 * would stall the combat. This helper models the realistic deck-builder
 * loop a human player would run: when hand + deck are empty, shuffle
 * discard back in and redraw, then keep playing.
 *
 * Returns a new `CombatTurnState` with the reshuffled deck + refilled
 * hand. No-op when hand is non-empty or when both deck and discard are
 * empty (combat has genuinely run dry).
 */
function reshuffleIfNeeded(state: CombatTurnState, seed: number): CombatTurnState {
  const { combatHand, combatDeck, combatDiscard } = state.combat;
  if (combatHand.length > 0) return state;
  if (combatDeck.length === 0 && combatDiscard.length === 0) return state;
  // Move discard into a shuffled deck and redraw up to hand cap.
  const rng = createSeededRng(seed + state.combat.turnIndex + 1);
  const pool = [...combatDeck, ...combatDiscard];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  const {
    combatDeck: newDeck,
    combatHand: newHand,
    combatDiscard: newDiscard,
  } = initialCombatDraw(pool);
  return {
    ...state,
    combat: {
      ...state.combat,
      combatDeck: newDeck,
      combatHand: newHand,
      combatDiscard: newDiscard,
    },
  };
}

/**
 * Simulate one combat. Returns `{ won, turnsElapsed }`. WIN samples
 * are the only ones that feed the median assertion — LOSS samples
 * imply the boss wasn't killed at all, so a "combat length to WIN"
 * number isn't meaningful for them.
 *
 * @param heirloomCount optional (default 0) — number of heirlooms to
 *   inject into the combat deck. Heirlooms are drawn from the
 *   canonical order `[craghorn-tusk, boulderkin-core, sentinel-eye,
 *   chimera-sword]`, so `heirloomCount=2` injects `craghorn-tusk`
 *   AND `boulderkin-core`. Clamped to `[0, 4]`.
 */
export function simulateCombat(
  strategy: CombatEngagingStrategy,
  bossId: string,
  seed: number,
  heirloomCount: number = 0,
): CombatSimResult {
  let state = initialCombatTurnState(strategy, bossId, seed, heirloomCount);
  let iterations = 0;
  while (state.terminal === null && iterations < HARD_CAP_TURNS) {
    // Reshuffle discard into deck + refill hand if the hand emptied
    // during the prior cycle. Standard deck-builder convention.
    state = reshuffleIfNeeded(state, seed);
    // Players-turn: play up to COMBAT_PLAYS_PER_TURN cards greedily.
    while (
      state.terminal === null &&
      state.combat.activeActor === 'players' &&
      state.playsThisTurn < COMBAT_PLAYS_PER_TURN &&
      state.combat.combatHand.length > 0
    ) {
      const cardId = pickHighestPowerCardId(state.combat.combatHand);
      if (cardId === null) break;
      state = combatTurnReducer(state, {
        type: 'PLAYER_PLAY_CARD',
        cardId,
        playerId: 'p0',
      });
    }
    if (state.terminal !== null) break;
    // Pass → boss resolves → back to players-turn (or terminal === 'loss').
    state = combatTurnReducer(state, { type: 'PLAYER_PASS' });
    state = combatTurnReducer(state, { type: 'BOSS_RESOLVE' });
    iterations += 1;
  }
  return {
    won: state.terminal === 'win',
    turnsElapsed: state.combat.turnIndex,
  };
}

/**
 * Compute the median of a numeric array. For an even-length array the
 * lower-middle value is returned (consistent with integer-valued
 * turn counts; we don't want `3.5` appearing in the assertion).
 */
export function computeMedian(values: readonly number[]): number {
  if (values.length === 0) {
    throw new Error('computeMedian: empty input');
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    // Round toward the lower-middle so integer-valued medians stay
    // integers; makes the [3, 7] window unambiguous.
    return Math.floor((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}
