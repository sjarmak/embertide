import type { JSX } from 'react';

export type CostGemKind = 'green' | 'red' | 'keys';

export interface CostGemProps {
  readonly kind: CostGemKind;
  readonly value: number;
  readonly size?: number;
}

const GOLD = 'var(--hc-lead-gold-500, #b89142)';
const GOLD_DARK = 'var(--hc-lead-gold-700, #8b6a2a)';
const PARCHMENT = 'var(--hc-parchment-50, #fbf6e9)';
const IRON = 'var(--hc-lead-iron-900, #0e0c14)';

const ARIA: Record<CostGemKind, string> = {
  green: 'green-shard',
  red: 'sword',
  keys: 'key',
};

/**
 * Card cost indicator rendered in the Elysian Cathedral stained-glass
 * aesthetic. Three glyphs, one per resource (see bd memory
 * `card-cost-icon-convention`):
 *  - `green` — Aurelia-canon vertical-hex shard (currency, point top + point
 *              bottom, longer than wide; updated in rkbf 2026-04-26)
 *  - `red`   — stylized sword (power, used to defeat monsters)
 *  - `keys`  — key (used to open chests)
 *
 * Each glyph is gold-rimmed, has internal leading lines, and carries a
 * Cinzel-serif numeral in a parchment counter at the bottom-right. The
 * outer SVG is labelled `<glyph-name> <value>` for assistive tech and the
 * legacy field/board tests that lookup by `aria-label`.
 */
export default function CostGem({ kind, value, size = 36 }: CostGemProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label={`${ARIA[kind]} ${value}`}
      data-testid={`cost-gem-${kind}`}
    >
      <defs>{glyphDefs(kind)}</defs>
      {glyphFor(kind)}
      <g transform="translate(28 28)">
        <circle cx="0" cy="0" r="9" fill={PARCHMENT} stroke={GOLD} strokeWidth="1.6" />
        <text
          x="0"
          y="3.4"
          textAnchor="middle"
          fill={IRON}
          style={{
            fontFamily: 'var(--hc-font-display)',
            fontSize: 'var(--hc-text-xs)',
            fontWeight: 'var(--hc-font-weight-bold)',
          }}
        >
          {value}
        </text>
      </g>
    </svg>
  );
}

function glyphDefs(kind: CostGemKind): JSX.Element {
  switch (kind) {
    case 'green':
      return (
        <linearGradient id="cost-gem-green-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--hc-jewel-emerald-300, #5fb079)" />
          <stop offset="55%" stopColor="var(--hc-jewel-emerald-500, #1f7a46)" />
          <stop offset="100%" stopColor="var(--hc-jewel-emerald-700, #0f5028)" />
        </linearGradient>
      );
    case 'red':
      return (
        <>
          <linearGradient id="cost-gem-red-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--hc-jewel-ruby-100, #f1ccd4)" />
            <stop offset="50%" stopColor="var(--hc-jewel-ruby-300, #d96a82)" />
            <stop offset="100%" stopColor="var(--hc-jewel-ruby-500, #a1223c)" />
          </linearGradient>
          {/* rrzl: blade fill biased to the darker steel so the sword
              carries the same saturated mass the green shard gets from its
              emerald fill — a near-white blade washed out against busy
              monster art (Stephanie: power symbol hard to see vs shard). */}
          <linearGradient id="cost-gem-steel-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--hc-lead-silver-500, #8a95a2)" />
            <stop offset="45%" stopColor="var(--hc-lead-silver-700, #5e6775)" />
            <stop offset="100%" stopColor="var(--hc-lead-silver-700, #5e6775)" />
          </linearGradient>
        </>
      );
    case 'keys':
      return (
        <linearGradient id="cost-gem-keys-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--hc-jewel-amber-100, #f6e7bc)" />
          <stop offset="60%" stopColor="var(--hc-lead-gold-500, #b89142)" />
          <stop offset="100%" stopColor="var(--hc-lead-gold-700, #8b6a2a)" />
        </linearGradient>
      );
  }
}

function glyphFor(kind: CostGemKind): JSX.Element {
  switch (kind) {
    case 'green':
      return greenRupeeGlyph();
    case 'red':
      return swordGlyph();
    case 'keys':
      return keyGlyph();
  }
}

/* Green shard — Aurelia-canon vertical hex (point top, point bottom,
   longer than wide) with full faceted leading: top cap seam + bottom
   cap seam + full-height vertical center seam, dividing the gem into
   six visible cells per OoT/LttP/WW canon. rkbf (2026-04-26) replaced
   the prior 4-sided diamond and slimmed the silhouette per designer
   feedback. */
