// src/styles/contrast-assertions.ts
//
// Elysian Cathedral — contrast assertion matrix.
//
// Source of truth: .claude/design/elysian-cathedral/accessibility.md §1–§3.
// This module exports the text × background pairs that the spec enumerates,
// together with their expected WCAG 2.1 minimum contrast ratio and ship
// status. The test file `contrast-assertions.test.ts` imports these entries
// and asserts the computed ratio meets or exceeds `expectedMin` for every
// pair that is shippable (i.e. `status !== 'Fail'`).
//
// PRD: T-4 (A-4 tool stack: apca-w3 for perceptual model). The spec matrix
// in accessibility.md §1 is STATED in WCAG 2.1 ratios (the canonical
// threshold numbers 7.0 / 4.5 / 3.0) but the tool-stack mandates APCA as
// the authoritative model. APCA Lc magnitude thresholds (Silver/W3C-WCAG3):
//   Lc 75+ → AAA body continuous reading (≈ WCAG 7:1)
//   Lc 60+ → AA  body (≈ WCAG 4.5:1)
//   Lc 45+ → Large / headline (≈ WCAG 3:1 Large)
//   Lc 30+ → non-text / decorative
// The test file asserts APCA Lc magnitude meets the expected band. WCAG 2.1
// ratio is computed alongside and included in the failure message for
// transparency and cross-reference with the spec tables.
//
// DO NOT mutate `CONTRAST_MATRIX` at runtime. Any token hex change must
// regenerate `src/theme/tokens.ts` (via the Vite plugin) and re-run
// `a11y:contrast` to detect regressions.

export type ContrastStatus = 'AAA' | 'AA' | 'Large' | 'Fail';

export interface ContrastMatrixEntry {
  /** CSS custom property token name for text, e.g. `--hc-parchment-50`. */
  readonly textToken: string;
  /** CSS custom property token name for background. */
  readonly bgToken: string;
  /**
   * Minimum WCAG 2.1 contrast ratio this pair must meet to be considered
   * passing (AAA=7, AA=4.5, Large=3). Retained for cross-reference with the
   * spec tables in accessibility.md §1–§3; logged in failure messages but
   * NOT the primary assertion (A-4 mandates APCA as authoritative).
   * For `Fail` entries, this is the spec's AA body threshold (4.5)
   * so the regression test can confirm they remain below it.
   */
  readonly expectedMin: number;
  /**
   * Minimum APCA Lc magnitude (|Lc|) required for the pair. This is the
   * primary assertion threshold; derived from the W3C APCA Silver bands:
   *   AAA   → |Lc| ≥ 75
   *   AA    → |Lc| ≥ 60
   *   Large → |Lc| ≥ 45
   */
  readonly expectedLcMin: number;
  /**
   * Shippable classification per accessibility.md:
   *  - 'AAA'   body text, ratio ≥ 7.0 / |Lc| ≥ 75
   *  - 'AA'    body text, ratio ≥ 4.5 / |Lc| ≥ 60
   *  - 'Large' display-only (≥24px or 18.66px bold), ratio ≥ 3.0 / |Lc| ≥ 45
   *  - 'Fail'  never ships; present here only as regression sentinel
   */
  readonly status: ContrastStatus;
}

/**
 * WCAG 2.1 minimum thresholds — see accessibility.md §1 header.
 * `AAA` used only when spec explicitly calls it out; body AA is the default.
 */
const WCAG_AA_BODY = 4.5;
const WCAG_AA_LARGE = 3.0;
const WCAG_AAA_BODY = 7.0;

/**
 * APCA Lc magnitude thresholds (W3C Silver bronze/silver bands).
 * Reference: https://git.apcacontrast.com/documentation/APCAeasyIntro
 */
const APCA_AA_BODY = 60;
const APCA_AA_LARGE = 45;
const APCA_AAA_BODY = 75;

// Status → APCA threshold lookup. `Fail` entries re-use AA_BODY as a
// regression sentinel upper bound (the sentinel test asserts |Lc| is BELOW
// this, not above).
const LC_FOR_STATUS: Record<ContrastStatus, number> = {
  AAA: APCA_AAA_BODY,
  AA: APCA_AA_BODY,
  Large: APCA_AA_LARGE,
  Fail: APCA_AA_BODY,
};

