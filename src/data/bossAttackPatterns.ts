/**
 * Boss attack patterns (PRD §B3, work unit u-8e).
 *
 * Pure data + a lookup function. One `BossAttackPattern` entry per v2.0
 * boss card id (the seven bosses defined in `src/data/cards.ts`). The
 * u-8b combat reducer consumes these via `attackPatternFor(bossCardId)`
 * when building a `CombatBoss` for `COMBAT_ENTER`.
 *
 * Tuning is a first-pass — u-8h balance simulation will validate. The
 * invariants asserted by the colocated test suite (and enforced here by
 * construction) are:
 *
 *   (1) every pattern has `damagePerTurn > 0`;
 *   (2) Silver Chimera's `damagePerTurn` is STRICTLY GREATER than the
 *       Sentinel's — Chimera is the hard-gate before Vurmox (per A5);
 *   (3) Vurmox's `onDefeatEffect` grants BOTH `power` AND `courage`
 *       shards coincident (v2.1 / REQ-31 amendment; cards.ts L630-639
 *       documents the same coincident flip on the main-board side).
 *
 * Region-boss shard mapping (canonical storyline — see `cards.ts`):
 *
 *   - Sylvani       → Broodmaw         → courage
 *   - Death Mtn    → Ashen Tyrant  → wisdom
 *   - Temple of T. → Cagewright Vurmox → power + courage (v2.1 coincident)
 *
 * Wild bosses (craghorn, boulderkin, sentinel, silver-chimera) default to
 * `wisp-drop` per amendment A6 — no shard grant from wild bosses.
 */

import type { BossAttackPattern, CombatOnDefeatEffect } from '../types/combat';

// ---------------------------------------------------------------------------
// On-defeat effect constants (factored out for readability).
// ---------------------------------------------------------------------------

const WISP_DROP: CombatOnDefeatEffect = { kind: 'wisp-drop' };

const COURAGE_GRANT: CombatOnDefeatEffect = {
  kind: 'shard-grant',
  shards: ['courage'],
};

// Vurmox grants BOTH power and courage coincident (v2.1 REQ-31 amendment).
const POWER_AND_COURAGE_GRANT: CombatOnDefeatEffect = {
  kind: 'shard-grant',
  shards: ['power', 'courage'],
};

// ---------------------------------------------------------------------------
// Per-boss patterns.
// ---------------------------------------------------------------------------

// Sylvanwood wild boss. Baseline wild-boss pressure — 2 dpt through
// the battlefield absorbs heroes first, spillage reaches player HP.
// u-9f: dpt held at 2 (entry-zone gentleness); HP raised via BOSS_HP.
const CRAGHORN_PATTERN: BossAttackPattern = {
  damagePerTurn: 2,
  targeting: 'battlefield-then-player',
  onDefeatEffect: WISP_DROP,
};

// Sylvanwood region boss.
// 2026-04-23: Courage shard moved off Broodmaw per user feedback — Courage
// now drops from the last wild boss (Silver Chimera) instead. Broodmaw defeat
// still advances the zone via the shared boss-win hook + grants combat
// hearts; the shard routing simply no longer includes Courage here.
const BROODMAW_PATTERN: BossAttackPattern = {
  damagePerTurn: 3,
  targeting: 'battlefield-then-player',
  onDefeatEffect: { kind: 'none' },
};

// Emberpeak wild boss. Mid-tier wild pressure.
const BOULDERKIN_PATTERN: BossAttackPattern = {
  damagePerTurn: 3,
  targeting: 'battlefield-then-player',
  onDefeatEffect: WISP_DROP,
};

// Emberpeak region boss.
// 2026-04-23: Wisdom shard moved off Ashen Tyrant per user feedback —
// Wisdom now comes only from freeing Princess Aurelia (crystal break).
// Ashen Tyrant defeat still advances the zone via the shared boss-win
// hook; the shard routing simply no longer includes Wisdom here.
// u-9f: dpt held at 3 so win rate against 0-heirloom decks
// stays viable for all engaging strategies — old dpt=4 killed map-rush
// and mixed players before they could land enough damage.
const ASHEN_TYRANT_PATTERN: BossAttackPattern = {
  damagePerTurn: 3,
  targeting: 'battlefield-then-player',
  onDefeatEffect: { kind: 'none' },
};

