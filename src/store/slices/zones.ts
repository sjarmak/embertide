/**
 * Zone-state slice (amendment A5, u-5a; Courage-unlock gate added u-5b).
 *
 * Pure helpers for the map-exploration spine. Four responsibilities:
 *
 *  1. Seed the per-game zone fields at initGame via `initialZoneFields`.
 *  2. Track boss-card defeats (wild and region) via `recordBossDefeat`,
 *     whose output feeds the wild/region slot selectors
 *     `currentWildBossForZone` / `currentRegionBossForZone`
 *     (REQ-32, u-9a).
 *  3. Advance the current zone via `advanceZone` when a region boss is
 *     defeated. At the terminal zone, advanceZone still records the
 *     zone-cleared event by appending the terminal zone to `zoneHistory`
 *     (idempotently) — region-boss defeat at terminal is what completes
 *     the v2.0 map.
 *  4. Fire the u-5b Courage-unlock gate (`checkCourageUnlock`): when
 *     `zoneHistory` contains every zone in `ZONE_ORDER`,
 *     `sharedTriforce.courage` flips to true. Called automatically from
 *     inside `advanceZone` on every advance event.
 *
 * Event emission is intentionally NOT implemented here — GameBoard
 * observes `zoneHistory` length changes and fires the advance banner
 * directly. u-6a/b/c emit wild-boss-defeated events via their combat
 * hooks if needed; this slice's contract is "record the defeat + advance
 * the zone + fire Courage on full clear", no more.
 */

import type { Card } from '../../types/card';
import type { KidGameState, ZoneId } from '../types';
import { ZONE_METADATA, ZONE_ORDER, nextZone } from '../../rules/zones';
import { baseIdOf as baseIdOfCard } from '../../data/cards';

/**
 * Tide-gauge upper bound for Tidehold (embertide-gdd.1).
 * `incrementTideGauge` clamps at this ceiling so a long stay in Maren
 * stops compounding rather than diverging unboundedly. 4 is the
 * roster-memo-authored value; tuning lives in z5e.
 */
export const TIDE_GAUGE_MAX = 4;

/**
 * Shadow-creep upper bound for the Hollow Shrine (embertide-gdd.2,
 * designer ruling 2026-04-25). `incrementShadowCreep` clamps at this
 * ceiling so a long stay in Shadow stops compounding. 3 is the
 * designer-ruling-authored value (one step less than tide-gauge's 4 —
 * Shadow's adder lands as a flat +N on monster damage, so the lower
 * cap holds combats inside the [5, 8] median-turn band).
 */
export const SHADOW_CREEP_MAX = 3;

/**
 * Increment `state.tideGauge` by 1, clamped at `TIDE_GAUGE_MAX`, ONLY
 * while `state.currentZone === 'maren'`. Pure: returns input reference
 * unchanged outside of Maren or once the cap is reached, so identity
 * comparisons stay stable upstream.
 *
 * Called from the End-phase pass-through in advancePhase
 * (gameStore.ts) — every player's turn end ticks the gauge while in
 * Maren, matching the roster memo's "+1 per turn-end" semantics.
 */
export function incrementTideGauge(state: KidGameState): KidGameState {
  if (state.currentZone !== 'maren') return state;
  if (state.tideGauge >= TIDE_GAUGE_MAX) return state;
  return { ...state, tideGauge: state.tideGauge + 1 };
}

/**
 * Increment `state.shadowCreep` by 1, clamped at `SHADOW_CREEP_MAX`,
 * ONLY while `state.currentZone === 'hollow-shrine'`. Pure: returns
 * input reference unchanged outside of Hollow Shrine or once the cap
 * is reached, so identity comparisons stay stable upstream.
 *
 * Called from the End-phase pass-through in advancePhase (gameStore.ts)
 * at the same site as `incrementTideGauge` — every player's turn end
 * ticks the gauge while in hollow-shrine. Mirrors the tide-gauge
 * slice-hook shape one-for-one (embertide-gdd.2.3 ruling
 * 2026-04-25). Consumer is `enterCombatAction`, which bumps
 * `attackPattern.damagePerTurn` by `state.shadowCreep` at combat-entry
 * time when in hollow-shrine.
 */
export function incrementShadowCreep(state: KidGameState): KidGameState {
  if (state.currentZone !== 'hollow-shrine') return state;
  if (state.shadowCreep >= SHADOW_CREEP_MAX) return state;
  return { ...state, shadowCreep: state.shadowCreep + 1 };
}

