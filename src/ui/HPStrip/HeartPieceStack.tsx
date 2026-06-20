import type { CSSProperties, JSX } from 'react';

// v2.1 gm0.17 — ember-shard meter + pending-heart stack.
//
// Two-layer readout of progress toward the next HP heart:
//
//   1. 3-segment METER — fills one pip per grunt-tier defeat
//      (`heartPieceMeter` 0..2). Meter full → +1 ember-shard + reset.
//
//   2. 4-segment PENDING HEART — outline heart split into four quarter
//      wedges; fills bottom-up per `heartPieces` (0..3). 4th piece
//      auto-promotes to a vital-ember (hpMax +1, new socket).
//
// Sits in its own parchment sub-pane below the sockets row. Meter +
// pending heart flow horizontally inside the pane. All CSS/SVG, no
// raster.
const EMBER_SHARD_PANE_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 10px',
  alignSelf: 'flex-start',
  background:
    'radial-gradient(circle at 30% 25%, var(--hc-parchment-100, #f7eccf) 0%, var(--hc-parchment-300, #dbc289) 65%, var(--hc-parchment-500, #b28a48) 100%)',
  color: 'var(--hc-lead-900, #1a1005)',
  border: '1px solid var(--hc-lead-gold-500, #b89142)',
  borderRadius: 8,
  boxShadow: '0 1px 0 var(--hc-lead-gold-700, #7a5a1e) inset, 0 1px 2px rgba(0,0,0,0.25)',
  userSelect: 'none',
  pointerEvents: 'none',
};

const METER_ROW_STYLE: CSSProperties = {
  display: 'flex',
  gap: 3,
  alignItems: 'center',
};

const METER_PIP_SIZE: CSSProperties = {
  width: 10,
  height: 8,
  borderRadius: 2,
  border: '1px solid var(--hc-jewel-ruby-700, #6e102a)',
};

const METER_PIP_FILLED_STYLE: CSSProperties = {
  ...METER_PIP_SIZE,
  background:
    'linear-gradient(180deg, var(--hc-jewel-ruby-300, #d96a82) 0%, var(--hc-jewel-ruby-500, #a1223c) 100%)',
};

const METER_PIP_EMPTY_STYLE: CSSProperties = {
  ...METER_PIP_SIZE,
  background: 'rgba(58, 5, 23, 0.25)',
};

const PENDING_HEART_SIZE = 32;

// Pending heart wedge fill colors — same ruby gradient as filled heart
// sockets, so a full 4-segment heart visually matches the HP row
// sockets the instant it auto-promotes to a container.
const PENDING_WEDGE_FILL = 'var(--hc-jewel-ruby-500, #a1223c)';
const PENDING_WEDGE_EMPTY = 'rgba(58, 5, 23, 0.15)';
const PENDING_WEDGE_STROKE = 'var(--hc-jewel-ruby-700, #6e102a)';

export interface HeartPieceStackProps {
  readonly playerId: string;
  readonly heartPieces: number;
  readonly heartPieceMeter: number;
}

/**
 * Ember-shard meter + 4-segment pending heart (v2.1 gm0.17).
 *
 * Layout (top-to-bottom): 3-pip meter row, then a 4-segment outline
 * heart whose wedges fill bottom-up as `heartPieces` grows 0..3. The
 * 4th piece auto-promotes (gm0.16) to a vital ember, so the wedges
 * never visually rest at 4/4 — that state animates into a new HP
 * socket and this component returns to 0/4.
 *
 * Always visible from game start so the empty meter + empty-heart
 * silhouette signal the progression goal before any pieces are earned.
 * Only hidden at the transient `heartPieces === 4` (auto-promoted to
 * a container; should never rest).
 */
export function HeartPieceStack({
  playerId,
  heartPieces,
  heartPieceMeter,
}: HeartPieceStackProps): JSX.Element | null {
  // Hide only at the transient heartPieces=4 (addHeartPieceLocal
  // auto-promotes and resets to 0 — guard against that state leaking
  // into a frame).
  if (heartPieces >= 4) return null;

  const meterPips: JSX.Element[] = [];
  for (let i = 0; i < 3; i += 1) {
    const filled = i < heartPieceMeter;
    meterPips.push(
      <span
        key={i}
        data-testid={`hp-strip-${playerId}-meter-pip-${i}`}
        data-filled={filled ? 'true' : 'false'}
        style={filled ? METER_PIP_FILLED_STYLE : METER_PIP_EMPTY_STYLE}
      />,
    );
  }

  // 4-quarter pending heart. Wedge index 0 = bottom-left, 1 =
  // bottom-right, 2 = top-left, 3 = top-right. Fill order is
  // bottom-up, left-first — reads as "building a heart" which
  // matches how filling sockets in the HP row reads left-to-right.
  // We draw the full outline path first (low-opacity fill), then
  // overlay filled wedges on top per heartPieces. Done this way so
  // the outline is always visible even at 0 pieces.
  const wedgePaths: readonly string[] = [
    // Bottom-left quarter.
    'M16 27 C 6 20, 3 13, 9 9 L 16 15 Z',
    // Bottom-right quarter.
    'M16 27 C 26 20, 29 13, 23 9 L 16 15 Z',
    // Top-left quarter (left lobe).
    'M9 9 C 13 6, 16 10, 16 12 L 16 15 Z',
    // Top-right quarter (right lobe).
    'M23 9 C 19 6, 16 10, 16 12 L 16 15 Z',
  ];

  return (
    <div
      data-testid={`hp-strip-${playerId}-ember-shard-stack`}
      role="img"
      aria-label={`${heartPieces} of 4 heart pieces, meter ${heartPieceMeter} of 3`}
      title={`Heart pieces: ${heartPieces}/4 · meter ${heartPieceMeter}/3`}
      style={EMBER_SHARD_PANE_STYLE}
    >
      <div
        data-testid={`hp-strip-${playerId}-ember-shard-meter`}
        data-meter={heartPieceMeter}
        style={METER_ROW_STYLE}
      >
        {meterPips}
      </div>
      <svg
        data-testid={`hp-strip-${playerId}-ember-shard-pending`}
        data-pieces={heartPieces}
        width={PENDING_HEART_SIZE}
        height={PENDING_HEART_SIZE}
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Base outline (empty) — always visible. */}
        <path
          d="M16 27 C 6 20, 3 13, 9 9 C 13 6, 16 10, 16 12 C 16 10, 19 6, 23 9 C 29 13, 26 20, 16 27 Z"
          fill={PENDING_WEDGE_EMPTY}
          stroke={PENDING_WEDGE_STROKE}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* Filled wedges overlay. */}
        {wedgePaths.map((d, i) =>
          i < heartPieces ? (
            <path
              key={i}
              data-testid={`hp-strip-${playerId}-ember-shard-wedge-${i}`}
              d={d}
              fill={PENDING_WEDGE_FILL}
              stroke={PENDING_WEDGE_STROKE}
              strokeWidth="0.6"
              strokeLinejoin="round"
            />
          ) : null,
        )}
      </svg>
    </div>
  );
}
