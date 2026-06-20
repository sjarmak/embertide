/**
 * Ladle viewer for the compositional illustration renderer.
 *
 * Renders the canonical `cathedral_hero_warrior` spec through
 * `renderIllustration` on both parchment and shadow backgrounds so the
 * designer can eyeball legibility in both light and dark contexts. A theme
 * toggle swaps between `cathedral` (emerald) and `arcane` (sapphire).
 *
 * Spec: `.claude/design/elysian-cathedral/PRD.md` V-4r-illustration-renderer.
 */

import { useState, type CSSProperties } from 'react';
import type { Story } from '@ladle/react';

import { renderIllustration } from '../illustration/renderer';
import type { IllustrationSpec, ThemeId } from '../illustration/schema';
import { HC_TOKENS } from '../theme/tokens';

import cathedralWarriorJson from '../illustration/examples/cathedral_hero_warrior.json' with { type: 'json' };

const cathedralWarrior = cathedralWarriorJson as IllustrationSpec;

const THEME_OPTIONS: readonly ThemeId[] = ['cathedral', 'arcane'];

const DISPLAY_SIZE = 240;

// ---------------------------------------------------------------------------
// Layout (inline styles — stories are intentionally self-contained).
// ---------------------------------------------------------------------------

const pageStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
  padding: 32,
  fontFamily: 'system-ui, sans-serif',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const titleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  letterSpacing: HC_TOKENS.semantic['tracking-banner'],
  margin: 0,
};

const subtitleStyle: CSSProperties = {
  fontSize: 13,
  color: '#5a5a5a',
  margin: 0,
};

const toggleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  fontSize: 13,
  fontWeight: 500,
};

const buttonStyle = (active: boolean): CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 6,
  border: active ? '2px solid #1A1620' : '1px solid #c8c0a7',
  background: active ? '#1A1620' : '#FFFCF2',
  color: active ? '#FFFCF2' : '#1A1620',
  cursor: 'pointer',
  fontWeight: 600,
  letterSpacing: HC_TOKENS.semantic['tracking-wide'],
  textTransform: 'uppercase',
  fontSize: 11,
});

const sideBySideStyle: CSSProperties = {
  display: 'flex',
  gap: 32,
  flexWrap: 'wrap',
};

const tileStyle = (background: string, foreground: string): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  padding: 24,
  background,
  color: foreground,
  borderRadius: 12,
  border: '1px solid rgba(0,0,0,0.12)',
});

const captionStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: HC_TOKENS.semantic['tracking-chrome'],
  textTransform: 'uppercase',
};

// ---------------------------------------------------------------------------
// Default story — warrior on parchment + shadow, theme-togglable.
// ---------------------------------------------------------------------------

export default {
  title: 'Illustration / cathedral_hero_warrior_001',
};

export const Warrior: Story = () => {
  const [theme, setTheme] = useState<ThemeId>('cathedral');

  const spec: IllustrationSpec = { ...cathedralWarrior, theme };
  const illustration = renderIllustration(spec, { size: DISPLAY_SIZE });

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <h1 style={titleStyle}>{spec.id}</h1>
        <p style={subtitleStyle}>
          active theme: <strong>{theme}</strong> — silhouette: <code>{spec.silhouetteId}</code>,
          segmentation: <code>{spec.segmentationId}</code>, ornament: <code>{spec.ornamentId}</code>
        </p>
      </header>

      <div style={toggleRowStyle} data-testid="theme-toggle-row">
        <span>theme:</span>
        {THEME_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setTheme(option)}
            style={buttonStyle(theme === option)}
            aria-pressed={theme === option}
            data-testid={`theme-toggle-${option}`}
          >
            {option}
          </button>
        ))}
      </div>

      <div style={sideBySideStyle}>
        <div style={tileStyle('#F4EBD3', '#1A1620')} data-testid={`tile-${theme}-parchment`}>
          <span style={captionStyle}>parchment-100</span>
          {illustration}
        </div>
        <div style={tileStyle('#0B1228', '#F6F2E6')} data-testid={`tile-${theme}-shadow`}>
          <span style={captionStyle}>shadow-800</span>
          {illustration}
        </div>
      </div>
    </div>
  );
};

Warrior.storyName = 'Warrior — parchment + shadow';
