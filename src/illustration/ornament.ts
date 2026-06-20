import type { OrnamentFrame } from './schema';

export const ORNAMENT_FRAMES: OrnamentFrame[] = [
  {
    id: 'cathedral_arch',
    description: 'Gothic upper arch, side mullions, and restrained reliquary framing.',
    density: 'medium',
    suitableFor: ['hero', 'monster', 'boss', 'chest'],
    motifs: ['arch', 'spire', 'mullion', 'keystone'],
    rules: [
      'Frame should reinforce verticality.',
      'Keep the keystone visible at 24px.',
      'Do not fill the lower corners with detail.',
    ],
  },
  {
    id: 'arcane_ring',
    description: 'Concentric rings, glyph arcs, and magical orbit framing.',
    density: 'medium',
    suitableFor: ['hero', 'monster', 'boss', 'item'],
    motifs: ['ring', 'sigil', 'rune wedge', 'orbit mark'],
    rules: ['One dominant ring only.', 'Glyph marks should read as marks, not text.'],
  },
  {
    id: 'thorned_vines',
    description: 'Organic frame with thorn/leaf curves hugging the silhouette.',
    density: 'rich',
    suitableFor: ['hero', 'monster', 'item'],
    motifs: ['vine', 'thorn', 'leaf', 'bud'],
    rules: [
      'Keep ornament on perimeter, not across the face.',
      'Use asymmetry carefully for monsters and rogues.',
    ],
  },
  {
    id: 'mechanical_aperture',
    description: 'Iris-like frame with segmented metal petals and technical openings.',
    density: 'medium',
    suitableFor: ['hero', 'monster', 'item'],
    motifs: ['aperture', 'joint', 'panel', 'port'],
    rules: [
      'Favor simple panel repeats over intricate machinery.',
      'Preserve central focal silhouette.',
    ],
  },
  {
    id: 'sunburst_halo',
    description: 'Radiant crown of wedge cells for heroic or divine emphasis.',
    density: 'light',
    suitableFor: ['hero', 'boss', 'item'],
    motifs: ['wedge rays', 'crown points', 'disc'],
    rules: [
      'Use as a secondary frame, not a full border replacement.',
      'Pairs well with cathedral or sage silhouettes.',
    ],
  },
  {
    // v2 / REQ-5a, u-2b: boss-chest frame. Ornate gold rim with gem
    // inlay cells at cardinal points. Paired with the chest-std raster
    // interior as a fallback until REQ-5b (v2.1) ships the finalized
    // boss-chest raster. See docs/art-governance.md for the paired
    // pending-bead contract.
    id: 'chest_boss_ornate_rim',
    description:
      'Ornate gold-rim chest frame with jewel inlays at four cardinal points, suggesting a legendary treasure cache.',
    density: 'rich',
    suitableFor: ['chest'],
    motifs: ['gold rim', 'cabochon gem', 'rivet', 'scroll flourish'],
    rules: [
      'Rim must read as a closed frame — no gaps at the corners.',
      'Four jewel inlays at N / S / E / W positions, never floating.',
      'Interior area reserved for raster cell fallback (chest-std raster until REQ-5b).',
    ],
  },
];
