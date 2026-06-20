import { useEffect, useMemo } from 'react';
import type { CSSProperties, JSX } from 'react';
import { motion, type Transition } from 'framer-motion';
import type { ZoneId } from '../store/types';
import { ZONE_METADATA } from '../rules/zones';
import { HC_TOKENS } from '../theme/tokens';
import { EASE } from '../motion/easings';

export interface ZoneAdvanceBannerProps {
  readonly fromZone: ZoneId;
  readonly toZone: ZoneId;
  readonly onDismiss: () => void;
  /**
   * Auto-dismiss delay in ms. Defaults to 2200ms so the visible window
   * meets the >= 2.0s read-time floor specified in embertide-4m5.3
   * (sweep-in 400ms + hold 1400ms + fade 400ms). Override for tests.
   */
  readonly durationMs?: number;
}

const DEFAULT_DURATION_MS = 2200;
const ENTER_MS = 400;
const EXIT_MS = 400;

const ROOT_STYLE: CSSProperties = {
  position: 'fixed',
  top: 72,
  left: '50%',
  transform: 'translateX(-50%)',
  padding: '12px 22px',
  borderRadius: 8,
  background: 'var(--hc-jewel-amber-500, #c48a1f)',
  color: 'var(--hc-jewel-amber-900, #4d2f04)',
  border: '1px solid var(--hc-lead-gold-700, #8b6a2a)',
  boxShadow:
    'inset 0 0 0 1px var(--hc-lead-gold-500, #b89142), 0 6px 18px var(--hc-glow-shadow, rgba(5, 8, 15, 0.6))',
  fontFamily: 'var(--hc-font-display)',
  fontSize: 'var(--hc-text-sm)',
  fontWeight: 'var(--hc-font-weight-extrabold)',
  letterSpacing: HC_TOKENS.semantic['tracking-chrome-md'],
  textTransform: 'uppercase',
  zIndex: 50,
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
};

const FROM_STYLE: CSSProperties = {
  opacity: 0.85,
  fontWeight: 'var(--hc-font-weight-bold)',
};

const TO_STYLE: CSSProperties = {
  fontWeight: 'var(--hc-font-weight-extrabold)',
  letterSpacing: HC_TOKENS.semantic['tracking-chrome-extra'],
};

const FLOURISH_STYLE: CSSProperties = {
  display: 'inline-block',
  margin: '0 8px',
  color: 'var(--hc-lead-gold-500)',
};

/**
 * ZoneAdvanceBanner — transient banner fired when a zone-advance event
 * occurs (region-boss defeat → `advanceZone`). GameBoard mounts this
 * component in response to `state.zoneHistory` growing, and unmounts it
 * when `onDismiss` fires after `durationMs`.
 *
 * Motion (embertide-4m5.3): sweep-in (~400ms) → hold (~1400ms) →
 * fade-out (~400ms), all driven by Framer Motion. Prefers-reduced-motion
 * is honored via the app-level <MotionConfig reducedMotion="user">: the
 * banner cross-fades without translation/sweep so the text simply swaps
 * in for the same hold window.
 *
 * Design: controlled component. Parent owns the lifecycle — this module
 * only knows how to display the text and fire a single dismiss signal
 * on timer expiry. Keeps the banner decoupled from the store-shape
 * subscriptions GameBoard manages.
 *
 * A11y: `role="status"` + `aria-live="polite"` so screen readers
 * announce the transition without interrupting current speech.
 */
export default function ZoneAdvanceBanner({
  fromZone,
  toZone,
  onDismiss,
  durationMs = DEFAULT_DURATION_MS,
}: ZoneAdvanceBannerProps): JSX.Element {
  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [onDismiss, durationMs]);

  const fromDisplayName = ZONE_METADATA[fromZone].displayName;
  const toDisplayName = ZONE_METADATA[toZone].displayName;

  // Compute keyframe times so enter/hold/exit segments scale with
  // durationMs. For the default 2200ms this yields [0, 0.18, 0.82, 1].
  // Always clamp so the hold segment is non-empty even if a tiny
  // durationMs is passed in tests.
  const times = useMemo<number[]>(() => {
    const enterFraction = Math.min(0.45, ENTER_MS / durationMs);
    const exitFraction = Math.min(0.45, EXIT_MS / durationMs);
    return [0, enterFraction, 1 - exitFraction, 1];
  }, [durationMs]);

  // Wrap the durationMs-aware transition in a memo so the `hc/no-inline-
  // framer-transition` rule passes (identifier expression rather than an
  // inline object literal) while keeping the runtime per-mount values
  // (durationMs, derived `times`) intact.
  const transition = useMemo<Transition>(
    () => ({
      duration: durationMs / 1000,
      times,
      ease: [...EASE.inkWash] as [number, number, number, number],
    }),
    [durationMs, times],
  );

  return (
    <motion.div
      data-testid="zone-advance-banner"
      role="status"
      aria-live="polite"
      aria-label={`${fromDisplayName} cleared — ${toDisplayName} awaits`}
      style={ROOT_STYLE}
      initial={{ opacity: 0, y: -12 }}
      animate={{
        opacity: [0, 1, 1, 0],
        y: [-12, 0, 0, -8],
      }}
      transition={transition}
    >
      <span data-testid="zone-advance-banner-from" style={FROM_STYLE}>
        {fromDisplayName}
      </span>
      <span style={FLOURISH_STYLE} aria-hidden="true">
        ✦
      </span>
      <span data-testid="zone-advance-banner-to" style={TO_STYLE}>
        {toDisplayName}
      </span>
      <span> awaits</span>
    </motion.div>
  );
}
