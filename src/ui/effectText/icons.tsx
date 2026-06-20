import type { ReactNode } from 'react';
import { CourageShard, GreenShard, Heart, Key, PowerShard, Sword, WisdomShard } from '../../icons';

/**
 * Inline effect-text icon size (px). Chosen to sit flush with the 10-13px
 * Cinzel rules-text without inflating line-height. See bead
 * embertide-9jg.
 */
export const EFFECT_ICON_PX = 12;

// Each icon renders at EFFECT_ICON_PX and carries a default `aria-label`
// matching its kind (see src/icons/index.tsx). We intentionally do NOT pass
// a `title` prop: the resulting <title> element is part of the SVG's
// `textContent` and would leak 'green-shard' / 'sword' / 'key' / 'heart'
// into the card rules-text. The aria-label alone is sufficient for
// assistive tech, and the card-level aria-label (spelled-out
// 'plus 2 green') still carries the full accessible summary at the tile
// boundary.
export type UnitKey = 'g' | 'power' | 'key' | '\u2665' | 'heart' | 'green';

export const ICON_BY_UNIT: Record<UnitKey, ReactNode> = {
  g: <GreenShard size={EFFECT_ICON_PX} />,
  green: <GreenShard size={EFFECT_ICON_PX} />,
  power: <Sword size={EFFECT_ICON_PX} />,
  key: <Key size={EFFECT_ICON_PX} />,
  '\u2665': <Heart size={EFFECT_ICON_PX} />,
  heart: <Heart size={EFFECT_ICON_PX} />,
};

/**
 * Embertide-shard icon map (REQ-13 Phase 2d / gm0.4). Keyed on the
 * lowercased shard label so the regex can normalize before lookup.
 * Mirrors `ICON_BY_UNIT`'s shape so downstream consumers can switch
 * between resource and shard tokens with the same indexing pattern.
 */
export type ShardKey = 'wisdom' | 'courage' | 'power';

export const SHARD_ICON_BY_KEY: Record<ShardKey, ReactNode> = {
  wisdom: <WisdomShard size={EFFECT_ICON_PX} />,
  courage: <CourageShard size={EFFECT_ICON_PX} />,
  power: <PowerShard size={EFFECT_ICON_PX} />,
};

export function isUnitKey(value: string): value is UnitKey {
  return value in ICON_BY_UNIT;
}

export function isShardKey(value: string): value is ShardKey {
  return value in SHARD_ICON_BY_KEY;
}
