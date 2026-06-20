/**
 * Elysian Cathedral icon set — V-3 substrate.
 *
 * Spec: .claude/design/elysian-cathedral/icons.md §2 (three-layer recipe)
 * and §3 (per-icon redraw specs 3.1–3.11).
 *
 * Each icon is a structurally-correct three-layer SVG:
 *   1. Leading (silhouette + internal divisions, stroked).
 *   2. Jewel fill (flat cel-shaded color cells).
 *   3. Highlight (single light-catch sliver, upper-left).
 *
 * Colors come from CSS custom properties with hex fallbacks so icons
 * render correctly in jsdom unit tests where tokens.css isn't loaded.
 *
 * Status: PLACEHOLDERS. Each icon is marked `data-hc-placeholder="true"`
 * because final art lands later in V-4. The structure (three layers,
 * 24×24 viewBox, IconProps signature) is the production substrate the
 * V-4 swap will use unchanged.
 */

interface IconProps {
  /** Single dimension control — applies to width and height. Default 24. */
  size?: number;
  /** Accessible label; falls back to icon name. */
  title?: string;
  /** Optional CSS color override for monochrome icons (champion-tinted variants per icons.md §4). */
  tint?: string;
}

const DEFAULT_SIZE = 24;

/*
 * Cathedral palette — resolved CSS custom properties with hex fallbacks
 * so the icons look correct both when tokens.css is loaded (app) and when
 * it is not (unit tests render icons in an isolated jsdom document).
 */
const IRON_700 = 'var(--hc-lead-iron-700, #1a1620)';
const IRON_900 = 'var(--hc-lead-iron-900, #0a0810)';
const GOLD_500 = 'var(--hc-lead-gold-500, #b89142)';
const GOLD_700 = 'var(--hc-lead-gold-700, #8b6a2a)';
const PARCHMENT_500 = 'var(--hc-parchment-500, #d8c896)';
const PEARL_GLOW = 'var(--hc-glow-pearl, #ffffff)';
const PEARL_300 = 'var(--hc-jewel-pearl-300, #e8e6df)';
const PEARL_500 = 'var(--hc-jewel-pearl-500, #c9c6bb)';
const EMERALD_300 = 'var(--hc-jewel-emerald-300, #5fb079)';
const EMERALD_500 = 'var(--hc-jewel-emerald-500, #1f7a46)';
const EMERALD_700 = 'var(--hc-jewel-emerald-700, #0f5028)';
const RUBY_300 = 'var(--hc-jewel-ruby-300, #d96a82)';
const RUBY_500 = 'var(--hc-jewel-ruby-500, #a1223c)';
const RUBY_700 = 'var(--hc-jewel-ruby-700, #6f1428)';
const AMBER_300 = 'var(--hc-jewel-amber-300, #f0c45a)';
const AMBER_500 = 'var(--hc-jewel-amber-500, #c98a1e)';
const AMETHYST_500 = 'var(--hc-jewel-amethyst-500, #5b3a8a)';
const AMETHYST_700 = 'var(--hc-jewel-amethyst-700, #3a2360)';
const SAPPHIRE_300 = 'var(--hc-jewel-sapphire-300, #6a93d6)';
const SAPPHIRE_500 = 'var(--hc-jewel-sapphire-500, #2e4ba0)';
const SHADOW_700 = 'var(--hc-shadow-700, #14101a)';

const STROKE_STD = 1.5;
const STROKE_PRESENCE = 2;
const HIGHLIGHT_OPACITY = 0.8;
const FACET_SHADE_OPACITY = 0.35;

