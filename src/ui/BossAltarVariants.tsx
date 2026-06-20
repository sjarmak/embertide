import type { JSX } from 'react';
import type { ZoneId } from '../store/types';
import BossAltarPane, { type BossAltarVariant } from './BossAltarPane';
import { assetUrl } from '../assetUrl';

/**
 * Inert placeholder shown when a slot has no active boss (defeated /
 * cleared / never spawned). Kept as a footprint-stable render so the
 * altar row layout doesn't collapse when a zone's bosses are cleared.
 */
export function BossAltarCleared({ label }: { readonly label: string }): JSX.Element {
  return (
    <div className="boss-altar-pane-cleared" data-testid="boss-altar-pane-cleared">
      {label}
    </div>
  );
}

/**
 * embertide-wnj — per-zone region boss-door raster map.
 *
 * Paths resolve to APPROVED illustrations in `/public/illustrations/`.
 * When a zone has no boss-door raster, the map returns `null` and
 * `BossAltarLocked` degrades to the text-only SEALED placeholder — a
 * footprint-stable fallback that matches the pre-wnj behavior.
 *
 * v2.0 ships with a raster for every `ZoneId`; the null-tolerant shape
 * exists so v2.1 zones (maren / hollow-shrine / dune-sanctum, per
 * `ZONE_ORDER` commentary in src/rules/zones.ts) can land without a
 * finished door asset and still render a graceful locked slot.
 */
export const ZONE_BOSS_DOOR_SRC: Readonly<Record<ZoneId, string | null>> = {
  sylvani: '/illustrations/cathedral_sylvani_boss_door_001.png',
  emberpeak: '/illustrations/cathedral_emberpeak_boss_door_001.png',
  // gdd.1 / gdd.2 / gdd.3: boss-door rasters landed 2026-04-25 (FAL batch).
  maren: '/illustrations/cathedral_maren_boss_door_001.png',
  'hollow-shrine': '/illustrations/cathedral_hollow_shrine_boss_door_001.png',
  'dune-sanctum': '/illustrations/cathedral_dune_sanctum_boss_door_001.png',
  'gilded-cage': '/illustrations/cathedral_gilded_cage_boss_door_001.png',
};

export interface BossAltarLockedProps {
  /**
   * Active zone id — keys into `ZONE_BOSS_DOOR_SRC` to pick the raster.
   * When the lookup yields `null`, the locked slot renders a text-only
   * SEALED placeholder so the row layout stays stable.
   */
  readonly zoneId: ZoneId;
  /**
   * Optional descriptor of the requirement that's still unmet (e.g.
   * `"Craghorn's wild-boss key"`). Surfaces to assistive tech via
   * `aria-label` and to sighted players via the sub-label under the
   * SEALED legend. Defaults to a generic "the region's wild-boss key".
   */
  readonly requirementLabel?: string;
  /**
   * Testid override for the outer pane. Defaults to `region-boss-slot`
   * so existing test hooks continue to work when the consumer swaps
   * out the earlier `BossDoor`-inside-`BossAltarPane` structure.
   */
  readonly testId?: string;
}

/**
 * embertide-wnj — Locked region-boss altar variant.
 *
 * Renders the region-variant `BossAltarPane` frame with `locked=true`
 * wrapped around the zone's boss-door raster (via `ZONE_BOSS_DOOR_SRC`).
 * An amber lock glyph sits over the door to reinforce the "gate is
 * closed" narrative cue; the pane's existing `data-locked="true"`
 * attribute is preserved so downstream hooks (analytics, tutorial
 * overlays, CSS selectors) keep working without a prop-contract change.
 *
 * Fallback: when `ZONE_BOSS_DOOR_SRC[zoneId]` is `null`, the interior
 * collapses to the shared `BossAltarCleared`-style text placeholder
 * with label "SEALED". No broken `<img>` ever ships to the DOM.
 *
 * Sibling to `BossAltarCleared`: kept alongside in this file so the
 * three region-slot interior variants (cleared / locked / live) are
 * all colocated.
 */