// Gilded Cage wild boss (lower-tier). Matches Boulderkin in
// pressure; Chimera is the harder sibling in the same zone.
const SENTINEL_PATTERN: BossAttackPattern = {
  damagePerTurn: 3,
  targeting: 'battlefield-then-player',
  onDefeatEffect: WISP_DROP,
};

// gdd.1: Tidehold wild boss. Maelstrom's "inkspurt + tentacle-slap"
// pattern is z5e tuning-pass scope; substrate ships with vanilla
// `battlefield-then-player` at dpt 2 (entry-tier wild pressure, matches
// craghorn). Tide-gauge-reactive damage scaling is deferred — the
// dynamic-pattern resolver lands in z5e alongside tidewraith's
// tentacle-grab strength scaling.
const MAELSTROM_PATTERN: BossAttackPattern = {
  damagePerTurn: 2,
  targeting: 'battlefield-then-player',
  onDefeatEffect: WISP_DROP,
};

// gdd.1.2: Tidehold region boss. Tidewraith's tentacle-grab dynamic
// resolver scales damage with `state.tideGauge` (snapshotted at
// COMBAT_ENTER into `combat.tideGaugeSnapshot`). Resolver
// `tidewraith-tentacle-grab` (in src/core/combatEngine.ts) computes:
//   dpt = clamp(2, 2 + Math.floor(tideGauge / 2), 5)
// and applies a chain-discard side effect at the high-tide threshold
// (tideGauge >= 4). Targeting stays `battlefield-then-player` so
// battlefield absorbs still matter.
//
// `damagePerTurn: 3` is the static FALLBACK consumed only when the
// engine's resolver dispatch is bypassed (legacy code paths / tests
// that don't snapshot tideGauge). On the live boss-turn the resolver
// always supersedes this number. Held at 3 to match the substrate-ship
// baseline so combat-length sims stay anchored at the same midpoint.
//
// On-defeat: zone advance fires through `advanceZone` in
// `src/store/slices/zones.ts` (tidewraith is `regionBossId` for the 'maren'
// zone); no shard grant — Courage still flips on full-map completion
// via `checkCourageUnlock`.
const TIDEWRAITH_PATTERN: BossAttackPattern = {
  damagePerTurn: 3,
  targeting: 'battlefield-then-player',
  onDefeatEffect: { kind: 'none' },
  bossAttackResolver: 'tidewraith-tentacle-grab',
};

// gdd.2 + embertide-44w8: Hollow Shrine wild boss. Hollow-effigy's
// delayed mirror-echo dynamic resolver — wired via the
// `hollow-effigy-mirror` resolver. Spec at
// `docs/design/hollow-effigy-attack-pattern.md`. Each players-turn,
// `reducePlayerPlayCard` accumulates the highest single-play power
// into `combat.echoQueue`. On the next boss-turn, the resolver reads
// echoQueue and computes:
//   - echoQueue null OR power < HOLLOW_EFFIGY_BASE_DPT: damage =
//     pattern.damagePerTurn (the static fallback, including any
//     shadow-creep flat-adder baked in at combat-entry).
//   - echoQueue power >= HOLLOW_EFFIGY_BASE_DPT: damage =
//     max(staticDpt, min(power, HOLLOW_EFFIGY_MAX_DPT)). The static
//     floor preserves the zone bump; the MAX_DPT clamp (4) caps the
//     worst-case mirror at 4 dmg (REQ-16 soft-clock — keeps a 5hp
//     kid alive through one mirror blast).
// After firing, the resolver clears echoQueue via combatPatch so the
// next players-turn starts fresh.
//
// Targeting stays 'player-hp' — mirror skips battlefield defenses by
// design (the echo "is" your play coming back at you, not a swing
// the front-line can absorb).
const HOLLOW_EFFIGY_PATTERN: BossAttackPattern = {
  damagePerTurn: 2,
  targeting: 'player-hp',
  onDefeatEffect: WISP_DROP,
  bossAttackResolver: 'hollow-effigy-mirror',
};