/* ---------- 3.1 GreenShard --------------------------------------------- */
//
// rkbf (2026-04-26): Aurelia-canon vertical hexagonal shard — point top,
// point bottom, longer than wide. Six visible facet cells via two
// horizontal seams (top cap + bottom cap) plus a full-height vertical
// center seam (per OoT/LttP/WW canon). Slightly thinner silhouette
// (width 12 within the 24-unit viewBox) than the prior 9d1g horizontal
// hex so the gem reads as a tall narrow upright jewel instead of a
// stout disc.
export function GreenShard({ size = DEFAULT_SIZE, title, tint }: IconProps) {
  const lead = tint ?? IRON_700;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title ?? 'green-shard'}
      data-hc-placeholder="true"
    >
      {title ? <title>{title}</title> : null}
      {/* Per-cell painterly fills (top-left lighter, bottom-right deeper)
          for jewel-cut tonal variation across the six facets. */}
      <path d="M12 1 L18 7 L12 7 Z" fill={EMERALD_300} />
      <path d="M12 1 L12 7 L6 7 Z" fill={EMERALD_500} />
      <path d="M6 7 L12 7 L12 17 L6 17 Z" fill={EMERALD_300} />
      <path d="M12 7 L18 7 L18 17 L12 17 Z" fill={EMERALD_500} />
      <path d="M6 17 L12 17 L12 23 Z" fill={EMERALD_500} />
      <path d="M12 17 L18 17 L12 23 Z" fill={EMERALD_700} />
      {/* Leading: outer hex + top cap seam + bottom cap seam + full-
          height vertical center seam. */}
      <path
        d="M12 1 L18 7 L18 17 L12 23 L6 17 L6 7 Z M6 7 L18 7 M6 17 L18 17 M12 1 L12 23"
        fill="none"
        stroke={lead}
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Highlight: small light-catch on the upper-left bevel. */}
      <path d="M8 5 L10 6 L8.5 7 Z" fill={PEARL_GLOW} opacity={HIGHLIGHT_OPACITY} />
    </svg>
  );
}

/* ---------- 3.2 RedShard (Power) --------------------------------------- */
//
// rkbf (2026-04-26): mirror the new GreenShard vertical hex silhouette
// + interior facet pattern for family kinship — only fill tones (ruby)
// and leading color (gold) differ.
export function RedShard({ size = DEFAULT_SIZE, title, tint }: IconProps) {
  const lead = tint ?? GOLD_700;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title ?? 'red-shard'}
      data-hc-placeholder="true"
    >
      {title ? <title>{title}</title> : null}
      <path d="M12 1 L18 7 L12 7 Z" fill={RUBY_300} />
      <path d="M12 1 L12 7 L6 7 Z" fill={RUBY_500} />
      <path d="M6 7 L12 7 L12 17 L6 17 Z" fill={RUBY_300} />
      <path d="M12 7 L18 7 L18 17 L12 17 Z" fill={RUBY_500} />
      <path d="M6 17 L12 17 L12 23 Z" fill={RUBY_500} />
      <path d="M12 17 L18 17 L12 23 Z" fill={RUBY_700} />
      <path
        d="M12 1 L18 7 L18 17 L12 23 L6 17 L6 7 Z M6 7 L18 7 M6 17 L18 17 M12 1 L12 23"
        fill="none"
        stroke={lead}
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M8 5 L10 6 L8.5 7 Z" fill={PEARL_GLOW} opacity={0.7} />
    </svg>
  );
}

/* ---------- 3.3 Key ----------------------------------------------------- */
export function Key({ size = DEFAULT_SIZE, title, tint }: IconProps) {
  const lead = tint ?? GOLD_700;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title ?? 'key'}
      data-hc-placeholder="true"
    >
      {title ? <title>{title}</title> : null}
      {/* Jewel cells: trefoil lobes */}
      <circle cx="6" cy="9" r="2.4" fill={AMBER_300} />
      <circle cx="6" cy="14.5" r="2.4" fill={AMBER_300} />
      <circle cx="9.5" cy="11.7" r="2.4" fill={AMBER_300} />
      {/* Jewel cells: shaft + teeth */}
      <rect x="11.5" y="10.5" width="9" height="2.4" fill={AMBER_500} />
      <rect x="17.5" y="12.9" width="1.6" height="2.4" fill={AMBER_500} />
      <rect x="14.5" y="12.9" width="1.6" height="1.8" fill={AMBER_500} />
      {/* Leading */}
      <g
        fill="none"
        stroke={lead}
        strokeWidth={STROKE_STD}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <circle cx="6" cy="9" r="2.4" />
        <circle cx="6" cy="14.5" r="2.4" />
        <circle cx="9.5" cy="11.7" r="2.4" />
        <rect x="11.5" y="10.5" width="9" height="2.4" />
        <rect x="17.5" y="12.9" width="1.6" height="2.4" />
        <rect x="14.5" y="12.9" width="1.6" height="1.8" />
      </g>
      {/* Facet shade: keyhole bore */}
      <circle cx="7.5" cy="11.7" r="0.7" fill={SHADOW_700} opacity="0.6" />
      {/* Highlight */}
      <path d="M5 7.5 L7 8 L5.2 9 Z" fill={PEARL_GLOW} opacity={HIGHLIGHT_OPACITY} />
    </svg>
  );
}

