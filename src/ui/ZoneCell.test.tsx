import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ZoneCell from './ZoneCell';
import { ZONE_METADATA } from '../rules/zones';
import type { ZoneId } from '../store/types';

/**
 * Per u-5a acceptance amended by v2.0 art finalization (beads x54 /
 * ha6 / efu, 2026-04-20): ZoneCell is a pure-art surface. The
 * painterly stained-glass raster IS the zone identity — no color
 * tint, no visible name text. Zone name survives only as the root's
 * aria-label for screen readers; themeHint survives as an sr-only
 * span.
 */

function renderFor(zoneId: ZoneId) {
  return render(<ZoneCell zone={ZONE_METADATA[zoneId]} />);
}

describe('ZoneCell (u-5a + art finalization)', () => {
  it.each<[ZoneId, string, string]>([
    ['sylvani', 'Sylvanwood', '/illustrations/cathedral_zone_sylvani_001.webp'],
    ['emberpeak', 'Emberpeak', '/illustrations/cathedral_zone_emberpeak_001.webp'],
    ['gilded-cage', 'Gilded Cage', '/illustrations/cathedral_zone_gilded_cage_001.webp'],
  ])(
    'renders finalized %s raster with display name in aria-label only',
    (zoneId, displayName, rasterSrc) => {
      renderFor(zoneId);
      const root = screen.getByTestId(`zone-cell-${zoneId}`);
      expect(root).toBeInTheDocument();
      // Zone name lives on the root aria-label for assistive tech; there is
      // NO longer a visible name element inside the cell.
      expect(root.getAttribute('aria-label')).toContain(displayName);
      expect(screen.queryByTestId(`zone-cell-${zoneId}-name`)).not.toBeInTheDocument();

      // The raster <img> is the only visible content.
      const raster = screen.getByTestId(`zone-raster-${zoneId}`) as HTMLImageElement;
      expect(raster).toBeInTheDocument();
      expect(raster.getAttribute('src')).toBe(rasterSrc);
    },
  );

  it.each<ZoneId>(['sylvani', 'emberpeak', 'gilded-cage'])(
    'does NOT render the [v2-art-pending] ribbon for %s (art landed)',
    (zoneId) => {
      renderFor(zoneId);
      expect(
        screen.queryByTestId(`art-pending-frame-zone-${zoneId}-ribbon`),
      ).not.toBeInTheDocument();
    },
  );

  it('exposes the zone theme hint via an sr-only hint node', () => {
    renderFor('sylvani');
    const hint = screen.getByTestId('zone-cell-sylvani-theme-hint');
    expect(hint).toBeInTheDocument();
    expect(hint.textContent).toBe(ZONE_METADATA.sylvani.themeHint);
  });

  it('renders a data-zone-id attribute on the root for CSS / test hooks', () => {
    renderFor('emberpeak');
    const root = screen.getByTestId('zone-cell-emberpeak');
    expect(root.getAttribute('data-zone-id')).toBe('emberpeak');
  });
});