export function BossAltarLocked({
  zoneId,
  requirementLabel,
  testId = 'region-boss-slot',
}: BossAltarLockedProps): JSX.Element {
  const rasterSrc = ZONE_BOSS_DOOR_SRC[zoneId];
  const gateDescriptor = requirementLabel ?? "the region's mini-boss key";
  const ariaLabel = `Locked — requires ${gateDescriptor}`;

  return (
    <BossAltarPane
      header="REGION BOSS"
      variant="region"
      disabled
      locked
      backdropZoneId={zoneId}
      ariaLabel={ariaLabel}
      testId={testId}
    >
      <div
        className="boss-altar-pane-locked"
        data-testid="boss-altar-pane-locked"
        data-zone={zoneId}
      >
        {rasterSrc !== null ? (
          <img
            src={assetUrl(rasterSrc)}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="boss-altar-pane-locked-raster"
            data-testid="boss-altar-pane-locked-raster"
            loading="lazy"
            decoding="async"
          />
        ) : null}
        <span
          className="boss-altar-pane-locked-glyph"
          data-testid="boss-altar-pane-locked-glyph"
          aria-hidden="true"
        >
          {'\u{1F512}'}
        </span>
        <div className="boss-altar-pane-locked-label" data-testid="boss-altar-pane-locked-label">
          SEALED
        </div>
      </div>
    </BossAltarPane>
  );
}

/**
 * embertide-rtf4 — Hourglass glyph used by both phase-gated
 * variants (`BossAltarDormant` for the wild slot in Stirring,
 * `BossAltarPhaseLocked` for the region slot pre-Boss). The codepoint
 * is U+231B; an explicit Unicode escape keeps the source byte-stable
 * regardless of editor encoding settings. The "wakes on a clock" cue
 * is intentionally distinct from the wild-boss-sealed padlock glyph
 * (U+1F512) used by `BossAltarLocked` — phase gates expire on a clock,
 * key gates expire on player action.
 */
const PHASE_GLYPH_HOURGLASS = '\u{231B}';

/**
 * embertide-rtf4 — Shared hourglass-glyph render used by both
 * phase-gated variants. Sibling components mount this where their
 * decorative glyph sits in the layout. Kept private (no export) since
 * the two consumers (`BossAltarDormant`, `BossAltarPhaseLocked`) are
 * the only callers.
 */
function PhaseGlyph(): JSX.Element {
  return (
    <span
      className="boss-altar-pane-phase-glyph"
      data-testid="boss-altar-pane-phase-glyph"
      aria-hidden="true"
    >
      {PHASE_GLYPH_HOURGLASS}
    </span>
  );
}

/**
 * embertide-3ub — Inert placeholder shown while a wild-boss slot is
 * SESSION-ARC DORMANT (Stirring phase, turns 1-2). Visually differentiated
 * from `BossAltarCleared` (defeated state) so the two states never blur:
 *
 *   - Cool silver/iron text tone instead of the muted parchment used for
 *     the cleared state — reads as "asleep" rather than "spent".
 *   - A secondary subline advertises WHEN the slot will become engageable
 *     (e.g. "Stirs at Turn 3"). This was the designer's core complaint:
 *     players could not tell when the dormant slot would unlock.
 *   - Same outer dimensions + padding footprint as `BossAltarCleared` so
 *     the altar row stays layout-stable through the Stirring → Rising
 *     transition.
 *
 * rtf4 (2026-04-26): added an hourglass glyph to mirror the new
 * `BossAltarPhaseLocked` variant used by the region slot — both
 * phase-gated states now read with the same "wakes on a clock" cue.
 *
 * A11y: the outer element is a `<div role="status">` with an explicit
 * aria-label that combines the primary label and the unlock cue, so
 * assistive tech announces the full "dormant — stirs at turn N" story in
 * one pass.
 */
export interface BossAltarDormantProps {
  readonly label: string;
  readonly unlockTurn: number;
}

