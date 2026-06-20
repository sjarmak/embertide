import type { CSSProperties, JSX } from 'react';
import { motion, type Transition } from 'framer-motion';
import { GENERIC_THEME } from '../theme/generic';
import { findChampion } from '../data/champions';
import { EASE } from '../motion/easings';
import { DUR } from '../motion/durations';

export interface TurnBannerProps {
  /**
   * 0-indexed active player index from state.currentPlayerIndex. Displayed
   * as 1-indexed in the banner ("Player 1", "Player 2", ...).
   */
  readonly currentPlayerIndex: number;
  /**
   * Current game turn (state.turn).
   */
  readonly turn: number;
  /**
   * Optional champion id for the active player (embertide-57p). Used
   * to surface a display name like "Valor Warden". Falls back to the raw
   * id, then to a generic "Player N" label.
   */
  readonly championId?: string;
}

const CHAMPION_GLOW_VAR: Record<string, string> = {
  'champion-courage': 'var(--hc-champion-courage-glow)',
  'champion-wisdom': 'var(--hc-champion-wisdom-glow)',
  'champion-power': 'var(--hc-champion-power-glow)',
  'champion-sword': 'var(--hc-champion-sword-glow)',
};

function labelFor(championId: string | undefined): string | null {
  if (!championId) return null;
  const champion = findChampion(championId);
  if (champion) return champion.displayName;
  // Defensive probe: GENERIC_THEME is keyed by CardRole, but we try an
  // opportunistic lookup so a caller passing a matching key gets a themed
  // name. Otherwise we fall back to the raw id.
  const themed = (GENERIC_THEME as Record<string, string>)[championId];
  if (themed) return themed;
  return championId;
}

function glowFor(championId: string | undefined): string {
  if (!championId) return 'var(--hc-glow-amber)';
  return CHAMPION_GLOW_VAR[championId] ?? 'var(--hc-glow-amber)';
}

const ROOT_STYLE: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
};

const SWEEP_BASE_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  mixBlendMode: 'screen',
};

/**
 * Light-sweep transition for the champion-tinted overlay. Extracted to a
 * named constant so the `hc/no-inline-framer-transition` rule passes —
 * motion durations / easings live in `src/motion/` and the spread here
 * keeps the single-source-of-truth contract.
 */
const SWEEP_TRANSITION: Transition = {
  duration: DUR.dramatic / 1000,
  ease: [...EASE.glassGlide] as [number, number, number, number],
};

/**
 * Top-of-board banner announcing whose turn it is. Large, centered, and
 * visible from across the table so non-readers can tell the game state at
 * a glance (issue embertide-2l9).
 *
 * Motion (embertide-4m5.3): on turn change the banner re-mounts and
 * runs `bannerVariants.enter` (heroicSpring drop-in) plus a champion-tinted
 * light-sweep from left to right (motion.md §4.8). Prefers-reduced-motion
 * is honored by the app-level <MotionConfig reducedMotion="user"> wrapper —
 * Framer skips animations and renders the resting state directly.
 *
 * IP-safety: uses generic "Player N" phrasing; falls back to the themed
 * champion display name or raw id — never hard-codes franchise names.
 */
export default function TurnBanner({
  currentPlayerIndex,
  turn,
  championId,
}: TurnBannerProps): JSX.Element {
  const championLabel = labelFor(championId);
  const playerNumber = currentPlayerIndex + 1;
  const playerName = `Player ${playerNumber}`;
  const text = championLabel
    ? `${playerName} (${championLabel}) — Turn ${turn}`
    : `${playerName} — Turn ${turn}`;

  const sweepStyle: CSSProperties = {
    ...SWEEP_BASE_STYLE,
    background: `linear-gradient(100deg, transparent 0%, ${glowFor(championId)} 50%, transparent 100%)`,
  };

  // Re-mount on turn / player change so `initial` fires fresh.
  const motionKey = `${currentPlayerIndex}-${turn}`;

  return (
    <motion.div
      key={motionKey}
      data-testid="turn-banner"
      className="turn-banner"
      role="status"
      aria-live="polite"
      style={ROOT_STYLE}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={EASE.heroicSpring}
    >
      <motion.span
        aria-hidden="true"
        data-testid="turn-banner-sweep"
        style={sweepStyle}
        initial={{ x: '-120%', opacity: 0 }}
        animate={{ x: '120%', opacity: [0, 1, 0] }}
        transition={SWEEP_TRANSITION}
      />
      <span data-testid="turn-banner-text">{text}</span>
    </motion.div>
  );
}
