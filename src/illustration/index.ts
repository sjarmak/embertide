/**
 * Public barrel for the compositional illustration system.
 *
 * External callers (e.g. `CardTile` in a follow-up PR) import the renderer
 * and the theme/spec types from here.
 */

export {
  DEFAULT_ILLUSTRATION_SIZE,
  renderIllustration,
  type RenderIllustrationOptions,
} from './renderer';

export type {
  IllustrationArchetype,
  IllustrationSpec,
  OrnamentFrame,
  OrnamentFrameId,
  PaletteRole,
  RenderPlan,
  SegmentationPattern,
  SegmentationPatternId,
  SilhouetteAnchor,
  SilhouetteTemplate,
  ThemeId,
  ThemeProfile,
} from './schema';

export { THEME_PROFILES } from './themes';
export { HERO_TEMPLATES } from './templates/heroes';
export { MONSTER_TEMPLATES } from './templates/monsters';
export { SEGMENTATION_PATTERNS } from './segmentation';
export { ORNAMENT_FRAMES } from './ornament';
export { buildRenderConstraints, planRender, validateIllustrationSpec } from './composer';