/**
 * Sandstorm-counter upper bound for the Dune Sanctum
 * (embertide-gdd.3, designer ruling 2026-04-25).
 * `incrementSandstormCounter` clamps at this ceiling so a long stay in
 * Dune Sanctum stops compounding. 3 is the designer-ruling-authored
 * value (mirrors shadow-creep's cap one-for-one — Spirit's adder lands
 * as a flat +N on monster damage in this substrate ship, identical
 * shape to Shadow's slice).
 */
export const SANDSTORM_COUNTER_MAX = 3;

/**
 * Increment `state.sandstormCounter` by 1, clamped at
 * `SANDSTORM_COUNTER_MAX`, ONLY while
 * `state.currentZone === 'dune-sanctum'`. Pure: returns input
 * reference unchanged outside of Dune Sanctum or once the cap is
 * reached, so identity comparisons stay stable upstream.
 *
 * Called from the End-phase pass-through in advancePhase (gameStore.ts)
 * at the same site as `incrementShadowCreep` — every player's turn end
 * ticks the gauge while in dune-sanctum. Mirrors the shadow-creep
 * slice-hook shape one-for-one (embertide-gdd.3 designer ruling
 * 2026-04-25). Consumer is `enterCombatAction`, which bumps
 * `attackPattern.damagePerTurn` by `state.sandstormCounter` at
 * combat-entry time when in dune-sanctum.
 *
 * Ship semantics: flat-adder only. The roster memo's "every 3 turns
 * the wind blows, discard one hand-card" was investigated by the
 * 2026-04-25 pacing pass (embertide-7itk) and rejected by the
 * designer — counter saturates at cap 3 within 3 ticks and stays
 * there for the rest of the zone visit, so any "fire when counter
 * reaches 3" interpretation lands ~5-10 forced discards per 16-turn
 * 2P game, which is not a fun mechanic for the target audience. See
 * docs/design/dune-sanctum-sandstorm-pacing-pass.md.
 */
export function incrementSandstormCounter(state: KidGameState): KidGameState {
  if (state.currentZone !== 'dune-sanctum') return state;
  if (state.sandstormCounter >= SANDSTORM_COUNTER_MAX) return state;
  return { ...state, sandstormCounter: state.sandstormCounter + 1 };
}

/**
 * Card-id base of the Tidehold regular monster that ships with a
 * fragility window (embertide-gdd.1.2). Kept as a constant rather
 * than a literal so future zone-flavored fragility windows can extend
 * the contract without re-greppinng for the string. Today the set is
 * exactly `{'fangfish'}` per the gdd.1 roster memo.
 */
const FANGFISH_BASE_ID = 'fangfish';

/**
 * Strip a trailing `-N` numeric suffix from a card id (mirror of
 * `baseIdOf` in `src/core/combatEngine.ts`). Supply mints duplicate
 * cards with `-2`, `-3`, ... suffixes so a `fangfish-3` resolves back
 * to `'fangfish'`. Falls back to the cards.ts `baseId` field when
 * present (matches the canonical resolution path used elsewhere in the
 * data layer).
 */
function resolveCardBaseId(card: Card): string {
  const declared = baseIdOfCard(card);
  if (declared !== card.id) return declared;
  const match = card.id.match(/^(.*)-\d+$/);
  return match ? match[1] : card.id;
}

/**
 * Fangfish fragility-window resolver (embertide-gdd.1.2).
 *
 * Roster-memo contract: a played fangfish that survives one turn-end
 * without re-engagement auto-discards itself ("school of fish darts
 * away" thematic). Implementation tracks per-card-id watchlist on
 * `state.skullfishFieldWatchlist`:
 *
 *   1. Find every fangfish currently in `state.field`.
 *   2. For each id in the previous watchlist that is STILL in the
 *      field → discard from field into `state.defeated`. The id
 *      reappearing in the watchlist means it sat through one full
 *      turn-end without being bought / fought.
 *   3. Replace the watchlist with the ids of the fangfish that
 *      survived this scan (i.e. fresh-this-turn fangfish; they get
 *      one turn of grace before the next end-phase fires the discard).
 *
 * Pure / immutable: returns a new state with new field + defeated +
 * watchlist when at least one card is involved; otherwise returns the
 * input reference unchanged so identity comparisons stay stable.
 *
 * Called from the End-phase pass-through in `advancePhase`
 * (gameStore.ts) AFTER `incrementTideGauge` so the gauge value
 * captured into any next-turn combat reflects the just-fired tick.
 * The fragility check is zone-agnostic — fangfish is only ever in
 * the supply for Maren, but if a future card mints duplicates with the
 * same baseId outside Maren the same window applies.
 */
