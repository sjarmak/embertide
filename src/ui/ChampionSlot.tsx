import type { CSSProperties, JSX } from 'react';
import { motion } from 'framer-motion';
import type { KidPlayer, ChampionId } from '../store/types';
import { findChampion } from '../data/champions';
import { illustrationForChampion } from './CardArt';
import ArtPendingFrame from './ArtPendingFrame';
import './ChampionSlot.css';

export interface ChampionSlotProps {
  readonly player: KidPlayer;
  readonly isActive?: boolean;
}

/**
 * Champion tile pulse tuning (u-2c). The tile replays its glow + particle
 * animation every time `player.championPassivePulse` increments; the exact
 * number is opaque to this component (React's `key` remounts the motion
 * node so framer-motion re-runs `animate` from the `initial` state).
 */
const PULSE_DURATION_MS = 600;

/**
 * Champion-tint palette. One CSS color per champion for the pulse glow
 * (u-2c acceptance — "champion-tinted glow"). Values point at existing
 * Elysian Cathedral jewel tokens so Art governance stays honored; fallback
 * hex is a darker cousin for the rare case where the token isn't available.
 */
const TINT_BY_CHAMPION: Record<ChampionId, string> = {
  'champion-courage': 'var(--hc-jewel-emerald-400, #4fae69)',
  'champion-wisdom': 'var(--hc-jewel-sapphire-400, #6193c9)',
  'champion-power': 'var(--hc-jewel-ruby-400, #c25a74)',
  'champion-sword': 'var(--hc-jewel-topaz-400, #d7b25a)',
};

const PULSE_INITIAL = {
  opacity: 0.9,
  scale: 0.85,
  boxShadow: '0 0 0 0 rgba(255,255,255,0)',
};
const PULSE_ANIMATE = {
  opacity: 0,
  scale: 1.25,
  boxShadow: '0 0 12px 6px currentColor',
};
const PULSE_TRANSITION = {
  duration: PULSE_DURATION_MS / 1000,
  ease: 'easeOut' as const,
};

const PULSE_STYLE: CSSProperties = {
  color: '',
};

/**
 * Build the tooltip text shown on hover. Surfaces the champion's display
 * name, passive-ability effect, and current HP / max HP so the designer's
 * "tells you what their effect is" requirement is honored without
 * cluttering the emblem with overlay text.
 */
function buildTooltip(
  displayName: string,
  passiveDescription: string,
  hp: number,
  hpMax: number,
): string {
  return `${displayName}\n${passiveDescription}\nHP ${hp}/${hpMax}`;
}

/**
 * ChampionSlot — dedicated tray tile for the player's chosen champion
 * (u-2c / REQ-3). Renders the champion portrait inside a brass-bordered
 * emblem; the champion's display name and passive-ability description
 * surface on hover via the `title` attribute (designer polish 2026-04-22
 * Issue 4).
 *
 * Replays a champion-tinted glow pulse every time `player.championPassivePulse`
 * bumps — the bump happens at each passive-fire call site:
 *   - power/sword:  src/store/slices/endgame.ts applyChampionPower (Upkeep)
 *   - wisdom:       src/store/gameStore.ts advancePhase 'Draw' branch
 *   - courage/sword:src/store/slices/combat.ts on mini/final-boss defeat
 *
 * When `player.championSlot` is null (edge case — never in the normal
 * initGame flow), renders an [v2-art-pending] placeholder so the tray
 * still reserves its real-estate.
 */
export default function ChampionSlot({ player, isActive = false }: ChampionSlotProps): JSX.Element {
  const slot = player.championSlot;
  if (slot === null) {
    return (
      <div
        data-testid={`champion-slot-${player.id}`}
        className="champion-slot"
        data-active={isActive ? 'true' : 'false'}
      >
        <ArtPendingFrame>
          <span>No champion</span>
        </ArtPendingFrame>
      </div>
    );
  }

  const champion = findChampion(slot);
  const displayName = champion?.displayName ?? slot;
  const passiveDescription = champion?.passiveDescription ?? '';
  // Designer feedback 2026-04-24: portrait + name plate now mirrors the
  // Setup champion pick tile (art on top, parchment plate with display
  // name below). 96px portrait keeps the raster sharp in the narrow
  // main-board tray cell without overflowing the plate.
  const portrait = illustrationForChampion(slot, 96);
  const tint = TINT_BY_CHAMPION[slot];
  const tooltip = buildTooltip(displayName, passiveDescription, player.hp, player.hpMax);

  return (
    <div
      data-testid={`champion-slot-${player.id}`}
      data-champion-slot={slot}
      data-active={isActive ? 'true' : 'false'}
      aria-label={`Champion: ${displayName}. ${passiveDescription}`}
      title={tooltip}
      className="champion-slot"
    >
      <div className="champion-slot-portrait">{portrait}</div>
      <div className="champion-slot-plate">
        <span data-testid={`champion-slot-${player.id}-name`} className="champion-slot-name">
          {displayName}
        </span>
      </div>
      <motion.span
        aria-hidden="true"
        data-testid={`champion-slot-${player.id}-pulse`}
        key={player.championPassivePulse}
        className="champion-slot-pulse"
        style={{ ...PULSE_STYLE, color: tint }}
        initial={PULSE_INITIAL}
        animate={PULSE_ANIMATE}
        transition={PULSE_TRANSITION}
      />
    </div>
  );
}
