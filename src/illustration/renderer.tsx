/**
 * Deterministic compositional illustration renderer.
 *
 * Takes an {@link IllustrationSpec} (the JSON authored in `examples/`),
 * validates it, and returns a React SVG element composed from four
 * modular layers: silhouette, segmentation, ornament, and theme palette.
 *
 * Contract invariants (see `renderContract.md`):
 *   - viewBox is exactly "0 0 24 24"
 *   - light source fixed at top-left
 *   - exactly one highlight family
 *   - layer order: leading → fill-primary → fill-secondary → shade? →
 *     highlight → ornament
 *   - All fill / stroke values are theme tokens (`var(--hc-*)`) or `none`
 *
 * This unit ONLY supports the `hero_warrior_upright` + `vertical_cathedral`
 * + `cathedral_arch` combination. Other silhouettes / segmentation /
 * ornaments currently throw a clear "path data not yet implemented" error;
 * future PRs (V-4r-2, V-4r-3, ...) will add their path modules.
 */

import type { ReactElement } from 'react';

import type {
  IllustrationSpec,
  OrnamentFrame,
  PaletteRole,
  SegmentationPattern,
  SilhouetteTemplate,
  ThemeProfile,
} from './schema';
import { THEME_PROFILES } from './themes';
import { HERO_TEMPLATES } from './templates/heroes';
import { MONSTER_TEMPLATES } from './templates/monsters';
import { SEGMENTATION_PATTERNS } from './segmentation';
import { ORNAMENT_FRAMES } from './ornament';
import { planRender, validateIllustrationSpec } from './composer';

import {
  getHeroWarriorPaths,
  type HeroWarriorUprightPaths,
} from './silhouettePaths/heroWarriorUpright';
import { getVerticalCathedralLeading } from './segmentationPaths/verticalCathedral';
import { getCathedralArchPaths, type CathedralArchPaths } from './ornamentPaths/cathedralArch';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RenderIllustrationOptions {
  /** Rendered pixel size for the svg's `width`/`height`. Defaults to 120. */
  size?: number;
  /**
   * How the 24×24 viewBox should be fitted inside the rendered SVG box.
   *  - `meet` (default) preserves the aspect and letterboxes the smaller axis.
   *  - `slice` preserves the aspect but crops the larger axis so the artwork
   *    fills the entire box edge-to-edge.
   */
  fit?: 'meet' | 'slice';
}

/** Default rendered size (matches the card-tile illustration panel). */
export const DEFAULT_ILLUSTRATION_SIZE = 120;

/**
 * Compose and return the SVG for a given illustration spec.
 *
 * @throws if the spec fails schema validation
 * @throws if the spec references an unknown theme / silhouette /
 *         segmentation / ornament id
 * @throws if the spec references a silhouette/segmentation/ornament whose
 *         concrete path data has not yet been authored
 */
