/**
 * Elysian Cathedral motion easings.
 *
 * Source of truth for all Framer Motion `transition.ease` and
 * `transition: { type: 'spring', … }` values used across the app.
 *
 * Spec: .claude/design/elysian-cathedral/motion.md §1.
 *
 * Cubic-bezier arrays are emitted as `[x1, y1, x2, y2]` and are accepted
 * by Framer Motion's `ease` field directly. Spring objects can be passed
 * to `transition` as a whole.
 *
 * The custom ESLint rule `hc/no-inline-framer-transition` forbids inline
 * `transition={…}` props on motion components — every variant or component
 * must reference EASE here so motion design is changed in exactly one place.
 */
export const EASE = {
  // ---------------------------------------------------------------------------
  // Cubic-bezier easings — primary curves.
  // ---------------------------------------------------------------------------

  /** Ease-out with a slight overshoot. Default for card enters and quiet UI. */
  inkWash: [0.22, 0.61, 0.36, 1.0],

  /** Smooth reveal, no overshoot. For hover states and shimmer slides. */
  glassGlide: [0.45, 0.0, 0.22, 1.0],

  /** Ease-in for press / sink interactions (button down, card press). */
  sink: [0.55, 0.06, 0.68, 0.19],

  /** Slow-start, hard-finish — reserved for boss / final-boss reveals. */
  ominous: [0.32, 0.0, 0.0, 1.0],

  // ---------------------------------------------------------------------------
  // Spring configs — pass directly as `transition: EASE.<name>`.
  // ---------------------------------------------------------------------------

  /** Soft, settled bounce — counter pulses, selected state. */
  gentleSpring: { type: 'spring', stiffness: 260, damping: 28, mass: 0.9 },

  /** Crisper response — feedback that needs to feel decisive. */
  firmSpring: { type: 'spring', stiffness: 420, damping: 32, mass: 0.8 },

  /** Pronounced bounce — counter pulses celebrating gains. */
  bouncySpring: { type: 'spring', stiffness: 520, damping: 18, mass: 0.6 },

  /** Heavy, ceremonial entrance — TurnBanner. */
  heroicSpring: { type: 'spring', stiffness: 180, damping: 22, mass: 1.2 },
} as const;

export type EaseToken = keyof typeof EASE;