// gdd.2 + embertide-x1qg: Hollow Shrine region boss. Knell's
// drum-telegraph + double-slam dynamic dpt — wired via the
// `knell-drum` resolver (`reduceBossResolve` in
// `src/core/combatEngine.ts`). 2-turn cycle keyed off
// `combat.turnIndex % 2`:
//   - turnIndex even (telegraph): 0 damage; combat-log forecasts the
//     incoming slam ("Knell: drum-slam coming for N next turn!")
//     where N reflects the at-entry pattern dpt (already includes the
//     shadow-creep flat-adder).
//   - turnIndex odd (slam): full pattern.damagePerTurn lands.
// `damagePerTurn: 3` is the live BASE consumed verbatim by the
// resolver on slam turns. Inside 'hollow-shrine' the substrate's
// `enterCombatAction` clone path bumps this by `state.shadowCreep`
// (snapshot at combat-entry), so a resolver firing at shadowCreep=2
// reads pattern.damagePerTurn=5 on slam turns. The resolver does
// NOT mutate `damagePerTurn`; it just routes the value through
// the cycle.
//
// Targeting flipped to 'player-hp' (was 'battlefield-then-player' at
// substrate ship) per the bead-spec rationale: knell's slam
// "skips battlefield defenses" — the drum is concussive and bypasses
// front-line absorbs. Telegraph turns deal 0 damage so targeting is
// inert in that branch; the flip only affects the slam.
//
// On-defeat: zone advance fires through `advanceZone` (knell
// is `regionBossId` for 'hollow-shrine', advances → 'gilded-cage');
// no shard grant — Courage flips on full-map completion via
// `checkCourageUnlock`.
const KNELL_PATTERN: BossAttackPattern = {
  damagePerTurn: 3,
  targeting: 'player-hp',
  onDefeatEffect: { kind: 'none' },
  bossAttackResolver: 'knell-drum',
};

// gdd.3 + embertide-2iyv: Dune Sanctum wild boss. Iron-sentinel's
// stagger dynamic resolver — wired via the `iron-sentinel-stagger`
// resolver. 3-turn cycle keyed off `combat.turnIndex % 3`:
//   - turnIndex % 3 === 0 (wind-up): pattern dpt + forecast log
//     ("Iron-sentinel winds up — heavy swing next turn!")
//   - turnIndex % 3 === 1 (heavy-swing burst): pattern dpt + 1
//     ("Iron-sentinel's heavy swing connects!"). The +1 burst is the
//     telegraphed big-hit beat.
//   - turnIndex % 3 === 2 (stagger): 0 damage, armor-cracks log
//     ("Iron-sentinel is staggered — armor cracks!"). The stagger
//     window is the 6yo's reward beat after surviving the burst.
// `damagePerTurn: 2` is the live BASE consumed by the resolver on
// wind-up turns; +1 on heavy-swing; 0 on stagger. Inside
// 'dune-sanctum' the substrate's `enterCombatAction` clone path
// bumps this by `state.sandstormCounter` so the cycle scales with
// zone pressure. Targeting stays 'player-hp' (heavy-swing bypasses
// battlefield front-line absorbs by design — the swing is overhead).
const IRON_SENTINEL_PATTERN: BossAttackPattern = {
  damagePerTurn: 2,
  targeting: 'player-hp',
  onDefeatEffect: WISP_DROP,
  bossAttackResolver: 'iron-sentinel-stagger',
};

