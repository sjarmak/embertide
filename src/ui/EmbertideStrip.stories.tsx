/**
 * Ladle stories for EmbertideStrip (u-2a). Covers every {0,1,2,3}-shard
 * combination so a designer can eyeball the filled / empty jewel
 * treatments for wisdom / courage / power without running the full game.
 *
 * Contract: `src/ui/*.stories.tsx` per PRD v2 dag.json u-2a acceptance.
 */
import type { CSSProperties } from 'react';
import type { Story } from '@ladle/react';

import EmbertideStrip from './EmbertideStrip';
import type { SharedEmbertide } from '../store/types';

export default {
  title: 'Components / EmbertideStrip',
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

function shards(partial: Partial<SharedEmbertide> = {}): SharedEmbertide {
  return { wisdom: false, courage: false, power: false, ...partial };
}

interface DemoProps {
  readonly shards: SharedEmbertide;
  readonly caption: string;
}

function Demo({ shards: s, caption }: DemoProps) {
  return (
    <div style={pageStyle}>
      <span style={captionStyle}>{caption}</span>
      <EmbertideStrip shards={s} />
    </div>
  );
}

export const Empty: Story = () => (
  <Demo shards={shards()} caption="0 shards — starting state (win condition visible)" />
);

export const WisdomOnly: Story = () => (
  <Demo shards={shards({ wisdom: true })} caption="Wisdom only (u-2e path complete)" />
);

export const CourageOnly: Story = () => (
  <Demo shards={shards({ courage: true })} caption="Courage only (u-5b path complete)" />
);

export const PowerOnly: Story = () => (
  <Demo shards={shards({ power: true })} caption="Power only (u-6c path complete)" />
);

export const WisdomAndCourage: Story = () => (
  <Demo
    shards={shards({ wisdom: true, courage: true })}
    caption="Wisdom + Courage — one shard left"
  />
);

export const WisdomAndPower: Story = () => (
  <Demo shards={shards({ wisdom: true, power: true })} caption="Wisdom + Power — one shard left" />
);

export const CourageAndPower: Story = () => (
  <Demo
    shards={shards({ courage: true, power: true })}
    caption="Courage + Power — one shard left"
  />
);

export const AllThree: Story = () => (
  <Demo
    shards={shards({ wisdom: true, courage: true, power: true })}
    caption="All three — co-op victory state"
  />
);