/* ---------- 3.4 Heart --------------------------------------------------- */
export function Heart({ size = DEFAULT_SIZE, title, tint }: IconProps) {
  const lead = tint ?? GOLD_500;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title ?? 'heart'}
      data-hc-placeholder="true"
    >
      {title ? <title>{title}</title> : null}
      {/* Jewel cells: left lobe / right lobe */}
      <path d="M12 21 C 4 15, 2.5 9, 6.5 6.5 C 9.5 5, 12 8, 12 9.5 L 12 21 Z" fill={RUBY_300} />
      <path d="M12 21 C 20 15, 21.5 9, 17.5 6.5 C 14.5 5, 12 8, 12 9.5 L 12 21 Z" fill={RUBY_500} />
      {/* Leading */}
      <path
        d="M12 21 C 4 15, 2.5 9, 6.5 6.5 C 9.5 5, 12 8, 12 9.5 C 12 8, 14.5 5, 17.5 6.5 C 21.5 9, 20 15, 12 21 Z M12 9.5 L12 21"
        fill="none"
        stroke={lead}
        strokeWidth={STROKE_STD}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Highlight: comma on upper-left of left lobe */}
      <path
        d="M6 8 C 5 10, 5.5 12, 7.5 13.5"
        fill="none"
        stroke={PEARL_GLOW}
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity={HIGHLIGHT_OPACITY}
      />
    </svg>
  );
}

/* ---------- 3.5 Sword --------------------------------------------------- */
export function Sword({ size = DEFAULT_SIZE, title, tint }: IconProps) {
  const lead = tint ?? IRON_900;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title ?? 'sword'}
      data-hc-placeholder="true"
    >
      {title ? <title>{title}</title> : null}
      {/* Jewel cells: blade halves */}
      <path d="M12 2 L12 16 L8 14 L9 4 Z" fill={PEARL_300} />
      <path d="M12 2 L12 16 L16 14 L15 4 Z" fill={PEARL_500} />
      {/* Cross-guard (gold metal, fills as leading) */}
      <path d="M4 14 L20 14 L19 17 L5 17 Z" fill={GOLD_500} />
      {/* Grip */}
      <rect x="11" y="17" width="2" height="4" fill={PARCHMENT_500} />
      {/* Pommel jewel */}
      <circle cx="12" cy="22" r="1.4" fill={SAPPHIRE_500} />
      {/* Leading */}
      <g
        fill="none"
        stroke={lead}
        strokeWidth={STROKE_STD}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M12 2 L8 14 L12 16 L16 14 Z" />
        <line x1="12" y1="4" x2="12" y2="14" />
        <path d="M4 14 L20 14 L19 17 L5 17 Z" />
        <rect x="11" y="17" width="2" height="4" />
        <circle cx="12" cy="22" r="1.4" />
      </g>
      {/* Highlight: blade-edge sliver, upper-left */}
      <path d="M11 3 L11.5 13 L10 13 L10.5 4 Z" fill={PEARL_GLOW} opacity="0.85" />
    </svg>
  );
}

