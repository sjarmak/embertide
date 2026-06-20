import { type ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';

/**
 * Top-level Framer Motion configuration wrapper.
 *
 * Mounts a `<MotionConfig reducedMotion="user">` so every descendant
 * `motion.*` component honors the user's `prefers-reduced-motion` media
 * query without needing per-component handling. This is required by
 * .claude/design/elysian-cathedral/motion.md §6.
 *
 * **Status (T-5):** Component is exported but NOT mounted in App.tsx —
 * V-1 mounts it. T-5 only ships the building block; mounting is gated
 * on V-1 also installing HyrulianDefs and the typography stylesheet.
 */
export interface MotionRootProps {
  children: ReactNode;
}

export function MotionRoot({ children }: MotionRootProps) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
