/**
 * Smoke story for the motion EASE / DUR tokens. Renders a static table so
 * a designer can verify the values shipped from `src/motion/easings.ts`
 * and `src/motion/durations.ts` match the spec without running the app.
 *
 * No actual motion is played here — V-5b+ stories will demo each variant
 * once the variants have real implementations in components.
 */
import type { CSSProperties } from 'react';
import type { Story } from '@ladle/react';

import { EASE } from '../motion/easings';
import { DUR } from '../motion/durations';
import { HC_TOKENS } from '../theme/tokens';

export default {
  title: 'Foundations / Motion Tokens',
};

const wrapStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(280px, 1fr))',
  gap: 24,
  padding: 24,
  background: '#F5EFE0',
  fontFamily: 'system-ui, sans-serif',
  color: '#1A1620',
};

const cardStyle: CSSProperties = {
  background: '#FFFCF2',
  border: '1px solid #1A1620',
  borderRadius: 8,
  padding: 16,
};

const headingStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: HC_TOKENS.semantic['tracking-wide'],
  textTransform: 'uppercase',
  marginBottom: 12,
};

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '4px 0',
  borderBottom: '1px dotted #C8BFA6',
  fontSize: 13,
  fontVariantNumeric: 'tabular-nums',
};

function formatEase(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.join(', ')}]`;
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export const Tokens: Story = () => (
  <div style={wrapStyle}>
    <section style={cardStyle}>
      <div style={headingStyle}>EASE</div>
      {Object.entries(EASE).map(([name, value]) => (
        <div key={name} style={rowStyle}>
          <span>{name}</span>
          <span>{formatEase(value)}</span>
        </div>
      ))}
    </section>
    <section style={cardStyle}>
      <div style={headingStyle}>DUR (ms)</div>
      {Object.entries(DUR).map(([name, value]) => (
        <div key={name} style={rowStyle}>
          <span>{name}</span>
          <span>{value}</span>
        </div>
      ))}
    </section>
  </div>
);

Tokens.storyName = 'EASE + DUR table';