/* ---------- 3.6 Shield -------------------------------------------------- */
export function Shield({ size = DEFAULT_SIZE, title, tint }: IconProps) {
  const lead = tint ?? IRON_700;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title ?? 'shield'}
      data-hc-placeholder="true"
    >
      {title ? <title>{title}</title> : null}
      {/* Outer face */}
      <path d="M4 4 L20 4 L20 12 C 20 18, 16 21, 12 22 C 8 21, 4 18, 4 12 Z" fill={SAPPHIRE_500} />
      {/* Inner field */}
      <path
        d="M6 6 L18 6 L18 12 C 18 17, 15 19.5, 12 20.4 C 9 19.5, 6 17, 6 12 Z"
        fill={SAPPHIRE_300}
      />
      {/* Bird-crest (gold) */}
      <path d="M12 8 L9 11 L12 10 L15 11 Z" fill={GOLD_500} />
      {/* Leading */}
      <g
        fill="none"
        stroke={lead}
        strokeWidth={STROKE_STD}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M4 4 L20 4 L20 12 C 20 18, 16 21, 12 22 C 8 21, 4 18, 4 12 Z" />
        <path d="M6 6 L18 6 L18 12 C 18 17, 15 19.5, 12 20.4 C 9 19.5, 6 17, 6 12 Z" />
        <path d="M12 8 L9 11 L12 10 L15 11 Z" />
      </g>
      {/* Facet shade: boss-ring */}
      <circle cx="12" cy="14.5" r="1.6" fill={SHADOW_700} opacity={FACET_SHADE_OPACITY} />
      {/* Highlight */}
      <path
        d="M8 7 C 7 10, 7.5 13, 9.5 15"
        fill="none"
        stroke={PEARL_GLOW}
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity={HIGHLIGHT_OPACITY}
      />
    </svg>
  );
}

/* ---------- 3.7 Hero ---------------------------------------------------- */
export function Hero({ size = DEFAULT_SIZE, title, tint }: IconProps) {
  // Hero is the only icon that re-tints by champion (icons.md §4).
  // `tint` overrides the hood fill; face/yoke remain parchment/iron.
  const hoodFill = tint ?? EMERALD_500;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title ?? 'hero'}
      data-hc-placeholder="true"
    >
      {title ? <title>{title}</title> : null}
      {/* Hood (champion-tintable) */}
      <path d="M12 3 L18 9 L18 14 L6 14 L6 9 Z" fill={hoodFill} />
      {/* Face */}
      <path d="M9 11 L15 11 L14 16 L10 16 Z" fill={PARCHMENT_500} />
      {/* Yoke */}
      <path d="M5 16 L19 16 L20 21 L4 21 Z" fill={EMERALD_700} />
      {/* Leading */}
      <g
        fill="none"
        stroke={IRON_700}
        strokeWidth={STROKE_STD}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M12 3 L18 9 L18 14 L6 14 L6 9 Z" />
        <path d="M9 11 L15 11 L14 16 L10 16 Z" />
        <path d="M5 16 L19 16 L20 21 L4 21 Z" />
      </g>
      {/* Highlight: hood upper-left */}
      <path d="M8 5 L9 10 L7 10 Z" fill={PEARL_GLOW} opacity={HIGHLIGHT_OPACITY} />
    </svg>
  );
}

/* ---------- 3.8 Monster ------------------------------------------------- */
export function Monster({ size = DEFAULT_SIZE, title, tint }: IconProps) {
  const lead = tint ?? IRON_900;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title ?? 'monster'}
      data-hc-placeholder="true"
    >
      {title ? <title>{title}</title> : null}
      {/* Face */}
      <path
        d="M3 16 C 3 8, 21 8, 21 16 L 19 21 L 16 18 L 12 21 L 8 18 L 5 21 Z"
        fill={AMETHYST_500}
      />
      {/* Brow band */}
      <path d="M3 16 C 3 11, 21 11, 21 16 Z" fill={AMETHYST_700} />
      {/* Eyes (with soft-glow filter) */}
      <g filter="url(#hc-soft-glow)">
        <circle cx="9" cy="14" r="1.6" fill={AMBER_300} />
        <circle cx="15" cy="14" r="1.6" fill={AMBER_300} />
      </g>
      {/* Pupils */}
      <circle cx="9" cy="14" r="0.6" fill={IRON_900} />
      <circle cx="15" cy="14" r="0.6" fill={IRON_900} />
      {/* Leading */}
      <g
        fill="none"
        stroke={lead}
        strokeWidth={STROKE_STD}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M3 16 C 3 8, 21 8, 21 16 L 19 21 L 16 18 L 12 21 L 8 18 L 5 21 Z" />
        <line x1="12" y1="11" x2="12" y2="20" />
        <circle cx="9" cy="14" r="1.6" />
        <circle cx="15" cy="14" r="1.6" />
      </g>
      {/* Highlights: malevolent wet glints on each eye */}
      <path d="M8.4 13.4 L8.8 13 L9 13.6 Z" fill={PEARL_GLOW} opacity={HIGHLIGHT_OPACITY} />
      <path d="M14.4 13.4 L14.8 13 L15 13.6 Z" fill={PEARL_GLOW} opacity={HIGHLIGHT_OPACITY} />
    </svg>
  );
}

