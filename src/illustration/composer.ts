import type {
  IllustrationSpec,
  RenderPlan,
  ThemeProfile,
  SilhouetteTemplate,
  SegmentationPattern,
  OrnamentFrame,
} from './schema';

export function validateIllustrationSpec(spec: IllustrationSpec) {
  const errors: string[] = [];

  if (spec.cellBudget < 5 || spec.cellBudget > 14) {
    errors.push('cellBudget must remain between 5 and 14 for readability.');
  }

  if (spec.archetype === 'hero' && spec.cellBudget > 12) {
    errors.push('Hero illustrations should bias toward larger noble cells, not dense detail.');
  }

  if (spec.archetype === 'monster' && spec.usesHalo && spec.ornamentId === 'sunburst_halo') {
    errors.push(
      'Monsters should not receive heroic sunburst halos unless intentionally subverted.',
    );
  }

  return errors;
}

export function buildRenderConstraints(
  spec: IllustrationSpec,
  theme: ThemeProfile,
  silhouette: SilhouetteTemplate,
  segmentation: SegmentationPattern,
  ornament: OrnamentFrame,
): string[] {
  return [
    'viewBox must remain 0 0 24 24',
    'light source fixed at top-left',
    'one highlight family only',
    'preserve silhouette readability at 24px',
    `theme: ${theme.id}`,
    `silhouette: ${silhouette.id}`,
    `segmentation max cells: ${segmentation.maxCells}`,
    `ornament density: ${ornament.density}`,
    ...theme.invariantRules,
    ...segmentation.rules,
    ...ornament.rules,
    ...silhouette.forbiddenFeatures.map((x) => `forbid: ${x}`),
  ];
}

export function planRender(spec: IllustrationSpec): RenderPlan {
  return {
    viewBox: '0 0 24 24',
    lightDirection: 'top-left',
    layers: {
      leading: [
        'silhouette outer boundary',
        'internal segmentation lines',
        'ornament boundary lines',
      ],
      fillPrimary: ['dominant silhouette cells', 'main focal element'],
      fillSecondary: ['secondary body cells', 'background support cells'],
      shade:
        spec.archetype === 'boss' || spec.archetype === 'monster'
          ? ['void/mouth/eye socket or internal danger cell']
          : undefined,
      highlight: ['single top-left sliver on focal glass cell'],
      ornament: ['top arch / ring / perimeter motifs only'],
    },
    constraints: [
      'no painterly texture as core shape definition',
      'no more than 1 highlight group',
      'no facial detail beyond eye slit / shadow / profile read',
      'ornament must support, not replace, silhouette',
    ],
  };
}
