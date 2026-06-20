import { useEffect, useRef, useState, type CSSProperties, type JSX } from 'react';

import { HC_TOKENS } from '../theme/tokens';

import './DieRollReveal.css';

/**
 * DieRollReveal — single-die rolling animation for boss-loot drops and
 * forest-sage omen rolls (embertide-ynn4 die-roll animation pass,
 * designer ruling 2026-04-25, + embertide-x4r2 stained-glass d20
 * variant 2026-04-25).
 *
 * Replaces the prior 3-face RollCommitModal chooser. The reroll-token
 * system was removed (also ynn4); with no reroll spend the "pick 1 of 3
 * random faces" affordance was a meaningless choice — the kid had no
 * info to pick on. Single-die animation that auto-resolves on a
 * pre-rolled face is cleaner: delightful arrival → reveal → dismiss.
 *
 * Two visual variants (selected via the `dieType` prop):
 *   - 'd6'  : pip-grid die (default; used by forest-sage omen). Cream-
 *             marble face with classic 1..6 pip layout in lead-iron.
 *   - 'd20' : translucent stained-glass d20 (used by region-boss loot
 *             drop, embertide-3wd6). Sapphire-tinted pentagonal
 *             silhouette with gold leading edges, painterly tone
 *             variation across five facets, and the numeral 1..20 in
 *             gold leaf at the center.
 *
 * Visual beats (1.4s total) are identical across both variants:
 *   - 0.0s   die enters, mid-tumble; cycles random faces every
 *            ~150ms via CSS keyframes
 *   - 0.9s   die lands on the resolved `face`; brief settle wobble
 *   - 1.1s   outcome label slides in beside the die
 *   - 1.4s   tap-to-dismiss enabled (caller's onDismiss fires)
 *
 * Skip behaviour: tap anywhere after 0.5s collapses to the settled
 * state. Tap before 0.5s is ignored (prevents accidental skip from
 * a rage-tap on the previous modal closing).
 *
 * Sound spec (descriptive only — assets out of scope for this component):
 *   - tumble click: short wood-on-wood pulses while spinning
 *   - settle thunk: single low-pitched land beat
 *   - reveal chime: soft bell on outcome label fade-in
 *
 * Palette + cadence intentionally mirror `ChestReveal` (the canonical
 * "no-choice automatic loot reveal" surface in v2.1) so the two beats
 * feel like siblings — the boss-loot animation is just snappier.
 */

const FACE_DOTS: Record<number, ReadonlyArray<readonly [number, number]>> = {
  1: [[2, 2]],
  2: [
    [1, 1],
    [3, 3],
  ],
  3: [
    [1, 1],
    [2, 2],
    [3, 3],
  ],
  4: [
    [1, 1],
    [1, 3],
    [3, 1],
    [3, 3],
  ],
  5: [
    [1, 1],
    [1, 3],
    [2, 2],
    [3, 1],
    [3, 3],
  ],
  6: [
    [1, 1],
    [1, 3],
    [2, 1],
    [2, 3],
    [3, 1],
    [3, 3],
  ],
};

const TUMBLE_DURATION_MS = 900;
const SETTLE_DURATION_MS = 200;
const REVEAL_DELAY_MS = TUMBLE_DURATION_MS + SETTLE_DURATION_MS;
const TAP_TO_DISMISS_DELAY_MS = REVEAL_DELAY_MS + 300;
const SKIP_AVAILABLE_AFTER_MS = 500;

export type DieType = 'd6' | 'd20';

export interface DieRollRevealProps {
  /**
   * Pre-rolled die result the die will settle on. For d6 the valid
   * range is 1..6; for d20, 1..20. Parent owns the RNG draw (typically
   * `d6(state.rng)` or `d20(state.rng)` in the gameStore reducer);
   * passing the face in keeps this component pure + deterministic for
   * any seed.
   */
  readonly face: number;
  /**
   * Fired exactly once on tap-to-dismiss (or auto-skip after the reveal
   * phase). The parent reducer applies the outcome and clears the
   * pending state.
   */
  readonly onDismiss: () => void;
  /**
   * Headline rendered above the die ("Dungeon Boss Reward", "Forest
   * Sage Omen"). Optional — omitted for unlabeled rolls.
   */
  readonly title?: string;
  /**
   * Outcome description rendered beside the die after it settles
   * ("Loot drop!", "Legendary drop!"). The parent derives this from
   * the appropriate outcome table since the table lives next to the
   * reducer logic.
   */
  readonly outcomeLabel?: string;
  /**
   * Visual die variant. Defaults to 'd6' for backward compatibility
   * with existing callsites (forest-sage omen). Region-boss loot drop
   * passes 'd20' to render the stained-glass pentagonal die
   * (embertide-x4r2).
   */
  readonly dieType?: DieType;
}

interface PipsProps {
  readonly face: number;
}

