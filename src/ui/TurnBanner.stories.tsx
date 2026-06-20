/**
 * Ladle stories for TurnBanner (embertide-4m5.3 polish).
 *
 * Each story re-mounts on a `key` change so designers can re-trigger the
 * sweep entrance with the "Replay" button. Champion variants exercise the
 * `--hc-champion-{tone}-glow` tints that drive the light-sweep gradient.
 *
 * Reduced-motion path: toggle `prefers-reduced-motion` in the OS / dev
 * tools — the app-level <MotionConfig reducedMotion="user"> in App.tsx
 * skips the sweep and drop-in transition while keeping text legible.
 */
import { useState, type CSSProperties } from 'react';
import type { Story } from '@ladle/react';

import TurnBanner from './TurnBanner';

export default {
  title: 'Components / TurnBanner',
};

const pageStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 24,
  background: 'var(--hc-shadow-800, #0b1228)',
  color: 'var(--hc-text-primary, #f6f2e6)',
  fontFamily: 'system-ui, sans-serif',
  minWidth: 320,
  maxWidth: 520,
};

const captionStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--hc-text-muted, #b7ae95)',
};

const replayButtonStyle: CSSProperties = {
  alignSelf: 'flex-start',
  padding: '6px 12px',
  fontSize: 12,
  background: 'var(--hc-lead-iron-700)',
  color: 'var(--hc-text-primary)',
  border: '1px solid var(--hc-lead-gold-700)',
  borderRadius: 4,
  cursor: 'pointer',
};

interface DemoProps {
  readonly currentPlayerIndex: number;
  readonly turn: number;
  readonly championId?: string;
  readonly caption: string;
}

function Demo({ currentPlayerIndex, turn, championId, caption }: DemoProps) {
  // Bump the React key to force a remount and replay the entrance + sweep.
  const [replay, setReplay] = useState(0);
  return (
    <div style={pageStyle}>
      <span style={captionStyle}>{caption}</span>
      <button type="button" style={replayButtonStyle} onClick={() => setReplay((n) => n + 1)}>
        ▶ Replay entrance
      </button>
      <TurnBanner
        key={replay}
        currentPlayerIndex={currentPlayerIndex}
        turn={turn}
        championId={championId}
      />
    </div>
  );
}

export const PlayerOneNoChampion: Story = () => (
  <Demo
    currentPlayerIndex={0}
    turn={1}
    caption="Player 1 — Turn 1, no champion (amber glow fallback)"
  />
);

export const ValorWarden: Story = () => (
  <Demo
    currentPlayerIndex={0}
    turn={3}
    championId="champion-courage"
    caption="Valor Warden — emerald sweep tint"
  />
);

export const LoreWarden: Story = () => (
  <Demo
    currentPlayerIndex={1}
    turn={5}
    championId="champion-wisdom"
    caption="Lore Warden — sapphire sweep tint"
  />
);

export const MightWarden: Story = () => (
  <Demo
    currentPlayerIndex={2}
    turn={7}
    championId="champion-power"
    caption="Might Warden — ruby sweep tint"
  />
);

export const BladeWarden: Story = () => (
  <Demo
    currentPlayerIndex={3}
    turn={9}
    championId="champion-sword"
    caption="Blade Warden — pearl sweep tint"
  />
);

export const UnknownChampionFallback: Story = () => (
  <Demo
    currentPlayerIndex={0}
    turn={2}
    championId="champion-unknown"
    caption="Unknown championId — falls back to raw id, amber glow"
  />
);
