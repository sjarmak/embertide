import type { SegmentationPattern } from './schema';

export const SEGMENTATION_PATTERNS: SegmentationPattern[] = [
  {
    id: 'vertical_cathedral',
    description: 'Long lead lines emphasizing posture and sacred architectural rhythm.',
    maxCells: 12,
    symmetryBias: 'high',
    suitableFor: ['hero', 'boss', 'chest'],
    lineFamilies: ['long verticals', 'shallow arches', 'central axis'],
    rules: [
      'Reserve one strong centerline for a primary symbol or body axis.',
      'Use 2-4 tall background cells behind figure.',
      'Avoid dense crosshatching near face focal zone.',
    ],
  },
  {
    id: 'radial_halo',
    description: 'Circular or sunburst segmentation around a focal head or emblem.',
    maxCells: 14,
    symmetryBias: 'high',
    suitableFor: ['hero', 'boss', 'item'],
    lineFamilies: ['radials', 'concentric arcs', 'crown wedges'],
    rules: [
      'Keep inner ring readable at small size.',
      'Do not place too many wedge cells behind detailed silhouette.',
      'Use highlight in upper-left ring wedge only.',
    ],
  },
  {
    id: 'shield_facets',
    description: 'Broad shield-like facets for stable, noble compositions.',
    maxCells: 10,
    symmetryBias: 'high',
    suitableFor: ['hero', 'chest'],
    lineFamilies: ['kite shapes', 'central crest lines', 'broad lower wedges'],
    rules: [
      'Favor large body cells over tiny decorative cuts.',
      'Works best with sentinel/warrior silhouettes.',
    ],
  },
  {
    id: 'broken_spires',
    description: 'Jagged, unstable segmentation suggesting danger or corruption.',
    maxCells: 11,
    symmetryBias: 'low',
    suitableFor: ['monster', 'boss'],
    lineFamilies: ['diagonals', 'rupture lines', 'off-axis wedges'],
    rules: [
      'Bias eye and mouth focal zones with larger surrounding cells.',
      'Avoid complete visual chaos; one dominant silhouette must remain.',
    ],
  },
  {
    id: 'hex_lattice',
    description: 'Panelized technical geometry for arcane or mechanical themes.',
    maxCells: 12,
    symmetryBias: 'medium',
    suitableFor: ['hero', 'monster', 'item'],
    lineFamilies: ['hex segments', 'panel seams', 'ring joints'],
    rules: [
      'Use selectively behind silhouette or inside armor surfaces.',
      'Do not flatten all silhouette curves into polygons.',
    ],
  },
  {
    id: 'vine_cells',
    description: 'Organic cell divisions that still read as leaded boundaries.',
    maxCells: 10,
    symmetryBias: 'medium',
    suitableFor: ['hero', 'monster', 'item'],
    lineFamilies: ['leaf splits', 'curved stems', 'petal wedges'],
    rules: [
      'Curves should support silhouette, not obscure it.',
      'Keep face/eye region free from clutter.',
    ],
  },
];
