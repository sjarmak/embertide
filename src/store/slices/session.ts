/**
 * Session-arc + co-op softclock slice (REQ-19 full 4-phase arc + REQ-16
 * + amendment A2/A4, u-7 + gm0.9).
 *
 * Pure helpers. Owns the turn-count-derived session arc
 * (Stirring → Rising → Boss → Climax), the per-tier spawn gates for
 * wild / region bosses, the Climax-phase Vurmox pin in Gilded Cage,
 * and the co-op softclock that grants an escalating HP-easier bonus
 * to un-claimed bosses once the party has fallen behind (sharedEmbertide
 * total < 2 at start of turn 10).
 *
 * Scope note: this slice is a STATE-DERIVED LAYER — it exposes helpers
 * but does NOT mutate `KidGameState`'s shape. `sessionPhase` is a pure
 * function of `state.turn`, not a stored field — duplicating it would
 * introduce a synchronization bug the helper exists to prevent. UI and
 * combat layers observe these helpers at the points they need them:
 *   - Spawn code consults `canSpawnWildBossInZone` /
 *     `canSpawnRegionBossByPhase` before placing wild / region boss
 *     cards. `engageWildBossSlot` / `engageRegionBossSlot` in
 *     gameStore.ts defensively gate on these predicates too.
 *   - GameBoard + WildBossEncounterSlot observe `sessionPhase`,
 *     `shouldPinVurmox`, and `isClimaxStalled` to drive banners +
 *     dormant-slot rendering.
 *   - fightMonster / affordability checks consult `softclockHpEase` to
 *     apply the cumulative discount.
 */

import type { KidGameState, SharedEmbertide, ZoneId } from '../types';
import type { Card } from '../../types/card';

/**
 * Session-arc phases derived from `state.turn` (REQ-19 full 4-phase,
 * gm0.9). Replaces the prior 3-phase `'Setup' | 'Boss' | 'Climax'` with
 * a finer cadence matching the v2.1 PRD:
 *
 *  - 'Stirring': turns 1-2. No Wild / Region boss spawns — the zone is
 *                  still being set up, and the wild-boss slot renders a
 *                  dormant placeholder in the UI.
 *  - 'Rising':   turns 3-5. Wild boss spawns are unlocked (the slot
 *                  becomes engageable); Region / Dungeon boss spawns
 *                  remain gated.
 *  - 'Boss':     turns 6-8. Region / Dungeon boss spawns are unlocked
 *                  on top of the Rising capabilities. The boss-key
 *                  gate (gm0.12) still applies to region slots — this
 *                  helper only covers the phase-level gate.
 *  - 'Climax':   turn 9+. On top of Boss capabilities, Vurmox pins in
 *                  Gilded Cage (if the party is there) or stalls
 *                  progression with a banner (if not).
 *
 * The 4-phase arc is monotonic non-decreasing as `turn` grows — once a
 * phase is reached it cannot regress.
 */
export type SessionPhase = 'Stirring' | 'Rising' | 'Boss' | 'Climax';

/** First turn of the Stirring phase (the session always starts here). */
export const STIRRING_PHASE_TURN = 1;

/** First turn on which wild-boss spawns become eligible (Rising, gm0.9). */
export const RISING_PHASE_TURN = 3;

/** First turn on which region-boss spawns become eligible (Boss). */
export const BOSS_PHASE_TURN = 6;

/** First turn on which Climax phase + Vurmox pin fire (acceptance b). */
export const CLIMAX_PHASE_TURN = 9;

/** First turn on which the co-op softclock can fire (amendment A4). */
export const SOFTCLOCK_TURN = 10;

/**
 * Shared-embertide count below which the softclock fires at turn 10+.
 * Strict less-than: a total of exactly 2 does NOT trigger (acceptance e).
 */
export const SOFTCLOCK_SHARD_FLOOR = 2;

/**
 * The canonical id of the v2.0 final-fight region boss. Load-bearing for
 * `shouldPinVurmox`. Exported so tests can reference it by constant
 * rather than string-literal and so future unit renames remain greppable.
 *
 * Also asserted to match `ZONE_METADATA['gilded-cage'].regionBossId`
 * (see `src/rules/zones.ts`) by the sessionArc test suite — a divergence
 * there would silently break the Climax pin.
 */
export const VURMOX_ID = 'cagewright-vurmox';

/**
 * Compute the current session-arc phase from `turn`.
 *
 * Invariant: phase is monotonic non-decreasing as `turn` grows — once
 * Climax is reached it cannot regress. Testing relies on this.
 */
export function sessionPhase(turn: number): SessionPhase {
  if (turn >= CLIMAX_PHASE_TURN) return 'Climax';
  if (turn >= BOSS_PHASE_TURN) return 'Boss';
  if (turn >= RISING_PHASE_TURN) return 'Rising';
  return 'Stirring';
}

/**
 * Count how many shards are currently granted in `sharedEmbertide`.
 * Pure + branchless-ish — used by the softclock gate.
 */
function embertideCount(t: SharedEmbertide): number {
  return (t.wisdom ? 1 : 0) + (t.courage ? 1 : 0) + (t.power ? 1 : 0);
}

