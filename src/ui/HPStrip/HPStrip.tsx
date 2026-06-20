import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import type { KidPlayer, Phase } from '../../store/types';
import { HeartSocketsRow } from './HeartSockets';
import { HeartPieceStack } from './HeartPieceStack';
import { ReviveButton } from './ReviveButton';

export interface HPStripProps {
  readonly player: KidPlayer;
  /** True when THIS player is the active (current-turn) player. */
  readonly isActive: boolean;
  /**
   * Is THIS component rendering the teammate (non-viewing player)?
   * When true AND `player.downed === true` AND the viewing/active player has
   * `revivedThisIncident === false`, a "Revive" button appears on THIS strip
   * (i.e., the DOWNED teammate's tray). Clicking it calls `onRevive`.
   */
  readonly isTeammateView?: boolean;
  /** Fired when the viewer clicks Revive on the downed teammate's strip. */
  readonly onRevive?: () => void;
  /**
   * The CURRENT phase of the game, used to gate the Revive button. Revive
   * only works in 'Main' phase (phase guard in the store throws otherwise).
   */
  readonly phase: Phase;
  /**
   * Has the ACTIVE (reviving) player already revived this incident?
   * When true, the Revive button is disabled with a tooltip/aria-label.
   */
  readonly activePlayerRevivedThisIncident: boolean;
}

const HEART_FEEDBACK_MS = 800;
const DAMAGE_FLASH_MS = 500;
// v2.1 gm0.17 — container-lands animation. When `hpMax` increments
// (grunt-meter promotion, tough kill that promotes, or slot-boss drop)
// a new heart slot appears. We pulse the LAST socket with a fade-in +
// glow for ~400ms so the player notices the bump. `prefers-reduced-motion`
// disables the pulse — the socket still renders, just without the animation.
const CONTAINER_PULSE_MS = 400;

const ROOT_STYLE: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  width: '100%',
};

interface HpDeltaTrackingState {
  readonly hpDelta: number | null;
  readonly damageFlash: boolean;
  readonly containerPulseIndex: number | null;
}

/**
 * Tracks HP / hpMax transitions and exposes the transient feedback
 * state the composition root needs to render: the most recent +N/-N
 * float, the damage-flash class toggle, and the container-lands pulse
 * index when `hpMax` grows.
 *
 * HP delta feedback (+N for gains, -N for losses): the "+N" gain float
 * landed in embertide-9c7; rev-2 2026-04-22 added the "-N" loss
 * float + a red-flash class on the sockets row so boss damage reads
 * visually (player feedback: "when the boss deals damage nothing shows
 * happening to your hearts"). Both branches write to the same state
 * slot — HeartFeedback picks its color and motion based on the sign of
 * the delta. The hpMax-grew effect runs independently so a heart
 * container (hpMax +1 AND hp +1) animates the new socket once rather
 * than competing with the "+1" float.
 */
function useHpDeltaTracking(hp: number, hpMax: number): HpDeltaTrackingState {
  const prevHpRef = useRef<number>(hp);
  const prevHpMaxRef = useRef<number>(hpMax);
  const [hpDelta, setHpDelta] = useState<{ delta: number; timestamp: number } | null>(null);
  const [damageFlash, setDamageFlash] = useState(false);
  const [containerPulseIndex, setContainerPulseIndex] = useState<number | null>(null);

  useEffect(() => {
    const prev = prevHpRef.current;
    if (hp === prev) return undefined;
    const delta = hp - prev;
    const timestamp = Date.now();
    setHpDelta({ delta, timestamp });
    const floatTimer = setTimeout(() => {
      setHpDelta((current) => (current && current.timestamp === timestamp ? null : current));
    }, HEART_FEEDBACK_MS);
    let flashTimer: ReturnType<typeof setTimeout> | null = null;
    if (delta < 0) {
      // Damage: flash the sockets row red briefly so the eye is
      // drawn to the HP bar during boss-turn resolution. The flash
      // lifts independently of the "-N" float so both cues register.
      setDamageFlash(true);
      flashTimer = setTimeout(() => setDamageFlash(false), DAMAGE_FLASH_MS);
    }
    prevHpRef.current = hp;
    return () => {
      clearTimeout(floatTimer);
      if (flashTimer !== null) clearTimeout(flashTimer);
    };
  }, [hp]);

  useEffect(() => {
    const prev = prevHpMaxRef.current;
    if (hpMax === prev) return undefined;
    if (hpMax > prev) {
      // The newly-added socket sits at index hpMax-1 (array is
      // left-to-right). Trigger the pulse briefly then clear.
      setContainerPulseIndex(hpMax - 1);
      const pulseTimer = setTimeout(() => {
        setContainerPulseIndex(null);
      }, CONTAINER_PULSE_MS);
      prevHpMaxRef.current = hpMax;
      return () => clearTimeout(pulseTimer);
    }
    prevHpMaxRef.current = hpMax;
    return undefined;
  }, [hpMax]);

  return {
    hpDelta: hpDelta ? hpDelta.delta : null,
    damageFlash,
    containerPulseIndex,
  };
}

/**
 * HPStrip — per-player HP display (amendment A2/A3). Replaces the v1 Heart
 * icon + counter with an hpMax-aware row of heart-shard sockets. When the
 * player is downed, the sockets render dimmed + cracked and a "DOWNED"
 * ribbon pins over the row. When the viewer is looking at a downed
 * teammate's tray and hasn't already consumed their teammate-revive
 * budget, a "Revive" button appears beneath the row.
 */
export default function HPStrip({
  player,
  isActive,
  isTeammateView = false,
  onRevive,
  phase,
  activePlayerRevivedThisIncident,
}: HPStripProps): JSX.Element {
  const { hpDelta, damageFlash, containerPulseIndex } = useHpDeltaTracking(player.hp, player.hpMax);

  // Revive button appears only when rendering a DOWNED teammate's strip
  // AND a callback is wired. Self-view (isTeammateView=false) never shows
  // the button because a player cannot revive themselves (store throws
  // 'reviveTeammate: cannot revive yourself'). Requiring `onRevive !==
  // undefined` here prevents a silent no-op click when a consumer forgets
  // to thread the callback through.
  const showReviveButton = Boolean(isTeammateView && player.downed && onRevive !== undefined);

  return (
    <div
      data-testid={`hp-strip-${player.id}`}
      data-active={isActive ? 'true' : 'false'}
      data-downed={player.downed ? 'true' : 'false'}
      style={ROOT_STYLE}
    >
      <HeartSocketsRow
        player={player}
        damageFlash={damageFlash}
        hpDelta={hpDelta}
        containerPulseIndex={containerPulseIndex}
      />
      {/* v2.1 gm0.17: ember-shard meter + pending heart in its own
          parchment sub-pane. Always visible so the empty structure
          signals the progression goal; hidden only at the transient
          heartPieces=4 state. */}
      <HeartPieceStack
        playerId={player.id}
        heartPieces={player.heartPieces}
        heartPieceMeter={player.heartPieceMeter}
      />
      {showReviveButton && onRevive ? (
        <ReviveButton
          playerId={player.id}
          playerName={player.name}
          phase={phase}
          activePlayerRevivedThisIncident={activePlayerRevivedThisIncident}
          onRevive={onRevive}
        />
      ) : null}
    </div>
  );
}
