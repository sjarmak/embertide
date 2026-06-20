import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { currentRegionBossForZone, currentWildBossForZone } from '../rules/zones';
import { canSpawnRegionBoss } from '../store/slices/zones';
import {
  BOSS_PHASE_TURN,
  RISING_PHASE_TURN,
  canSpawnRegionBossByPhase,
  canSpawnWildBossInZone,
  sessionPhase,
} from '../store/slices/session';
import { KID_CARDS } from '../data/cards';
import type { Card } from '../types/card';
import type { ZoneId } from '../store/types';

/**
 * Discriminated union of every state the wild encounter slot can land in.
 *
 *   - dormant : Stirring phase (turns 1-2) — slot has not yet woken.
 *   - cleared : every wild boss in the active zone is defeated.
 *   - live    : Rising / Boss / Climax with a live wild boss bound to the slot.
 */
export type WildSlotState =
  | {
      readonly kind: 'dormant';
      readonly unlockTurn: number;
      readonly phaseLabel: string;
      readonly zoneId: ZoneId;
    }
  | { readonly kind: 'cleared'; readonly zoneId: ZoneId }
  | {
      readonly kind: 'live';
      readonly card: Card;
      readonly zoneId: ZoneId;
      readonly engage: () => void;
    };

/**
 * Discriminated union of every state the region encounter slot can land in.
 *
 *   - cleared      : the region boss is already defeated.
 *   - phase-locked : session-arc phase gate (Stirring / Rising) — clock-based.
 *   - key-locked   : every core wild-boss key for the zone has not yet dropped.
 *   - live         : both gates open and a live region boss is bound to the slot.
 *
 * Precedence (mirrors the pre-refactor branch ordering): cleared dominates so
 * a defeated boss never re-renders as locked; phase-lock checks before
 * key-lock so a turn-1 player without keys sees the clock cue rather than
 * the SEALED padlock cue (rtf4 fix).
 */
export type RegionSlotState =
  | { readonly kind: 'cleared'; readonly zoneId: ZoneId }
  | { readonly kind: 'phase-locked'; readonly unlockTurn: number; readonly zoneId: ZoneId }
  | { readonly kind: 'key-locked'; readonly zoneId: ZoneId }
  | {
      readonly kind: 'live';
      readonly card: Card;
      readonly zoneId: ZoneId;
      readonly engage: () => void;
    };

export type EncounterSlotState = WildSlotState | RegionSlotState;

/**
 * Wild encounter-slot state hook.
 *
 * Reads the active zone's wild boss + session-arc phase, returns a
 * discriminated union the slot component can switch over. Side effect
 * colocated: the `wild-boss-slot-revealed` tutorial bubble fires the first
 * time `bossId !== null && !isDormant` — preserving the pre-refactor fire
 * timing exactly so the bubble lands at the moment the slot becomes
 * engageable, not while it is still dormant.
 */
export function useWildEncounterSlotState(): WildSlotState {
  const zoneId = useGameStore((s) => s.currentZone);
  const bossId = useGameStore((s) => currentWildBossForZone(s, s.currentZone));
  const isDormant = useGameStore((s) => !canSpawnWildBossInZone(s, s.currentZone));
  const phaseLabel = useGameStore((s) => sessionPhase(s.turn));
  const engageWildBossSlot = useGameStore((s) => s.engageWildBossSlot);
  const fireTutorialBubbleOnce = useGameStore((s) => s.fireTutorialBubbleOnce);

  useEffect(() => {
    if (bossId !== null && !isDormant) {
      fireTutorialBubbleOnce('wild-boss-slot-revealed');
    }
  }, [bossId, isDormant, fireTutorialBubbleOnce]);

  if (isDormant) {
    return { kind: 'dormant', unlockTurn: RISING_PHASE_TURN, phaseLabel, zoneId };
  }
  const card = bossId !== null ? KID_CARDS.find((c) => c.id === bossId) : undefined;
  if (card === undefined) {
    return { kind: 'cleared', zoneId };
  }
  return {
    kind: 'live',
    card,
    zoneId,
    engage: () => engageWildBossSlot(zoneId, card.id),
  };
}

/**
 * Region encounter-slot state hook.
 *
 * Reads the active zone's region boss + both gates (session-arc phase and
 * wild-boss-key seal), returns a discriminated union the slot component can
 * switch over. Side effect colocated: the `region-boss-slot-revealed`
 * tutorial bubble fires the first time `bossId !== null && !locked &&
 * !phaseLocked` — preserving the pre-refactor fire timing exactly so the
 * bubble lands at the moment both gates open and the slot becomes
 * engageable.
 */
export function useRegionEncounterSlotState(): RegionSlotState {
  const zoneId = useGameStore((s) => s.currentZone);
  const bossId = useGameStore((s) => currentRegionBossForZone(s, s.currentZone));
  const phaseLocked = useGameStore((s) => !canSpawnRegionBossByPhase(s, s.currentZone));
  const locked = useGameStore((s) => !canSpawnRegionBoss(s, s.currentZone));
  const engageRegionBossSlot = useGameStore((s) => s.engageRegionBossSlot);
  const fireTutorialBubbleOnce = useGameStore((s) => s.fireTutorialBubbleOnce);

  useEffect(() => {
    if (bossId !== null && !locked && !phaseLocked) {
      fireTutorialBubbleOnce('region-boss-slot-revealed');
    }
  }, [bossId, locked, phaseLocked, fireTutorialBubbleOnce]);

  const card = bossId !== null ? KID_CARDS.find((c) => c.id === bossId) : undefined;
  if (card === undefined) {
    return { kind: 'cleared', zoneId };
  }
  if (phaseLocked) {
    return { kind: 'phase-locked', unlockTurn: BOSS_PHASE_TURN, zoneId };
  }
  if (locked) {
    return { kind: 'key-locked', zoneId };
  }
  return {
    kind: 'live',
    card,
    zoneId,
    engage: () => engageRegionBossSlot(zoneId, card.id),
  };
}
