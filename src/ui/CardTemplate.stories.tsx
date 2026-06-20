/*
 * Ladle stories for CardTemplate (embertide-4r3a / ppf9-4d.2).
 *
 * Net-new visible state surfaced by ppf9.4 / ppf9.4d:
 *   1. equip-only           — base on-equip text only
 *   2. passive-only         — `Passive: ...` line only
 *   3. dual-slot            — base on-equip + Passive line stacked
 *   4. dual-slot + combat   — base on-equip + Passive + italic combat-summary
 *
 * Each variant is rendered at the four tile widths the production layout
 * uses so future regressions on `.card-template-rules-box` min-height /
 * type scale / vertical clipping are caught at story-snapshot time:
 *   - hand        78×110   (.hand-card-tile)
 *   - field       108×164  (default .field-card-tile, narrow viewport)
 *   - market      134×178  (.market-row .field-card-tile, narrow viewport)
 *   - chest-mid   78×110   (.chest-row .field-card-tile)
 *
 * Sizes come from src/styles/app.css (search `.field-card-tile`,
 * `.market-row .field-card-tile`, `.always-available-row .field-card-tile`).
 * Widths are forced inline so the snapshot stays deterministic regardless
 * of the Ladle preview iframe's own viewport — and a one-shot
 * `<style>` block re-asserts the @media (max-width: 1440px) min-height
 * rules under a story-only ancestor class so the chest-row / hand-tile
 * compaction always applies.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { Story } from '@ladle/react';

import CardTemplate from './CardTemplate';
import type { Card } from '../types/card';
import { KID_CARDS } from '../data/cards';
import { itemPassiveConstructs } from '../data/cards/passives';
import { HC_TOKENS } from '../theme/tokens';

import '../styles/tokens.css';
import '../styles/app.css';

export default {
  title: 'Components / CardTemplate',
};

interface TileSpec {
  readonly label: string;
  readonly key: 'hand' | 'field' | 'market' | 'chest-mid';
  readonly tileClass: string;
  readonly contextClass?: string;
  readonly width: number;
  readonly minHeight: number;
}

const TILE_SPECS: readonly TileSpec[] = [
  {
    // dpy0 (2026-05-02): hand bumped 78×110 → 90×130 to match market
    // ratio (1.43 at narrow viewport) so hand cards stop reading as
    // cramped thin strips. The card-template inside is HEIGHT-CAPPED
    // (not just min-height) so the default illustration size doesn't
    // blow the card past the target ratio.
    label: 'hand 90×130',
    key: 'hand',
    tileClass: 'card-tile field-card-tile hand-card-tile',
    width: 90,
    minHeight: 130,
  },
  {
    label: 'field 108×164',
    key: 'field',
    tileClass: 'card-tile field-card-tile',
    width: 108,
    minHeight: 164,
  },
  {
    label: 'market 134×178',
    key: 'market',
    tileClass: 'card-tile field-card-tile',
    contextClass: 'market-row',
    width: 134,
    minHeight: 178,
  },
  {
    label: 'chest-mid 78×110',
    key: 'chest-mid',
    tileClass: 'card-tile field-card-tile',
    contextClass: 'chest-row',
    width: 78,
    minHeight: 110,
  },
];

/*
 * Re-assert the narrow-viewport rules from app.css under the
 * `.card-template-story-root` ancestor so chest-row + hand tiles get the
 * right min-height regardless of the Ladle iframe's own width. Mirrors
 * the @media (max-width: 1440px) block; values must stay in sync with
 * src/styles/app.css. dpy0 (2026-05-02): hand-card-tile bumped to 116px
 * to match the production widening; chest-row stays at 110px.
 */
const NARROW_VIEWPORT_OVERRIDES = `
  .card-template-story-root .field-card-tile .card-template {
    min-height: 164px;
  }
  .card-template-story-root .market-row .field-card-tile .card-template {
    min-height: 178px;
  }
  .card-template-story-root .hand-card-tile .card-template {
    height: 130px;
    min-height: 130px;
    max-height: 130px;
  }
  .card-template-story-root .chest-row .field-card-tile .card-template {
    min-height: 110px;
  }
`;

const pageStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
  padding: 24,
  background: 'var(--hc-shadow-800, #0b1228)',
  color: 'var(--hc-text-primary, #f6f2e6)',
  fontFamily: 'system-ui, sans-serif',
  minWidth: 640,
};

const rowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 16,
  alignItems: 'flex-start',
};

const cellStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const labelStyle: CSSProperties = {
  fontFamily: 'Cinzel, Georgia, serif',
  fontSize: 11,
  letterSpacing: HC_TOKENS.semantic['tracking-chrome-md'],
  textTransform: 'uppercase',
  color: 'var(--hc-text-muted, #b7ae95)',
};

const variantHeadingStyle: CSSProperties = {
  ...labelStyle,
  fontSize: 13,
  color: 'var(--hc-parchment-200, #e7dcb8)',
};

function findCard(id: string): Card {
  const direct = KID_CARDS.find((c) => c.id === id);
  if (direct) return direct;
  const passive = itemPassiveConstructs.find((c) => c.id === id);
  if (passive) return passive;
  throw new Error(
    `CardTemplate.stories: card id "${id}" not found in KID_CARDS or itemPassiveConstructs`,
  );
}