export function renderIllustration(
  spec: IllustrationSpec,
  options: RenderIllustrationOptions = {},
): ReactElement {
  // -------------------------------------------------------------------------
  // 1. Validate the spec. Composer produces human-readable error strings;
  //    concatenate and throw if any are present.
  // -------------------------------------------------------------------------
  const errors = validateIllustrationSpec(spec);
  if (errors.length > 0) {
    throw new Error(
      `renderIllustration: invalid IllustrationSpec ("${spec.id}"): ${errors.join('; ')}`,
    );
  }

  // -------------------------------------------------------------------------
  // 2. Resolve the four modular layers by id. Fail loud on anything missing.
  // -------------------------------------------------------------------------
  const theme = lookupTheme(spec.theme);
  const silhouette = lookupSilhouette(spec.silhouetteId);
  const segmentation = lookupSegmentation(spec.segmentationId);
  const ornament = lookupOrnament(spec.ornamentId);

  // -------------------------------------------------------------------------
  // 3. Look up the concrete path-data modules. These throw a clear error
  //    for ids the renderer has not yet implemented — UNLESS the spec
  //    carries a `rasterImageUrl`, in which case the painted raster IS
  //    the artwork and the underlying vector layers must NOT render.
  //
  //    Critically: raster-only specs commonly reference real ids
  //    (hero_warrior_upright, cathedral_arch) as placeholders, which
  //    means lookup succeeds and would draw vector silhouettes /
  //    cathedral-arch leading strokes over the painted raster — visible
  //    as dark "smudges" on the artwork. So we collapse all three vector
  //    layers to empty arrays when raster-only, regardless of whether
  //    path data exists for the referenced ids.
  // -------------------------------------------------------------------------
  const isRasterOnly = Boolean(spec.rasterImageUrl);
  const silhouettePaths = isRasterOnly ? EMPTY_SILHOUETTE_PATHS : lookupSilhouettePaths(silhouette);
  const segmentationPaths = isRasterOnly ? [] : lookupSegmentationPaths(segmentation);
  const ornamentPaths = isRasterOnly ? EMPTY_ORNAMENT_PATHS : lookupOrnamentPaths(ornament);

  // -------------------------------------------------------------------------
  // 4. Derive layer ordering from the composer's plan. This is informational
  //    — the renderer always honours the strict layer order defined in
  //    `renderContract.md`, but `plan.layers.shade` tells us whether to
  //    emit the optional shade group.
  // -------------------------------------------------------------------------
  const plan = planRender(spec);

  // -------------------------------------------------------------------------
  // 5. Resolve the palette mapping for this archetype.
  // -------------------------------------------------------------------------
  const palette = resolvePalette(theme, spec.paletteRole);

  const size = options.size ?? DEFAULT_ILLUSTRATION_SIZE;
  const fit = options.fit ?? 'meet';
  const preserveAspectRatio = fit === 'slice' ? 'xMidYMid slice' : 'xMidYMid meet';
  const label = buildAriaLabel(spec);

  // -------------------------------------------------------------------------
  // 6. Compose the SVG. Layer order is strict and matches
  //    `renderContract.md` §"Layer order".
  // -------------------------------------------------------------------------
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      preserveAspectRatio={preserveAspectRatio}
      role="img"
      aria-label={label}
      data-illustration-id={spec.id}
      data-theme={spec.theme}
    >
      <title>{label}</title>

      {/* 1. leading — leading-line family laid down first so subsequent
          fills sit ON TOP of the cell boundaries where they should. */}
      <g
        id="leading"
        stroke={palette.lead}
        strokeWidth={0.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {segmentationPaths.map((d, i) => (
          <path key={`seg-${i}`} d={d} />
        ))}
      </g>

      {/* 2. fill-primary — the dominant silhouette mass. */}
      <g
        id="fill-primary"
        fill={palette.primary}
        stroke={palette.lead}
        strokeWidth={0.25}
        strokeLinejoin="round"
      >
        {silhouettePaths.primaryPaths.map((d, i) => (
          <path key={`fp-${i}`} d={d} />
        ))}
      </g>

      {/* 3. fill-secondary — focal element (sword + jewel) in the
          accent tone. */}
      <g
        id="fill-secondary"
        fill={palette.secondary}
        stroke={palette.lead}
        strokeWidth={0.2}
        strokeLinejoin="round"
      >
        {silhouettePaths.secondaryPaths.map((d, i) => (
          <path key={`fs-${i}`} d={d} />
        ))}
      </g>

      {/* 4. shade — optional; monsters/bosses only. Reserved for future
          silhouettes. */}
      {plan.layers.shade ? <g id="shade" fill={palette.lead} stroke="none" opacity={0.6} /> : null}

      {/* 4b. raster — optional painterly fill of the illustration cell, sits
          on top of the vector silhouette layers and beneath the highlight
          and ornament. See `renderContract.md` §"Layer order". */}
      {spec.rasterImageUrl ? (
        <g id="raster">
          <image
            href={spec.rasterImageUrl}
            x={0}
            y={0}
            width={24}
            height={24}
            preserveAspectRatio={preserveAspectRatio}
          />
        </g>
      ) : null}

      {/* 5. highlight — EXACTLY ONE path, top-left, translucent. */}
      <g id="highlight" fill={palette.highlight} stroke="none" opacity={0.85}>
        <path d={silhouettePaths.highlightWedge} />
      </g>

      {/* 6. ornament — perimeter frame (arch, keystone, pillars). */}
      <g
        id="ornament"
        fill="none"
        stroke={palette.lead}
        strokeWidth={0.35}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ornamentPaths.arch.map((d, i) => (
          <path key={`oa-${i}`} d={d} />
        ))}
        {ornamentPaths.keystone.map((d, i) => (
          <path key={`ok-${i}`} d={d} fill={palette.primary} />
        ))}
        {ornamentPaths.pillars
          ? ornamentPaths.pillars.map((d, i) => <path key={`op-${i}`} d={d} />)
          : null}
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

function lookupTheme(id: string): ThemeProfile {
  const theme = THEME_PROFILES.find((t) => t.id === id);
  if (!theme) {
    throw new Error(
      `renderIllustration: unknown theme "${id}" (expected one of: ` +
        THEME_PROFILES.map((t) => t.id).join(', ') +
        ')',
    );
  }
  return theme;
}

function lookupSilhouette(id: string): SilhouetteTemplate {
  const all = [...HERO_TEMPLATES, ...MONSTER_TEMPLATES];
  const match = all.find((s) => s.id === id);
  if (!match) {
    throw new Error(
      `renderIllustration: unknown silhouetteId "${id}" (expected one of: ` +
        all.map((s) => s.id).join(', ') +
        ')',
    );
  }
  return match;
}

function lookupSegmentation(id: string): SegmentationPattern {
  const match = SEGMENTATION_PATTERNS.find((s) => s.id === id);
  if (!match) {
    throw new Error(
      `renderIllustration: unknown segmentationId "${id}" (expected one of: ` +
        SEGMENTATION_PATTERNS.map((s) => s.id).join(', ') +
        ')',
    );
  }
  return match;
}

function lookupOrnament(id: string): OrnamentFrame {
  const match = ORNAMENT_FRAMES.find((o) => o.id === id);
  if (!match) {
    throw new Error(
      `renderIllustration: unknown ornamentId "${id}" (expected one of: ` +
        ORNAMENT_FRAMES.map((o) => o.id).join(', ') +
        ')',
    );
  }
  return match;
}

// ---------------------------------------------------------------------------
// Path-data lookup — only `hero_warrior_upright`, `vertical_cathedral`, and
// `cathedral_arch` are implemented in this validation pass. Others throw
// a clear error so the author sees what's missing.
// ---------------------------------------------------------------------------

interface ResolvedSilhouettePaths {
  primaryPaths: string[];
  secondaryPaths: string[];
  highlightWedge: string;
}

function lookupSilhouettePaths(silhouette: SilhouetteTemplate): ResolvedSilhouettePaths {
  if (silhouette.id === 'hero_warrior_upright') {
    const raw: HeroWarriorUprightPaths = getHeroWarriorPaths();
    return {
      primaryPaths: [...raw.headHelm, ...raw.torsoPlate, ...raw.lowerRobesOrGreaves],
      secondaryPaths: raw.weaponVertical,
      highlightWedge: raw.highlightWedge,
    };
  }

  throw new Error(
    `renderIllustration: path data not yet implemented for silhouette: ${silhouette.id}`,
  );
}

function lookupSegmentationPaths(segmentation: SegmentationPattern): string[] {
  if (segmentation.id === 'vertical_cathedral') {
    return getVerticalCathedralLeading();
  }

  throw new Error(
    `renderIllustration: path data not yet implemented for segmentation: ${segmentation.id}`,
  );
}

function lookupOrnamentPaths(ornament: OrnamentFrame): CathedralArchPaths {
  if (ornament.id === 'cathedral_arch') {
    return getCathedralArchPaths();
  }

  throw new Error(`renderIllustration: path data not yet implemented for ornament: ${ornament.id}`);
}

// Raster-only fallbacks. When `spec.rasterImageUrl` is set the painted
// raster IS the artwork, so we feed empty arrays into all three vector
// layers — leading, fill, ornament — even when the spec references ids
// that DO have authored path data (the common pattern is to reuse
// hero_warrior_upright + cathedral_arch as placeholder ids on monster /
// item / chest specs).

const EMPTY_SILHOUETTE_PATHS: ResolvedSilhouettePaths = {
  primaryPaths: [],
  secondaryPaths: [],
  highlightWedge: '',
};

const EMPTY_ORNAMENT_PATHS: CathedralArchPaths = {
  arch: [],
  keystone: [],
};

// ---------------------------------------------------------------------------
// Palette resolution
// ---------------------------------------------------------------------------

interface ResolvedPalette {
  primary: string;
  secondary: string;
  lead: string;
  highlight: string;
}

function resolvePalette(theme: ThemeProfile, role: PaletteRole): ResolvedPalette {
  switch (role) {
    case 'hero':
      return {
        primary: theme.mapping.heroPrimary,
        secondary: theme.mapping.heroSecondary,
        lead: theme.mapping.lead,
        highlight: theme.mapping.highlight,
      };
    case 'monster':
      return {
        primary: theme.mapping.monsterPrimary,
        secondary: theme.mapping.monsterSecondary,
        lead: theme.mapping.lead,
        highlight: theme.mapping.highlight,
      };
    case 'boss':
      return {
        primary: theme.mapping.bossPrimary,
        secondary: theme.mapping.bossSecondary,
        lead: theme.mapping.lead,
        highlight: theme.mapping.highlight,
      };
    case 'legendary':
    case 'neutral':
      // Legendary and neutral roles fall back to the boss palette for now
      // (they're not used in this validation pass but must type-check).
      return {
        primary: theme.mapping.bossPrimary,
        secondary: theme.mapping.bossSecondary,
        lead: theme.mapping.lead,
        highlight: theme.mapping.highlight,
      };
  }
}

// ---------------------------------------------------------------------------
// aria-label
// ---------------------------------------------------------------------------

function buildAriaLabel(spec: IllustrationSpec): string {
  // Use the theme + archetype + subtype; avoid leaking the opaque numeric id.
  return `${capitalize(spec.theme)} ${spec.archetype} ${spec.subtype} illustration`;
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}
