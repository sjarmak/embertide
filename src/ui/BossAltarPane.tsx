import { useState, type JSX, type ReactNode } from 'react';
import type { ZoneId } from '../store/types';
import { ZONE_RASTER, ZONE_FILTER } from './zoneRaster';
import './BossAltarPane.css';

/**
 * Module-level dedupe set for ornament-load failures. We want `console.warn`
 * to fire at most ONCE per offending `src` across the whole session, not
 * once per render / once per mount. Tests reset the set via
 * `__resetOrnamentWarnings` to keep assertions deterministic.
 */
const warnedOrnamentSrcs = new Set<string>();

function warnOrnamentLoadFailure(src: string): void {
  if (warnedOrnamentSrcs.has(src)) return;
  warnedOrnamentSrcs.add(src);
  console.warn(`[boss-altar-pane] ornament raster failed to load: ${src}`);
}

/** Test-only escape hatch to clear the dedupe set between cases. */
export function __resetOrnamentWarnings(): void {
  warnedOrnamentSrcs.clear();
}

/**
 * REQ-32 (u-9d) — BossAltarPane primitive.
 *
 * Renders the stained-glass panel shared by the Wild / Region encounter
 * slots and the Vurmox DESTINY slot. The `variant` prop drives the visual
 * treatment via CSS custom properties (see `BossAltarPane.css`):
 *
 *   - wild    — gold ember pulse
 *   - region  — amber ember pulse
 *   - destiny — purple-to-gold gradient border, persistent flame, gold aura
 *
 * The pane is rendered as a `<button>` when an `onClick` handler is
 * supplied and the pane is not disabled; otherwise it falls back to a
 * `<div>` with `aria-disabled="true"`. This keeps the cleared state
 * focusable-but-inert and guarantees no tap handler fires through.
 *
 * Why CSS variables: bead `embertide-b56` plans to promote this pane
 * into a unified primitive. The variant-specific colors and timings are
 * all read from `--boss-altar-*` custom properties, so b56 can rename
 * the base class and absorb the variants without rewriting any consumer.
 */

export type BossAltarVariant = 'wild' | 'region' | 'destiny';

/**
 * REQ-33 (u-10c, u-10d, PRD §D2-§D3) — Variant → default ornament raster map.
 *
 * Shared assets per variant (wild/region) plus a bespoke Vurmox raster for
 * destiny (u-10d, PRD §D3 — obsidian-gold altar, same 1× scale as wild/region;
 * purple→gold border + pulsing gold aura carry the distinction). Resolution
 * rule: `ornamentSrc ?? map[variant]` — explicit callers still win.
 */
const ORNAMENT_SRC_BY_VARIANT: Readonly<Record<BossAltarVariant, string | undefined>> = {
  wild: '/illustrations/cathedral_altar_frame_wild_001.webp',
  region: '/illustrations/cathedral_altar_frame_region_001.webp',
  destiny: '/illustrations/cathedral_altar_destiny_vurmox_001.webp',
};

export interface BossAltarPaneProps {
  readonly header: string;
  readonly variant: BossAltarVariant;
  readonly disabled?: boolean;
  /**
   * gm0.12 (REVERSE-Q8) — marks the pane as sealed by an unmet gate
   * (e.g. the region-boss slot locked behind missing wild-boss keys).
   * Emits `data-locked="true"` on the root so the gm0.13 boss-door
   * art can hook the attribute without a prop contract change. Implies
   * `disabled`: locked panes are non-interactive. Default false.
   */
  readonly locked?: boolean;
  readonly onClick?: () => void;
  readonly ariaLabel?: string;
  readonly testId?: string;
  readonly children?: ReactNode;
  /**
   * REQ-33 (u-10a, PRD §D2) — Optional ornament raster src. When provided,
   * an `<img>` is absolutely positioned over the stained-glass CSS pane
   * (z-index above the pane background, below the header + body children).
   *
   * Graceful degradation: if the raster fails to load (404 / decode
   * error), the `<img>` is hidden for the remainder of the session and
   * `console.warn` fires ONCE per unique src (module-level dedupe). The
   * rest of the pane renders unchanged, so u-9d regression safety holds.
   *
   * When this prop is omitted, the render output is byte-identical to the
   * pre-u-10a behavior.
   */
  readonly ornamentSrc?: string;
  /**
   * embertide-4e21 — Optional zone-backdrop art for the PRE-CLICK
   * boss-selection tile. When set, the active zone's painterly raster
   * (the same art `ZoneCell` paints board-wide) is rendered behind the
   * boss portrait, replacing the solid jewel fill that read as an
   * off-theme purple/red backdrop. A token-based vignette scrim keeps the
   * name/HP readout legible over the art.
   *
   * Wired ONLY into the live/engageable slots — dormant, cleared,
   * phase-locked, and key-locked states keep their existing treatment
   * (those panes are `data-disabled` and never showed the offending
   * solid-color tile to begin with). When omitted, the render is
   * byte-identical to the pre-4e21 output.
   */
  readonly backdropZoneId?: ZoneId;
}