interface TileProps {
  readonly spec: TileSpec;
  readonly card: Card;
}

function Tile({ spec, card }: TileProps): ReactNode {
  const inner = (
    <div style={cellStyle} data-testid={`tile-${card.id}-${spec.key}`}>
      <div style={labelStyle}>{spec.label}</div>
      <div className={spec.tileClass} style={{ width: spec.width, minHeight: spec.minHeight }}>
        <CardTemplate card={card} />
      </div>
    </div>
  );
  if (!spec.contextClass) return inner;
  return (
    <div className={spec.contextClass} style={{ display: 'contents' }}>
      {inner}
    </div>
  );
}

interface VariantRowProps {
  readonly heading: string;
  readonly card: Card;
}

function VariantRow({ heading, card }: VariantRowProps): ReactNode {
  return (
    <section style={cellStyle}>
      <div style={variantHeadingStyle}>
        {heading} — {card.id}
      </div>
      <div style={rowStyle}>
        {TILE_SPECS.map((spec) => (
          <Tile key={spec.key} spec={spec} card={card} />
        ))}
      </div>
    </section>
  );
}

function StoryFrame({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <div className="card-template-story-root" style={pageStyle}>
      <style>{NARROW_VIEWPORT_OVERRIDES}</style>
      {children}
    </div>
  );
}

export const EquipOnly: Story = () => (
  <StoryFrame>
    <div style={labelStyle}>
      variant: equip-only · base on-equip text, no passive, no combat-summary
    </div>
    <VariantRow heading="equip-only" card={findCard('short-sword')} />
  </StoryFrame>
);

export const PassiveOnly: Story = () => (
  <StoryFrame>
    <div style={labelStyle}>variant: passive-only · `Passive: ...` line only</div>
    <VariantRow heading="passive-only" card={findCard('forge-of-power')} />
  </StoryFrame>
);

export const DualSlot: Story = () => (
  <StoryFrame>
    <div style={labelStyle}>variant: dual-slot · base on-equip + Passive line stacked</div>
    <VariantRow heading="dual-slot" card={findCard('tower-shield')} />
  </StoryFrame>
);

export const DualSlotWithCombatSummary: Story = () => (
  <StoryFrame>
    <div style={labelStyle}>
      variant: dual-slot + combat-summary · base on-equip + Passive + italic combat line
    </div>
    <VariantRow heading="dual-slot+combat" card={findCard('boulderkin-core')} />
  </StoryFrame>
);

export const AllVariantsGrid: Story = () => (
  <StoryFrame>
    <div style={labelStyle}>all 4 variants × 4 tile widths — eyeball regression sweep</div>
    <VariantRow heading="equip-only" card={findCard('short-sword')} />
    <VariantRow heading="passive-only" card={findCard('forge-of-power')} />
    <VariantRow heading="dual-slot" card={findCard('tower-shield')} />
    <VariantRow heading="dual-slot+combat" card={findCard('boulderkin-core')} />
  </StoryFrame>
);

/* ------------------------------------------------------------------------- */
/* Card-frame variant grid (embertide-4jxh).                              */
/*                                                                            */
/* Five card classes — regular / wild-boss / region-boss / item / champion —  */
/* each rendered at the 4 production tile widths so any variant regression in */
/* border / name plate / accent is visible at story-snapshot time.            */
/* ------------------------------------------------------------------------- */

export const VariantRegular: Story = () => (
  <StoryFrame>
    <div style={labelStyle}>
      variant: regular · generic monster (gold leading on parchment plate)
    </div>
    <VariantRow heading="regular" card={findCard('saurian')} />
  </StoryFrame>
);

export const VariantWildBoss: Story = () => (
  <StoryFrame>
    <div style={labelStyle}>
      variant: wild-boss · in-zone mini boss (iron + amber on shadow plate)
    </div>
    <VariantRow heading="wild-boss" card={findCard('boulderkin')} />
  </StoryFrame>
);

export const VariantRegionBoss: Story = () => (
  <StoryFrame>
    <div style={labelStyle}>
      variant: region-boss · zone gatekeeper (gold + ruby crown on royal plate)
    </div>
    <VariantRow heading="region-boss" card={findCard('ashen-tyrant')} />
  </StoryFrame>
);

export const VariantItem: Story = () => (
  <StoryFrame>
    <div style={labelStyle}>variant: item · inventory crate (iron leading, compact rules box)</div>
    <VariantRow heading="item" card={findCard('short-sword')} />
  </StoryFrame>
);

export const VariantChampion: Story = () => (
  <StoryFrame>
    <div style={labelStyle}>
      variant: champion · playable hero (gold + pearl on light parchment)
    </div>
    <VariantRow heading="champion" card={findCard('sage-keeper')} />
  </StoryFrame>
);

export const AllFrameVariantsGrid: Story = () => (
  <StoryFrame>
    <div style={labelStyle}>
      all 5 frame variants × 4 tile widths — variant-distinctness regression sweep
    </div>
    <VariantRow heading="regular" card={findCard('saurian')} />
    <VariantRow heading="wild-boss" card={findCard('boulderkin')} />
    <VariantRow heading="region-boss" card={findCard('ashen-tyrant')} />
    <VariantRow heading="item" card={findCard('short-sword')} />
    <VariantRow heading="champion" card={findCard('sage-keeper')} />
  </StoryFrame>
);
