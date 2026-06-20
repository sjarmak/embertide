import type { CSSProperties, JSX } from 'react';
import type { KidPlayer } from '../../store/types';
import { HC_TOKENS } from '../../theme/tokens';
import HeartFeedback from '../HeartFeedback';
import HeartGainFx from '../HeartGainFx';

const SOCKET_SIZE = 22;

const SOCKETS_ROW_STYLE: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  alignItems: 'center',
  position: 'relative',
};

// The downed ribbon sits over the socket row. Modeled on ArtPendingFrame's
// pinned ribbon (position:absolute, top:0, full-width band with uppercase
// high-contrast text).
const DOWNED_RIBBON_STYLE: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  padding: '2px 6px',
  fontSize: 'var(--hc-text-xs)',
  fontWeight: 'var(--hc-font-weight-bold)',
  letterSpacing: HC_TOKENS.semantic['tracking-wider'],
  textAlign: 'center',
  background: 'var(--hc-jewel-ruby-700, #6e102a)',
  color: 'var(--hc-jewel-ruby-100, #f1ccd4)',
  borderBottom: '1px solid var(--hc-jewel-ruby-900, #3a0517)',
  zIndex: 2,
  textTransform: 'uppercase',
  pointerEvents: 'none',
};

export interface HeartSocketProps {
  readonly playerId: string;
  readonly index: number;
  readonly filled: boolean;
  readonly downed: boolean;
  /**
   * Optional pixel size override. Defaults to the main-board HPStrip
   * SOCKET_SIZE (22px). nz8-d (embertide-343): CombatScreen's top
   * player-hp row shares the same pip glyph at 18px so the combat HP
   * row matches the main-board HPStrip visually (embertide-ruby-pip-
   * consolidation 2026-04-24).
   */
  readonly size?: number;
}

export function HeartSocket({
  playerId,
  index,
  filled,
  downed,
  size = SOCKET_SIZE,
}: HeartSocketProps): JSX.Element {
  // Render each socket as a standalone SVG with two variants:
  //   filled  : ruby gradient (full heart shard)
  //   empty   : outline only, low-opacity fill
  // Downed applies a cracked/dimmed overlay to both variants so the strip
  // reads as "broken" at a glance even when HP === 0 and every socket is
  // empty (the whole row still needs to read as DOWNED).
  const gradId = `hc-hpstrip-socket-${playerId}-${index}`;
  const gradientStops = filled ? (
    <>
      <stop offset="0%" stopColor="var(--hc-jewel-ruby-100, #f1ccd4)" />
      <stop offset="55%" stopColor="var(--hc-jewel-ruby-300, #d96a82)" />
      <stop offset="100%" stopColor="var(--hc-jewel-ruby-500, #a1223c)" />
    </>
  ) : (
    <>
      <stop offset="0%" stopColor="var(--hc-jewel-ruby-900, #3a0517)" stopOpacity="0.25" />
      <stop offset="100%" stopColor="var(--hc-jewel-ruby-900, #3a0517)" stopOpacity="0.35" />
    </>
  );

  const strokeColor = downed
    ? 'var(--hc-jewel-ruby-900, #3a0517)'
    : 'var(--hc-lead-gold-500, #b89142)';

  return (
    <svg
      data-testid={`hp-strip-${playerId}-socket-${index}`}
      data-filled={filled ? 'true' : 'false'}
      data-downed={downed ? 'true' : 'false'}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={filled ? 'heart shard (full)' : 'heart shard (empty)'}
      style={{ opacity: downed ? 0.55 : 1 }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          {gradientStops}
        </linearGradient>
      </defs>
      <path
        d="M16 27 C 6 20, 3 13, 9 9 C 13 6, 16 10, 16 12 C 16 10, 19 6, 23 9 C 29 13, 26 20, 16 27 Z"
        fill={`url(#${gradId})`}
        stroke={strokeColor}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {downed ? (
        // "Cracked" zig-zag line drawn across the shard when the player is
        // downed — purely cosmetic damage tell.
        <path
          d="M9 12 L14 16 L11 19 L17 22 L14 25"
          stroke="var(--hc-jewel-ruby-900, #3a0517)"
          strokeWidth="1.2"
          fill="none"
          strokeLinejoin="round"
          opacity={0.9}
        />
      ) : null}
    </svg>
  );
}

export interface HeartSocketsRowProps {
  readonly player: KidPlayer;
  readonly damageFlash: boolean;
  readonly hpDelta: number | null;
  readonly containerPulseIndex: number | null;
}

/**
 * Heart sockets row for the main-board HPStrip. Renders one HeartSocket
 * per `hpMax`, marks the newest socket with a container-lands pulse when
 * `containerPulseIndex` matches its position, overlays the DOWNED ribbon
 * when `player.downed` is true, and floats a +N/-N HeartFeedback bubble
 * on each `hpDelta` change.
 */
export function HeartSocketsRow({
  player,
  damageFlash,
  hpDelta,
  containerPulseIndex,
}: HeartSocketsRowProps): JSX.Element {
  const sockets: JSX.Element[] = [];
  for (let i = 0; i < player.hpMax; i += 1) {
    const shouldPulse = containerPulseIndex === i;
    sockets.push(
      <div
        key={i}
        data-testid={`hp-strip-${player.id}-hpslot-${i}`}
        data-container-pulse={shouldPulse ? 'true' : undefined}
        className={shouldPulse ? 'hp-socket-container-pulse' : undefined}
        style={{ display: 'inline-flex' }}
      >
        <HeartSocket playerId={player.id} index={i} filled={i < player.hp} downed={player.downed} />
      </div>,
    );
  }

  return (
    <div
      className={damageFlash ? 'hp-sockets-row hp-damage-flash' : 'hp-sockets-row'}
      style={SOCKETS_ROW_STYLE}
      aria-label={`hp ${player.hp} of ${player.hpMax}`}
    >
      {sockets}
      {player.downed ? (
        <div
          data-testid={`hp-strip-${player.id}-downed-ribbon`}
          role="status"
          aria-label="Downed — awaiting revive"
          style={DOWNED_RIBBON_STYLE}
        >
          Downed
        </div>
      ) : null}
      {hpDelta !== null ? <HeartFeedback playerId={player.id} delta={hpDelta} /> : null}
      {hpDelta !== null && hpDelta > 0 ? (
        <HeartGainFx playerId={player.id} delta={hpDelta} />
      ) : null}
    </div>
  );
}