export function applySkullfishFragility(state: KidGameState): KidGameState {
  // Find every fangfish currently in the field. Resolve via
  // `resolveCardBaseId` so duplicate-suffix mints (e.g. `fangfish-2`)
  // resolve back to the canonical id; the watchlist tracks the runtime
  // card-id (with suffix) so individual copies don't collide.
  const skullfishCards = state.field.filter((c) => resolveCardBaseId(c) === FANGFISH_BASE_ID);
  if (skullfishCards.length === 0) {
    // No fangfish in the field. Watchlist must reset to empty so a
    // fangfish that was bought between turn-ends doesn't leave a
    // ghost id sitting around — important for the identity-stable
    // contract upstream (selectors that read the array shouldn't see
    // it grow without bound).
    if (state.skullfishFieldWatchlist.length === 0) return state;
    return { ...state, skullfishFieldWatchlist: [] };
  }

  const previousIds = new Set(state.skullfishFieldWatchlist);
  const fragileIds = new Set<string>();
  const survivorIds: string[] = [];
  for (const card of skullfishCards) {
    if (previousIds.has(card.id)) {
      fragileIds.add(card.id);
    } else {
      survivorIds.push(card.id);
    }
  }

  if (fragileIds.size === 0) {
    // No fangfish has been around long enough to drop. Just refresh
    // the watchlist with the current crop and return.
    const sameWatchlist =
      survivorIds.length === state.skullfishFieldWatchlist.length &&
      survivorIds.every((id, i) => id === state.skullfishFieldWatchlist[i]);
    if (sameWatchlist) return state;
    return { ...state, skullfishFieldWatchlist: survivorIds };
  }

  // Discard fragile fangfish: remove from field, append to defeated
  // (auto-banish — same destination as a normal monster that gets
  // fought; the fangfish "escapes" rather than being killed, but the
  // game-state effect is identical from the field's POV).
  // embertide-g294: also mirror into the visible Void pile so the
  // kid sees the auto-escaped fangfish on the void pane (matches the
  // combat-defeat mirror; no game-logic delta).
  const nextField = state.field.filter((c) => !fragileIds.has(c.id));
  const droppedCards = state.field.filter((c) => fragileIds.has(c.id));
  return {
    ...state,
    field: nextField,
    defeated: [...state.defeated, ...droppedCards],
    voided: [...state.voided, ...droppedCards],
    skullfishFieldWatchlist: survivorIds,
  };
}

/**
 * Wild-boss ids that are NOT part of the region-boss unlock gate
 * (v2.1 REVERSE-Q8, gm0.12). Post-completion bosses that only surface
 * after the core map is cleared are excluded from the Vurmox-unlock
 * gate so the gate stays semantically "every CORE wild boss of this
 * zone" without a second metadata field.
 *
 * embertide-044 (2026-04-24): the Prism Chimera is now a
 * dynamic-spawn encounter driven by `state.goldenRainbowLynelSpawned`
 * (see src/rules/zones.ts `currentWildBossForZone`) and is no longer
 * in any zone's `wildBossIds` array — the filter below is kept as the
 * extensibility hook for future post-completion bosses that do land
 * in `wildBossIds` but should be excluded from `canSpawnRegionBoss`.
 */
const POST_COMPLETION_WILD_BOSS_IDS: ReadonlySet<string> = new Set();

/**
 * Initial zone fields for a fresh game (spread into EMPTY_STATE and
 * applied by initGame). Always starts at the first zone in ZONE_ORDER
 * with no history and no defeated bosses.
 */
export function initialZoneFields(): {
  readonly currentZone: ZoneId;
  readonly zoneHistory: readonly ZoneId[];
  readonly defeatedBossIds: readonly string[];
  readonly bossKeys: Readonly<Record<ZoneId, readonly string[]>>;
} {
  return {
    currentZone: ZONE_ORDER[0],
    zoneHistory: [],
    defeatedBossIds: [],
    bossKeys: emptyBossKeys(),
  };
}

