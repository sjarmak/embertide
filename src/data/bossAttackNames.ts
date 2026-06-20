/**
 * Boss-specific named attack catalog (embertide-9lj6).
 *
 * Replaces the bare "Boss winds up for N" telegraph string with a
 * per-boss-per-cycle named attack so a 6yo player can read combat as
 * narrative ("Craghorn: Rock Throw!") rather than a stat readout.
 *
 * Two flavours:
 *
 *   1. STATIC-PATTERN bosses (no `bossAttackResolver`) rotate through a
 *      3-name catalog keyed off `combat.turnIndex % 3`. Names are pure
 *      flavour — damage stays driven by `pattern.damagePerTurn`.
 *
 *   2. DYNAMIC-RESOLVER bosses must surface names that match the
 *      RESOLVER's cycle, not turnIndex % 3. Each resolver gets a
 *      bespoke dispatch keyed off the same state slice the resolver
 *      reads (`turnIndex`, `tideGaugeSnapshot`, `echoQueue`). When the
 *      catalog and the resolver disagree about which beat the boss is
 *      on, the kid sees the wrong name — keep them aligned.
 *
 * Designer ruling 2026-04-25 (`bd recall
 * embertide-designer-ruling-9lj6-ynn4-2026-04-25`):
 *   - All proposed static names ship as drafted EXCEPT broodmaw's
 *     "Spawn Larva" → "Skitter Charge" (body-horror filter for 6yo).
 *   - Telegraph banner format = "<Attack> — winds up for N".
 *   - Intent indicator above the portrait stays number-only; only the
 *     telegraph banner consumes attack names.
 */

import type { CombatBoss } from '../types/combat';

/**
 * Cycle context the lookup needs for dynamic-resolver dispatch. All
 * fields optional so static-pattern callers (and pre-9lj6 fixtures) can
 * pass `{}` without churn.
 */
export interface AttackNameContext {
  readonly turnIndex?: number;
  readonly tideGaugeSnapshot?: number;
  readonly echoQueue?: { readonly power: number; readonly sourceCardId: string } | null;
}

/**
 * Static 3-name rotation. Names are flavour-only — damage stays driven
 * by `pattern.damagePerTurn`. Dispatched via `turnIndex % 3`.
 */
const STATIC_NAMES: Readonly<Record<string, readonly [string, string, string]>> = Object.freeze({
  craghorn: ['Rock Throw', 'Swipe', 'Stomp'],
  // broodmaw: 'Spawn Larva' replaced with 'Skitter Charge' per designer
  // ruling — "larva" reads body-horror to a 6yo.
  broodmaw: ['Eye Beam', 'Skitter Charge', 'Claw Slam'],
  'boulderkin': ['Boulder Hurl', 'Ground Pound', 'Spike Burst'],
  'ashen-tyrant': ['Fire Breath', 'Roll Crush', 'Tail Whip'],
  'maelstrom': ['Inkspurt', 'Tentacle Slap', 'Spin Vortex'],
  sentinel: ['Laser Beam', 'Stomp', 'Charge Beam'],
  'silver-chimera': ['Triple Shot', 'Sword Spin', 'Savage Charge'],
  'prism-chimera': ['Rainbow Beam', 'Sword Cyclone', 'Lightning Stomp'],
  'cagewright-vurmox': ['Trident Slash', 'Dark Beam', 'Thunder Smash'],
});

/**
 * Tide-gauge thresholds for tidewraith's named-attack dispatch. Mirrors the
 * combat engine's `tidewraith-tentacle-grab` resolver bands so the name and
 * the damage agree on which beat is firing.
 */
const TIDEWRAITH_LOW_TIDE_MAX = 1;
const TIDEWRAITH_MID_TIDE_MAX = 3;

function morphaName(ctx: AttackNameContext): string {
  const tide = ctx.tideGaugeSnapshot ?? 0;
  if (tide <= TIDEWRAITH_LOW_TIDE_MAX) return 'Tentacle Grab';
  if (tide <= TIDEWRAITH_MID_TIDE_MAX) return 'Water Whip';
  return 'Chain Drag';
}

/**
 * Hollow-effigy's mirror dispatch keys off `echoQueue`: when no echo is
 * queued the boss surfaces its base shadow attack; when a player play
 * is queued, the next mirror reflects it.
 */
function gloomLinkName(ctx: AttackNameContext): string {
  return ctx.echoQueue ? 'Mirror Strike' : 'Shadow Echo';
}

/**
 * Knell's drum cycle: even turn = telegraph (no damage), odd =
 * slam. Mirrors `knell-drum` resolver dispatch.
 */
function bongoBongoName(ctx: AttackNameContext): string {
  const turn = ctx.turnIndex ?? 0;
  return turn % 2 === 0 ? 'Drum Telegraph' : 'Drum Slam';
}

/**
 * Hextwins's 3-turn fire/ice/fire cycle. Indexes 0 and 2 are fire (full
 * damage); index 1 is ice (0 damage + hand-discard side effect).
 */
function twinrovaName(ctx: AttackNameContext): string {
  const turn = ctx.turnIndex ?? 0;
  return turn % 3 === 1 ? 'Ice Freeze' : 'Fire Blast';
}

/**
 * Iron-sentinel's 3-turn wind-up / heavy-swing / stagger cycle. Mirrors
 * `iron-sentinel-stagger` resolver dispatch.
 */
function ironKnuckleName(ctx: AttackNameContext): string {
  const turn = ctx.turnIndex ?? 0;
  switch (turn % 3) {
    case 0:
      return 'Wind-up';
    case 1:
      return 'Heavy Swing';
    default:
      return 'Stagger';
  }
}

const DYNAMIC_NAMES: Readonly<Record<string, (ctx: AttackNameContext) => string>> = Object.freeze({
  tidewraith: morphaName,
  'hollow-effigy': gloomLinkName,
  'knell': bongoBongoName,
  hextwins: twinrovaName,
  'iron-sentinel': ironKnuckleName,
});

/**
 * Resolve the named attack for a boss given the current combat cycle
 * context. Falls back to the literal string `'Attack'` when the boss
 * id has no entry in either table — defensive guard so a brand-new
 * boss card without a name catalog still renders something legible
 * rather than crashing the combat surface.
 */
export function attackNameFor(boss: CombatBoss, ctx: AttackNameContext = {}): string {
  const id = boss.sourceCardId;
  const dynamic = DYNAMIC_NAMES[id];
  if (dynamic !== undefined) {
    return dynamic(ctx);
  }
  const staticNames = STATIC_NAMES[id];
  if (staticNames !== undefined) {
    const turn = ctx.turnIndex ?? 0;
    return staticNames[turn % 3];
  }
  return 'Attack';
}

/**
 * Re-exports for tests + tooling that want to enumerate the catalogue
 * without going through the dispatch function.
 */
export const BOSS_ATTACK_NAMES = {
  static: STATIC_NAMES,
  dynamic: DYNAMIC_NAMES,
} as const;
