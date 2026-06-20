# Pane primitive — design template

Bead: **embertide-b56** (phase 1 — Pane component only).

The Pane is the Cathedral stained-glass primitive that will replace the
ad-hoc `.tray` / `.field` / `.hand` / `.embertide-hud` / `.combat-screen`
/ `.status-bar` chrome currently scattered across `app.css` and
component-local stylesheets. Phase 1 ships the primitive only — no
existing surface is migrated by this bead.

## Visual reference

See `pane.svg` (sibling file in this directory) for the inline SVG
mock. It shows the sapphire and emerald families side-by-side in two
rows:

- Row 1 — `density="comfortable"` (4px outer wrap, ≤ 8px budget)
- Row 2 — `density="compact"` (0px outer wrap, ≤ 8px budget)

Both rows have `cornerMedallions={true}` to show the four-corner
medallion treatment. `cornerMedallions` defaults to `false` so that
migration of existing surfaces is visually minimal until a designer
opts in.

## Prop API

```tsx
import Pane, { type PaneColorFamily, type PaneDensity } from '../ui/Pane';

<Pane
  colorFamily="sapphire"            // required — see family list below
  density="comfortable"             // optional — default 'comfortable'
  cornerMedallions={false}          // optional — default false
  className="player-tray"           // optional — appended after Pane classes
  ariaLabel="Player tray"           // optional — promotes role from group → region
  testId="pane"                     // optional — default 'pane'
>
  {children}
</Pane>
```

| Prop | Type | Default | Notes |
| ---- | ---- | ------- | ----- |
| `colorFamily` | `PaneColorFamily` | — | Required. One of the 7 families below. |
| `density` | `PaneDensity` | `'comfortable'` | `'comfortable'` → 4px outer wrap; `'compact'` → 0px outer wrap. |
| `cornerMedallions` | `boolean` | `false` | Renders 4 `aria-hidden` medallion nodes at the corners. |
| `children` | `ReactNode` | — | Pane adds NO inner padding. Inner padding is the consumer's responsibility. |
| `className` | `string` | `undefined` | Appended after Pane's own classes — surface-specific CSS wins. |
| `ariaLabel` | `string` | `undefined` | When present, role is `region`; otherwise `group`. |
| `testId` | `string` | `'pane'` | Used for the wrapper and as a prefix for the 4 medallion test ids. |

## Color-family enumeration

| Family | Jewel triplet | Lead | Glow | Suggested role |
| ------ | ------------- | ---- | ---- | -------------- |
| `sapphire` | `--hc-jewel-sapphire-{100,300,700}` | `--hc-lead-silver-700` | `--hc-glow-sapphire` | Wisdom · Water · Player tray |
| `emerald` | `--hc-jewel-emerald-{100,300,700}` | `--hc-lead-iron-700` | `--hc-glow-emerald` | Courage · Forest · Field |
| `amber` | `--hc-jewel-amber-{100,300,700}` | `--hc-lead-gold-700` | `--hc-glow-amber` | Triumph · Boss crown · Embertide HUD |
| `ruby` | `--hc-jewel-ruby-{100,300,700}` | `--hc-lead-gold-700` | `--hc-glow-ruby` | Power · Hearts · Combat alarms |
| `amethyst` | `--hc-jewel-amethyst-{100,300,700}` | `--hc-lead-iron-700` | `--hc-glow-pearl` | Mini-boss · Shadow magic |
| `pearl` | `--hc-jewel-pearl-{100,300,700}` | `--hc-lead-silver-700` | `--hc-glow-pearl` | Sword · Status bar |
| `neutral-shadow` | `--hc-shadow-{500,600,800}` | `--hc-lead-iron-700` | `--hc-glow-shadow` | Default · neutral panel |

No new tokens are introduced for this bead. Every Pane color value
resolves through one of the existing `--hc-*` tokens enumerated in
`src/styles/tokens.css`.

### Class naming

Class names are kebab-case throughout to satisfy the project
stylelint `selector-class-pattern` rule (BEM `--` / `__` separators
are not allowed in this project). Pane emits the following classes:

- `.pane` — base
- `.pane-comfortable` / `.pane-compact` — density modifiers
- `.pane-{family}` — one of the 7 color-family modifiers
- `.pane-medallions` — added when `cornerMedallions` is true
- `.pane-medallion` + `.pane-medallion-{tl,tr,bl,br}` — corner nodes
- `.pane-content` — inner content slot

## Padding budget

The Pane primitive owns the OUTER WRAP padding (≤ 8px total per the
b56 design contract):

- `comfortable` → 4px
- `compact` → 0px

Inner content padding (the space between the Pane's lead frame and
the consumer's content) is the consumer's responsibility. Consumers
should add their own padding inside the slot if they need it — the
Pane does not pad children.

## Opt-OUT surfaces

The following surfaces are explicitly **not** migrated to Pane (per
b56 designer decisions):

- Setup screens
- Tutorial bubbles
- RollCommitModal interior dice cards

These keep their bespoke chrome.

## Migration plan

Phase 1 (this bead) ships only the primitive. Migration order for
follow-up waves:

1. tray
2. field
3. hand
4. embertide-hud
5. combat-screen
6. status-bar

Button and StatusBar primitives are separate follow-up beads
(`b56-button` and `b56-statusbar`) — file them if they prove
necessary while migrating.

## Lead-frame implementation choice

The lead frame is implemented via **`box-shadow` + `border`** rather
than `border-image`. Rationale:

- `border-image` is awkward to drive from CSS variables — every
  variant would need its own raster or SVG slice. `box-shadow` lets
  us rebind a single `--pane-lead` custom property per family.
- `box-shadow` composes cleanly with the existing
  `inset 0 2px 6px var(--hc-shadow-900)` inner-shadow pattern shared
  by `BossAltarPane.css` and the combat chrome stylesheets.
- The 4-corner medallions sit on the same `box-shadow`-driven frame
  via absolute-positioning + `transform: translate(±50%, ±50%)`, so
  density changes don't shift medallions relative to the frame.

If a future revision needs ornamented edges (gold filigree, etc),
`border-image` can be layered on top per-family without disturbing
the base contract — the `--pane-lead` token is the public seam.