export function BossAltarDormant({ label, unlockTurn }: BossAltarDormantProps): JSX.Element {
  const subline = `Stirs at Turn ${unlockTurn}`;
  const ariaLabel = `${label} — ${subline}`;
  return (
    <div
      className="boss-altar-pane-dormant"
      data-testid="boss-altar-pane-dormant"
      role="status"
      aria-label={ariaLabel}
    >
      <PhaseGlyph />
      <span className="boss-altar-pane-dormant-label" data-testid="boss-altar-pane-dormant-label">
        {label}
      </span>
      <span
        className="boss-altar-pane-dormant-subline"
        data-testid="boss-altar-pane-dormant-subline"
      >
        {subline}
      </span>
    </div>
  );
}

/**
 * embertide-rtf4 — Phase-gate locked altar variant.
 *
 * Pre-rtf4 the region slot rendered as a fully engageable BossStamp
 * during Stirring + Rising (turns 1-5) — clicking it threw "phase gate
 * closed" inside `engageRegionBossSlot` and the silent failure was
 * indistinguishable from a missed input. This variant surfaces the gate
 * visually with an hourglass glyph + an "Available turn N" subline so
 * the player can see when the slot will wake.
 *
 * Distinct from `BossAltarLocked`:
 *   - Padlock + boss-door raster ⇒ wild-boss-key seal (`BossAltarLocked`).
 *     The gate clears when the player drops the key — a player action.
 *   - Hourglass + "Available turn N" ⇒ phase gate (`BossAltarPhaseLocked`).
 *     The gate clears when the turn counter reaches the unlock turn — a
 *     clock event.
 *
 * Rendered inside a standard `BossAltarPane` with `disabled={true}`. The
 * pane root keeps `data-locked="false"` because phase-locks are NOT
 * key-locks — the wild-boss-sealed CSS hooks (and any analytics) must
 * not double-fire when both a phase gate and a key gate apply.
 */
export interface BossAltarPhaseLockedProps {
  readonly header: string;
  readonly variant: BossAltarVariant;
  readonly unlockTurn: number;
  /**
   * embertide round2 — active zone whose backdrop art renders behind the
   * altar-frame cutout so the phase-locked altar reads as a dim lit altar
   * (zone art under the disabled grayscale) rather than an empty/white
   * hole. Optional so non-zone consumers stay byte-identical when omitted.
   */
  readonly backdropZoneId?: ZoneId;
  /**
   * Optional override for the rendered label above the subline.
   * Defaults to "LOCKED" — Cinzel small-caps treatment via CSS keeps
   * the visual rhythm aligned with the SEALED legend used by
   * `BossAltarLocked`.
   */
  readonly label?: string;
  /**
   * Testid override for the outer pane. Consumers (`RegionBossEncounter
   * Slot`, `WildBossEncounterSlot`) pass slot-specific ids so e2e
   * scenarios can target the phase-gated state without colliding with
   * the engageable / SEALED testIds.
   */
  readonly testId?: string;
}

export function BossAltarPhaseLocked({
  header,
  variant,
  unlockTurn,
  label = 'Locked',
  testId,
  backdropZoneId,
}: BossAltarPhaseLockedProps): JSX.Element {
  const subline = `Available turn ${unlockTurn}`;
  const ariaLabel = `${label} — ${subline}`;
  return (
    <BossAltarPane
      header={header}
      variant={variant}
      disabled
      backdropZoneId={backdropZoneId}
      ariaLabel={ariaLabel}
      testId={testId}
    >
      <div
        className="boss-altar-pane-phase-locked"
        data-testid="boss-altar-pane-phase-locked"
        role="status"
      >
        <PhaseGlyph />
        <span className="boss-altar-pane-phase-label" data-testid="boss-altar-pane-phase-label">
          {label}
        </span>
        <span className="boss-altar-pane-phase-subline" data-testid="boss-altar-pane-phase-subline">
          {subline}
        </span>
      </div>
    </BossAltarPane>
  );
}