/**
 * Fresh per-zone boss-key record (gm0.12). Every `ZoneId` in `ZONE_ORDER`
 * gets an empty array so lookups `state.bossKeys[zoneId]` are defined
 * without narrowing even before the first key drops.
 */
export function emptyBossKeys(): Record<ZoneId, readonly string[]> {
  const keys = {} as Record<ZoneId, readonly string[]>;
  for (const zoneId of ZONE_ORDER) {
    keys[zoneId] = [];
  }
  return keys;
}

/**
 * Record a wild-boss key drop for `zoneId` (v2.1 REVERSE-Q8, gm0.12).
 * Appends `keyId` to `state.bossKeys[zoneId]` idempotently — a second
 * call with the same id returns `state` unchanged. Pure.
 *
 * Called by the `COMBAT_RESOLVE_WIN` reducer when the defeated boss's
 * `bossTier === 'wild-boss'`; the heirloom drop path is unchanged and
 * both effects fire in the same transaction.
 */
export function recordBossKey(state: KidGameState, zoneId: ZoneId, keyId: string): KidGameState {
  const existing = state.bossKeys[zoneId] ?? [];
  if (existing.includes(keyId)) return state;
  return {
    ...state,
    bossKeys: {
      ...state.bossKeys,
      [zoneId]: [...existing, keyId],
    },
  };
}

/**
 * Region-boss unlock predicate (v2.1 REVERSE-Q8, gm0.12). Returns true
 * iff every CORE wild boss id for `zoneId` (i.e. every
 * `ZONE_METADATA[zoneId].wildBossIds` entry except the post-completion
 * bonus bosses in `POST_COMPLETION_WILD_BOSS_IDS`) is present in
 * `state.bossKeys[zoneId]`.
 *
 * Contract:
 *   - Sylvani / Emberpeak have a single core wild (craghorn /
 *     boulderkin), so one key unlocks the region boss.
 *   - Gilded Cage has two cores (sentinel + silver-chimera). Both
 *     core keys are required; the dynamic-spawn Prism Chimera
 *     (embertide-044) is not in `wildBossIds` so it never
 *     participates in the gate.
 *   - Defensive: an unknown `zoneId` returns `false` — callers treat
 *     that as "locked" which is the safe fail-closed default.
 *
 * This gate reverses REQ-32 / u-9a's always-on region slot behavior
 * (designer decision 2026-04-23). The old `canSpawnRegionBoss` name is
 * intentionally reused so grep navigates readers to the locked-door
 * flow. Pure + side-effect free; safe to call from selectors.
 */
export function canSpawnRegionBoss(state: KidGameState, zoneId: ZoneId): boolean {
  const meta = ZONE_METADATA[zoneId];
  if (!meta) return false;
  const required = meta.wildBossIds.filter((id) => !POST_COMPLETION_WILD_BOSS_IDS.has(id));
  if (required.length === 0) return true;
  const keys = state.bossKeys[zoneId] ?? [];
  const held = new Set(keys);
  return required.every((id) => held.has(id));
}

/**
 * Record a boss-card defeat (by card id). Appends to
 * `state.defeatedBossIds` without duplication — calling twice with the
 * same id is idempotent. Pure.
 *
 * Feeds the slot selectors in src/rules/zones.ts: defeated wild ids
 * advance the FIFO queue in `currentWildBossForZone`, and a defeated
 * `regionBossId` clears the region slot to `null` in
 * `currentRegionBossForZone`.
 */
export function recordBossDefeat(state: KidGameState, cardId: string): KidGameState {
  if (state.defeatedBossIds.includes(cardId)) return state;
  return {
    ...state,
    defeatedBossIds: [...state.defeatedBossIds, cardId],
  };
}

/**
 * Card ids (not `baseId`s) that gate the colosseum unlock
 * (embertide-4hr1.2): the Sylvani wild boss + region boss.
 * Single source of truth — downstream sub-beads should import this.
 */
export const COLOSSEUM_UNLOCK_BOSS_IDS = ['craghorn', 'broodmaw'] as const;

/**
 * True iff every id in `COLOSSEUM_UNLOCK_BOSS_IDS` appears in
 * `state.defeatedBossIds`. Subset check (not equality), so unrelated
 * cross-zone defeats do not interfere. Pure derived state — no
 * persisted unlock flag.
 */
export function isColosseumUnlocked(state: KidGameState): boolean {
  return COLOSSEUM_UNLOCK_BOSS_IDS.every((id) => state.defeatedBossIds.includes(id));
}

