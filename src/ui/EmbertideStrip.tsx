import { useId } from 'react';
import type { CSSProperties, JSX } from 'react';
import type { SharedEmbertide } from '../store/types';

export interface EmbertideStripProps {
  readonly shards: SharedEmbertide;
}

type ShardId = 'wisdom' | 'courage' | 'power';

interface ShardDef {
  readonly id: ShardId;
  readonly label: string;
  /** SVG polygon points for the triangle in the 120×110 inner-niche frame. */
  readonly points: string;
  /**
   * Top-edge polyline (the "catches-the-light" edge) — rendered as a
   * subtle warm-cream highlight ON the rim to fake a chamfered bevel.
   * Each entry is `"x1,y1 x2,y2"` — matches the two edges of the
   * triangle that face upward.
   */
  readonly topEdge: string;
}

/**
 * Classic Embertide formation in a 120×110 frame, sitting inside an
 * ornate cathedral-niche surround. Geometry preserved from the
 * pre-7cew canonical art (rev 79ec1a6) so the empty-slot / fill-with-
 * gold-stained-glass aesthetic comes back exactly as it was before
 * the title-strip-medallion detour.
 *
 * Three discrete ember-gem facets, one per aspect, set at an apex +
 * lower-left + lower-right with clear gaps between them — three separate
 * jewels of the Embertide, not a single conjoined sigil:
 *   - Power:   APEX        (defeat Cagewright Vurmox)
 *   - Wisdom:  LOWER-LEFT  (free Sovereign Aurelia from the crystal)
 *   - Courage: LOWER-RIGHT (complete the map)
 */
const SHARDS: readonly ShardDef[] = [
  {
    id: 'power',
    label: 'Power',
    points: '60,3 82,25 60,47 38,25',
    topEdge: '38,25 60,3 82,25',
  },
  {
    id: 'wisdom',
    label: 'Wisdom',
    points: '30,58 52,80 30,102 8,80',
    topEdge: '8,80 30,58 52,80',
  },
  {
    id: 'courage',
    label: 'Courage',
    points: '90,58 112,80 90,102 68,80',
    topEdge: '68,80 90,58 112,80',
  },
];

/*
 * 9eou rev-2 (2026-04-26): the cathedral-niche arch surround is
 * dropped — user feedback was "the weird black background arch thing"
 * read poorly. The Embertide now renders as the bare three-shard
 * silhouette and inherits the cream parchment plate that wraps
 * Crystal + Embertide in the right-rail (`.crystal-embertide-pane`).
 * Shard geometry stays at its canonical 0..120 × 0..110 coordinates;
 * a small symmetric bleed (-4) keeps the brass rim from clipping.
 */
const VIEWBOX_X = -4;
const VIEWBOX_Y = -4;
const VIEWBOX_WIDTH = 128;
const VIEWBOX_HEIGHT = 118;

const ROOT_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 0,
  width: '100%',
  boxSizing: 'border-box',
};

const SVG_STYLE: CSSProperties = {
  width: '100%',
  height: 'auto',
  maxWidth: '100%',
  display: 'block',
};

interface EmbertideShardPolygonProps {
  readonly def: ShardDef;
  readonly filled: boolean;
  readonly rimGradientId: string;
  readonly hollowGradientId: string;
  readonly filledGradientId: string;
  readonly innerShadowId: string;
  readonly glowId: string;
}

/**
 * One triangular reliquary niche.
 *
 * EMPTY state — recessed hollow carved into brass:
 *   1. Radial dark gradient fills the triangle interior (darker at
 *      center, warmer at rim) to suggest concavity.
 *   2. Inner-shadow filter on a transparent copy so the rim casts a
 *      soft shadow INTO the hollow.
 *   3. Brass rim is a 3px gradient stroke (light top → dark bottom).
 *   4. Cream polyline traces the upward-facing edges as a specular glint.
 *
 * FILLED state — seated stained-glass piece:
 *   1. Diagonal amber/gold gradient fills the triangle (pale → deep).
 *   2. Gaussian-blur glow halos the piece so it reads as backlit.
 *   3. Same brass rim + top-edge highlight stays visible — frames the
 *      seated piece instead of an empty socket.
 */
function EmbertideShardPolygon({
  def,
  filled,
  rimGradientId,
  hollowGradientId,
  filledGradientId,
  innerShadowId,
  glowId,
}: EmbertideShardPolygonProps): JSX.Element {
  const ariaLabel = filled ? `${def.label} shard (earned)` : `${def.label} shard (not earned)`;
  return (
    <g
      data-testid={`embertide-shard-${def.id}`}
      data-filled={filled ? 'true' : 'false'}
      data-glow-filter={filled ? `url(#${glowId})` : 'none'}
      role="img"
      aria-label={ariaLabel}
      filter={filled ? `url(#${glowId})` : undefined}
    >
      {filled ? (
        <polygon points={def.points} fill={`url(#${filledGradientId})`} />
      ) : (
        <>
          <polygon points={def.points} fill={`url(#${hollowGradientId})`} />
          <polygon
            points={def.points}
            fill="#000000"
            fillOpacity={0.001}
            filter={`url(#${innerShadowId})`}
          />
        </>
      )}
      <polygon
        points={def.points}
        fill="none"
        stroke={`url(#${rimGradientId})`}
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points={def.topEdge}
        fill="none"
        stroke="var(--hc-parchment-100, #f4ebd3)"
        strokeWidth={0.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.55}
      />
    </g>
  );
}

