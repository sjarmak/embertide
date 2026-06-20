import { useEffect, type CSSProperties, type JSX } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Chest, Heart, Hero, Sword, Shield } from '../icons';
import type { ChestReward } from '../rules/chestPool';
import type { Card } from '../types/card';
import { DUR } from '../motion/durations';
import { EASE } from '../motion/easings';
import { illustrationForBaseId } from './CardArt';
import CardTemplate from './CardTemplate';

export interface ChestRevealProps {
  readonly reward: ChestReward | string;
  /**
   * Resolved Card minted alongside the reward (embertide-ymgc).
   * When provided for a card-grant reward (`'hero'` / `'item'` /
   * `'premium-item'` / `'wisp'`) the popup renders the actual rolled
   * card via `CardTemplate` so the player sees the same art they will
   * draw / play later. `null` / `undefined` falls through to the legacy
   * `RewardIcon` path used by heart-only rolls and as a defensive
   * fallback if a caller forgets to thread the card.
   */
  readonly card?: Card | null;
  readonly onComplete: () => void;
}

// Exhaustive over `ChestReward` (embertide-1xw7): the `satisfies` clause
// makes the compiler reject this file if a future ChestReward variant is
// added without a label/subtext entry — preventing the silent-missing-key
// bug class that produced literal lowercase 'wisp' in production. The
// lookup site widens to Record<string, string> because the prop accepts
// `ChestReward | string` (defensive — see ChestRevealProps.reward).
const REWARD_LABELS = {
  heart: '+1 Heart',
  'double-heart': '+2 Hearts',
  hero: 'New Champion',
  item: 'Relic',
  // bead embertide-0ku5: category label, NOT a card-face name —
  // pickPremiumItem rolls Ancient Blade OR Great Wisp, so the label
  // must cover both (memory: embertide-designer-ruling-premium-item-label-2026-05-05).
  'premium-item': 'Treasure',
  // bead embertide-063: gm0.16 ember-shard / vital-ember rewards.
  'ember-shard': 'Ember Shard',
  'vital-ember': 'Vital Ember',
  // bead embertide-1xw7: category label paired with card-face name
  // ('Wisp' label + 'Wisp in Bottle' card name), mirroring 'Relic' + card.
  wisp: 'Wisp',
} as const satisfies Record<ChestReward, string>;

const REWARD_SUBTEXT = {
  heart: 'Added to your count',
  'double-heart': 'Added to your count',
  hero: 'Added to your discard',
  item: 'Added to your Relics',
  'premium-item': 'Added to your Relics',
  'ember-shard': 'Collect 4 to earn a vital ember',
  'vital-ember': '+1 max HP + full heal',
  wisp: 'Added to your Items',
} as const satisfies Record<ChestReward, string>;

// 4m5.d.1 (embertide-4m5.2): hold = reveal-anim (telegraph→settle) +
// dramatic read-beat. Both come from the canonical DUR scale so the
// "no hardcoded ms" rule is honored end-to-end. Total ≈ 1400ms — a
// gentle tightening from the prior 1600 hardcoded value, well within
// kid-readable range for the reward label.
const HOLD_MS = DUR.reveal + DUR.dramatic;

const REWARD_ICON_SIZE = 72;

/**
 * Reward types that mint a real Card (hero / item / premium-item / wisp).
 * When `card` is provided for these, the reveal swaps the generic icon
 * shell for a full `CardTemplate` so the player sees the actual art.
 */
const CARD_REWARD_KINDS: ReadonlySet<string> = new Set(['hero', 'item', 'premium-item', 'wisp']);

/**
 * CardTemplate illustration size inside the reveal — slightly tighter
 * than the 240px detail-modal size so the reward popup fits a 1280x800
 * viewport with comfortable margin.
 */
const REVEAL_CARD_ART_SIZE = 168;

