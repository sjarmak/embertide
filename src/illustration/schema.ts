export type IllustrationArchetype = 'hero' | 'monster' | 'boss' | 'chest' | 'item';
export type HeroSubtype = 'warrior' | 'sentinel' | 'rogue' | 'sage' | 'ranger';
export type MonsterSubtype = 'brute' | 'stalker' | 'swarm' | 'caster' | 'aberration';
export type BossSubtype = 'tyrant' | 'dragon' | 'void-lord' | 'usurper';
export type SegmentationPatternId =
  | 'vertical_cathedral'
  | 'radial_halo'
  | 'shield_facets'
  | 'broken_spires'
  | 'hex_lattice'
  | 'vine_cells';
export type OrnamentFrameId =
  | 'cathedral_arch'
  | 'arcane_ring'
  | 'thorned_vines'
  | 'mechanical_aperture'
  | 'sunburst_halo'
  // v2 / REQ-5a, u-2b: ornate gold rim for boss-chest cells.
  | 'chest_boss_ornate_rim';
export type ThemeId = 'cathedral' | 'arcane' | 'verdant' | 'mechanical';
export type PaletteRole = 'hero' | 'monster' | 'boss' | 'legendary' | 'neutral';
export type LightDirection = 'top-left';

/**
 * REQ-33 (u-10a) — Non-card illustration role taxonomy.
 *
 * Tags assets that aren't per-card illustrations but still need schema-backed
 * examples + prompts. Extends the art pipeline to cover:
 *   - `combat-background` — per-zone combat arena backdrops (§D1)
 *   - `altar-frame`       — shared wild / region altar ornament overlays (§D2)
 *   - `destiny-altar`     — bespoke Vurmox DESTINY backdrop raster (§D3)
 *
 * Additive only: the per-card `IllustrationSpec` shape is unchanged. u-10b /
 * u-10c / u-10d consume this role in their accompanying example JSONs.
 */
export type IllustrationRole = 'combat-background' | 'altar-frame' | 'destiny-altar';

export interface SilhouetteAnchor {
  id: string;
  x: number;
  y: number;
}

export interface SilhouetteTemplate {
  id: string;
  archetype: IllustrationArchetype;
  subtype: string;
  description: string;
  poseRead: 'upright' | 'forward-leaning' | 'coiled' | 'regal';
  symmetry: 'high' | 'medium' | 'low';
  shapeLanguage: string[];
  anchors: SilhouetteAnchor[];
  basePaths: string[];
  focalZones: string[];
  forbiddenFeatures: string[];
}

export interface SegmentationPattern {
  id: SegmentationPatternId;
  description: string;
  maxCells: number;
  symmetryBias: 'high' | 'medium' | 'low';
  suitableFor: IllustrationArchetype[];
  lineFamilies: string[];
  rules: string[];
}

export interface OrnamentFrame {
  id: OrnamentFrameId;
  description: string;
  density: 'light' | 'medium' | 'rich';
  suitableFor: IllustrationArchetype[];
  motifs: string[];
  rules: string[];
}

export interface ThemeProfile {
  id: ThemeId;
  description: string;
  invariantRules: string[];
  ornamentBias: OrnamentFrameId[];
  segmentationBias: SegmentationPatternId[];
  mapping: {
    heroPrimary: string;
    heroSecondary: string;
    monsterPrimary: string;
    monsterSecondary: string;
    bossPrimary: string;
    bossSecondary: string;
    lead: string;
    highlight: string;
  };
}

export interface IllustrationSpec {
  id: string;
  theme: ThemeId;
  archetype: IllustrationArchetype;
  subtype: string;
  paletteRole: PaletteRole;
  silhouetteId: string;
  segmentationId: SegmentationPatternId;
  ornamentId: OrnamentFrameId;
  focalElement: string;
  secondaryElement?: string;
  cellBudget: number;
  usesHalo: boolean;
  usesBackdropMotif: boolean;
  notes: string[];
  rasterImageUrl?: string;
}

export interface RenderPlan {
  viewBox: '0 0 24 24';
  lightDirection: LightDirection;
  layers: {
    leading: string[];
    fillPrimary: string[];
    fillSecondary: string[];
    shade?: string[];
    highlight: string[];
    ornament?: string[];
  };
  constraints: string[];
}
