/*
 * Ladle stories for HeartGainFx (embertide-4m5.4 / 4m5.d.3).
 *
 * Sparkle + halo flourish that fires on a positive HP delta. Sibling
 * of HeartFeedback (which renders the `+N` text float).
 *
 * Variants:
 *   - Default — full motion, +1 gain
 *   - LargeGain — same render, +3 delta (data attribute differs)
 *   - ReducedMotion — forces the prefers-reduced-motion path via
 *     `MotionConfig reducedMotion="always"` so the no-FX branch can be
 *     reviewed without toggling the OS preference. Acceptance A4:
 *     under reduced motion the component renders nothing and the HP
 *     count itself (already plain text in HPStrip) updates instantly.
 *
 * The FX positions absolutely inside its parent — stories wrap the
 * component in a `position: relative` cell with a representative
 * heart-strip placeholder so the sparkles + halo land where they
 * would in production.
 */
import type { CSSProperties, JSX, ReactNode } from 'react';
import type { Story } from '@ladle/react';
import { MotionConfig } from 'framer-motion';

import HeartGainFx from './HeartGainFx';

import '../styles/tokens.css';
import '../styles/app.css';

export default {
  title: 'Components / HeartGainFx',
};

const stageStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 200,
  padding: 32,
  background: 'var(--hc-shadow-800, #0b1228)',
  fontFamily: 'system-ui, sans-serif',
};

const heartStripStyle: CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '8px 12px',
  borderRadius: 8,
  background: 'var(--hc-shadow-600, #1e2b52)',
  border: '1px solid var(--hc-lead-gold-500, #b89142)',
  minWidth: 160,
  minHeight: 38,
  color: 'var(--hc-jewel-amber-100, #f6e7bc)',
  fontSize: 12,
  letterSpacing: '0.04em',
};

interface FrameProps {
  readonly children: ReactNode;
  readonly label: string;
}

function Frame({ children, label }: FrameProps): JSX.Element {
  return (
    <div style={stageStyle}>
      <div style={heartStripStyle}>
        <span aria-hidden>♥ ♥ ♥</span>
        <span style={{ marginLeft: 8 }}>{label}</span>
        {children}
      </div>
    </div>
  );
}

export const Default: Story = () => (
  <Frame label="HP +1">
    <HeartGainFx playerId="p0" delta={1} />
  </Frame>
);

export const LargeGain: Story = () => (
  <Frame label="HP +3 (vital ember)">
    <HeartGainFx playerId="p0" delta={3} />
  </Frame>
);

export const ReducedMotion: Story = () => (
  <MotionConfig reducedMotion="always">
    <Frame label="HP +1 (reduced motion → no sparkle, instant count-up)">
      <HeartGainFx playerId="p0" delta={1} />
    </Frame>
  </MotionConfig>
);