// gdd.3 + embertide-jghb: Dune Sanctum region boss. Hextwins's
// fire/ice 3-turn cycle — wired via the `hextwins-fire-ice` resolver.
// 3-turn cycle keyed off `combat.turnIndex % 3`:
//   - turnIndex % 3 === 0 (fire): full pattern.damagePerTurn lands;
//     log "Hextwins: fire blast!"
//   - turnIndex % 3 === 1 (ice): 0 damage; side-effect discards 1
//     hand-card from each non-downed attacker's main-board hand;
//     log "Hextwins: ice freezes a card!"
//   - turnIndex % 3 === 2 (fire): full pattern.damagePerTurn lands;
//     log "Hextwins: fire blast!"
// `damagePerTurn: 2` is the live BASE on fire turns. Inside
// 'dune-sanctum' the substrate's `enterCombatAction` clone path
// bumps this by `state.sandstormCounter` (snapshot at combat-entry),
// so the fire blast naturally escalates with zone pressure. Ice's
// hand-discard fires regardless of sandstorm — the 6yo learns
// "ice freezes my plans" without an additional knob.
//
// Targeting stays 'battlefield-then-player' (fire blast routes
// through front-line absorbs first; only the residual reaches
// player-hp). Ice's 0-damage payload makes targeting inert that
// branch; the only behavioral lever in ice is the side-effect.
//
// On-defeat: zone advance fires through `advanceZone` (hextwins is
// `regionBossId` for 'dune-sanctum', advances → 'gilded-cage');
// no shard grant — Courage flips on full-map completion via
// `checkCourageUnlock`.
const HEXTWINS_PATTERN: BossAttackPattern = {
  damagePerTurn: 2,
  targeting: 'battlefield-then-player',
  onDefeatEffect: { kind: 'none' },
  bossAttackResolver: 'hextwins-fire-ice',
};

// Gilded Cage wild boss (HARD GATE before Vurmox per A5). dpt
// strictly greater than Sentinel's — invariant (2) above.
// u-9f: dpt lowered from 5 → 4 so wild-boss band sits at median 4-6
// rather than the old 3-4. Still > Sentinel's 3 dpt.
// 2026-04-23: Silver Chimera is now the Courage-shard source (was Broodmaw).
// Wisp drop is tier-driven — wild-boss wisp routing in combat.ts's
// `grantWildBossFairy` runs regardless of this onDefeatEffect value, so
// swapping the marker from WISP_DROP to COURAGE_GRANT does not remove
// the wisp; it only adds the shard grant.
const SILVER_CHIMERA_PATTERN: BossAttackPattern = {
  damagePerTurn: 4,
  targeting: 'battlefield-then-player',
  onDefeatEffect: COURAGE_GRANT,
};

// embertide-044 (2026-04-24): rare post-completion wild boss
// (Prism Chimera). Dynamic-spawn encounter rolled once at
// Silver Chimera's defeat via `computeGoldenRainbowLynelSpawnChance` in
// src/rules/zones.ts — outside the u-9f balance band by design.
// Stats scaled ~1.5× Silver Chimera dpt (4 → 6) and ~2× HP (12 → 24).
// Same `battlefield-then-player` targeting for consistency with other
// wild bosses so battlefield cards and absorbs still matter. Wisp
// drop on defeat (same as every other wild boss). Heirloom drop
// (rainbow-ancient-chimera-sword) is routed separately via
// HEIRLOOM_DROPS in src/data/cards.ts.
const PRISM_CHIMERA_PATTERN: BossAttackPattern = {
  damagePerTurn: 6,
  targeting: 'battlefield-then-player',
  onDefeatEffect: WISP_DROP,
};

