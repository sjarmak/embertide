import type { JSX } from 'react';
import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { DUR } from '../motion/durations';
import { EASE } from '../motion/easings';

export interface HeartGainFxProps {
  readonly playerId: string;
  /**
   * Positive HP delta. The component is gated on `delta > 0` — non-positive
   * values render nothing (loss feedback lives in `HeartFeedback`).
   */
  readonly delta: number;
  /**
   * Fires once the full animation cycle finishes. Lets the consumer
   * clear transient state (e.g. a `pendingGainAt` timestamp) so a
   * subsequent gain remounts the FX cleanly.
   */
  readonly onComplete?: () => void;
}

const SPARKLE_COUNT = 3;
const SPARKLE_OFFSETS_PX: readonly number[] = [-14, 0, 14];

const TOTAL_MS = DUR.base + 80; // ~400ms (A6)

const ROOT_VARIANTS = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const HALO_VARIANTS = {
  initial: { opacity: 0, scale: 0.85 },
  animate: { opacity: [0, 0.95, 0], scale: [0.85, 1.18, 1.0] },
};

const ROOT_TRANSITION = EASE.gentleSpring;
const HALO_TRANSITION = { duration: DUR.base / 1000, ease: EASE.inkWash };

const sparkleVariant = (offsetX: number) => ({
  initial: { opacity: 0, x: offsetX * 0.4, y: 4, scale: 0.6 },
  animate: {
    opacity: [0, 1, 0],
    x: [offsetX * 0.4, offsetX, offsetX * 1.2],
    y: [4, -10, -22],
    scale: [0.6, 1.0, 0.7],
  },
});

const sparkleTransition = (delayMs: number) => ({
  duration: TOTAL_MS / 1000,
  ease: EASE.inkWash,
  delay: delayMs / 1000,
});

/**
 * HeartGainFx — sparkle-halo flourish that fires on a positive HP delta.
 *
 * embertide-4m5.4 (4m5.d.3) — animation polish for heart gain. Sibling
 * of `HeartFeedback` (which renders the `+N` text float). Path B chosen:
 * keep HeartFeedback's signed-delta text concern single-purpose and add
 * the warm-gold sparkle + halo as a separate composable component so the
 * gain-only treatment doesn't bloat the shared `+N/-N` text float.
 *
 * Renders three sparkle particles drifting up + outward from the heart-
 * strip baseline plus a single warm-amber halo that pulses over the
 * strip — together they read as "heart-icon pulse" without requiring
 * per-socket index tracking.
 *
 * Reduced-motion (per `useReducedMotion()`): renders nothing. The HP
 * count itself is already plain text that updates instantly on store
 * change, so the user still sees the heart count-up — they just don't
 * get the sparkle/float (acceptance A4).
 *
 * `aria-hidden="true"` because the visual flourish is decorative; HP
 * change is announced via the `aria-label="hp N of M"` on the sockets
 * row.
 *
 * Renders nothing when `delta <= 0`. Pairs with HeartFeedback at the
 * same mount site (`HeartSocketsRow`).
 */
export default function HeartGainFx({
  playerId,
  delta,
  onComplete,
}: HeartGainFxProps): JSX.Element | null {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (delta <= 0) return undefined;
    if (reducedMotion) {
      // Skip the visual cycle but still fire onComplete so the consumer
      // can clear pending state symmetrically across motion modes.
      const t = setTimeout(() => onComplete?.(), 16);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => onComplete?.(), TOTAL_MS);
    return () => clearTimeout(t);
  }, [delta, reducedMotion, onComplete]);

  if (delta <= 0) return null;
  if (reducedMotion) return null;

  return (
    <AnimatePresence>
      <motion.span
        key={`${playerId}-gain`}
        data-testid={`heart-gain-fx-${playerId}`}
        data-delta={delta}
        className="heart-gain-fx"
        variants={ROOT_VARIANTS}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={ROOT_TRANSITION}
        aria-hidden="true"
      >
        <motion.span
          className="heart-gain-fx-halo"
          variants={HALO_VARIANTS}
          initial="initial"
          animate="animate"
          transition={HALO_TRANSITION}
        />
        {SPARKLE_OFFSETS_PX.slice(0, SPARKLE_COUNT).map((offset, i) => (
          <motion.span
            key={i}
            className="heart-gain-fx-sparkle"
            variants={sparkleVariant(offset)}
            initial="initial"
            animate="animate"
            transition={sparkleTransition(i * 40)}
          />
        ))}
      </motion.span>
    </AnimatePresence>
  );
}