function greenRupeeGlyph(): JSX.Element {
  return (
    <g>
      <polygon
        points="20,3 30,12 30,28 20,37 10,28 10,12"
        fill="url(#cost-gem-green-fill)"
        stroke={GOLD}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <line x1="10" y1="12" x2="30" y2="12" stroke={GOLD_DARK} strokeWidth="0.7" opacity="0.85" />
      <line x1="10" y1="28" x2="30" y2="28" stroke={GOLD_DARK} strokeWidth="0.7" opacity="0.85" />
      <line x1="20" y1="3" x2="20" y2="37" stroke={GOLD_DARK} strokeWidth="0.7" opacity="0.85" />
      <polygon points="20,3 30,12 20,12" fill="rgba(255,255,255,0.22)" />
      <polygon points="10,12 20,12 20,28 10,28" fill="rgba(255,255,255,0.06)" />
    </g>
  );
}

/* Stylized sword — bold upright blade, wide gold crossguard, ruby grip +
   pommel. rrzl (2026-06-06): rebuilt for legibility parity with the green
   shard (Stephanie: the power symbol was much harder to see). Three moves,
   all targeting the shard's "reads at a glance" qualities:
     1. Mass — the blade is wider and the crossguard spans nearly the full
        glyph width (x6→34), so the silhouette has comparable ink to the
        shard hex instead of reading as a thin sliver.
     2. Contrast vs backing — every element is drawn first as a dark iron
        halo, then its fill on top. The shard separates from busy art via
        its saturated emerald fill; the lighter steel blade needs an
        explicit dark outline to do the same on both light and dark art.
     3. Saturated fill — the blade gradient is biased to the darker steel
        (see cost-gem-steel-fill) so it isn't a near-white wash. */
function swordGlyph(): JSX.Element {
  const blade = '20,2.5 25,12 23,19 17,19 15,12';
  return (
    <g>
      {/* Dark separation halo behind the whole sword (legibility move #2). */}
      <g
        fill="none"
        stroke={IRON}
        strokeOpacity="0.85"
        strokeWidth="2.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <polygon points={blade} />
        <rect x="6" y="18.6" width="28" height="4" rx="1.4" />
        <rect x="16.5" y="22.4" width="7" height="6.6" rx="1" />
        <circle cx="20" cy="31" r="3.3" />
      </g>
      {/* Blade — saturated steel with bold gold leading. */}
      <polygon
        points={blade}
        fill="url(#cost-gem-steel-fill)"
        stroke={GOLD}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Crossguard — wide bold gold bar for horizontal mass. */}
      <rect
        x="6"
        y="18.6"
        width="28"
        height="4"
        rx="1.4"
        fill={GOLD}
        stroke={GOLD_DARK}
        strokeWidth="1"
      />
      {/* Grip wrap (ruby). */}
      <rect
        x="16.5"
        y="22.4"
        width="7"
        height="6.6"
        rx="1"
        fill="url(#cost-gem-red-fill)"
        stroke={GOLD_DARK}
        strokeWidth="1"
      />
      {/* Pommel jewel. */}
      <circle
        cx="20"
        cy="31"
        r="3.3"
        fill="url(#cost-gem-red-fill)"
        stroke={GOLD}
        strokeWidth="1.1"
      />
      {/* Top-left blade highlight. */}
      <polygon points="20,4 23,12 20,12" fill="rgba(255,255,255,0.4)" />
    </g>
  );
}

/* Stained-glass key — round bow at top, ridged shaft, two teeth. */
function keyGlyph(): JSX.Element {
  return (
    <g>
      {/* Bow (head). */}
      <circle
        cx="14"
        cy="11"
        r="6"
        fill="url(#cost-gem-keys-fill)"
        stroke={GOLD_DARK}
        strokeWidth="1.4"
      />
      <circle cx="14" cy="11" r="2.2" fill={IRON} opacity="0.55" />
      {/* Shaft. */}
      <rect
        x="18"
        y="9.5"
        width="14"
        height="3"
        fill="url(#cost-gem-keys-fill)"
        stroke={GOLD_DARK}
        strokeWidth="0.8"
      />
      {/* Teeth. */}
      <rect
        x="27"
        y="12.5"
        width="2.4"
        height="3"
        fill={GOLD}
        stroke={GOLD_DARK}
        strokeWidth="0.6"
      />
      <rect
        x="22.5"
        y="12.5"
        width="2.2"
        height="2.2"
        fill={GOLD}
        stroke={GOLD_DARK}
        strokeWidth="0.6"
      />
      {/* Top-left highlight on bow. */}
      <path
        d="M10 8 A6 6 0 0 1 14 5"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.4"
        fill="none"
      />
    </g>
  );
}
