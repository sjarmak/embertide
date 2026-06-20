/*
 * Pane — Cathedral stained-glass primitive (embertide-b56 phase 1).
 *
 * The shared visual surface for tray / field / hand / embertide-hud /
 * combat-screen / status-bar (migration follow-up). Renders a stained-
 * glass backing + lead-frame border with optional 4-corner medallions.
 *
 * Design contract (locked, per b56 designer decisions):
 *   - 8px outer-padding budget on the OUTER WRAP only
 *     (4px on `comfortable`, 0px on `compact`). Inner content padding
 *     is the consumer's responsibility — Pane does not pad children.
 *   - color-family selects the jewel + lead + glow triplet via
 *     CSS classes (no token mixing inline). All values resolve through
 *     existing --hc-* tokens; no new tokens added.
 *   - cornerMedallions is OFF by default. When ON, four <span> nodes
 *     are positioned at the corners and styled by CSS. The medallion
 *     shapes use background-image gradients, not raster assets.
 *   - opt-OUT surfaces (NOT migrated by this bead): Setup screens,
 *     tutorial bubbles, RollCommitModal interior dice cards.
 *
 * Class naming: kebab-case throughout. The project stylelint config
 * rejects BEM `--` / `__` separators, so modifiers are written as
 * `pane-<modifier>` and the inner slot as `pane-content`.
 *
 * See `docs/design/pane-template/README.md` for the prop API,
 * color-family enumeration, and migration plan reference.
 */

import type { ReactNode } from 'react';
import './Pane.css';

export type PaneColorFamily =
  | 'sapphire'
  | 'emerald'
  | 'amber'
  | 'ruby'
  | 'amethyst'
  | 'pearl'
  | 'neutral-shadow';

export type PaneDensity = 'comfortable' | 'compact';

export interface PaneProps {
  /** Color family — drives the jewel + lead + glow triplet. */
  readonly colorFamily: PaneColorFamily;
  /**
   * Density variant. `comfortable` (default) gives a 4px outer wrap;
   * `compact` removes the outer wrap to hit the 8px total budget on
   * tighter surfaces. Inner content padding is the consumer's
   * responsibility either way.
   */
  readonly density?: PaneDensity;
  /**
   * When true, renders 4 corner medallion nodes inside the pane.
   * Defaults to false to keep migration of existing surfaces visually
   * minimal — surfaces opt INTO medallions explicitly.
   */
  readonly cornerMedallions?: boolean;
  /** Slot for content. Pane adds no inner padding around children. */
  readonly children: ReactNode;
  /**
   * Optional caller class — appended after Pane's own classes so
   * surface-specific CSS (e.g. layout) wins over Pane's chrome.
   */
  readonly className?: string;
  /**
   * Optional accessible label. When present, the pane is announced as
   * a region with this label; otherwise the pane is a presentational
   * group (role="group") and inherits the surrounding landmark.
   */
  readonly ariaLabel?: string;
  /** Optional test id; defaults to "pane". */
  readonly testId?: string;
}

const COLOR_CLASS: Readonly<Record<PaneColorFamily, string>> = {
  sapphire: 'pane-sapphire',
  emerald: 'pane-emerald',
  amber: 'pane-amber',
  ruby: 'pane-ruby',
  amethyst: 'pane-amethyst',
  pearl: 'pane-pearl',
  'neutral-shadow': 'pane-neutral-shadow',
};

/**
 * Pane primitive. Composition order (outer → inner):
 *
 *   <div class="pane pane-{family} pane-{density} pane-medallions?">
 *     [4× <span class="pane-medallion pane-medallion-{corner}" />]
 *     <div class="pane-content">{children}</div>
 *   </div>
 *
 * The medallion <span> nodes sit BEFORE the content so they paint
 * underneath without affecting tab order. They are presentational
 * (aria-hidden) — semantics live on the outer wrap.
 */
export default function Pane({
  colorFamily,
  density = 'comfortable',
  cornerMedallions = false,
  children,
  className,
  ariaLabel,
  testId = 'pane',
}: PaneProps) {
  const classes = [
    'pane',
    COLOR_CLASS[colorFamily],
    density === 'compact' ? 'pane-compact' : 'pane-comfortable',
    cornerMedallions ? 'pane-medallions' : null,
    className ?? null,
  ]
    .filter((cls): cls is string => cls !== null && cls.length > 0)
    .join(' ');

  const role = ariaLabel ? 'region' : 'group';

  return (
    <div
      data-testid={testId}
      data-color-family={colorFamily}
      data-density={density}
      role={role}
      aria-label={ariaLabel}
      className={classes}
    >
      {cornerMedallions ? (
        <>
          <span
            aria-hidden="true"
            data-testid={`${testId}-medallion-tl`}
            className="pane-medallion pane-medallion-tl"
          />
          <span
            aria-hidden="true"
            data-testid={`${testId}-medallion-tr`}
            className="pane-medallion pane-medallion-tr"
          />
          <span
            aria-hidden="true"
            data-testid={`${testId}-medallion-bl`}
            className="pane-medallion pane-medallion-bl"
          />
          <span
            aria-hidden="true"
            data-testid={`${testId}-medallion-br`}
            className="pane-medallion pane-medallion-br"
          />
        </>
      ) : null}
      <div className="pane-content">{children}</div>
    </div>
  );
}
