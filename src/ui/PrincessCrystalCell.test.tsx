import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PrincessCrystalCell from './PrincessCrystalCell';
import type { GameOutcome, Phase, PrincessCrystalState } from '../store/types';

interface RenderOverrides {
  readonly crystal?: Partial<PrincessCrystalState>;
  readonly phase?: Phase;
  readonly outcome?: GameOutcome;
  readonly activePlayerDowned?: boolean;
  readonly onStrike?: () => void;
}

function renderCell(o: RenderOverrides = {}) {
  // vj52: PRINCESS_CRYSTAL_INITIAL_CHARGES bumped 5 → 8. Default fixture
  // tracks the live constant so "full charges" assertions don't drift.
  const crystal: PrincessCrystalState = {
    charges: 8,
    freed: false,
    ...o.crystal,
  };
  const onStrike = o.onStrike ?? (() => undefined);
  return render(
    <PrincessCrystalCell
      crystal={crystal}
      phase={o.phase ?? 'Main'}
      outcome={o.outcome ?? null}
      activePlayerDowned={o.activePlayerDowned ?? false}
      onStrike={onStrike}
    />,
  );
}

describe('PrincessCrystalCell (u-2e) — rev-3 (auto-strike + aurelia reveal)', () => {
  it('renders the root cell with a sensible aria-label at full charges', () => {
    renderCell();
    const root = screen.getByTestId('princess-crystal-cell');
    expect(root).toBeInTheDocument();
    expect(root.getAttribute('aria-label')).toMatch(/8 of 8/);
  });

  it('no blueish rectangular pane — root cell is transparent (no inline background)', () => {
    renderCell();
    const root = screen.getByTestId('princess-crystal-cell');
    expect(root.style.background).toBe('');
    expect(root.style.backdropFilter ?? '').toBe('');
  });

  it('renders the finalized cathedral_princess_crystal raster pre-freed', () => {
    renderCell();
    const raster = screen.getByTestId('princess-crystal-raster') as HTMLImageElement;
    expect(raster).toBeInTheDocument();
    expect(raster.getAttribute('src')).toContain('cathedral_princess_crystal_001.png');
    expect(screen.queryByTestId('art-pending-frame-ribbon')).toBeNull();
  });

  it('does NOT render a coloured glow halo behind the crystal (9eou rev-4 2026-04-26)', () => {
    // User feedback: the sapphire/amber halo competed with the cream
    // parchment pane behind the cell. The glow div is now omitted
    // entirely; the crystal raster sits flat on the pane.
    renderCell();
    expect(screen.queryByTestId('princess-crystal-glow')).toBeNull();
  });

  it('does NOT render a Strike button (auto-strike is the only path; designer 2026-04-22)', () => {
    renderCell({ crystal: { charges: 0, freed: false }, phase: 'End' });
    expect(screen.queryByTestId('princess-crystal-strike-button')).toBeNull();
  });

  it('does NOT render a "Wisdom freed" text banner (designer 2026-04-22)', () => {
    renderCell({ crystal: { charges: 0, freed: true } });
    expect(screen.queryByTestId('princess-crystal-freed-banner')).toBeNull();
  });

  it('reveals the Princess Aurelia portrait once freed=true, hiding the crystal raster', () => {
    renderCell({ crystal: { charges: 0, freed: true } });
    const aurelia = screen.getByTestId('princess-crystal-aurelia-freed') as HTMLImageElement;
    expect(aurelia).toBeInTheDocument();
    expect(aurelia.getAttribute('src')).toContain('cathedral_aurelia_light_arrow_001');
    // The crystal raster is unmounted once the princess is freed — the
    // Aurelia portrait takes its visual slot.
    expect(screen.queryByTestId('princess-crystal-raster')).toBeNull();
    // Root aria-label reads as "freed" story, not charge count.
    expect(screen.getByTestId('princess-crystal-cell').getAttribute('aria-label')).toMatch(
      /freed/i,
    );
  });
});