/* ---------- 3.9 Chest --------------------------------------------------- */
export function Chest({ size = DEFAULT_SIZE, title, tint }: IconProps) {
  const lead = tint ?? IRON_700;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title ?? 'chest'}
      data-hc-placeholder="true"
    >
      {title ? <title>{title}</title> : null}
      {/* Lid */}
      <path d="M3 10 Q 12 4, 21 10 L 21 13 L 3 13 Z" fill={`var(--hc-chest-lid, ${GOLD_500})`} />
      {/* Face */}
      <rect x="3" y="13" width="18" height="9" fill={`var(--hc-chest-face, ${GOLD_700})`} />
      {/* Lock panel */}
      <rect x="10" y="14.5" width="4" height="5" fill={AMBER_300} />
      {/* Straps (leading-fill) */}
      <rect x="6" y="9" width="1.2" height="13" fill={GOLD_500} />
      <rect x="16.8" y="9" width="1.2" height="13" fill={GOLD_500} />
      {/* Leading */}
      <g
        fill="none"
        stroke={lead}
        strokeWidth={STROKE_STD}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M3 10 Q 12 4, 21 10 L 21 22 L 3 22 Z" />
        <line x1="3" y1="13" x2="21" y2="13" />
        <rect x="10" y="14.5" width="4" height="5" />
      </g>
      {/* Facet shade: keyhole inside lock panel */}
      <path d="M12 16 L12.6 18 L11.4 18 Z" fill={SHADOW_700} opacity="0.7" />
      {/* Highlight: arc on upper-left of lid */}
      <path
        d="M5 9 C 6 7, 9 6, 11 6"
        fill="none"
        stroke={PEARL_GLOW}
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity={HIGHLIGHT_OPACITY}
      />
    </svg>
  );
}

/* ---------- 3.10 Boss --------------------------------------------------- */
export function Boss({ size = DEFAULT_SIZE, title, tint }: IconProps) {
  const lead = tint ?? IRON_900;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title ?? 'boss'}
      data-hc-placeholder="true"
    >
      {title ? <title>{title}</title> : null}
      {/* Crown */}
      <path d="M3 9 L6 4 L9 8 L12 3 L15 8 L18 4 L21 9 L21 11 L3 11 Z" fill={AMBER_500} />
      {/* Mask */}
      <path d="M3 11 L21 11 L20 18 C 19 21, 13 22, 12 22 C 11 22, 5 21, 4 18 Z" fill={RUBY_700} />
      {/* Eye glow (with soft-glow) */}
      <g filter="url(#hc-soft-glow)">
        <circle cx="9" cy="15" r="1.4" fill={AMBER_300} />
        <circle cx="15" cy="15" r="1.4" fill={AMBER_300} />
      </g>
      {/* Pupils */}
      <circle cx="9" cy="15" r="0.5" fill={IRON_900} />
      <circle cx="15" cy="15" r="0.5" fill={IRON_900} />
      {/* Leading (presence stroke = 2px) */}
      <g
        fill="none"
        stroke={lead}
        strokeWidth={STROKE_PRESENCE}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M3 9 L6 4 L9 8 L12 3 L15 8 L18 4 L21 9 L21 11 L3 11 Z" />
        <path d="M3 11 L21 11 L20 18 C 19 21, 13 22, 12 22 C 11 22, 5 21, 4 18 Z" />
        <circle cx="9" cy="15" r="1.4" />
        <circle cx="15" cy="15" r="1.4" />
        {/* Fangs */}
        <path d="M10 19 L11 21 L12 19" />
        <path d="M12 19 L13 21 L14 19" />
      </g>
      {/* Highlight: crown center point */}
      <path d="M11.5 4 L12 6 L12.5 4 Z" fill={PEARL_GLOW} opacity={HIGHLIGHT_OPACITY} />
    </svg>
  );
}

