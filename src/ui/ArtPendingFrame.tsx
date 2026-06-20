import type { ReactNode } from 'react';

import { HC_TOKENS } from '../theme/tokens';

export interface ArtPendingFrameProps {
  /** Optional child content rendered inside the frame (typically a fallback illustration). */
  readonly children?: ReactNode;
  /** Optional follow-up bead id for the finalization task. Rendered alongside the ribbon if present. */
  readonly followUpBeadId?: string;
  /** Optional extra test id suffix when multiple pending frames render on the same surface. */
  readonly testIdSuffix?: string;
}

const RIBBON_TEXT = '[v2-art-pending]';

const FRAME_STYLE = {
  position: 'relative',
  display: 'inline-block',
  width: '100%',
  height: '100%',
} as const;

const RIBBON_STYLE = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  padding: '2px 6px',
  fontSize: 'var(--hc-text-xs)',
  fontWeight: 'var(--hc-font-weight-bold)',
  // 0.05em rounded down to tracking-wide (0.04em). Mirrors the 5hw8
  // precedent of mapping unmatched values to the nearest existing token
  // rather than fabricating a new one.
  letterSpacing: HC_TOKENS.semantic['tracking-wide'],
  textAlign: 'center',
  background: 'var(--hc-jewel-amber-500, #c79b2a)',
  color: 'var(--hc-jewel-amber-900, #3a2506)',
  borderBottom: '1px solid var(--hc-jewel-amber-700, #8b6a17)',
  zIndex: 10,
  textTransform: 'uppercase',
  pointerEvents: 'none',
} as const;

/**
 * ArtPendingFrame — renders a pinned `[v2-art-pending]` ribbon over any
 * visual surface whose finalized art (typically raster) is not yet ready.
 *
 * Documented by docs/art-governance.md. Every PR that uses this component
 * must also link a follow-up bead tracking the finalization task.
 */
export default function ArtPendingFrame({
  children,
  followUpBeadId,
  testIdSuffix,
}: ArtPendingFrameProps) {
  const testId = testIdSuffix ? `art-pending-frame-${testIdSuffix}` : 'art-pending-frame';
  const ribbonLabel = followUpBeadId ? `${RIBBON_TEXT} · ${followUpBeadId}` : RIBBON_TEXT;

  return (
    <div data-testid={testId} style={FRAME_STYLE}>
      <div
        data-testid={`${testId}-ribbon`}
        role="status"
        aria-label={ribbonLabel}
        style={RIBBON_STYLE}
      >
        {ribbonLabel}
      </div>
      {children}
    </div>
  );
}