export default function BossAltarPane({
  header,
  variant,
  disabled = false,
  locked = false,
  onClick,
  ariaLabel,
  testId,
  children,
  ornamentSrc,
  backdropZoneId,
}: BossAltarPaneProps): JSX.Element {
  const resolvedLabel = ariaLabel ?? header;
  const effectivelyDisabled = disabled || locked;
  const isInteractive = !effectivelyDisabled && typeof onClick === 'function';

  // u-10c: resolve the ornament src from the variant map when the caller
  // didn't pass one explicitly. Explicit `ornamentSrc` still wins — keeps
  // u-10a test coverage (synthetic-failure src) intact and lets u-10d
  // override destiny with the Vurmox-specific raster later.
  const resolvedOrnamentSrc = ornamentSrc ?? ORNAMENT_SRC_BY_VARIANT[variant];

  // Session-scoped "this specific src failed" latch. Re-mounts reset it,
  // which is fine: a fresh mount gets a fresh load attempt. The
  // module-level `warnedOrnamentSrcs` set is what guarantees console.warn
  // dedup across mounts.
  const [ornamentFailed, setOrnamentFailed] = useState(false);

  const ornament =
    resolvedOrnamentSrc !== undefined && !ornamentFailed ? (
      <img
        src={resolvedOrnamentSrc}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="boss-altar-pane-ornament"
        data-testid="boss-altar-pane-ornament"
        loading="lazy"
        decoding="async"
        onError={() => {
          warnOrnamentLoadFailure(resolvedOrnamentSrc);
          setOrnamentFailed(true);
        }}
      />
    ) : null;

  // REQ-33 (u-10d, PRD §D3) — Gold-flame mandala overlay. Pure CSS
  // (radial + conic gradient + @keyframes spin). Rendered ONLY for the
  // destiny variant — wild and region panes are byte-identical to the
  // pre-u-10d output. Z-index sits between the ornament raster (1) and
  // the header/body children (3, bumped from 2 for this layering) so
  // the mandala never occludes the boss portrait or HP readout.
  const mandala =
    variant === 'destiny' ? (
      <div
        className="boss-altar-pane-mandala"
        data-testid="boss-altar-pane-mandala"
        aria-hidden="true"
      />
    ) : null;

  // embertide-4e21 — zone-backdrop layer (z-index 0, below the
  // ornament frame and header/body). Shows the boss's zone art through
  // the altar frame's transparent interior instead of the solid jewel
  // fill. The atmospheric `ZONE_FILTER` pass + the CSS `::after` scrim
  // keep the painted detail from competing with the portrait + readout.
  const backdrop =
    backdropZoneId !== undefined ? (
      <div
        className="boss-altar-pane-backdrop"
        data-testid="boss-altar-pane-backdrop"
        aria-hidden="true"
      >
        <img
          src={ZONE_RASTER[backdropZoneId]}
          alt=""
          aria-hidden="true"
          draggable={false}
          loading="lazy"
          decoding="async"
          style={{ filter: ZONE_FILTER[backdropZoneId] }}
        />
      </div>
    ) : null;

  const backdropAttr = backdropZoneId !== undefined ? 'true' : undefined;

  if (isInteractive) {
    return (
      <button
        type="button"
        data-testid={testId ?? 'boss-altar-pane'}
        data-variant={variant}
        data-disabled="false"
        data-locked="false"
        data-backdrop={backdropAttr}
        data-touch-target="true"
        className="boss-altar-pane"
        aria-label={resolvedLabel}
        onClick={onClick}
      >
        {backdrop}
        {ornament}
        {mandala}
        <div className="boss-altar-pane-header" data-testid="boss-altar-pane-header">
          {header}
        </div>
        <div className="boss-altar-pane-body">{children}</div>
      </button>
    );
  }

  return (
    <div
      data-testid={testId ?? 'boss-altar-pane'}
      data-variant={variant}
      data-disabled={effectivelyDisabled ? 'true' : 'false'}
      data-locked={locked ? 'true' : 'false'}
      data-backdrop={backdropAttr}
      className="boss-altar-pane"
      role="group"
      aria-label={resolvedLabel}
      aria-disabled={effectivelyDisabled ? 'true' : undefined}
    >
      {backdrop}
      {ornament}
      {mandala}
      <div className="boss-altar-pane-header" data-testid="boss-altar-pane-header">
        {header}
      </div>
      <div className="boss-altar-pane-body">{children}</div>
    </div>
  );
}
