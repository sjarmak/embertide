/**
 * Visual smoke test for the shared SVG `<defs>` filters mounted by
 * <HyrulianDefs />. Renders the defs once and shows two filtered shapes
 * so a designer can eyeball the strength of each filter side-by-side.
 *
 * Spec: .claude/design/elysian-cathedral/icons.md §2.
 */
import type { CSSProperties } from 'react';
import type { Story } from '@ladle/react';

import { HyrulianDefs } from '../icons/defs';
import { HC_TOKENS } from '../theme/tokens';

export default {
  title: 'Foundations / HyrulianDefs',
};

const containerStyle: CSSProperties = {
  display: 'flex',
  gap: 32,
  padding: 24,
  background: '#F5EFE0',
  fontFamily: 'system-ui, sans-serif',
  color: '#1A1620',
};

const cellStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  padding: 16,
  background: '#FFFCF2',
  border: '1px solid #1A1620',
  borderRadius: 8,
  minWidth: 160,
};

const captionStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: HC_TOKENS.semantic['tracking-wide'],
  textTransform: 'uppercase',
};

export const Defaults: Story = () => (
  <div style={containerStyle}>
    <HyrulianDefs />

    <div style={cellStyle}>
      <span style={captionStyle}>baseline</span>
      <svg width="120" height="120" viewBox="0 0 120 120" aria-label="baseline gem">
        <polygon
          points="60,12 108,40 90,108 30,108 12,40"
          fill="#2E4BA0"
          stroke="#1A1620"
          strokeWidth="2"
        />
      </svg>
    </div>

    <div style={cellStyle}>
      <span style={captionStyle}>#hc-glass-refract</span>
      <svg width="120" height="120" viewBox="0 0 120 120" aria-label="refract gem">
        <g filter="url(#hc-glass-refract)">
          <polygon
            points="60,12 108,40 90,108 30,108 12,40"
            fill="#2E4BA0"
            stroke="#1A1620"
            strokeWidth="2"
          />
        </g>
      </svg>
    </div>

    <div style={cellStyle}>
      <span style={captionStyle}>#hc-soft-glow</span>
      <svg width="120" height="120" viewBox="0 0 120 120" aria-label="glow gem">
        <g filter="url(#hc-soft-glow)">
          <polygon
            points="60,12 108,40 90,108 30,108 12,40"
            fill="#E0A82E"
            stroke="#1A1620"
            strokeWidth="2"
          />
        </g>
      </svg>
    </div>
  </div>
);

Defaults.storyName = 'Filter samples';