/**
 * u-5b Courage-unlock gate. Returns true iff every zone in `ZONE_ORDER`
 * appears in `state.zoneHistory` — that is, the full v2.0 3-zone sequence
 * (Sylvani + Emberpeak + Gilded Cage) has been cleared.
 *
 * Idempotent and side-effect-free: callers use this either as a guard
 * or to drive the `sharedTriforce.courage` flip. `advanceZone` calls it
 * on every advance event and flips Courage the first time it returns
 * true; subsequent `advanceZone` calls at the terminal zone are no-ops
 * (see `advanceZone` docstring) so re-firing is impossible.
 */
export function checkCourageUnlock(state: KidGameState): boolean {
  const history = new Set(state.zoneHistory);
  for (const zoneId of ZONE_ORDER) {
    if (!history.has(zoneId)) return false;
  }
  return true;
}

/**
 * Advance `currentZone` to the next zone in `ZONE_ORDER`. Appends the
 * just-cleared zone to `zoneHistory` idempotently. Pure.
 *
 * Semantics:
 *  - Non-terminal zone: append `currentZone` to `zoneHistory`, set
 *    `currentZone` to `nextZone(currentZone)`.
 *  - Terminal zone (Gilded Cage): append `currentZone` to
 *    `zoneHistory` if it isn't there already; leave `currentZone`
 *    unchanged. This is the u-5b amendment to u-5a's original
 *    "no-op at terminal" contract — the region-boss defeat that fires
 *    advanceZone at terminal IS the signal that the terminal zone was
 *    cleared, so it must be recorded.
 *  - Terminal zone with `zoneHistory` already containing it: full no-op
 *    (identity return) — callers can invoke this repeatedly without
 *    double-appending or re-firing the Courage unlock.
 *
 * After the zone-state update, `checkCourageUnlock` runs. If it returns
 * true and `sharedTriforce.courage` is still false, Courage flips to
 * true in the same returned state — the defeat transaction that clears
 * the terminal zone also grants the Courage shard.
 */
export function advanceZone(state: KidGameState): KidGameState {
  const upcoming = nextZone(state.currentZone);
  const alreadyInHistory = state.zoneHistory.includes(state.currentZone);

  // Terminal zone, already recorded → nothing to do.
  if (upcoming === null && alreadyInHistory) return state;

  const nextHistory = alreadyInHistory
    ? state.zoneHistory
    : [...state.zoneHistory, state.currentZone];
  const nextCurrent = upcoming ?? state.currentZone;

  // embertide-gdd.1: reset tide-gauge whenever currentZone actually
  // changes. The terminal-zone idempotent path (upcoming === null AND
  // already in history) bailed early above so we don't reset after
  // re-entering the same identity state. We DO reset on first-time
  // terminal-zone entry too — that case advances zoneHistory but
  // leaves currentZone unchanged; tide-gauge in non-maren is already 0
  // so the reset is a no-op there. The reset semantics fire only when
  // crossing a zone boundary.
  const crossingBoundary = nextCurrent !== state.currentZone;
  const nextTideGauge = crossingBoundary ? 0 : state.tideGauge;
  // embertide-gdd.2: shadow-creep mirrors the tide-gauge reset
  // contract — zero on every zone-boundary crossing. The Shadow gauge
  // is 0 outside hollow-shrine anyway, so the reset is a no-op for
  // any boundary crossing that doesn't leave hollow-shrine.
  const nextShadowCreep = crossingBoundary ? 0 : state.shadowCreep;
  // embertide-gdd.3: sandstorm-counter mirrors the shadow-creep
  // reset contract — zero on every zone-boundary crossing. The
  // Sandstorm gauge is 0 outside dune-sanctum anyway, so the reset
  // is a no-op for any boundary crossing that doesn't leave
  // dune-sanctum.
  const nextSandstormCounter = crossingBoundary ? 0 : state.sandstormCounter;

  let next: KidGameState = {
    ...state,
    currentZone: nextCurrent,
    zoneHistory: nextHistory,
    tideGauge: nextTideGauge,
    shadowCreep: nextShadowCreep,
    sandstormCounter: nextSandstormCounter,
  };

  if (!next.sharedTriforce.courage && checkCourageUnlock(next)) {
    next = {
      ...next,
      sharedTriforce: { ...next.sharedTriforce, courage: true },
    };
  }

  return next;
}