function Pips({ face }: PipsProps): JSX.Element {
  const dots = FACE_DOTS[face] ?? [];
  return (
    <div className="die-roll-reveal-pips" data-face={face}>
      {Array.from({ length: 9 }, (_v, i) => {
        const row = Math.floor(i / 3) + 1;
        const col = (i % 3) + 1;
        const filled = dots.some(([r, c]) => r === row && c === col);
        return (
          <span
            key={i}
            data-pip-cell={`${row}-${col}`}
            className={filled ? 'die-roll-reveal-pip-filled' : 'die-roll-reveal-pip-empty'}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

/**
 * Stained-glass d20 — pentagonal silhouette with five trapezoidal
 * facets and an inner pentagon centered on the rolled numeral
 * (embertide-x4r2). The geometry is a stylized "front face" of an
 * icosahedron (the canonical tabletop d20 silhouette): five outer
 * vertices form the regular pentagon, five inner vertices form the
 * inverted inner pentagon, and the trapezoidal panes between them read
 * as faceted stained-glass leading.
 *
 * Each facet uses a slightly different sapphire gradient so the die
 * reads as painterly leaded glass rather than flat plastic — the same
 * tone-variation principle the cathedral surfaces use. Gold leading
 * (lead-gold-700) traces every edge.
 *
 * The numeral is rendered in gold leaf on the inner pentagon's cream
 * marble fill — high contrast so the result is legible at the 88px
 * footprint shared with the d6 pip die.
 */
interface D20FaceProps {
  readonly face: number;
}

function D20Face({ face }: D20FaceProps): JSX.Element {
  // 88x88 viewbox, center (44, 44), outer radius 42.
  // Outer pentagon vertices (regular, top vertex at angle -90°).
  // angles: -90°, -18°, 54°, 126°, 198°
  const outerPoints = '44,2 84,31 69,80 19,80 4,31';
  // Inner pentagon (inverted; flat top), radius 18.
  // angles: 90°, 162°, 234°, 306°, 18° → in screen coords:
  const innerPoints = '44,62 27,49 33,28 55,28 61,49';
  // Five trapezoidal facets bridging outer→inner edges (one per outer
  // edge). Listed in clockwise order starting from the top-right edge.
  const facetTopRight = '44,2 84,31 61,49 55,28';
  const facetBottomRight = '84,31 69,80 44,62 61,49';
  const facetBottom = '69,80 19,80 27,49 44,62';
  const facetBottomLeft = '19,80 4,31 33,28 27,49';
  const facetTopLeft = '4,31 44,2 55,28 33,28';

  return (
    <svg
      className="die-roll-reveal-d20"
      viewBox="0 0 88 88"
      width="88"
      height="88"
      role="img"
      aria-hidden="true"
    >
      <defs>
        {/* Five sapphire-gradient panes — wide value range across the
            five facets sells the painterly leaded-glass read (post-
            x4r2 polish: collapsed value range was reading as flat blue
            at 88px footprint). The brightest facet (top-left) sits in
            the highlight zone and pairs with the specular gloss; the
            darkest (bottom) anchors the die in shadow. */}
        <linearGradient id="d20-facet-1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8fb8ee" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#1a3568" stopOpacity="0.98" />
        </linearGradient>
        <linearGradient id="d20-facet-2" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6e9bdc" stopOpacity="0.88" />
          <stop offset="100%" stopColor="#102347" stopOpacity="0.98" />
        </linearGradient>
        <linearGradient id="d20-facet-3" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#385d9d" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#070f25" stopOpacity="0.98" />
        </linearGradient>
        <linearGradient id="d20-facet-4" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#4773b6" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0f1f3f" stopOpacity="0.98" />
        </linearGradient>
        <linearGradient id="d20-facet-5" x1="1" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#9cc1f0" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#1d3a6d" stopOpacity="0.98" />
        </linearGradient>
        {/* Cream marble center — same parchment family as the panel
            ground so the numeral reads. */}
        <radialGradient id="d20-center" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#fbf3d8" />
          <stop offset="70%" stopColor="#e6cf95" />
          <stop offset="100%" stopColor="#b88f48" />
        </radialGradient>
        {/* Specular highlight overlay — single gentle gloss across the
            top-left so the die reads as glass rather than matte. */}
        <radialGradient id="d20-gloss" cx="30%" cy="22%" r="55%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Outer pentagon backplate — soft drop-shadow + gold leading. */}
      <polygon
        points={outerPoints}
        fill="#1a2e57"
        stroke="#7a5a1e"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Five trapezoidal facets — one gradient each for tonal
          variation. Gold leading on every edge. */}
      <polygon
        points={facetTopRight}
        fill="url(#d20-facet-1)"
        stroke="#b89142"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <polygon
        points={facetBottomRight}
        fill="url(#d20-facet-2)"
        stroke="#b89142"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <polygon
        points={facetBottom}
        fill="url(#d20-facet-3)"
        stroke="#b89142"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <polygon
        points={facetBottomLeft}
        fill="url(#d20-facet-4)"
        stroke="#b89142"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <polygon
        points={facetTopLeft}
        fill="url(#d20-facet-5)"
        stroke="#b89142"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {/* Inner pentagon — cream marble face for the numeral. */}
      <polygon
        points={innerPoints}
        fill="url(#d20-center)"
        stroke="#7a5a1e"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {/* The rolled numeral. Centered on the inner pentagon's
          centroid (≈44, 41). Cinzel display font matches the other
          cathedral display copy. */}
      <text
        x="44"
        y="44"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#1a1005"
        style={{
          fontFamily: 'var(--hc-font-display)',
          fontSize: 'var(--hc-text-2xl)',
          fontWeight: 'var(--hc-font-weight-extrabold)',
          letterSpacing: HC_TOKENS.semantic['tracking-banner'],
        }}
      >
        {face}
      </text>

      {/* Top-left specular gloss — overlaid LAST so it sits above the
          facets and reads as glass surface. */}
      <polygon points={outerPoints} fill="url(#d20-gloss)" pointerEvents="none" />
    </svg>
  );
}

// Cream-toned cathedral veil — matches `.chest-reveal-backdrop` so all
// reveal surfaces share one parchment vocabulary (embertide-6846).
// Exported so the test can assert constant equality without depending on
// jsdom's CSS shorthand serializer round-tripping inline-style strings.
export const ROLL_BACKDROP_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(20, 14, 4, 0.42)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

/**
 * Phase machine: `tumble` → `settle` → `reveal` → `dismissable`. Driven
 * by setTimeout chained off the mount; React `act()` warnings are
 * silenced in tests by allowing the timers to resolve naturally rather
 * than freezing on a single phase.
 */
type Phase = 'tumble' | 'settle' | 'reveal' | 'dismissable';

export default function DieRollReveal({
  face,
  onDismiss,
  title,
  outcomeLabel,
  dieType = 'd6',
}: DieRollRevealProps): JSX.Element {
  const [phase, setPhase] = useState<Phase>('tumble');
  const [skipAvailable, setSkipAvailable] = useState(false);
  const dismissedRef = useRef(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('settle'), TUMBLE_DURATION_MS);
    const t2 = setTimeout(() => setPhase('reveal'), TUMBLE_DURATION_MS + SETTLE_DURATION_MS);
    const t3 = setTimeout(() => setPhase('dismissable'), TAP_TO_DISMISS_DELAY_MS);
    const t4 = setTimeout(() => setSkipAvailable(true), SKIP_AVAILABLE_AFTER_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  function handleDismiss(): void {
    if (dismissedRef.current) return;
    if (phase === 'tumble' && !skipAvailable) return;
    dismissedRef.current = true;
    onDismiss();
  }

  // Display face: while tumbling, cycle random faces so the die looks
  // alive. After settle, lock to the resolved face. The cycling is
  // visual-only — the resolved outcome is already determined. Range
  // matches the die type — 1..6 for d6, 1..20 for d20.
  const faceRange = dieType === 'd20' ? 20 : 6;
  const [displayFace, setDisplayFace] = useState<number>(() => {
    return Math.floor(Math.random() * faceRange) + 1;
  });
  useEffect(() => {
    if (phase !== 'tumble') {
      setDisplayFace(face);
      return;
    }
    const id = setInterval(() => {
      setDisplayFace(Math.floor(Math.random() * faceRange) + 1);
    }, 150);
    return () => clearInterval(id);
  }, [phase, face, faceRange]);

  const isSettled = phase === 'settle' || phase === 'reveal' || phase === 'dismissable';
  const showOutcome = phase === 'reveal' || phase === 'dismissable';

  return (
    <div
      data-testid="die-roll-reveal-backdrop"
      data-phase={phase}
      style={ROLL_BACKDROP_STYLE}
      onClick={handleDismiss}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? 'Die roll reveal'}
    >
      <div
        data-testid="die-roll-reveal-panel"
        className="die-roll-reveal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <div data-testid="die-roll-reveal-title" className="die-roll-reveal-title">
            {title}
          </div>
        ) : null}
        <div className="die-roll-reveal-stage">
          <div
            data-testid="die-roll-reveal-die"
            data-settled={isSettled ? 'true' : 'false'}
            data-face={isSettled ? face : displayFace}
            data-die-type={dieType}
            className={
              dieType === 'd20'
                ? 'die-roll-reveal-die die-roll-reveal-die-d20'
                : 'die-roll-reveal-die'
            }
            aria-live="polite"
            aria-label={isSettled ? `Die rolled a ${face}` : 'Die rolling'}
          >
            {dieType === 'd20' ? (
              <D20Face face={isSettled ? face : displayFace} />
            ) : (
              <Pips face={isSettled ? face : displayFace} />
            )}
          </div>
          {showOutcome && outcomeLabel ? (
            <div
              data-testid="die-roll-reveal-outcome"
              className="die-roll-reveal-outcome"
              role="status"
            >
              {outcomeLabel}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          data-testid="die-roll-reveal-dismiss"
          data-tap-target="true"
          className="die-roll-reveal-dismiss"
          disabled={!skipAvailable && phase === 'tumble'}
          onClick={handleDismiss}
          aria-label={phase === 'dismissable' ? 'Continue' : 'Skip animation'}
        >
          {phase === 'dismissable' ? 'Continue' : 'Skip'}
        </button>
      </div>
    </div>
  );
}