/**
 * 4m5.d.1 — three-stage reveal choreography (telegraph → unlock → settle)
 * driven by Framer Motion `times` keyframes. Total runtime is `DUR.reveal`
 * (520ms) — within the ~600ms target called out in the bead and within
 * the kid-6yo "rewarding, not scary" tone bar (no jump-scare flash).
 *
 * Frame 0 (t=0) — telegraph / anticipation: scale 0.86, slight CCW rotate.
 * Frame 1 (t≈0.55) — unlock cue: gentle overshoot to 1.04 with rotate to
 *   the opposite side (~+1°) so the card visibly "snaps" past the rest
 *   position before settling.
 * Frame 2 (t=1) — settle: scale 1, rotate 0, fully opaque.
 *
 * Easing is `EASE.inkWash` — the canonical "quiet UI" cubic-bezier, kept
 * out of the spring family so the reveal reads as a deliberate flourish
 * rather than a bouncy toy. Reduced-motion users skip these keyframes
 * entirely (see `useReducedMotion` branch below).
 */
// Framer Motion's `animate` / `transition` props expect mutable arrays
// for keyframe lists. The `ease` field accepts a 4-tuple cubic-bezier
// rather than a generic `number[]`, so we keep it as a tuple — sourced
// from the canonical EASE module — and only widen the keyframe arrays.
type CubicBezier = [number, number, number, number];

const REVEAL_ANIMATE_KEYFRAMES = {
  scale: [0.86, 1.04, 1],
  rotate: [-6, 1, 0],
  opacity: [0, 1, 1],
};

const REVEAL_TRANSITION = {
  duration: DUR.reveal / 1000,
  times: [0, 0.55, 1],
  ease: [...EASE.inkWash] as CubicBezier,
};

/**
 * Reduced-motion path: a single static frame at the rest pose. No
 * keyframes, no scale/rotate animation — the panel mounts at scale 1
 * with full opacity so the reward is immediately visible. Sparkles are
 * suppressed by the reduced-motion check below.
 */
const REVEAL_STATIC_ANIMATE = { scale: 1, rotate: 0, opacity: 1 };
const REVEAL_STATIC_TRANSITION = { duration: 0 };

/**
 * Sparkle layer choreography — 4 amber spark glyphs that radiate outward
 * from the panel center over `DUR.reveal` (520ms). Palette aligned with
 * the cost-gem family per the bead's sparkle requirement: amber jewel
 * stops + the canonical `--hc-glow-amber` glow alpha. Each spark uses
 * the same keyframe shape but different `--sparkle-angle` so the burst
 * reads as a radial arrangement rather than a column.
 *
 * Suppressed entirely when `prefers-reduced-motion` is set.
 */
const SPARKLE_COUNT = 4;
const SPARKLE_ANIMATE = {
  opacity: [0, 1, 0],
  scale: [0.4, 1.15, 0.6],
};
const SPARKLE_TRANSITION = {
  duration: DUR.reveal / 1000,
  times: [0, 0.55, 1],
  ease: [...EASE.glassGlide] as CubicBezier,
};

function RewardIcon({ reward }: { reward: string }): JSX.Element {
  // bead embertide-063: surface bespoke ember-shard / vital-ember
  // rasters for gm0.16 drops. Both base IDs are registered in
  // SPEC_BY_BASE_ID; the switch's `default: <Chest>` is an unreachable
  // safety net.
  if (reward === 'ember-shard' || reward === 'vital-ember') {
    const illustration = illustrationForBaseId(reward, REWARD_ICON_SIZE);
    if (illustration) return illustration;
  }
  switch (reward) {
    case 'heart':
    case 'double-heart':
      return <Heart size={REWARD_ICON_SIZE} />;
    case 'hero':
      return <Hero size={REWARD_ICON_SIZE} />;
    case 'item':
      return <Shield size={REWARD_ICON_SIZE} />;
    case 'premium-item':
      return <Sword size={REWARD_ICON_SIZE} />;
    default:
      return <Chest size={REWARD_ICON_SIZE} />;
  }
}

