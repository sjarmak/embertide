/**
 * Concrete path data for the `cathedral_arch` ornament frame.
 *
 * From `ornament.ts`:
 *  - Gothic upper arch, side mullions, and restrained reliquary framing.
 *  - Motifs: arch, spire, mullion, keystone.
 *  - Rules:
 *      - Frame should reinforce verticality.
 *      - Keep the keystone visible at 24px.
 *      - Do not fill the lower corners with detail.
 *
 * The arch crowns the upper third of the canvas; thin pillars frame the
 * figure left/right without entering the central focal zone. The keystone
 * is a chunky trapezoid at the apex so it reads even at 24px.
 */

export interface CathedralArchPaths {
  arch: string[];
  keystone: string[];
  pillars?: string[];
}

export function getCathedralArchPaths(): CathedralArchPaths {
  return {
    // Pointed gothic (lancet-style) arch — a true two-arc sweep meeting at
    // a sharp apex above the figure's helm. The two arcs spring from the
    // top of each pillar (y≈8) and meet at (12, 1.6) — that apex is where
    // the keystone snaps in. Drawn as two quadratic bezier paths so the
    // shape reads as proper gothic, not a soft semicircle.
    arch: [
      // Left arc — springs from (2.6, 8.0), curves up to apex (12, 1.6).
      'M 2.6 8.0 Q 2.6 3.2 12.0 1.6',
      // Right arc — mirror.
      'M 21.4 8.0 Q 21.4 3.2 12.0 1.6',
      // Inner archivolt (a parallel inner trace 0.7px inside) — adds the
      // "stone band" reading without filling.
      'M 3.6 8.2 Q 3.6 4.0 12.0 2.6',
      'M 20.4 8.2 Q 20.4 4.0 12.0 2.6',
    ],

    // Keystone — sits at the apex of the arch as a distinct trapezoidal
    // wedge integrated into the arch line, not floating above it. The
    // narrow end points DOWN (true keystone profile) and the wide end caps
    // the apex.
    keystone: [
      // Trapezoidal keystone, wide top, narrow bottom, sitting astride the
      // apex point at (12, 1.6).
      'M 10.6 0.6 L 13.4 0.6 L 12.9 2.4 L 11.1 2.4 Z',
      // Small jewel set in the keystone center — adds visual punctuation.
      'M 12.0 1.0 L 12.5 1.5 L 12.0 2.0 L 11.5 1.5 Z',
    ],

    // Side pillars/mullions — start where the arch springs (y=8) and run
    // straight down to the floor. Two parallel lines per pillar give a
    // stacked-stone column reading rather than a single thin line.
    pillars: [
      // Left pillar outer + inner.
      'M 2.6 8.0 L 2.6 22.5',
      'M 3.6 8.2 L 3.6 22.5',
      // Right pillar outer + inner.
      'M 21.4 8.0 L 21.4 22.5',
      'M 20.4 8.2 L 20.4 22.5',
      // Pillar capitals (small horizontal accent at the springing line).
      'M 2.4 8.0 L 3.8 8.0',
      'M 20.2 8.0 L 21.6 8.0',
      // Pillar bases (slightly wider plinth at the floor).
      'M 2.2 22.5 L 4.0 22.5',
      'M 20.0 22.5 L 21.8 22.5',
    ],
  };
}