/**
 * Seed list — each entry carries only the varying fields. `expectedLcMin` is
 * derived from `status` via `LC_FOR_STATUS` so the two thresholds can't drift
 * out of sync.
 */
interface MatrixSeed {
  readonly textToken: string;
  readonly bgToken: string;
  readonly expectedMin: number;
  readonly status: ContrastStatus;
}

const MATRIX_SEED: readonly MatrixSeed[] = [
  // ---------------------------------------------------------------------
  // §1 Parchment-50 on jewel-500 backgrounds
  // ---------------------------------------------------------------------
  {
    textToken: '--hc-parchment-50',
    bgToken: '--hc-jewel-sapphire-500',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },
  {
    textToken: '--hc-parchment-50',
    bgToken: '--hc-jewel-emerald-500',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },
  {
    textToken: '--hc-parchment-50',
    bgToken: '--hc-jewel-ruby-500',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },
  {
    textToken: '--hc-parchment-50',
    bgToken: '--hc-jewel-amber-500',
    expectedMin: WCAG_AA_LARGE,
    status: 'Large',
  },
  {
    textToken: '--hc-parchment-50',
    bgToken: '--hc-jewel-amethyst-500',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },
  {
    textToken: '--hc-parchment-50',
    bgToken: '--hc-jewel-pearl-500',
    expectedMin: WCAG_AA_LARGE,
    status: 'Large',
  },

  // ---------------------------------------------------------------------
  // §1 Parchment-100 on jewel-500 backgrounds
  // ---------------------------------------------------------------------
  {
    textToken: '--hc-parchment-100',
    bgToken: '--hc-jewel-sapphire-500',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },
  {
    textToken: '--hc-parchment-100',
    bgToken: '--hc-jewel-emerald-500',
    // spec 6.7 is AA body (≥4.5) but below AAA (7). Treat as AA.
    expectedMin: WCAG_AA_BODY,
    status: 'AA',
  },
  {
    textToken: '--hc-parchment-100',
    bgToken: '--hc-jewel-ruby-500',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },
  {
    textToken: '--hc-parchment-100',
    bgToken: '--hc-jewel-amber-500',
    expectedMin: WCAG_AA_LARGE,
    status: 'Large',
  },
  {
    textToken: '--hc-parchment-100',
    bgToken: '--hc-jewel-amethyst-500',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },
  {
    textToken: '--hc-parchment-100',
    bgToken: '--hc-jewel-pearl-500',
    expectedMin: WCAG_AA_LARGE,
    status: 'Large',
  },

  // ---------------------------------------------------------------------
  // §1 Lead-iron-900 on jewel-500 — only amber/pearl ship per rule 2
  // ---------------------------------------------------------------------
  {
    textToken: '--hc-lead-iron-900',
    bgToken: '--hc-jewel-sapphire-500',
    expectedMin: WCAG_AA_BODY,
    status: 'Fail',
  },
  {
    textToken: '--hc-lead-iron-900',
    bgToken: '--hc-jewel-emerald-500',
    expectedMin: WCAG_AA_BODY,
    status: 'Fail',
  },
  {
    textToken: '--hc-lead-iron-900',
    bgToken: '--hc-jewel-ruby-500',
    expectedMin: WCAG_AA_BODY,
    status: 'Fail',
  },
  {
    textToken: '--hc-lead-iron-900',
    bgToken: '--hc-jewel-amber-500',
    expectedMin: WCAG_AA_BODY,
    status: 'AA',
  },
  {
    textToken: '--hc-lead-iron-900',
    bgToken: '--hc-jewel-amethyst-500',
    expectedMin: WCAG_AA_BODY,
    status: 'Fail',
  },
  {
    textToken: '--hc-lead-iron-900',
    bgToken: '--hc-jewel-pearl-500',
    expectedMin: WCAG_AA_BODY,
    status: 'AA',
  },

  // ---------------------------------------------------------------------
  // §1 Lead-gold-500 on jewel-500 — all fail per rule 4
  // ---------------------------------------------------------------------
  {
    textToken: '--hc-lead-gold-500',
    bgToken: '--hc-jewel-sapphire-500',
    expectedMin: WCAG_AA_BODY,
    status: 'Fail',
  },
  {
    textToken: '--hc-lead-gold-500',
    bgToken: '--hc-jewel-emerald-500',
    expectedMin: WCAG_AA_BODY,
    status: 'Fail',
  },
  {
    textToken: '--hc-lead-gold-500',
    bgToken: '--hc-jewel-ruby-500',
    expectedMin: WCAG_AA_BODY,
    status: 'Fail',
  },
  {
    textToken: '--hc-lead-gold-500',
    bgToken: '--hc-jewel-amber-500',
    expectedMin: WCAG_AA_BODY,
    status: 'Fail',
  },
  {
    textToken: '--hc-lead-gold-500',
    bgToken: '--hc-jewel-amethyst-500',
    expectedMin: WCAG_AA_BODY,
    status: 'Fail',
  },
  {
    textToken: '--hc-lead-gold-500',
    bgToken: '--hc-jewel-pearl-500',
    expectedMin: WCAG_AA_BODY,
    status: 'Fail',
  },

  // ---------------------------------------------------------------------
  // §2 Text on parchment
  // ---------------------------------------------------------------------
  {
    textToken: '--hc-lead-iron-900',
    bgToken: '--hc-parchment-50',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },
  {
    textToken: '--hc-lead-iron-900',
    bgToken: '--hc-parchment-100',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },
  {
    textToken: '--hc-lead-iron-900',
    bgToken: '--hc-parchment-300',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },
  {
    textToken: '--hc-lead-iron-700',
    bgToken: '--hc-parchment-50',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },
  {
    textToken: '--hc-lead-iron-700',
    bgToken: '--hc-parchment-100',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },
  {
    textToken: '--hc-lead-iron-700',
    bgToken: '--hc-parchment-300',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },
  // Muted text is a deliberate placeholder-only style per §2 — regression sentinel.
  {
    textToken: '--hc-text-muted',
    bgToken: '--hc-parchment-50',
    expectedMin: WCAG_AA_BODY,
    status: 'Fail',
  },
  {
    textToken: '--hc-text-muted',
    bgToken: '--hc-parchment-100',
    expectedMin: WCAG_AA_BODY,
    status: 'Fail',
  },
  {
    textToken: '--hc-text-muted',
    bgToken: '--hc-parchment-300',
    expectedMin: WCAG_AA_BODY,
    status: 'Fail',
  },
  {
    textToken: '--hc-jewel-emerald-700',
    bgToken: '--hc-parchment-50',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },
  {
    textToken: '--hc-jewel-emerald-700',
    bgToken: '--hc-parchment-100',
    // spec 6.6 — AA body.
    expectedMin: WCAG_AA_BODY,
    status: 'AA',
  },
  {
    textToken: '--hc-jewel-emerald-700',
    bgToken: '--hc-parchment-300',
    // spec 4.7 — AA body.
    expectedMin: WCAG_AA_BODY,
    status: 'AA',
  },
  {
    textToken: '--hc-jewel-ruby-700',
    bgToken: '--hc-parchment-50',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },
  {
    textToken: '--hc-jewel-ruby-700',
    bgToken: '--hc-parchment-100',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },
  {
    textToken: '--hc-jewel-ruby-700',
    bgToken: '--hc-parchment-300',
    // spec 5.9 — AA body.
    expectedMin: WCAG_AA_BODY,
    status: 'AA',
  },

  // ---------------------------------------------------------------------
  // §3 Text on shadow
  // ---------------------------------------------------------------------
  {
    textToken: '--hc-text-primary',
    bgToken: '--hc-shadow-700',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },
  {
    textToken: '--hc-text-primary',
    bgToken: '--hc-shadow-800',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },
  {
    textToken: '--hc-lead-gold-500',
    bgToken: '--hc-shadow-700',
    expectedMin: WCAG_AA_BODY,
    status: 'AA',
  },
  {
    textToken: '--hc-lead-gold-500',
    bgToken: '--hc-shadow-800',
    // spec 6.2 — AA body.
    expectedMin: WCAG_AA_BODY,
    status: 'AA',
  },
  {
    textToken: '--hc-jewel-amber-300',
    bgToken: '--hc-shadow-700',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },
  {
    textToken: '--hc-jewel-amber-300',
    bgToken: '--hc-shadow-800',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },

  // ---------------------------------------------------------------------
  // embertide-pym7 — Cathedral-button hover-state pairings.
  //
  // The secondary cathedral buttons (.hc-button + .tutorial-dismiss) flip
  // text from --hc-lead-gold-500 (base) to --hc-jewel-amber-100 (cream)
  // on hover while the shadow gradient (--hc-shadow-600 → --hc-shadow-800)
  // is unchanged. Lock both bg stops into the matrix so a token hex tweak
  // can't quietly regress hover legibility — the pym7 incident was a
  // competing CSS rule forcing iron-900 (near-black) text on the same
  // shadow gradient. Note: the primary CTA buttons (.end-turn-button +
  // .play-all-starters) use the iron-900-on-amber-gradient path instead
  // and are not exercised by these pairs.
  // ---------------------------------------------------------------------
  {
    textToken: '--hc-jewel-amber-100',
    bgToken: '--hc-shadow-600',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },
  {
    textToken: '--hc-jewel-amber-100',
    bgToken: '--hc-shadow-800',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },

  // ---------------------------------------------------------------------
  // embertide-4jxh — Card-frame variant pairings.
  //
  // wild-boss + region-boss variants render parchment-100 body text over
  // shadow-700 / shadow-800 / ruby-900 plates. champion variant renders
  // lead-gold-700 name text on parchment-50 / parchment-100. All five
  // additions are net-new pairings introduced by the variant CSS in
  // app.css; locking them into the matrix keeps a token hex change from
  // silently regressing the variant readability.
  // ---------------------------------------------------------------------
  {
    textToken: '--hc-parchment-100',
    bgToken: '--hc-shadow-700',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },
  {
    textToken: '--hc-parchment-100',
    bgToken: '--hc-shadow-800',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },
  {
    textToken: '--hc-parchment-100',
    bgToken: '--hc-jewel-ruby-900',
    expectedMin: WCAG_AAA_BODY,
    status: 'AAA',
  },
  {
    textToken: '--hc-lead-gold-700',
    bgToken: '--hc-parchment-50',
    expectedMin: WCAG_AA_BODY,
    status: 'AA',
  },
  {
    textToken: '--hc-lead-gold-700',
    bgToken: '--hc-parchment-100',
    expectedMin: WCAG_AA_BODY,
    status: 'AA',
  },
] as const;

/**
 * CONTRAST_MATRIX — derived at module load from MATRIX_SEED. Each entry
 * gets its `expectedLcMin` from the status band so WCAG and APCA thresholds
 * stay in lock-step.
 */
export const CONTRAST_MATRIX: readonly ContrastMatrixEntry[] = MATRIX_SEED.map((seed) => ({
  ...seed,
  expectedLcMin: LC_FOR_STATUS[seed.status],
}));

/**
 * WCAG 2.1 contrast ratio for two RGB triplets (0–255).
 * Formula: (L1 + 0.05) / (L2 + 0.05) where L is relative luminance.
 * Returns the larger-over-smaller ratio ∈ [1, 21].
 */
export function wcagContrastRatio(
  rgbA: readonly [number, number, number],
  rgbB: readonly [number, number, number],
): number {
  const la = relativeLuminance(rgbA);
  const lb = relativeLuminance(rgbB);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function relativeLuminance(rgb: readonly [number, number, number]): number {
  const [r, g, b] = rgb.map(channelLinear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function channelLinear(c255: number): number {
  const c = c255 / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Parse `#rrggbb` → `[r, g, b]` (0–255). Throws on bad input. */
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}
