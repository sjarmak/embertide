/**
 * Elysian Cathedral motion durations.
 *
 * All values are in **milliseconds**. Framer Motion's `transition.duration`
 * field is in seconds, so call sites divide by 1000 (e.g.,
 * `duration: DUR.base / 1000`). Keeping the canonical scale in ms matches
 * how UI engineers reason about time and aligns with CSS keyframe authoring.
 *
 * Spec: .claude/design/elysian-cathedral/motion.md §2.
 */
export const DUR = {
  /** 120 ms — hover tints, focus ring appearance. */
  flick: 120,

  /** 200 ms — card hover lift, button press. */
  quick: 200,

  /** 320 ms — card play, zone transitions, counter pulse. */
  base: 320,

  /** 520 ms — chest open, modal enter, banner flash. */
  reveal: 520,

  /** 880 ms — final-boss entrance. */
  dramatic: 880,

  /** 4000+ ms — idle loops (lock-pulse). */
  ambient: 4000,
} as const;

export type DurationToken = keyof typeof DUR;
