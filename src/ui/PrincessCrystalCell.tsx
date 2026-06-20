import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import type { GameOutcome, Phase, PrincessCrystalState } from '../store/types';
import { PRINCESS_CRYSTAL_INITIAL_CHARGES } from '../store/slices/crystal';
import { assetUrl } from '../assetUrl';
import './PrincessCrystalCell.css';

// 2026-04-23 designer decision: skip the hairline stage (the crack was
// too subtle to read at the card-size thumbnail — felt like noise, not
// damage). Stages 0+1 both show the whole crystal; stage 2 jumps
// straight to the visible-crack raster; stage 3 shows pre-break.
const CRYSTAL_RASTER_BY_STAGE: Readonly<Record<0 | 1 | 2 | 3, string>> = {
  0: '/illustrations/cathedral_princess_crystal_001.png',
  1: '/illustrations/cathedral_princess_crystal_001.png',
  2: '/illustrations/cathedral_princess_crystal_crack2_001.png',
  3: '/illustrations/cathedral_princess_crystal_crack3_001.png',
};
// 2026-04-26 follow-up: freed Aurelia swaps to the light-arrow shot per
// user direction. The previous portrait (`cathedral_aurelia_freed_001`)
// shipped inside a leaded-glass pane with a Cinzel name header and a
// warm gold-glow drop-shadow — flagged as too ornate. The replacement
// is the bare light-arrow raster, sized to fit the same art-surface
// the crystal occupies (matches the player champion-slot portrait
// vocabulary), with no border / header / glow.
const AURELIA_FREED_RASTER = '/illustrations/cathedral_aurelia_light_arrow_001.webp';

export interface PrincessCrystalCellProps {
  readonly crystal: PrincessCrystalState;
  readonly phase: Phase;
  readonly outcome: GameOutcome;
  /**
   * Is the ACTIVE (current-turn) player downed? Downed players cannot
   * take main-phase actions including Strike (amendment A3). Defaults
   * to false if omitted — callers wiring against live state should
   * always thread this through.
   */
  readonly activePlayerDowned?: boolean;
  readonly onStrike: () => void;
}

/**
 * Crack-stage thresholds, computed from `charges / maxCharges`. p5uw
 * (2026-04-25) re-tuned the thresholds so the dramatic pre-break stage
 * (crack3) actually surfaces during normal play. Pre-fix at maxCharges=5
 * the pre-break raster only rendered at charges=0, but charges=0
 * immediately auto-strikes → freed → Aurelia portrait, so the raster was
 * effectively unreachable. New mapping for maxCharges=5:
 *   stage 0 (no cracks)        — charges 4-5  (ratio > 0.6)
 *   stage 1 (hairline, hidden) — charges 3    (ratio > 0.4)
 *   stage 2 (visible cracks)   — charges 2    (ratio > 0.2)
 *   stage 3 (pre-break cracks) — charges 0-1  (ratio <= 0.2)
 * The `charges === 0` terminal is still explicit so the pre-break stage
 * is guaranteed even if `maxCharges` changes under us.
 */
function crackStage(charges: number, maxCharges: number): 0 | 1 | 2 | 3 {
  if (charges <= 0) return 3;
  const ratio = charges / maxCharges;
  if (ratio > 0.6) return 0;
  if (ratio > 0.4) return 1;
  if (ratio > 0.2) return 2;
  return 3;
}

/**
 * PrincessCrystalCell — visible permanent-zone UI for REQ-8 / u-2e.
 *
 * Designer feedback 2026-04-22 rev-3:
 *   The Strike button is redundant once charges hit zero — the cell
 *   auto-fires `onStrike` via the useEffect below, and there's no
 *   player-driven action to attach a button to. When the princess is
 *   freed, the crystal's fade-out reveals a warm-glow portrait of
 *   Princess Aurelia in place of the crystal — no "Wisdom freed!" text
 *   banner (the Embertide strip and Aurelia portrait carry the message).
 *
 * Shipped behavior:
 *   (1) Transparent root — no blueish backdrop-blur pane.
 *   (2) Radial glow halo behind the crystal (ambient pulse).
 *   (3) Integrity bar below the crystal, pink/rose to match the crystal.
 *   (4) Stage-keyed crystal raster — the cracks are baked into four
 *       distinct PNGs (whole / hairline / visible / pre-break) and the
 *       cell swaps `<img src>` based on `crackStage()`. Replaces the v1
 *       SVG polyline overlay which read as "janky black lines" against
 *       the pink glass (designer feedback 2026-04-23).
 *   (5) Auto-strike: when charges hit 0 and the game allows it, the UI
 *       fires `onStrike()` automatically. No manual button is rendered.
 *   (6) Break celebration: when `freed` flips true, the crystal fades
 *       + scales while a radial shatter burst flashes, and a glowing
 *       Aurelia portrait fades in at the same position.
 */
