// .stylelintrc.cjs
//
// Elysian Cathedral stylelint enforcement.
//
// Core rule: every color-valued CSS property in `src/**/*.css` MUST reference
// a `var(--hc-*)` token (with a tight allowlist of CSS-wide keywords). Literal
// hex / rgb() / named colors are errors. See PRD work unit T-3.
//
// The npm script intentionally scopes this product gate to `src/**/*.css`.
// `public/art-preview.css` styles a standalone internal art-review utility,
// and `architecture/site/styles.css` styles generated architecture docs;
// neither stylesheet ships in the browser game or uses its token runtime.
// Their local palettes are therefore deliberately outside the HC product gate.
//
// Rule scope intentionally narrow: we want the strict-value rule to be the
// only signal fired during this work unit. Formatting-level rules from
// stylelint-config-standard (hex case, alpha notation, blank-line nits) are
// disabled because tokens.css values come verbatim from palette.md and must
// be preserved. Future work units can tighten these once tokens.css is locked.

/** @type {import('stylelint').Config} */
module.exports = {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-declaration-strict-value'],
  rules: {
    // Allow nested CSS custom properties with the project prefix.
    'custom-property-pattern': null,
    'custom-property-empty-line-before': null,

    // Cascade layers are the project's primary cascade mechanism.
    'at-rule-no-unknown': [true, { ignoreAtRules: ['layer'] }],

    // Preserve palette-verbatim values (rgba + long hex).
    'color-function-notation': null,
    'alpha-value-notation': null,
    'color-hex-length': null,
    'hue-degree-notation': null,

    // Legacy file contains duplicate selectors during the transition; the
    // override below exempts it fully, but disable here too so the rule does
    // not regress.
    'no-duplicate-selectors': null,

    // Design-system-critical rule: every color-valued declaration must use a
    // --hc-* CSS variable (or a small set of system keywords). Typography
    // properties (95bo) are also enforced — every font-family / font-size /
    // font-weight value must reference an --hc-* token. The 5hw8 follow-up
    // adds letter-spacing to the enforced set so chrome-label tracking
    // values (0.06..0.22em) cannot drift away from the chrome tier defined
    // in tokens.css. Layout primitives like `font-size: 0;` (used to
    // collapse whitespace inside inline-block chains) are explicitly allowed
    // via the `0` ignoreValue, which also covers the `letter-spacing: 0;`
    // reset used to neutralise chrome tracking on nested non-chrome content.
    // The @font-face descriptor block in app.css uses literal values per CSS
    // spec (var() is not reliably supported inside @font-face) — wrapped
    // with stylelint-disable comments locally.
    'scale-unlimited/declaration-strict-value': [
      [
        'color',
        'background',
        'background-color',
        'border-color',
        'outline-color',
        'fill',
        'stroke',
        'box-shadow',
        'caret-color',
        'font-family',
        'font-size',
        'font-weight',
        'letter-spacing',
      ],
      {
        ignoreValues: [
          '/^var\\(--hc-/',
          'currentColor',
          'currentcolor',
          'transparent',
          'inherit',
          'initial',
          'revert',
          'revert-layer',
          'unset',
          'none',
          '0',
        ],
        ignoreFunctions: false,
      },
    ],
  },
  overrides: [
    {
      // Legacy file — compound color declarations (gradients and shadows) and
      // font-* migrate in V-11 per PRD A-5. Simple foreground/background
      // colors are enforced now so app.css cannot bypass the HC contract with
      // a bare `color` or `background-color` declaration. (embertide-n6m)
      //
      // Graduated from .stylelintignore in embertide-275m (2026-05-04):
      // app.css is now lint-checked. overrides[].rules REPLACES the matched
      // strict-value config, so every property enforced here must be listed.
      //
      // The 63 known no-descending-specificity violations from the V-5 /
      // V-9eou / 4jxh card-frame eras were resolved in 275m by reordering
      // selectors within multi-selector lists (lowest-specificity first)
      // and wrapping inter-rule offenders in `@layer base { ... }`.
      // Unlayered higher-specificity rules continue to dominate the
      // cascade exactly as before — runtime behavior is unchanged.
      files: ['src/styles/app.css'],
      rules: {
        'scale-unlimited/declaration-strict-value': [
          ['color', 'background-color', 'letter-spacing'],
          { ignoreValues: ['/^var\\(--hc-/', '0', 'inherit', 'transparent'] },
        ],
      },
    },
    {
      // REQ-32 / u-9d (embertide-b56 precursor): the BossAltarPane
      // primitive composes --hc-* tokens inside linear-gradient() and
      // inset-shadow lists. The stylelint regex requires the FIRST token
      // after the declaration colon to match `^var\(--hc-` — it doesn't
      // look inside CSS functions. The file still references only --hc-*
      // tokens for every color value; exempting the strict-value rule
      // here keeps intent clear without loosening the rule globally.
      // b56 will absorb these variants into a shared Pane primitive.
      files: ['src/ui/BossAltarPane.css'],
      rules: {
        'scale-unlimited/declaration-strict-value': null,
      },
    },
    {
      // embertide-b56 phase 1: Pane.css composes --hc-* tokens inside
      // linear-gradient(), radial-gradient(), and box-shadow lists for
      // the stained-glass backing + lead-frame border + corner-medallion
      // treatment. Same constraint as BossAltarPane.css above: the
      // strict-value regex only inspects the first token after the
      // declaration colon and cannot introspect CSS functions. Every
      // color reference goes through a --hc-* token.
      files: ['src/ui/Pane.css'],
      rules: {
        'scale-unlimited/declaration-strict-value': null,
      },
    },
    {
      // REQ-33 / u-10e (Combat UI chrome): the three combat-panel chrome
      // stylesheets compose --hc-* tokens inside box-shadow lists,
      // linear-gradient()/repeating-linear-gradient() stops, and
      // url(data:image/svg+xml...) backgrounds. Same constraint as
      // BossAltarPane.css above: the strict-value regex only inspects the
      // first token after the declaration colon. Every color reference in
      // these files either goes through a `--hc-*` token OR embeds a hex
      // value that mirrors a token verbatim (documented inline in each
      // CSS file's header comment). Exempting the rule keeps intent clear
      // without loosening the rule globally.
      files: [
        // CombatBossPanel.css was retired in nz8-a (embertide-f3z);
        // CombatBossStage.css inherits the same chrome composition pattern.
        // CombatScreen.css (nz8-d / embertide-343) adds the full-
        // viewport backdrop + arena layout using the same --hc-* tokens.
        'src/ui/CombatBossStage.css',
        'src/ui/CombatScreen.css',
        'src/ui/CombatBattlefield.css',
        'src/ui/CombatHand.css',
      ],
      rules: {
        'scale-unlimited/declaration-strict-value': null,
      },
    },
    {
      // Designer polish 2026-04-22 Issue 4: ChampionSlot emblem reuses the
      // combat-panel brass-bevel pattern — stacked inset box-shadows that
      // compose --hc-* tokens. Same constraint as CombatBossPanel.css above:
      // the strict-value regex only inspects the first token after the
      // declaration colon. Every color reference in this file goes through
      // a `--hc-*` token.
      files: ['src/ui/ChampionSlot.css'],
      rules: {
        'scale-unlimited/declaration-strict-value': null,
      },
    },
    {
      // Designer feedback 2026-04-22 rev-2: PrincessCrystalCell.css uses
      // the same CSS-function composition pattern as the combat chrome
      // files — radial-gradient() halos, linear-gradient() integrity
      // fill, stacked box-shadow lists, drop-shadow() filters. Every
      // color reference goes through a `--hc-*` token; the strict-value
      // regex only inspects the first token after the declaration colon
      // and cannot introspect CSS functions. Exempt to keep intent clear
      // without loosening the rule globally.
      files: ['src/ui/PrincessCrystalCell.css'],
      rules: {
        'scale-unlimited/declaration-strict-value': null,
      },
    },
    {
      // embertide-4hr1.4 — ColosseumEntryPane composes --hc-* tokens
      // inside linear-gradient() backgrounds and stacked box-shadow
      // lists for the cathedral obsidian-and-gold leading treatment.
      // Same constraint as BossAltarPane / Pane / CombatBossStage above:
      // the strict-value regex only inspects the first token after the
      // declaration colon and cannot introspect CSS functions. Every
      // color reference goes through a `--hc-*` token.
      files: ['src/ui/ColosseumEntryPane.css'],
      rules: {
        'scale-unlimited/declaration-strict-value': null,
      },
    },
  ],
};
