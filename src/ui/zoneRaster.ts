import type { ZoneId } from '../store/types';

/**
 * Shared zone-art lookup tables.
 *
 * Extracted from `ZoneCell.tsx` (embertide-4e21, 2026-06-04) once a
 * SECOND consumer appeared: the pre-click boss-selection tiles
 * (`BossAltarPane`) now render the active zone's backdrop art behind the
 * boss portrait instead of a solid jewel fill. Both surfaces read the same
 * raster + atmospheric-filter tables so the tile backdrop matches the
 * full-board `ZoneCell` art for the zone the boss lives in.
 *
 * `ZONE_SCRIM` is the FULL-AREA dual-edge vignette `ZoneCell` paints over
 * its board-sized backdrop; the small boss tile uses its own token-based
 * scrim (see `BossAltarPane.css`) sized for the tile, so it does not import
 * this table. It lives here for cohesion with the other two zone-art tables.
 */

/**
 * Finalized raster backdrops (nano-banana-pro, 21:9 2K webp). Landed in
 * 2026-04-20 v2.0 art finalization pass (beads x54 / ha6 / efu). Each
 * raster is a painterly stained-glass panel matching the zone's jewel
 * family and the Elysian Cathedral card-art style.
 */
export const ZONE_RASTER: Record<ZoneId, string> = {
  sylvani: '/illustrations/cathedral_zone_sylvani_001.webp',
  'emberpeak': '/illustrations/cathedral_zone_emberpeak_001.webp',
  // gdd.1 / gdd.2 / gdd.3: zone backdrops landed 2026-04-25 (FAL batch).
  maren: '/illustrations/cathedral_zone_maren_001.webp',
  'hollow-shrine': '/illustrations/cathedral_zone_hollow_shrine_001.webp',
  'dune-sanctum': '/illustrations/cathedral_zone_dune_sanctum_001.webp',
  'gilded-cage': '/illustrations/cathedral_zone_gilded_cage_001.webp',
};

/**
 * Per-zone thematic filter + overlay tuning. Each zone raster gets a
 * blur/brightness/saturate pass so the detail reads as "atmospheric wash"
 * rather than a busy foreground distraction, plus a zone-tinted gradient
 * scrim that pushes the palette hint through without competing with
 * foreground card chrome.
 */
export const ZONE_FILTER: Record<ZoneId, string> = {
  sylvani: 'brightness(0.85) saturate(1.05) contrast(1.02)',
  'emberpeak': 'brightness(0.8) saturate(1.1) contrast(1.02)',
  // gdd.1 Maren: cooler aqua bias via slightly lifted saturation.
  maren: 'brightness(0.82) saturate(1.15) contrast(1.02)',
  // gdd.2 Hollow Shrine: moonlit-haunt cool darks via slightly lowered
  // brightness + cool-bias saturation. Mirror tide-gauge tuning shape.
  'hollow-shrine': 'brightness(0.7) saturate(1.05) contrast(1.05)',
  // gdd.3 Dune Sanctum: sun-bleached desert warm tones via slightly
  // lifted brightness + warm-bias saturation. Mirror shadow-creep
  // tuning shape (inverse direction — sun-bleached not moonlit).
  'dune-sanctum': 'brightness(0.95) saturate(1.1) contrast(1.02)',
  'gilded-cage': 'brightness(0.82) saturate(1.05) contrast(1.02)',
};

/** Thin vignette-style overlay — zero tint in the middle so the raster
 *  reads crisply, a soft dark edge at top and bottom to keep card chrome
 *  legible without turning the whole scene into a color wash. */
export const ZONE_SCRIM: Record<ZoneId, string> = {
  sylvani:
    'linear-gradient(180deg, rgba(10, 28, 18, 0.32) 0%, rgba(0, 0, 0, 0) 25%, rgba(0, 0, 0, 0) 70%, rgba(10, 28, 18, 0.38) 100%)',
  'emberpeak':
    'linear-gradient(180deg, rgba(40, 10, 10, 0.32) 0%, rgba(0, 0, 0, 0) 25%, rgba(0, 0, 0, 0) 70%, rgba(40, 10, 10, 0.38) 100%)',
  // gdd.1 Maren: aqua-blue scrim — water-temple palette cue.
  maren: 'linear-gradient(180deg, rgba(8, 28, 40, 0.32) 0%, rgba(0, 0, 0, 0) 25%, rgba(0, 0, 0, 0) 70%, rgba(8, 28, 40, 0.38) 100%)',
  // gdd.2 Hollow Shrine: deep-violet moonlit scrim — moonlit-haunt
  // palette cue (no bloody reds, no full black).
  'hollow-shrine':
    'linear-gradient(180deg, rgba(20, 14, 36, 0.40) 0%, rgba(0, 0, 0, 0) 25%, rgba(0, 0, 0, 0) 70%, rgba(20, 14, 36, 0.46) 100%)',
  // gdd.3 Dune Sanctum: warm sandstone scrim — sun-bleached desert
  // palette cue (golden-tan, no harsh oranges).
  'dune-sanctum':
    'linear-gradient(180deg, rgba(56, 40, 14, 0.34) 0%, rgba(0, 0, 0, 0) 25%, rgba(0, 0, 0, 0) 70%, rgba(56, 40, 14, 0.40) 100%)',
  'gilded-cage':
    'linear-gradient(180deg, rgba(40, 28, 8, 0.3) 0%, rgba(0, 0, 0, 0) 25%, rgba(0, 0, 0, 0) 70%, rgba(40, 28, 8, 0.36) 100%)',
};