// Cagewright Vurmox — v2.0 final region boss. `battlefield-then-player`
// targeting so boulderkin-core absorb can eat incoming damage before
// it spills to player hp (heirloom prep pays off). On-defeat grants
// BOTH power AND courage shards (v2.1 coincident — invariant (3) above).
//
// Tuning history:
//   - u-8h  : dpt=6 aoe hp=12. Wiped sim players in ~3 turns → fights
//             never hit median-turn [7, 10] band.
//   - u-9f  : dpt=1 aoe hp=18. Stretched median turn-count into the
//             band, but left Vurmox trivial (~99.6% 0-heirloom win rate)
//             — violates REQ-32 "difficulty IS the gate" intent.
//   - 0wc   : dpt=3 battlefield-then-player hp=20. Challenging-but-
//             winnable curve holds (PRD Q4/Q7 endgame gate):
//               0 heirlooms → ~15-20% (speedrun penance)
//               2 heirlooms →  ~55-65% (prep pays off)
//               4 heirlooms →  ~75-85% (completion rewarded)
//             Median turn-count stays in [7, 10] for 0-heirloom sim.
//             `battlefield-then-player` (not 'aoe') lets boulderkin-core
//             absorb meaningfully contribute to the heirloom curve.
const CAGEWRIGHT_VURMOX_PATTERN: BossAttackPattern = {
  damagePerTurn: 3,
  targeting: 'battlefield-then-player',
  onDefeatEffect: POWER_AND_COURAGE_GRANT,
};

// ---------------------------------------------------------------------------
// Lookup map + public API.
// ---------------------------------------------------------------------------

/**
 * Keyed by the `Card.id` string for the authoring card in
 * `src/data/cards.ts`. Exported for test transparency; the primary
 * consumer-facing API is `attackPatternFor`.
 */
export const BOSS_ATTACK_PATTERNS: Readonly<Record<string, BossAttackPattern>> = Object.freeze({
  craghorn: CRAGHORN_PATTERN,
  broodmaw: BROODMAW_PATTERN,
  'boulderkin': BOULDERKIN_PATTERN,
  'ashen-tyrant': ASHEN_TYRANT_PATTERN,
  'maelstrom': MAELSTROM_PATTERN,
  tidewraith: TIDEWRAITH_PATTERN,
  'hollow-effigy': HOLLOW_EFFIGY_PATTERN,
  'knell': KNELL_PATTERN,
  'iron-sentinel': IRON_SENTINEL_PATTERN,
  hextwins: HEXTWINS_PATTERN,
  sentinel: SENTINEL_PATTERN,
  'silver-chimera': SILVER_CHIMERA_PATTERN,
  'prism-chimera': PRISM_CHIMERA_PATTERN,
  'cagewright-vurmox': CAGEWRIGHT_VURMOX_PATTERN,
});

/**
 * Resolve the attack pattern for a given boss card id.
 *
 * Throws on unknown id — the caller (u-8b `COMBAT_ENTER` reducer) only
 * dispatches combat entry on cards with `bossTier === 'wild-boss' |
 * 'region-boss'`, so a miss here signals a data-integrity bug (new
 * boss card shipped without a matching pattern). Fail fast rather than
 * silently dropping combat with an undefined pattern.
 */
export function attackPatternFor(bossCardId: string): BossAttackPattern {
  const pattern = BOSS_ATTACK_PATTERNS[bossCardId];
  if (pattern === undefined) {
    throw new Error(
      `attackPatternFor: no BossAttackPattern defined for bossCardId="${bossCardId}". ` +
        `Add an entry to BOSS_ATTACK_PATTERNS in src/data/bossAttackPatterns.ts.`,
    );
  }
  return pattern;
}

// ---------------------------------------------------------------------------
// Per-boss combat HP (u-9f, PRD §C8).
//
// Authoritative per-boss HP table. Consumed by:
//   - `src/store/gameStore.ts::defaultCombatHpFor` (main-game COMBAT_ENTER)
//   - `src/balance/combatLengthSim.ts::buildBoss` (balance sim)
//
// Tuning rationale (u-9f balance pass — final values):
//
//   - Wild bosses (craghorn 10, boulderkin 10, sentinel 10, silver-chimera 12):
//     Raised from the u-8h flat 8 so median combat-length lands in
//     [4, 6] rather than the old [3, 4]. Silver Chimera HP > Sentinel HP
//     (and silver-chimera dpt > sentinel dpt by the invariant in the
//     pattern block above) reflects the hard-gate-before-Vurmox stance.
//
//   - Region bosses (broodmaw 18, ashen-tyrant 19): Raised from the u-8h
//     flat 12 so the 0-heirloom combat deck lands ~35% win rate (design
//     target: 30-40%) and median turns falls in [5, 8]. The heirloom
//     uplift from 2 heirlooms pulls win rate into ~70%, matching the
//     PRD §C8 curve.
//
//   - Vurmox (20, 0wc retune): Raised from 12 so the climax fight lands
//     at median ~8 turns (inside the [7, 10] band). Paired with dpt=3
//     battlefield-then-player (0wc — was dpt=1 aoe under u-9f) so the
//     fight is both long-form AND an actual gate: 0-heirloom wins
//     ~15-20% of the time (speedrun penance), 2-heirloom ~55-65% (prep
//     pays off), 4-heirloom ~75-85% (completion rewarded but not
//     auto-won). u-9f's dpt=1 left Vurmox trivial (~99.6% 0-heirloom).
// ---------------------------------------------------------------------------