/**
 * EmbertideStrip — SHARED co-op shard display (amendment A2).
 *
 * embertide-9eou (2026-04-26): the Embertide relocates from the
 * cathedral title-strip center to the right-side rail, sitting beneath
 * the PrincessCrystal cell. Both the Crystal and the Embertide share a
 * single cream parchment pane (rendered by GameBoard, see
 * `.crystal-embertide-pane`) so the right rail reads as one cathedral
 * artifact rather than competing surfaces.
 *
 * Shard art reverts to the canonical pre-7cew aesthetic — recessed
 * brass-rim niches that fill with stained-glass amber when each shard
 * is earned. The SVG carries no surrounding chrome; the cream pane in
 * `.board-side-crystal-rail` is the only frame.
 *
 * Each triangle fills independently when its corresponding
 * `sharedEmbertide` flag flips true:
 *   - power:   defeat Cagewright Vurmox (TOP)
 *   - wisdom:  free Princess Aurelia from the crystal (BOTTOM-LEFT)
 *   - courage: complete map exploration (BOTTOM-RIGHT)
 *
 * Per-instance ids (gradients/filters) are scoped via `useId` so
 * multiple instances (Ladle gallery, future split views) never
 * cross-contaminate.
 */
export default function EmbertideStrip({ shards }: EmbertideStripProps): JSX.Element {
  const idScope = useId().replace(/:/g, '');
  const rimGradientId = `hc-embertide-rim-${idScope}`;
  const hollowGradientId = `hc-embertide-hollow-${idScope}`;
  const filledGradientId = `hc-embertide-filled-${idScope}`;
  const innerShadowId = `hc-embertide-inner-shadow-${idScope}`;
  const glowId = `hc-embertide-glow-${idScope}`;

  return (
    <div data-testid="embertide-strip" style={ROOT_STYLE} aria-label="Embertide shards">
      <svg
        viewBox={`${VIEWBOX_X} ${VIEWBOX_Y} ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        style={SVG_STYLE}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Embertide"
      >
        <defs>
          {/* Brass rim: light top → mid → shadowed bottom. */}
          <linearGradient id={rimGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--hc-jewel-amber-300, #e8bd59)" />
            <stop offset="50%" stopColor="var(--hc-lead-gold-500, #b89142)" />
            <stop offset="100%" stopColor="var(--hc-lead-gold-900, #5a3f10)" />
          </linearGradient>

          {/* Empty hollow: radial, near-black at center → warmer dark at rim. */}
          <radialGradient id={hollowGradientId} cx="50%" cy="55%" r="65%">
            <stop offset="0%" stopColor="#000000" />
            <stop offset="55%" stopColor="#0a0806" />
            <stop offset="100%" stopColor="#1c160f" />
          </radialGradient>

          {/* Filled stained-glass: varied amber/gold tones across diagonal. */}
          <linearGradient id={filledGradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--hc-jewel-amber-100, #f6e7bc)" />
            <stop offset="40%" stopColor="var(--hc-jewel-amber-300, #e8bd59)" />
            <stop offset="70%" stopColor="var(--hc-jewel-amber-500, #c48a1f)" />
            <stop offset="100%" stopColor="var(--hc-lead-gold-700, #8b6a2a)" />
          </linearGradient>

          {/*
           * Inner-shadow filter — applied to a transparent copy of each
           * shard polygon so the rim casts a soft shadow into the hollow:
           *   1. Blur source alpha (the rim shape).
           *   2. Offset downward.
           *   3. Flood dark, mask by offset.
           *   4. Composite as difference, clipped to shape.
           */}
          <filter
            id={innerShadowId}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.8" />
            <feOffset dy="1.2" result="offsetblur" />
            <feFlood floodColor="#000000" floodOpacity="0.75" />
            <feComposite in2="offsetblur" operator="in" />
            <feComposite in2="SourceGraphic" operator="arithmetic" k2="-1" k3="1" />
          </filter>

          {/* Filled-piece glow — soft Gaussian halo so stained glass reads as backlit. */}
          <filter
            id={glowId}
            x="-25%"
            y="-25%"
            width="150%"
            height="150%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {SHARDS.map((def) => (
          <EmbertideShardPolygon
            key={def.id}
            def={def}
            filled={shards[def.id]}
            rimGradientId={rimGradientId}
            hollowGradientId={hollowGradientId}
            filledGradientId={filledGradientId}
            innerShadowId={innerShadowId}
            glowId={glowId}
          />
        ))}
      </svg>
    </div>
  );
}
