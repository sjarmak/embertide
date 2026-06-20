/*
 * Ladle stories for ChestReveal (embertide-4m5.2 / 4m5.d.1).
 *
 * Visual surface for the polished chest-reveal animation:
 *   - telegraph → unlock → settle choreography (`DUR.reveal` window)
 *   - amber sparkle burst aligned with the cost-gem palette
 *   - reduced-motion fallback (static frame, no sparkles)
 *
 * Each variant renders the popup against a dim board-color backdrop so
 * the cream-parchment panel reads with the same contrast it has during
 * gameplay. Stories include each `ChestReward` shape (heart / hero /
 * item / premium-item / wisp / ember-shard / vital-ember) plus a
 * dedicated `ReducedMotion` story that forces the static-fallback path
 * via Framer Motion's `MotionConfig` so the reduced-motion experience
 * is reviewable without toggling the OS preference.
 *
 * onComplete is wired to a no-op `() => undefined` so the popup stays
 * on screen for inspection — Ladle's preview iframe does not need the
 * auto-dismiss behavior the production GameBoard relies on.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { Story } from '@ladle/react';
import { MotionConfig } from 'framer-motion';

import ChestReveal from './ChestReveal';
import type { Card } from '../types/card';
import { KID_CARDS } from '../data/cards';

import '../styles/tokens.css';
import '../styles/app.css';

export default {
  title: 'Components / ChestReveal',
};

const noop = (): void => undefined;

const pageStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 360,
  padding: 32,
  background: 'var(--hc-shadow-800, #0b1228)',
  fontFamily: 'system-ui, sans-serif',
};

const labelStyle: CSSProperties = {
  position: 'absolute',
  top: 12,
  left: 12,
  fontFamily: 'Cinzel, Georgia, serif',
  fontSize: 11,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--hc-text-muted, #b7ae95)',
};

function findCard(id: string): Card {
  const card = KID_CARDS.find((c) => c.id === id);
  if (!card) {
    throw new Error(`ChestReveal.stories: card id "${id}" not found in KID_CARDS`);
  }
  return card;
}

interface FrameProps {
  readonly heading: string;
  readonly children: ReactNode;
}

function Frame({ heading, children }: FrameProps): ReactNode {
  return (
    <div style={{ ...pageStyle, position: 'relative' }}>
      <div style={labelStyle}>{heading}</div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Heart-only rewards — generic-icon path (no Card threaded).                */
/* ------------------------------------------------------------------------- */

export const Heart: Story = () => (
  <Frame heading="reward: heart · generic Heart icon, no card">
    <ChestReveal reward="heart" onComplete={noop} />
  </Frame>
);

export const DoubleHeart: Story = () => (
  <Frame heading="reward: double-heart · generic Heart icon, +2 Hearts label">
    <ChestReveal reward="double-heart" onComplete={noop} />
  </Frame>
);

export const EmberShard: Story = () => (
  <Frame heading="reward: ember-shard · bespoke ember-shard raster (gm0.16)">
    <ChestReveal reward="ember-shard" onComplete={noop} />
  </Frame>
);

export const VitalEmber: Story = () => (
  <Frame heading="reward: vital-ember · bespoke vital-ember raster">
    <ChestReveal reward="vital-ember" onComplete={noop} />
  </Frame>
);

/* ------------------------------------------------------------------------- */
/* Card-grant rewards — CardTemplate path (real rolled card art).            */
/* ------------------------------------------------------------------------- */

export const HeroCard: Story = () => (
  <Frame heading="reward: hero · sage-keeper champion via CardTemplate">
    <ChestReveal reward="hero" card={findCard('sage-keeper')} onComplete={noop} />
  </Frame>
);

export const ItemCard: Story = () => (
  <Frame heading="reward: item · boomerang relic via CardTemplate">
    <ChestReveal reward="item" card={findCard('boomerang')} onComplete={noop} />
  </Frame>
);

export const PremiumItemCard: Story = () => (
  <Frame heading="reward: premium-item · ancient-blade legendary via CardTemplate">
    <ChestReveal reward="premium-item" card={findCard('ancient-blade')} onComplete={noop} />
  </Frame>
);

export const FairyCard: Story = () => (
  <Frame heading="reward: wisp · wisp card via CardTemplate, 'Wisp' category label">
    <ChestReveal reward="wisp" card={findCard('wisp')} onComplete={noop} />
  </Frame>
);

/* ------------------------------------------------------------------------- */
/* Reduced-motion fallback — static frame, no sparkles, no choreography.     */
/* ------------------------------------------------------------------------- */

export const ReducedMotion: Story = () => (
  <Frame heading="prefers-reduced-motion: reduce · static frame, sparkles suppressed">
    <MotionConfig reducedMotion="always">
      <ChestReveal reward="hero" card={findCard('sage-keeper')} onComplete={noop} />
    </MotionConfig>
  </Frame>
);

/* ------------------------------------------------------------------------- */
/* All variants grid — eyeball regression sweep across every reward shape.   */
/* ------------------------------------------------------------------------- */

export const AllRewardsGrid: Story = () => (
  <div style={{ ...pageStyle, flexDirection: 'column', gap: 16, alignItems: 'stretch' }}>
    <Frame heading="heart">
      <ChestReveal reward="heart" onComplete={noop} />
    </Frame>
    <Frame heading="double-heart">
      <ChestReveal reward="double-heart" onComplete={noop} />
    </Frame>
    <Frame heading="ember-shard">
      <ChestReveal reward="ember-shard" onComplete={noop} />
    </Frame>
    <Frame heading="vital-ember">
      <ChestReveal reward="vital-ember" onComplete={noop} />
    </Frame>
    <Frame heading="hero (card)">
      <ChestReveal reward="hero" card={findCard('sage-keeper')} onComplete={noop} />
    </Frame>
    <Frame heading="item (card)">
      <ChestReveal reward="item" card={findCard('boomerang')} onComplete={noop} />
    </Frame>
    <Frame heading="premium-item (card)">
      <ChestReveal reward="premium-item" card={findCard('ancient-blade')} onComplete={noop} />
    </Frame>
    <Frame heading="wisp (card)">
      <ChestReveal reward="wisp" card={findCard('wisp')} onComplete={noop} />
    </Frame>
  </div>
);