export default function PrincessCrystalCell({
  crystal,
  phase,
  outcome,
  activePlayerDowned = false,
  onStrike,
}: PrincessCrystalCellProps): JSX.Element {
  const freed = crystal.freed;
  const maxCharges = PRINCESS_CRYSTAL_INITIAL_CHARGES;
  const stage = crackStage(crystal.charges, maxCharges);
  const fillPercent = Math.max(0, Math.min(100, (crystal.charges / maxCharges) * 100));

  const ariaLabel = freed
    ? 'Princess Aurelia — freed from the crystal'
    : `Princess Crystal — ${crystal.charges} of ${maxCharges} charges remaining`;

  // Auto-strike guard — fires ONCE when charges hit 0 and game state
  // allows the Strike. The reducer itself has defensive no-op guards so
  // calling it when freed/wrong-phase/downed is safe, but we also check
  // here to avoid needless invocations + to preserve the user-readable
  // disabled-state semantics (if the player is downed the UI should
  // wait for revive before freeing the princess, matching amendment A3).
  const autoFiredRef = useRef(false);
  useEffect(() => {
    if (freed) {
      autoFiredRef.current = false; // reset after freed so a new game can re-arm
      return;
    }
    if (autoFiredRef.current) return;
    if (crystal.charges !== 0) return;
    if (phase !== 'Main') return;
    if (outcome !== null) return;
    if (activePlayerDowned) return;
    autoFiredRef.current = true;
    onStrike();
  }, [crystal.charges, freed, phase, outcome, activePlayerDowned, onStrike]);

  // Break celebration state — briefly render the shatter burst after
  // `freed` transitions false → true so the player reads "crystal breaks,
  // wisdom released" as one continuous beat. The burst element auto-decays
  // via its CSS animation (1.4s) after which we drop it from the DOM.
  const [showBurst, setShowBurst] = useState(false);
  const prevFreedRef = useRef(freed);
  useEffect(() => {
    if (!prevFreedRef.current && freed) {
      setShowBurst(true);
      const t = setTimeout(() => setShowBurst(false), 1500);
      prevFreedRef.current = freed;
      return () => clearTimeout(t);
    }
    prevFreedRef.current = freed;
    return undefined;
  }, [freed]);

  return (
    <div
      data-testid="princess-crystal-cell"
      className="princess-crystal-cell"
      data-freed={freed ? 'true' : 'false'}
      aria-label={ariaLabel}
    >
      <div className="princess-crystal-art-surface">
        {/*
         * 9eou rev-4 (2026-04-26): the ambient glow halo behind the
         * crystal is dropped entirely per user feedback ("no glow on
         * aurelia crystal at all"). The freed-state amber pulse is also
         * gone — the cracked-crystal raster + integrity bar are the
         * complete read against the cream pane.
         */}
        {!freed && (
          <img
            data-testid="princess-crystal-raster"
            data-stage={stage}
            className="princess-crystal-raster"
            data-breaking={showBurst ? 'true' : 'false'}
            data-freed="false"
            src={assetUrl(CRYSTAL_RASTER_BY_STAGE[stage])}
            alt=""
          />
        )}
        {showBurst && (
          <div
            data-testid="princess-crystal-shatter-burst"
            className="princess-crystal-shatter-burst"
            aria-hidden="true"
          />
        )}
        {freed && (
          <img
            data-testid="princess-crystal-aurelia-freed"
            className="princess-crystal-aurelia-freed"
            src={assetUrl(AURELIA_FREED_RASTER)}
            alt="Princess Aurelia, freed from the crystal"
          />
        )}
      </div>

      {/* Integrity bar — rendered only pre-freed. Once the princess is
          freed the bar disappears and the Aurelia portrait tells the story
          on its own (no banner text per designer feedback 2026-04-22). */}
      {!freed && (
        <div
          data-testid="princess-crystal-integrity-bar"
          className="princess-crystal-integrity-bar"
          role="progressbar"
          aria-valuenow={crystal.charges}
          aria-valuemin={0}
          aria-valuemax={maxCharges}
          aria-label={`Crystal integrity ${crystal.charges} of ${maxCharges}`}
        >
          <div
            data-testid="princess-crystal-integrity-fill"
            className="princess-crystal-integrity-fill"
            data-depleted={crystal.charges === 0 ? 'true' : 'false'}
            style={{ width: `${fillPercent}%` }}
          />
        </div>
      )}
    </div>
  );
}