function SparkleBurst(): JSX.Element {
  // Fixed angles so the four sparks form a balanced cross-burst around
  // the reward (top-left / top-right / bottom-left / bottom-right). Each
  // angle is consumed by `.chest-reveal-sparkle` via the `--sparkle-angle`
  // custom property — see the matching block in src/styles/app.css.
  const angles = [-58, 58, 122, -122];
  return (
    <div className="chest-reveal-sparkles" data-testid="chest-reveal-sparkles" aria-hidden="true">
      {angles.slice(0, SPARKLE_COUNT).map((angle, index) => (
        <motion.span
          key={index}
          className="chest-reveal-sparkle"
          style={{ '--sparkle-angle': `${angle}deg` } as CSSProperties}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={SPARKLE_ANIMATE}
          transition={SPARKLE_TRANSITION}
        />
      ))}
    </div>
  );
}

/**
 * Chest-reveal animation (embertide-z3z). Pops a Framer-Motion
 * three-stage choreography (telegraph → unlock → settle) on the reward
 * panel, holds for `HOLD_MS`, then fires `onComplete` so the parent can
 * clear the pending-reward state. Click anywhere on the panel to
 * dismiss early.
 *
 * embertide-ymgc (2026-04-26): when a card-grant reward
 * (`'hero'` / `'item'` / `'premium-item'` / `'wisp'`) ships with the
 * resolved `card`, the reveal renders the actual rolled card art via
 * `CardTemplate` instead of a generic placeholder icon — so a kid sees
 * the same illustration they will later draw / play. Heart-only rewards
 * keep the bespoke icon path.
 *
 * embertide-4m5.2 (4m5.d.1, 2026-05-08): polish pass — animation
 * now reads as telegraph → unlock → settle with `EASE.inkWash` over
 * `DUR.reveal` (520ms). An amber sparkle burst (cost-gem palette via
 * `--hc-glow-amber` + `--hc-jewel-amber-300`) layers under the reward
 * during the same window. `useReducedMotion` collapses both the
 * keyframe choreography and the sparkle layer to a static single-frame
 * mount so the reduced-motion path remains a quiet, jank-free reveal.
 */
export default function ChestReveal({
  reward,
  card = null,
  onComplete,
}: ChestRevealProps): JSX.Element {
  const rewardKey = String(reward);
  const label = (REWARD_LABELS as Record<string, string>)[rewardKey] ?? rewardKey;
  const subtext = (REWARD_SUBTEXT as Record<string, string>)[rewardKey] ?? '';
  const showCard = card !== null && CARD_REWARD_KINDS.has(rewardKey);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const timer = setTimeout(onComplete, HOLD_MS);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const animate = reducedMotion ? REVEAL_STATIC_ANIMATE : REVEAL_ANIMATE_KEYFRAMES;
  const transition = reducedMotion ? REVEAL_STATIC_TRANSITION : REVEAL_TRANSITION;

  return (
    <motion.button
      type="button"
      data-testid="chest-reveal"
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      className="chest-reveal"
      initial={{ scale: 0.86, rotate: -6, opacity: 0 }}
      animate={animate}
      transition={transition}
      onClick={onComplete}
      aria-label={`Chest reward: ${label}. Click to dismiss.`}
    >
      {!reducedMotion ? <SparkleBurst /> : null}
      {showCard && card ? (
        <div className="chest-reveal-card" data-testid="chest-reveal-card">
          <CardTemplate card={card} illustrationSize={REVEAL_CARD_ART_SIZE} />
        </div>
      ) : (
        <div className="chest-reveal-icon" data-testid="chest-reveal-icon">
          <RewardIcon reward={rewardKey} />
        </div>
      )}
      <div className="chest-reveal-label">{label}</div>
      {subtext ? <div className="chest-reveal-subtext">{subtext}</div> : null}
    </motion.button>
  );
}
