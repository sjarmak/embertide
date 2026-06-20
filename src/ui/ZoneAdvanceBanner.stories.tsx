/**
 * Ladle stories for ZoneAdvanceBanner (embertide-4m5.3 polish).
 *
 * Each story re-mounts on a `key` change so designers can re-trigger the
 * sweep-in / hold / fade-out cycle with the "Replay" button. The auto-
 * dismiss timer is suppressed via a no-op `onDismiss` so the banner
 * remains visible after the visible animation window ends.
 *
 * Reduced-motion path: toggle `prefers-reduced-motion` in the OS / dev
 * tools — the app-level <MotionConfig reducedMotion="user"> skips the
 * translation while keeping the cross-fade so the text still appears
 * for the full read-time floor.
 */
import { useState, type CSSProperties } from 'react';
import type { Story } from '@ladle/react';

import ZoneAdvanceBanner from './ZoneAdvanceBanner';
import type { ZoneId } from '../store/types';

export default {
  title: 'Components / ZoneAdvanceBanner',
};

const pageStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 24,
  // Plenty of headroom so the fixed-position banner has somewhere to
  // sweep into without overlapping the controls below.
  minHeight: 220,
  background: 'var(--hc-shadow-800, #0b1228)',
  color: 'var(--hc-text-primary, #f6f2e6)',
  fontFamily: 'system-ui, sans-serif',
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
  readonly fromZone: ZoneId;
  readonly toZone: ZoneId;
  readonly caption: string;
  readonly durationMs?: number;
}

function noop(): void {
  /* swallow auto-dismiss so the banner stays put for the design review */
}

function Demo({ fromZone, toZone, caption, durationMs }: DemoProps) {
  const [replay, setReplay] = useState(0);
  return (
    <div style={pageStyle}>
      <span style={captionStyle}>{caption}</span>
      <button type="button" style={replayButtonStyle} onClick={() => setReplay((n) => n + 1)}>
        ▶ Replay sweep-in / hold / fade
      </button>
      <ZoneAdvanceBanner
        key={replay}
        fromZone={fromZone}
        toZone={toZone}
        onDismiss={noop}
        durationMs={durationMs}
      />
    </div>
  );
}

export const KokiriToDeathMountain: Story = () => (
  <Demo
    fromZone="sylvani"
    toZone="emberpeak"
    caption="Default 2.2s window: 400ms sweep-in → 1400ms hold → 400ms fade-out"
  />
);

export const DeathMountainToZora: Story = () => (
  <Demo
    fromZone="emberpeak"
    toZone="maren"
    caption="Mid-game advance — Emberpeak cleared → Tidehold awaits"
  />
);

export const ShadowToSpirit: Story = () => (
  <Demo
    fromZone="hollow-shrine"
    toZone="dune-sanctum"
    caption="Late-game advance — Hollow Shrine cleared → Dune Sanctum awaits"
  />
);

export const FinalAscent: Story = () => (
  <Demo
    fromZone="dune-sanctum"
    toZone="gilded-cage"
    caption="Final ascent — Dune Sanctum cleared → Gilded Cage awaits"
  />
);

export const ExtendedHold: Story = () => (
  <Demo
    fromZone="sylvani"
    toZone="gilded-cage"
    durationMs={3600}
    caption="3.6s extended hold — useful for screenshot capture / design review"
  />
);