/**
 * Are wild-boss spawns allowed in `zoneId` given the current session
 * phase? Returns true in Rising, Boss, and Climax phases; false in
 * Stirring (the zone is still being set up and the wild-boss slot
 * renders a dormant placeholder in the UI per gm0.9).
 *
 * The `zoneId` parameter is reserved for future per-zone gating —
 * today's gate is purely turn-based per REQ-19. The wild-slot's FIFO
 * queue is orthogonal: `currentWildBossForZone` (in
 * `src/rules/zones.ts`) returns the next wild-boss id regardless of
 * phase; THIS helper answers whether engagement is session-arc-eligible.
 */
export function canSpawnWildBossInZone(state: KidGameState, _zoneId: ZoneId): boolean {
  void _zoneId;
  const phase = sessionPhase(state.turn);
  return phase === 'Rising' || phase === 'Boss' || phase === 'Climax';
}

/**
 * Are region-boss spawns allowed in `zoneId` given the current session
 * phase? Returns true in Boss + Climax phases; false in Stirring +
 * Rising. The region (Dungeon) boss appears one phase later than the
 * wild boss per REQ-19 — wild is the Rising gate, region is the Boss
 * gate.
 *
 * This is the PHASE gate only. The boss-key gate (gm0.12,
 * `canSpawnRegionBoss` in `src/store/slices/zones.ts`) is a separate
 * predicate — both must return true before region-slot engagement is
 * allowed. Callers that combine them live in `gameStore.ts`
 * (`engageRegionBossSlot`).
 */
export function canSpawnRegionBossByPhase(state: KidGameState, _zoneId: ZoneId): boolean {
  void _zoneId;
  const phase = sessionPhase(state.turn);
  return phase === 'Boss' || phase === 'Climax';
}

/**
 * Should the Climax-phase Vurmox pin fire? True iff:
 *   (1) phase is Climax (turn >= 9), AND
 *   (2) currentZone === 'gilded-cage', AND
 *   (3) Vurmox is not already in `state.field`.
 *
 * The "not already in field" check uses `state.field.some(c => c.id ===
 * VURMOX_ID || (c as { baseId?: string }).baseId === VURMOX_ID)` so a
 * duplicate-suffixed supply copy still counts as already-pinned.
 */
export function shouldPinVurmox(state: KidGameState): boolean {
  if (sessionPhase(state.turn) !== 'Climax') return false;
  if (state.currentZone !== 'gilded-cage') return false;
  const alreadyPinned = state.field.some((c) => {
    const base = (c as Card & { baseId?: string }).baseId ?? c.id;
    return base === VURMOX_ID;
  });
  return !alreadyPinned;
}

/**
 * Append `vurmoxCard` to `state.field` iff `shouldPinVurmox(state)` is
 * true. Pure — returns the input state unchanged otherwise. Callers
 * must pass the canonical Vurmox card (from KID_CARDS or supply); this
 * helper does not reach into the card dataset to keep the slice free of
 * data-layer imports.
 */
export function applyVurmoxPin(state: KidGameState, vurmoxCard: Card): KidGameState {
  if (!shouldPinVurmox(state)) return state;
  return { ...state, field: [...state.field, vurmoxCard] };
}

/**
 * Is the Climax phase currently stalled waiting for the party to reach
 * Gilded Cage? True iff phase is Climax and the current zone is NOT
 * gilded-cage. UI layer observes this to render the "Climax — reach
 * Gilded Cage" banner (acceptance c). Does not itself mutate state.
 */
export function isClimaxStalled(state: KidGameState): boolean {
  return sessionPhase(state.turn) === 'Climax' && state.currentZone !== 'gilded-cage';
}

/**
 * Cumulative softclock HP-easier bonus at the current turn (amendment A4).
 *
 * Fires at the start of turn 10+ when `sharedEmbertide` total is strictly
 * less than `SOFTCLOCK_SHARD_FLOOR` (= 2). Grows by 1 per subsequent
 * turn (acceptance f): turn 10 → 1, turn 11 → 2, turn 12 → 3, …
 *
 * Returns 0 when the gate condition is not met (either turn < 10 or
 * shared-embertide count >= 2). The gate is re-evaluated every turn —
 * if the party flips the second shard after the softclock has started
 * firing, the discount snaps back to 0 the next turn. This is the
 * design-intended reward for catching up.
 *
 * Consumers interpret the returned value as a deduction to un-claimed
 * wild/region-boss effective cost (or equivalently a bonus to their
 * monster-drop heal) — u-7 does not prescribe the exact consumer
 * pathway since no v2.0 code presently consumes it; the value is made
 * deterministic + testable here so downstream wiring is mechanical.
 */
export function softclockHpEase(state: KidGameState): number {
  if (state.turn < SOFTCLOCK_TURN) return 0;
  const shardCount = embertideCount(state.sharedEmbertide);
  if (shardCount >= SOFTCLOCK_SHARD_FLOOR) return 0;
  return state.turn - CLIMAX_PHASE_TURN; // turn 10 → 1, turn 11 → 2, …
}
