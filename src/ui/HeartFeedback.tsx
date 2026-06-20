import type { JSX } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export interface HeartFeedbackProps {
  readonly playerId: string;
  /**
   * Signed delta. Positive = HP gain (renders `+N` in warm gold,
   * drifts UP). Negative = HP loss (renders `-N` in ruby red, drifts
   * UP with a horizontal shake stagger). Zero renders nothing.
   */
  readonly delta: number;
}

const INITIAL = { opacity: 0, y: 0, scale: 0.8 };
const ANIMATE_GAIN = { opacity: 1, y: -18, scale: 1 };
const ANIMATE_LOSS = { opacity: 1, y: -18, scale: 1.08, x: [0, -3, 3, -2, 2, 0] };
const EXIT = { opacity: 0, y: -28 };
const TRANSITION = { duration: 0.8, ease: 'easeOut' as const };

/**
 * Floating delta tag next to the HP counter for both gains (+N) and
 * losses (-N). Purely visual — never mutates engine state.
 *
 * Added for embertide-9c7 as a "+N" gain float; rev-2 2026-04-22
 * extended it to render "-N" loss feedback in ruby red with a small
 * horizontal shake so boss damage is visibly registered (player
 * feedback: "when the boss deals damage it doesn't show anything
 * happening to your hearts"). The same component handles both
 * directions so the consumer's effect hook stays simple — pass the
 * signed delta.
 *
 * Renders nothing when `delta === 0`.
 */
export default function HeartFeedback({ playerId, delta }: HeartFeedbackProps): JSX.Element | null {
  if (delta === 0) return null;
  const isLoss = delta < 0;
  const label = isLoss ? `${delta}` : `+${delta}`;
  return (
    <AnimatePresence>
      <motion.span
        key={`${playerId}-${delta}`}
        data-testid={`heart-feedback-${playerId}`}
        data-direction={isLoss ? 'loss' : 'gain'}
        className={isLoss ? 'heart-feedback heart-feedback-loss' : 'heart-feedback'}
        initial={INITIAL}
        animate={isLoss ? ANIMATE_LOSS : ANIMATE_GAIN}
        exit={EXIT}
        transition={TRANSITION}
        aria-hidden="true"
      >
        {label}
      </motion.span>
    </AnimatePresence>
  );
}