describe('PrincessCrystalCell integrity bar', () => {
  it('renders an integrity progressbar with correct aria values at 8/8', () => {
    // vj52: max charges bumped 5 → 8.
    renderCell();
    const bar = screen.getByTestId('princess-crystal-integrity-bar');
    expect(bar).toBeInTheDocument();
    expect(bar.getAttribute('role')).toBe('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('8');
    expect(bar.getAttribute('aria-valuemax')).toBe('8');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    const fill = screen.getByTestId('princess-crystal-integrity-fill');
    expect(fill.style.width).toBe('100%');
  });

  it('depletes the fill width proportionally as charges drop', () => {
    // vj52 ratios at max=8: 6/8 = 75%, 2/8 = 25%.
    const { rerender } = renderCell({ crystal: { charges: 6, freed: false } });
    let fill = screen.getByTestId('princess-crystal-integrity-fill');
    expect(fill.style.width).toBe('75%');

    rerender(
      <PrincessCrystalCell
        crystal={{ charges: 2, freed: false }}
        phase="Main"
        outcome={null}
        activePlayerDowned={false}
        onStrike={() => undefined}
      />,
    );
    fill = screen.getByTestId('princess-crystal-integrity-fill');
    expect(fill.style.width).toBe('25%');
  });

  it('bar width reaches 0% and marks depleted at charges=0', () => {
    renderCell({
      crystal: { charges: 0, freed: false },
      // Phase=End avoids auto-strike so we can observe the 0%-depleted
      // state synchronously without the strike side-effect racing the assert.
      phase: 'End',
    });
    const fill = screen.getByTestId('princess-crystal-integrity-fill');
    expect(fill.style.width).toBe('0%');
    expect(fill.getAttribute('data-depleted')).toBe('true');
  });

  it('integrity bar unmounts once freed=true (Aurelia portrait replaces the crystal art)', () => {
    renderCell({ crystal: { charges: 0, freed: true } });
    expect(screen.queryByTestId('princess-crystal-integrity-bar')).toBeNull();
    // And no banner text anywhere — the Aurelia portrait carries the story.
    expect(screen.queryByTestId('princess-crystal-freed-banner')).toBeNull();
  });
});

describe('PrincessCrystalCell crack stages (raster swap)', () => {
  // 2026-04-23: the crack overlay is no longer an SVG polyline; it's a
  // stage-keyed raster swap. Each stage loads a different chroma-keyed
  // PNG baked with the appropriate level of fracture damage. The public
  // surface is the `data-stage` attribute on the crystal <img>.
  const rasterStageAttr = (): string | null =>
    screen.getByTestId('princess-crystal-raster').getAttribute('data-stage');

  const rasterSrc = (): string =>
    screen.getByTestId('princess-crystal-raster').getAttribute('src') ?? '';

  // vj52: max charges bumped 5 → 8. crackStage thresholds are ratio-based
  // (>0.6 → 0, >0.4 → 1, >0.2 → 2, else 3); at max=8 the stage mapping
  // lands as: charges 5-8 → stage 0, charges 4 → stage 1, charges 2-3 →
  // stage 2, charges 0-1 → stage 3. Stage 1 collapses to a single charge
  // value at max=8 — that's the natural consequence of holding the
  // ratio thresholds constant while bumping the denominator.
  it('stage 0 — whole-crystal raster at full charges (8/8)', () => {
    renderCell();
    expect(rasterStageAttr()).toBe('0');
    expect(rasterSrc()).toContain('cathedral_princess_crystal_001.png');
  });

  it('stage 0 at 5/8 (ratio 0.625) — still no visible damage', () => {
    renderCell({ crystal: { charges: 5, freed: false } });
    expect(rasterStageAttr()).toBe('0');
    expect(rasterSrc()).toContain('cathedral_princess_crystal_001.png');
  });

  it('stage 1 at 4/8 (ratio 0.5) — still shows the whole crystal (hairline stage is intentionally skipped)', () => {
    renderCell({ crystal: { charges: 4, freed: false } });
    expect(rasterStageAttr()).toBe('1');
    // Designer decision 2026-04-23: hairline cracks were too subtle at
    // card size — stages 0 and 1 both render the whole crystal. First
    // visible damage kicks in at stage 2.
    expect(rasterSrc()).toContain('cathedral_princess_crystal_001.png');
    expect(rasterSrc()).not.toContain('crack');
  });

  it('stage 2 — visible-crack raster at 3/8 (ratio 0.375)', () => {
    // p5uw (2026-04-25): visible-crack stage 2 covers the mid-damage band.
    // At max=8 (vj52) this is charges 2 or 3.
    renderCell({ crystal: { charges: 3, freed: false } });
    expect(rasterStageAttr()).toBe('2');
    expect(rasterSrc()).toContain('cathedral_princess_crystal_crack2_001.png');
  });

  it('stage 3 — pre-break raster at 1/8 (ratio 0.125) — visible BEFORE auto-strike (p5uw)', () => {
    // p5uw (2026-04-25): pre-break crystal is the last frame the player
    // sees before the princess is freed. With auto-strike firing at
    // charges=0 the pre-fix mapping never let crack3 surface in normal
    // play — moving it to charges=1 fixes that. (vj52: ratio 0.125 at
    // max=8.)
    renderCell({ crystal: { charges: 1, freed: false } });
    expect(rasterStageAttr()).toBe('3');
    expect(rasterSrc()).toContain('cathedral_princess_crystal_crack3_001.png');
  });

  it('stage 3 — pre-break raster at 0/8 (phase=End gates auto-strike)', () => {
    renderCell({
      crystal: { charges: 0, freed: false },
      phase: 'End',
    });
    expect(rasterStageAttr()).toBe('3');
    expect(rasterSrc()).toContain('cathedral_princess_crystal_crack3_001.png');
  });

  it('crystal raster is unmounted once the crystal is freed (Aurelia portrait replaces it)', () => {
    renderCell({ crystal: { charges: 0, freed: true } });
    expect(screen.queryByTestId('princess-crystal-raster')).toBeNull();
  });
});

describe('PrincessCrystalCell auto-strike (charges=0 auto-fires onStrike)', () => {
  it('fires onStrike exactly once when charges hit 0 in Main phase with no guards tripping', () => {
    const onStrike = vi.fn();
    renderCell({
      crystal: { charges: 0, freed: false },
      phase: 'Main',
      outcome: null,
      activePlayerDowned: false,
      onStrike,
    });
    expect(onStrike).toHaveBeenCalledTimes(1);
  });

  it('does NOT auto-strike when phase !== Main (phase guard mirrors reducer)', () => {
    const onStrike = vi.fn();
    renderCell({
      crystal: { charges: 0, freed: false },
      phase: 'Upkeep',
      onStrike,
    });
    expect(onStrike).not.toHaveBeenCalled();
  });

  it('does NOT auto-strike when a terminal outcome is set', () => {
    const onStrike = vi.fn();
    renderCell({
      crystal: { charges: 0, freed: false },
      outcome: 'win',
      onStrike,
    });
    expect(onStrike).not.toHaveBeenCalled();
  });

  it('does NOT auto-strike when the active player is downed (amendment A3)', () => {
    const onStrike = vi.fn();
    renderCell({
      crystal: { charges: 0, freed: false },
      activePlayerDowned: true,
      onStrike,
    });
    expect(onStrike).not.toHaveBeenCalled();
  });

  it('does NOT auto-strike while charges > 0', () => {
    const onStrike = vi.fn();
    renderCell({
      crystal: { charges: 2, freed: false },
      onStrike,
    });
    expect(onStrike).not.toHaveBeenCalled();
  });

  it('does NOT auto-strike when the crystal is already freed (no re-fire loop)', () => {
    const onStrike = vi.fn();
    renderCell({
      crystal: { charges: 0, freed: true },
      onStrike,
    });
    expect(onStrike).not.toHaveBeenCalled();
  });
});
