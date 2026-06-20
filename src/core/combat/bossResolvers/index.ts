/**
 * Boss-attack resolver dispatch table (embertide-gdd.1.2).
 *
 * Wired resolvers:
 *   - `tidewraith-tentacle-grab` (gdd.1.2) — Maren region-boss.
 *   - `knell-drum` (embertide-x1qg) — Shadow region-boss.
 *   - `hextwins-fire-ice` (embertide-jghb) — Spirit region-boss.
 *   - `iron-sentinel-stagger` (embertide-2iyv) — Spirit wild-boss.
 *   - `hollow-effigy-mirror` (embertide-44w8) — Shadow wild-boss
 *     delayed-echo. Reads `combat.echoQueue` populated each
 *     `reducePlayerPlayCard` via `playPower`.
 *   - `phantom-vurmox-volley` (embertide-nlr8) — Colosseum tier-2
 *     sequence-archetype 2-step ball-volley.
 *   - `trinity-aurogax-heads` (embertide-nlr8) — Colosseum tier-5
 *     sequence-archetype 3-head rotation.
 *
 * Adding a resolver here is a one-line change; the engine's switch
 * in `reduceBossResolve` reads this map by id.
 */

import type { BossAttackResolverId } from '../../../types/combat';
import type { BossResolver } from './types';
import { tidewraithTentacleGrabResolver } from './tidewraith';
import { knellDrumResolver } from './knell';
import { hextwinsFireIceResolver } from './hextwins';
import { ironSentinelStaggerResolver } from './ironSentinel';
import { hollowEffigyMirrorResolver } from './hollowEffigy';
import { phantomVurmoxVolleyResolver } from './phantomVurmox';
import { trinityAurogaxHeadsResolver } from './trinityAurogax';

/**
 * Dispatch table — adding a new id to `BossAttackResolverId` without
 * registering its resolver here is a compile error (the `satisfies`
 * clause requires every union member to be present). Runtime engine
 * fallback in `reduceBossResolve` is exercised only when a spec sets
 * `bossAttackResolver` to `undefined` (i.e., legacy static-dpt path).
 */
export const BOSS_ATTACK_RESOLVERS = {
  'tidewraith-tentacle-grab': tidewraithTentacleGrabResolver,
  'knell-drum': knellDrumResolver,
  'hextwins-fire-ice': hextwinsFireIceResolver,
  'iron-sentinel-stagger': ironSentinelStaggerResolver,
  'hollow-effigy-mirror': hollowEffigyMirrorResolver,
  'phantom-vurmox-volley': phantomVurmoxVolleyResolver,
  'trinity-aurogax-heads': trinityAurogaxHeadsResolver,
} as const satisfies Record<BossAttackResolverId, BossResolver>;

export type { BossResolveOutcome, BossResolver } from './types';
export {
  TIDEWRAITH_TENTACLE_GRAB_BASE_DPT,
  TIDEWRAITH_TENTACLE_GRAB_MAX_DPT,
  TIDEWRAITH_TENTACLE_GRAB_HIGH_TIDE_THRESHOLD,
  tidewraithTentacleGrabDpt,
  TIDEWRAITH_LOG_TELEGRAPH_PREFIX,
  TIDEWRAITH_LOG_WILL_HIT,
  TIDEWRAITH_LOG_TENTACLES_DRAG,
} from './tidewraith';
export {
  IRON_SENTINEL_BURST_BONUS,
  IRON_SENTINEL_LOG_WINDUP,
  IRON_SENTINEL_LOG_HEAVY_SWING,
  IRON_SENTINEL_LOG_STAGGERED,
  IRON_SENTINEL_LOG_ARMOR_CRACKS,
} from './ironSentinel';
export {
  HOLLOW_EFFIGY_BASE_DPT,
  HOLLOW_EFFIGY_MAX_DPT,
  HOLLOW_EFFIGY_LOG_FINDS_NOTHING,
  HOLLOW_EFFIGY_LOG_MIRRORS_STRONGEST,
} from './hollowEffigy';
export {
  PHANTOM_VURMOX_VOLLEY_FIRE_BONUS,
  PHANTOM_VURMOX_LOG_CHARGE,
  PHANTOM_VURMOX_LOG_VOLLEY,
} from './phantomVurmox';
export { KNELL_LOG_TELEGRAPH, KNELL_LOG_SLAM } from './knell';
export { HEXTWINS_LOG_FIRE_HITS, HEXTWINS_LOG_ICE_FREEZES } from './hextwins';
export {
  TRINITY_AUROGAX_LOG_GLOOM,
  TRINITY_AUROGAX_LOG_UMBRA,
  TRINITY_AUROGAX_LOG_ANCIENT,
  TRINITY_AUROGAX_LOG_AUREN,
} from './trinityAurogax';
