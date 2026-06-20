/*
 * Ladle stories for Pane (embertide-b56 phase 1).
 *
 * Mirrors the inline SVG mock in docs/design/pane-template/pane.svg —
 * shows every color family in both densities, with and without
 * corner medallions, so a designer can eyeball the primitive without
 * running the full game.
 */
import type { CSSProperties } from 'react';
import type { Story } from '@ladle/react';

import Pane, { type PaneColorFamily } from './Pane';
import { HC_TOKENS } from '../theme/tokens';

export default {
  title: 'Components / Pane',
};

const ALL_FAMILIES: readonly PaneColorFamily[] = [
  'sapphire',
  'emerald',
  'amber',
  'ruby',
  'amethyst',
  'pearl',
  'neutral-shadow',
] as const;

const pageStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 24,
  background: 'var(--hc-shadow-800, #0b1228)',
  color: 'var(--hc-text-primary, #f6f2e6)',
  fontFamily: 'system-ui, sans-serif',
  minWidth: 320,
};

const rowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  alignItems: 'flex-start',
};

const cellStyle: CSSProperties = {
  width: 160,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const labelStyle: CSSProperties = {
  fontFamily: 'Cinzel, Georgia, serif',
  fontSize: 11,
  letterSpacing: HC_TOKENS.semantic['tracking-chrome-md'],
  textTransform: 'uppercase',
  color: 'var(--hc-text-muted, #b7ae95)',
};

const innerContentStyle: CSSProperties = {
  padding: 12,
  fontFamily: 'Cinzel, Georgia, serif',
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: HC_TOKENS.semantic['tracking-wider'],
  textTransform: 'uppercase',
};

export const AllFamiliesComfortable: Story = () => (
  <div style={pageStyle}>
    <div style={labelStyle}>density: comfortable · cornerMedallions: false</div>
    <div style={rowStyle}>
      {ALL_FAMILIES.map((family) => (
        <div key={family} style={cellStyle}>
          <div style={labelStyle}>{family}</div>
          <Pane colorFamily={family} ariaLabel={`${family} pane`}>
            <div style={innerContentStyle}>{family}</div>
          </Pane>
        </div>
      ))}
    </div>
  </div>
);

export const AllFamiliesCompact: Story = () => (
  <div style={pageStyle}>
    <div style={labelStyle}>density: compact · cornerMedallions: false</div>
    <div style={rowStyle}>
      {ALL_FAMILIES.map((family) => (
        <div key={family} style={cellStyle}>
          <div style={labelStyle}>{family}</div>
          <Pane colorFamily={family} density="compact" ariaLabel={`${family} pane`}>
            <div style={innerContentStyle}>{family}</div>
          </Pane>
        </div>
      ))}
    </div>
  </div>
);

export const WithCornerMedallions: Story = () => (
  <div style={pageStyle}>
    <div style={labelStyle}>density: comfortable · cornerMedallions: true</div>
    <div style={rowStyle}>
      {ALL_FAMILIES.map((family) => (
        <div key={family} style={cellStyle}>
          <div style={labelStyle}>{family}</div>
          <Pane colorFamily={family} cornerMedallions ariaLabel={`${family} pane`}>
            <div style={innerContentStyle}>{family}</div>
          </Pane>
        </div>
      ))}
    </div>
  </div>
);

export const SapphireAndEmeraldSideBySide: Story = () => (
  <div style={pageStyle}>
    <div style={labelStyle}>sapphire + emerald · matches docs/design/pane-template/pane.svg</div>
    <div style={rowStyle}>
      <div style={cellStyle}>
        <div style={labelStyle}>sapphire / comfortable / medallions</div>
        <Pane colorFamily="sapphire" cornerMedallions ariaLabel="sapphire pane">
          <div style={innerContentStyle}>Sapphire</div>
        </Pane>
      </div>
      <div style={cellStyle}>
        <div style={labelStyle}>emerald / comfortable / medallions</div>
        <Pane colorFamily="emerald" cornerMedallions ariaLabel="emerald pane">
          <div style={innerContentStyle}>Emerald</div>
        </Pane>
      </div>
      <div style={cellStyle}>
        <div style={labelStyle}>sapphire / compact / no medallions</div>
        <Pane colorFamily="sapphire" density="compact" ariaLabel="sapphire compact">
          <div style={innerContentStyle}>Sapphire</div>
        </Pane>
      </div>
      <div style={cellStyle}>
        <div style={labelStyle}>emerald / compact / no medallions</div>
        <Pane colorFamily="emerald" density="compact" ariaLabel="emerald compact">
          <div style={innerContentStyle}>Emerald</div>
        </Pane>
      </div>
    </div>
  </div>
);