/**
 * Per-boss combat HP pool. Keyed by Card.id — one entry per v2.0 boss.
 */
export const BOSS_HP: Readonly<Record<string, number>> = Object.freeze({
  craghorn: 10,
  broodmaw: 18,
  'boulderkin': 10,
  'ashen-tyrant': 19,
  // gdd.1: Maren wild + region. maelstrom HP 10 matches the entry-tier
  // wild band (craghorn / boulderkin / sentinel). tidewraith HP 16 sits
  // BETWEEN ashen-tyrant's 19 and broodmaw's 18 on the region curve —
  // intentionally a touch lower while the tide-gauge dynamic-damage
  // pattern is still substrate-only, so single-boss runs stay
  // completable in the [5, 8] median-turn band.
  'maelstrom': 10,
  tidewraith: 16,
  // gdd.2: Hollow Shrine wild + region. hollow-effigy HP 8 — z5e tuning
  // pass (2026-05-28) raised from substrate-ship 6 after the
  // combatLengthSim showed median combat-length of 2 boss-turns,
  // below the gdd.2.4 spec's [3, 5] target band. HP 8 lands the
  // sim median at 3 (inside the design band) while still keeping
  // the mirror-fight leaner than the v2.0 wild band (craghorn /
  // boulderkin / sentinel at HP 10). knell HP 17 sits between
  // tidewraith's 16 and broodmaw's 18 on the region curve — Shadow's
  // pressure comes from the shadow-creep adder (consumer at
  // enterCombatAction), so the raw HP stays inside the [16, 19]
  // mid-region band.
  'hollow-effigy': 8,
  'knell': 17,
  // gdd.3: Dune Sanctum wild + region. iron-sentinel HP 8 — z5e tuning
  // pass (2026-05-28) raised from substrate-ship 6 (same reason as
  // hollow-effigy: sim showed median 2, below the [3, 5] design band;
  // HP 8 brings sim median to 3 inside the band). Still leaner than
  // the v2.0 wild band. hextwins HP 10 is sized small for the
  // substrate vanilla pattern + sandstorm-counter flat-adder.
  // Spirit's pressure comes from the sandstorm adder (consumer at
  // enterCombatAction); raw HP stays intentionally below the
  // tidewraith/knell region band so the fire/ice cycle resolver
  // (gdd.3.2 follow-up) has room to scale up.
  'iron-sentinel': 8,
  hextwins: 10,
  sentinel: 10,
  'silver-chimera': 12,
  // embertide-044 (2026-04-24): rare post-completion wild boss
  // (Prism Chimera) — 2× Silver Chimera HP. Outside the u-9f
  // balance band by design (dynamic-spawn encounter rolled at Silver
  // Chimera's defeat).
  'prism-chimera': 24,
  'cagewright-vurmox': 20,
});

/**
 * Resolve the combat HP for a given boss card id. Returns `null` for
 * unknown ids so non-boss callers can fall back to their own defaults
 * (`defaultCombatHpFor` still handles regular monsters via the
 * `card.power` defensive read + tier-based tier fallback).
 */
export function bossHpFor(bossCardId: string): number | null {
  const hp = BOSS_HP[bossCardId];
  return typeof hp === 'number' ? hp : null;
}
