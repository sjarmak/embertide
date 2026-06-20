import type { CSSProperties, JSX } from 'react';
import type { ZoneMetadata } from '../rules/zones';
import { ZONE_RASTER, ZONE_FILTER, ZONE_SCRIM } from './zoneRaster';

export interface ZoneCellProps {
  readonly zone: ZoneMetadata;
}

const ROOT_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: 8,
  overflow: 'hidden',
  pointerEvents: 'none',
  zIndex: 0,
};

const IMG_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
  opacity: 1,
};

const SCRIM_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
};

const SR_ONLY_STYLE: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/**
 * ZoneCell — the current zone's raster rendered as a FULL-AREA backdrop
 * behind all board-main content. Absolutely positioned with `inset: 0`;
 * callers must give the parent `position: relative` and push interactive
 * content onto `z-index: 1`. A blur + brightness + scrim pass tones the
 * detail down so the painted forest / volcano / temple art reads as
 * atmospheric mood rather than a busy foreground distraction.
 *
 * Zone identity is still carried accessibly via the root's aria-label
 * and an sr-only themeHint span. No visible label — the raster IS the
 * zone identity.
 */
export default function ZoneCell({ zone }: ZoneCellProps): JSX.Element {
  const rasterSrc = ZONE_RASTER[zone.id];
  const filter = ZONE_FILTER[zone.id];
  const scrim = ZONE_SCRIM[zone.id];
  return (
    <div
      data-testid={`zone-cell-${zone.id}`}
      data-zone-id={zone.id}
      style={ROOT_STYLE}
      aria-label={`Current zone: ${zone.displayName}`}
    >
      <img
        data-testid={`zone-raster-${zone.id}`}
        src={rasterSrc}
        alt=""
        style={{ ...IMG_STYLE, filter }}
      />
      <div style={{ ...SCRIM_STYLE, background: scrim }} />
      <span
        data-testid={`zone-cell-${zone.id}-theme-hint`}
        aria-label={zone.themeHint}
        style={SR_ONLY_STYLE}
      >
        {zone.themeHint}
      </span>
    </div>
  );
}
