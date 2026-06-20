/**
 * Concrete leading-line path data for the `vertical_cathedral` segmentation
 * pattern. The pattern description: "Long lead lines emphasizing posture and
 * sacred architectural rhythm."
 *
 * Rules (from `segmentation.ts`):
 *  - Reserve one strong centerline for a primary symbol or body axis.
 *  - Use 2-4 tall background cells behind figure.
 *  - Avoid dense crosshatching near face focal zone.
 *
 * Lines are drawn OVER the silhouette as "leading" — they read as glass
 * cell divisions dividing the canvas into ≤11 cells for the warrior
 * (`cellBudget: 11`).
 */

export function getVerticalCathedralLeading(): string[] {
  // Cell budget for the warrior is 11 — these leading lines subdivide the
  // background into ~7 backdrop cells (2 outer + 2 inner stacked vertically
  // between the pillars and the figure), keeping the focal zones (face,
  // weapon jewel, chest crest) free of crosshatching.
  return [
    // ------------------------------------------------------------------
    // Inner mullions — flank the figure just outside the pauldrons. These
    // are the secondary cathedral mullions inside the pillar frame; they
    // stop short of the floor so the figure plants on a clean base.
    // ------------------------------------------------------------------
    'M 5.6 9.0 L 5.6 17.2',
    'M 18.4 9.0 L 18.4 17.2',

    // ------------------------------------------------------------------
    // Mini-arch tops on each backdrop cell — petite gothic sub-arches
    // crowning the inner mullions. Mirrors the main cathedral arch in
    // miniature, establishing the "sacred rhythm" called out in the
    // segmentation rules.
    // ------------------------------------------------------------------
    'M 3.6 9.4 Q 4.6 8.4 5.6 9.0',
    'M 5.6 9.0 Q 6.6 8.4 7.6 9.4',
    'M 16.4 9.4 Q 17.4 8.4 18.4 9.0',
    'M 18.4 9.0 Q 19.4 8.4 20.4 9.4',

    // ------------------------------------------------------------------
    // Clerestory transom — single horizontal lead just below the
    // pauldron line, dividing the upper backdrop cells from the lower
    // ones. Keeps the cathedral storey-stacking read.
    // ------------------------------------------------------------------
    'M 3.6 14.0 L 5.6 14.0',
    'M 18.4 14.0 L 20.4 14.0',

    // ------------------------------------------------------------------
    // Floor lead — transverse line at the figure's planting level. Anchors
    // the warrior on the cathedral floor.
    // ------------------------------------------------------------------
    'M 3.6 17.2 L 20.4 17.2',
  ];
}
