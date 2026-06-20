/**
 * Ladle stories for ZoneCell (u-5a). One story per v2.0 zone so a
 * designer can eyeball each backdrop's first-pass silhouette in
 * isolation, plus an explicit ArtPending-visible story for review.
 */
import type { CSSProperties } from 'react';
import type { Story } from '@ladle/react';

import ZoneCell from './ZoneCell';
import { ZONE_METADATA } from '../rules/zones';

export default {
  title: 'Components / ZoneCell',
};

const pageStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 24,
  background: 'var(--hc-shadow-800, #0b1228)',
  color: 'var(--hc-text-primary, #f6f2e6)',
  fontFamily: 'system-ui, sans-serif',
  minWidth: 320,
};

const captionStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--hc-text-muted, #b7ae95)',
};

interface DemoProps {
  readonly zoneId: keyof typeof ZONE_METADATA;
  readonly caption: string;
}

function Demo({ zoneId, caption }: DemoProps) {
  return (
    <div style={pageStyle}>
      <span style={captionStyle}>{caption}</span>
      <ZoneCell zone={ZONE_METADATA[zoneId]} />
    </div>
  );
}

export const Sylvanwood: Story = () => (
  <Demo zoneId="sylvani" caption="Sylvanwood — starting zone, emerald canopy" />
);

export const Emberpeak: Story = () => (
  <Demo zoneId="emberpeak" caption="Emberpeak — volcanic peak, ruby + amber tint" />
);

export const GildedCage: Story = () => (
  <Demo zoneId="gilded-cage" caption="Gilded Cage — final zone, sapphire cathedral" />
);
