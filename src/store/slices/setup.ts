/**
 * Setup slice helpers (u-2c / REQ-3).
 *
 * The `initGame` entry point in `gameStore.ts` remains the canonical
 * setup pipeline (deck build, opening-hand draw, supply shuffle, zone
 * bootstrap). This slice only factors out the champion-identity bits so
 * the ChampionId type-narrowing invariant is enforced in one place and
 * reused by tests + UI helpers without needing to import from gameStore.
 */

import type { ChampionId } from '../types';
import { KID_CHAMPIONS } from '../../data/champions';

/**
 * Canonical list of valid champion ids. Source of truth is `KID_CHAMPIONS`
 * in `src/data/champions.ts`; this cast narrows the loose `string` id to
 * the `ChampionId` union at load time. The cast is safe because every
 * KID_CHAMPIONS entry's id is authored as one of the four union members.
 */
export const CHAMPION_IDS: readonly ChampionId[] = KID_CHAMPIONS.map((c) => c.id as ChampionId);

const CHAMPION_ID_SET: ReadonlySet<string> = new Set(CHAMPION_IDS);

/** Type guard — true when `id` is one of the four declared champion ids. */
export function isChampionId(id: string | null | undefined): id is ChampionId {
  return typeof id === 'string' && CHAMPION_ID_SET.has(id);
}

/**
 * Narrow a loose champion id (as carried on the legacy `KidPlayer.championId`
 * string field or the `GameConfig.championIds` setup payload) to the tight
 * `ChampionId | null` type used by the dedicated passive slot. Returns null
 * when the input is unrecognized — callers decide whether to throw or
 * degrade gracefully.
 */
export function resolveChampionSlot(id: string | null | undefined): ChampionId | null {
  return isChampionId(id) ? id : null;
}