/*
 * Embertide-shard inline icons (REQ-13 Phase 2d / gm0.4). Three small
 * triangular gems matching the shard-color canon used by EmbertideStrip:
 *   - Power:   warm gold (Din)
 *   - Wisdom:  cool emerald
 *   - Courage: warm ruby
 * Now migrated to the V-3 IconProps signature ({size, title, tint}) and
 * the three-layer recipe.
 */

/* ---------- WisdomShard ------------------------------------------------- */
export function WisdomShard({ size = DEFAULT_SIZE, title, tint }: IconProps) {
  const lead = tint ?? GOLD_500;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title ?? 'wisdom-shard'}
      data-hc-placeholder="true"
    >
      {title ? <title>{title}</title> : null}
      <polygon points="12,4 21,20 3,20" fill={EMERALD_500} />
      <polygon points="12,4 21,20 12,20" fill={EMERALD_300} />
      <polygon
        points="12,4 21,20 3,20"
        fill="none"
        stroke={lead}
        strokeWidth={STROKE_STD}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M8 9 L11 7 L9 13 Z" fill={PEARL_GLOW} opacity={HIGHLIGHT_OPACITY} />
    </svg>
  );
}

/* ---------- CourageShard ------------------------------------------------ */
export function CourageShard({ size = DEFAULT_SIZE, title, tint }: IconProps) {
  const lead = tint ?? GOLD_500;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title ?? 'courage-shard'}
      data-hc-placeholder="true"
    >
      {title ? <title>{title}</title> : null}
      <polygon points="12,4 21,20 3,20" fill={RUBY_500} />
      <polygon points="12,4 21,20 12,20" fill={RUBY_300} />
      <polygon
        points="12,4 21,20 3,20"
        fill="none"
        stroke={lead}
        strokeWidth={STROKE_STD}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M8 9 L11 7 L9 13 Z" fill={PEARL_GLOW} opacity={HIGHLIGHT_OPACITY} />
    </svg>
  );
}

/* ---------- PowerShard -------------------------------------------------- */
export function PowerShard({ size = DEFAULT_SIZE, title, tint }: IconProps) {
  const lead = tint ?? GOLD_700;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title ?? 'power-shard'}
      data-hc-placeholder="true"
    >
      {title ? <title>{title}</title> : null}
      <polygon points="12,4 21,20 3,20" fill={AMBER_500} />
      <polygon points="12,4 21,20 12,20" fill={AMBER_300} />
      <polygon
        points="12,4 21,20 3,20"
        fill="none"
        stroke={lead}
        strokeWidth={STROKE_STD}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M8 9 L11 7 L9 13 Z" fill={PEARL_GLOW} opacity={HIGHLIGHT_OPACITY} />
    </svg>
  );
}

/**
 * Magnifier — "view full card details" affordance. Used as the small corner
 * button on board tiles (always-available row + market field) that opens the
 * CardDetailModal, after the primary tap was reserved for the buy/fight/trade
 * action (2026-06-20 player ruling: "clicking directly should buy/kill;
 * rethink the expand-to-view"). Stroked lead-gold lens over a faint pearl
 * glass so it reads as cathedral chrome, not a jewel icon.
 */
export function Magnifier({ size = DEFAULT_SIZE, title, tint }: IconProps) {
  const lead = tint ?? GOLD_700;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title ?? 'view details'}
      data-hc-placeholder="true"
    >
      {title ? <title>{title}</title> : null}
      {/* Glass lens fill */}
      <circle cx="10" cy="10" r="6" fill={PEARL_GLOW} opacity={0.55} />
      {/* Leading: lens ring + handle */}
      <g
        fill="none"
        stroke={lead}
        strokeWidth={STROKE_STD}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <circle cx="10" cy="10" r="6" />
        <line x1="14.5" y1="14.5" x2="20" y2="20" />
      </g>
      {/* Highlight: upper-left light-catch on the glass */}
      <path d="M7 7.5 L9.5 6.5 L7.5 10 Z" fill={PEARL_GLOW} opacity={HIGHLIGHT_OPACITY} />
    </svg>
  );
}
