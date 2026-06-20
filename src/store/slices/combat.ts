import type { Card } from '../../types/card';
import type { MonsterDropEffect } from '../../types/effectSpec';
import { isMonsterDropEffect } from '../../types/effectSpec';
import {
  GRUNT_HEART_METER_IDS,
  HEIRLOOM_DROPS,
  KID_CARDS,
  TOUGH_EMBER_SHARD_IDS,
  baseIdOf,
} from '../../data/cards';
import type { KidGameState, KidPlayer } from '../types';
import { applyReward } from './chests';
import { openChest as sampleChestReward } from '../../rules/chestPool';
import { decrementCrystalCharges } from './crystal';
import { drawCards } from './deck';
import { applyItemPassivesForTrigger } from './endgame';
import { equipAsItem } from './inventory';
import { advanceZone, recordBossDefeat } from './zones';
import { ZONE_METADATA } from '../../rules/zones';
import { replacePlayer } from '../_shared';

/**
 * Ids that, once defeated, return to their Always-Available stack rather
 * than being banished to the Void (§5.4 / embertide-9yu). Listed as
 * canonical `baseId`s so duplicate-suffix copies (e.g. `wild-wolf-3-...`)
 * resolve correctly via `baseIdOf`.
 */
const ALWAYS_AVAILABLE_MONSTER_BASE_IDS: ReadonlySet<string> = new Set(['wild-wolf']);

/**
 * Resolve a card's monster-drop payload, or `undefined` when the card
 * does not ship a valid `monster-drop` effect. Call sites fall back to
 * zero-heal / zero-key defaults via `drop?.hearts ?? 0`.
 *
 * Narrows via `isMonsterDropEffect` (embertide-5pj / same defect
 * class as embertide-bv5). The previous implementation cast
 * `card.effects` to a locally-declared `{ kind: string; hearts?; keys? }`
 * shape — that cast silently accepted primitives, arrays, null, and
 * wrong-shape objects, then `.hearts` evaluated to `undefined`.
 */
function extractDrop(card: Card): MonsterDropEffect | undefined {
  return isMonsterDropEffect(card.effects) ? card.effects : undefined;
}

/**
 * Defeat-drop variety extension (embertide-r94e) — apply the optional
 * `gems` / `cardDraw` fields of a `monster-drop` payload onto the
 * defeating player. Hearts + keys are still applied inline at the call
 * site (they sit alongside other player-resource bookkeeping like
 * red-cost deduction and champion-passive bonuses); this helper covers
 * the new shape so both `fightMonster` and `defeatAlwaysAvailableMonster`
 * route through one place.
 *
 * Pure / immutable: returns a new `KidPlayer`. `cardDraw` consumes the
 * shared seeded RNG — empty-deck reshuffle is delegated to `drawCards`,
 * matching the equip-bonus card-draw path.
 *
 * Wild Wolf (always-available) once-per-turn farm cap is enforced at the
 * call site by passing `applyDrop=false` on subsequent kills, mirroring
 * how the existing heal-from-drop is gated.
 */
function applyMonsterDropExtras(
  player: KidPlayer,
  drop: MonsterDropEffect | undefined,
  rng: () => number,
): KidPlayer {
  if (!drop) return player;
  let next = player;
  const gems = drop.gems ?? 0;
  if (gems > 0) {
    next = { ...next, green: next.green + gems };
  }
  const cardDraw = drop.cardDraw ?? 0;
  if (cardDraw > 0) {
    const drawn = drawCards(
      { deck: next.deck, hand: next.hand, discard: next.discard },
      cardDraw,
      rng,
    );
    next = { ...next, deck: drawn.deck, hand: drawn.hand, discard: drawn.discard };
  }
  return next;
}

/**
 * Open an attached-chest bonus (v2.1 REQ-21 / gm0.6) for the player at
 * `playerIdx`. Triggered when a defeated monster carries
 * `hasAttachedChest: true`. Bypasses the usual key gate — the chest is
 * the kill bonus, not a separately-paid action — and routes the loot
 * sample explicitly through the `chest-std` weight table (NOT
 * `chest-boss`) per the L1-mitigated acceptance.
 *
 * Bumps `chestsOpened` and writes `lastChestReward` so the existing
 * ChestReveal animation surfaces the bonus exactly like a normal
 * chest open. Pure / immutable: returns a new state with new player +
 * top-level fields.
 */
function applyAttachedChestBonus(state: KidGameState, playerIdx: number): KidGameState {
  const player = state.players[playerIdx];
  if (!player) return state;

  const { reward } = sampleChestReward('std', state.rng);
  const withBookkeeping: KidPlayer = {
    ...player,
    chestsOpened: player.chestsOpened + 1,
  };
  const { player: rewarded, card } = applyReward(withBookkeeping, reward, state.rng);
  return {
    ...replacePlayer(state, playerIdx, rewarded),
    lastChestReward: reward,
    lastChestRewardCard: card,
  };
}

/**
 * Monotonic counter for minting unique wisp-copy ids on wild-boss
 * defeat (u-6a / u-6b / u-6c amendment A6). Each wild-boss kill
 * increments once so every minted wisp has a unique id of the form
 * `wisp-wild-boss-<baseBossId>-<counter>`. Seed is irrelevant — these
 * ids are not serialized across games.
 */
let wildBossWispMintCounter = 0;

/**
 * Mint a fresh wisp card from the KID_CARDS wisp template
 * (amendment A6 wild-boss drop). Each call returns a NEW Card with a
 * unique id so duplicate drops in the same game don't collide.
 * `baseId: 'wisp'` is load-bearing: `playWispOn` in gameStore.ts,
 * the ItemCell "is wisp" dispatch, and the victory-check wisp
 * detection all resolve minted copies back to the canonical 'wisp'
 * template via `baseIdOf`. This mirrors the mint-with-baseId pattern
 * used by `mintAlwaysAvailable` in src/data/cards.ts.
 *
 * Throws if the wisp template is missing from KID_CARDS — that would
 * indicate data-layer corruption upstream (wisp is declared by u-1d /
 * u-2d and is required by u-6a/b/c wild-boss drops).
 */
export function mintFreshWisp(baseBossId: string): Card {
  const template = KID_CARDS.find((c) => c.id === 'wisp');
  if (!template) {
    throw new Error('No wisp card in KID_CARDS — cannot mint wild-boss wisp drop');
  }
  wildBossWispMintCounter += 1;
  const minted: Card & { readonly baseId: string } = {
    ...template,
    id: `wisp-wild-boss-${baseBossId}-${wildBossWispMintCounter}`,
    baseId: 'wisp',
  };
  return minted;
}

/**
 * Grant a fresh wisp on wild-boss defeat (u-6a/u-6b amendment A6).
 * The wisp always lands in the defeater's items zone — items are
 * unbounded per embertide-nmmc, so the legacy cap-overflow
 * routing through teammate / silent-drop is gone.
 *
 * Pure at the state boundary — returns a new KidGameState. The mint
 * counter side effect is module-scoped and is not part of game state.
 */
export function grantWildBossWisp(
  state: KidGameState,
  defeaterIdx: number,
  defeatedBaseId: string,
): KidGameState {
  const defeater = state.players[defeaterIdx];
  if (!defeater) return state;

  const wisp = mintFreshWisp(defeatedBaseId);
  const outcome = equipAsItem(defeater, wisp);
  return replacePlayer(state, defeaterIdx, outcome.owner);
}

/**
 * Monotonic counter for minting unique heirloom-copy ids on wild-boss
 * defeat via the slot-engagement path (u-9c / REQ-32). Mirrors
 * `wildBossWispMintCounter` above — keeps each heirloom drop's id
 * unique so a game with two Craghorn variants wouldn't collide copies in
 * `buildCombatDeck`. Not part of game state; session-scoped only.
 */
let heirloomMintCounter = 0;

/**
 * Mint a fresh heirloom Card from the KID_CARDS template identified by
 * `heirloomCardId` (one of the four v2.0 heirlooms declared by u-9b:
 * craghorn-tusk, boulderkin-core, sentinel-eye, chimera-sword). Each
 * call returns a NEW card with a unique numeric-suffix id so repeat
 * drops from the same boss (future v2.1+) don't collide.
 *
 * `baseId: <heirloomCardId>` is load-bearing: `combatEffectFor` in
 * combatEffects.ts keys the effect lookup on `baseIdOf(card.id)`, and
 * `buildCombatDeck`'s item-active eligibility reads the role + itemKind
 * which are copied from the template by spread. Mirrors the mint
 * pattern used by `mintFreshWisp` above.
 *
 * Throws if the template is missing from KID_CARDS — that would
 * indicate data-layer corruption upstream (u-9b authors all four
 * heirlooms in src/data/cards.ts).
 */
function mintFreshHeirloom(heirloomCardId: string): Card {
  const template = KID_CARDS.find((c) => c.id === heirloomCardId);
  if (!template) {
    throw new Error(
      `No heirloom template "${heirloomCardId}" in KID_CARDS — cannot mint REQ-32 drop`,
    );
  }
  heirloomMintCounter += 1;
  const minted: Card & { readonly baseId: string } = {
    ...template,
    id: `${heirloomCardId}-${heirloomMintCounter}`,
    baseId: heirloomCardId,
  };
  return minted;
}

/**
 * Grant a fresh heirloom card on wild-boss-slot defeat (u-9c / REQ-32).
 * The heirloom always lands in the defeating hero's items zone —
 * items are unbounded per embertide-nmmc, so the legacy cap-
 * overflow routing through teammate / silent-drop is gone.
 *
 * The defeating seat is resolved by `determineDefeatingHero` in the
 * combat engine (last-card-played owner, tiebreak to player-1), and
 * the caller passes that index here. This helper does NOT re-derive
 * the defeater — callers MUST pass the resolved index.
 *
 * Pure at the state boundary — returns a new KidGameState. The mint
 * counter side effect is module-scoped and is not part of game state.
 */
export function grantHeirloom(
  state: KidGameState,
  defeaterIdx: number,
  heirloomCardId: string,
): KidGameState {
  const defeater = state.players[defeaterIdx];
  if (!defeater) return state;

  const heirloom = mintFreshHeirloom(heirloomCardId);
  const outcome = equipAsItem(defeater, heirloom);
  return replacePlayer(state, defeaterIdx, outcome.owner);
}

/**
 * Re-export of `HEIRLOOM_DROPS` from the data layer so slot-engagement
 * consumers don't need to reach across the data/slice boundary. Kept
 * intentionally thin — the source of truth remains
 * `src/data/cards.ts`.
 */
export { HEIRLOOM_DROPS };

/**
 * u-5a map-zone hook: apply the post-crystal-decrement zone-level side
 * effects for a defeated card. Called from every successful combat
 * resolution after the crystal counter has ticked down.
 *
 *  - `bossTier === 'wild-boss'`  → append the card id to
 *      `state.defeatedBossIds` (so the FIFO queue in
 *      `currentWildBossForZone` advances to the next wild boss once the
 *      current one falls). No zone advance. Wisp drop is granted to
 *      the defeater's items zone via `grantWildBossWisp` per amendment
 *      A6 (u-6a Craghorn, u-6b Boulderkin, u-6c Sentinel / Silver Chimera —
 *      all wire the same hook).
 *
 *  - `bossTier === 'region-boss'` AND the card id matches the current
 *    zone's `regionBossId` → append to defeatedBossIds AND advance the
 *    current zone. No-op at the terminal zone (advanceZone already
 *    handles that), which is safe because the Vurmox on-defeat
 *    Power-shard grant in u-6c fires in the same transaction. Neither
 *    wild- nor region-boss defeats grant a Embertide shard in v2 —
 *    shards only drop from Princess (u-2e), Map completion (u-5b),
 *    and Vurmox (u-6c).
 *
 *  - Any other case (regular beast, region-boss card whose id doesn't
 *    match the current zone's gatekeeper) → state unchanged.
 *
 * Pure at the state boundary — returns new state only when a boss tier
 * is present. `grantWildBossWisp` increments a module-scoped mint
 * counter as a side effect (for unique wisp ids); this is NOT part of
 * game state and is not serialized.
 */
/**
 * Card id of the v2.0 final-fight region boss (u-6c-bosses, Layer 7).
 * Defeat flips `sharedEmbertide.power = true` in the same defeat
 * transaction as the zone-advance-fired Courage unlock (u-5b). This is
 * the ONLY card in v2.0 that grants the Power shard — amendment A2
 * forbids beast and wild-boss shard drops. v2.1 may broaden this if
 * additional final-fight variants ship; for now the check is deliberately
 * a single-id constant rather than a flag on the card so the contract
 * is greppable.
 */
const POWER_SHARD_GRANTER_ID = 'cagewright-vurmox';

function applyBossDefeatHooks(
  state: KidGameState,
  defeated: Card,
  defeaterIdx: number,
): KidGameState {
  const tier = defeated.bossTier;
  if (!tier) return state;
  // ORDERING CONTRACT (u-5a): `recordBossDefeat` MUST run before
  // `advanceZone` so any downstream consumer that reads
  // `state.defeatedBossIds` during the advance transaction sees the
  // freshly-recorded id. The two calls currently produce identical
  // terminal state in v2.0/v2.1 (advanceZone is unconditional), so the
  // test suite verifies post-conditions rather than call order. DO NOT
  // reorder these two calls.
  let next = recordBossDefeat(state, defeated.id);
  if (tier === 'wild-boss') {
    // u-6a/u-6b/u-6c-bosses: wild-boss defeat grants a fresh wisp to
    // the defeater (3-cap routing: defeater → teammate → warn+drop).
    // Runs AFTER recordBossDefeat so state.defeatedBossIds is up-to-date
    // when any downstream consumer observes the wisp-grant transaction.
    // NO shard grant (amendment A2: shards come only from Princess / Map
    // / Vurmox). Sentinel + Silver Chimera (u-6c-bosses) route the same way
    // as Craghorn (u-6a) and Boulderkin (u-6b).
    next = grantWildBossWisp(next, defeaterIdx, baseIdOf(defeated));
  } else if (tier === 'region-boss') {
    const gate = ZONE_METADATA[next.currentZone].regionBossId;
    if (gate !== null && gate === defeated.id) {
      next = advanceZone(next);
    }
    // u-6c-bosses (Layer 7): Vurmox is the SOLE Power shard granter.
    // This runs AFTER advanceZone so the shared-transaction contract
    // holds — a single returned state contains (a) defeatedBossIds with
    // Vurmox's id, (b) zoneHistory with 'gilded-cage' appended by
    // advanceZone's u-5b amendment, (c) sharedEmbertide.courage flipped
    // by advanceZone's checkCourageUnlock, and (d) sharedEmbertide.power
    // flipped here. Idempotent — re-entry on an already-granted Power
    // shard is a no-op (the flag cannot regress).
    if (baseIdOf(defeated) === POWER_SHARD_GRANTER_ID && !next.sharedEmbertide.power) {
      next = {
        ...next,
        sharedEmbertide: { ...next.sharedEmbertide, power: true },
      };
    }
  }
  return next;
}

// Heart rewards (monster-drop / champion-passive / ranch-keeper bonus)
// now use the vital-ember helper from `core/vitalEmber.ts`.
// At `hp < hpMax` it heals; at `hp === hpMax` it grows both hp and
// hpMax up to HP_CAP (10). Replaces the previous `Math.min(hp + n,
// hpMax)` helper that silently wasted drops at full health.
import { applyHeartReward } from '../../core/vitalEmber';

// v2.1 gm0.17 (embertide-0jf) — ember-shard drop constants. Mirrors
// `HEART_PIECES_PER_CONTAINER` in src/store/gameStore.ts. Duplicated
// locally so this slice stays a leaf dependency and doesn't reach
// upward into the store aggregator (avoiding a circular import through
// the slice graph — same pattern `chests.ts` uses for
// `addEmberShardToPlayer`).
const HEART_PIECES_PER_CONTAINER = 4;

/**
 * Grunt meter modulus: every GRUNT_METER_SIZE-th grunt-tier defeat
 * promotes to a ember shard. The meter lives on `KidPlayer.emberShardMeter`
 * in the 0..(GRUNT_METER_SIZE-1) range; the GRUNT_METER_SIZE-th bump
 * resets the meter to 0 AND calls `addEmberShard` to award the piece.
 */
const GRUNT_METER_SIZE = 3;

/**
 * Award a ember shard to `player`, auto-promoting to a vital ember
 * when the counter rolls over at `HEART_PIECES_PER_CONTAINER`. Mirrors
 * `addEmberShard` in src/store/gameStore.ts — duplicated locally to
 * avoid a circular import through the slice graph.
 */
function addEmberShardLocal(player: KidPlayer): KidPlayer {
  const next = player.heartPieces + 1;
  if (next >= HEART_PIECES_PER_CONTAINER) {
    const grown = applyHeartReward(player, 1);
    return { ...grown, heartPieces: 0 };
  }
  return { ...player, heartPieces: next };
}

/**
 * v2.1 gm0.17 (embertide-0jf) — three-tier monster-drop hook.
 *
 * Called from `fightMonster` + `defeatAlwaysAvailableMonster` AFTER the
 * monster-drop HP-heal + boss-defeat hooks have landed. Routes the
 * DEFEATED card through the grunt / tough / slot-boss allowlists:
 *
 *   - Grunt tier (`GRUNT_HEART_METER_IDS`): bump `emberShardMeter`.
 *     Every 3rd kill promotes to a ember shard (meter → 0, heartPieces
 *     += 1 via `addEmberShardLocal` which itself auto-promotes at 4
 *     pieces → vital ember).
 *
 *   - Tough tier (`TOUGH_EMBER_SHARD_IDS`): grant a ember shard
 *     directly (1 kill = 1 piece; 4 kills ≈ 1 container via
 *     auto-promotion).
 *
 *   - Slot-boss tier: NOT handled here — wild/region bosses flow
 *     through the COMBAT_RESOLVE_WIN reducer path (see
 *     `src/store/gameStore.ts`) which grants a full vital ember
 *     directly. This helper is only for regulars.
 *
 *   - Anything else (grunt-orc, brute, wild-wolf, mini-boss-reptile,
 *     etc.): no effect. A card belongs to EITHER grunt OR tough; if an
 *     id is accidentally listed in both, grunt wins.
 *
 * Pure at the state boundary — returns a new `KidGameState` (or the
 * original state unchanged when the defeated id is outside both sets).
 */
export function applyHeartDropHooks(
  state: KidGameState,
  defeated: Card,
  defeaterIdx: number,
): KidGameState {
  const defeater = state.players[defeaterIdx];
  if (!defeater) return state;
  const bid = baseIdOf(defeated);

  if (GRUNT_HEART_METER_IDS.has(bid)) {
    const nextMeter = defeater.emberShardMeter + 1;
    if (nextMeter >= GRUNT_METER_SIZE) {
      const reset: KidPlayer = { ...defeater, emberShardMeter: 0 };
      const withPiece = addEmberShardLocal(reset);
      return replacePlayer(state, defeaterIdx, withPiece);
    }
    return replacePlayer(state, defeaterIdx, { ...defeater, emberShardMeter: nextMeter });
  }

  if (TOUGH_EMBER_SHARD_IDS.has(bid)) {
    return replacePlayer(state, defeaterIdx, addEmberShardLocal(defeater));
  }

  return state;
}

/**
 * Resolve a fight against a monster card in the field. Deducts red shards
 * equal to `card.cost.red`, consumes any `card.cost.keys`, and applies the
 * monster-drop HP-heal (amendment A2) + optional keys to the player. The
 * monster card is removed from the field and moved to `state.defeated`.
 *
 * v2: beasts/Wild Bosses grant NO shards — shards only drop from Princess
 * (u-2e), Map completion (u-5b), and Vurmox (u-6c).
 *
 * Throws if the monster is not present in the field, if the player cannot
 * pay the red cost, or if the player does not have enough keys.
 */
export function fightMonster(
  state: KidGameState,
  playerIdx: number,
  monsterId: string,
): KidGameState {
  const player = state.players[playerIdx];
  if (!player) throw new Error(`Invalid player index: ${playerIdx}`);

  const fieldIdx = state.field.findIndex((c) => c.id === monsterId);
  if (fieldIdx === -1) {
    throw new Error(`Monster not in field: ${monsterId}`);
  }
  const monster = state.field[fieldIdx];
  if (monster.role !== 'monster' && monster.role !== 'mini-boss' && monster.role !== 'final-boss') {
    throw new Error(`Card is not a monster: ${monsterId}`);
  }

  const redCost = monster.cost.red ?? 0;
  const keyCost = monster.cost.keys ?? 0;
  if (player.red < redCost) {
    throw new Error(`Insufficient red: need ${redCost}, have ${player.red}`);
  }
  if (player.keys < keyCost) {
    throw new Error(`Insufficient keys: need ${keyCost}, have ${player.keys}`);
  }

  const drop = extractDrop(monster);
  // Monster-drop "hearts" is interpreted as +HP heal in v2 (amendment A2).
  const healFromDrop = drop?.hearts ?? 0;
  const keyDrops = drop?.keys ?? 0;

  // Champion-courage passive (embertide-57p, reinterpreted for v2):
  // +1 HP heal whenever this player defeats a mini-boss or final-boss.
  // Pure-mechanical check; does NOT fire on regular 'monster' cards.
  const courageHealBonus =
    player.championId === 'champion-courage' &&
    (monster.role === 'mini-boss' || monster.role === 'final-boss')
      ? 1
      : 0;

  // Champion-sword passive (embertide-g7f, 2026-04-22 reconnect):
  // +1 HP heal when defeating a region boss (Broodmaw / Ashen Tyrant /
  // Cagewright Vurmox) — the three zone-clear gatekeepers. Originally
  // gated on `role === 'final-boss'` for v1's dark-lord endgame, which
  // effectively died in v2 since Vurmox + the other region bosses are
  // authored as `role='mini-boss'` with `bossTier='region-boss'`. The
  // legacy `role === 'final-boss'` branch is kept so the pinned
  // dark-lord card still triggers the bonus while it remains in the
  // deck. Preserves Sword's distinct specialty: Courage fires on every
  // mini-boss (broad, every kill), Sword fires only on the big region
  // gatekeepers (narrow, ~3 fires per playthrough).
  const swordHealBonus =
    player.championId === 'champion-sword' &&
    (monster.bossTier === 'region-boss' || monster.role === 'final-boss')
      ? 1
      : 0;

  // V0.2 hero triggers (embertide-g6a). Fire while the hero is in
  // inPlay — that zone holds everything played this turn before endTurn
  // flushes it to discard, so the trigger is scoped to "this turn".
  // Stacks per copy: ranch-keeper grants +1 HP-heal per copy on boss;
  // mountain-king grants +1 red per copy per monster kill.
  const isBoss = monster.role === 'mini-boss' || monster.role === 'final-boss';
  const ranchKeeperHealBonus = isBoss
    ? player.inPlay.filter((c) => baseIdOf(c) === 'ranch-keeper').length
    : 0;
  const mountainKingBonus = player.inPlay.filter((c) => baseIdOf(c) === 'mountain-king').length;

  const totalHeal = healFromDrop + courageHealBonus + swordHealBonus + ranchKeeperHealBonus;

  // u-2c: Courage's combat-triggered passive AND Sword's final-boss
  // passive both fire here. Bump the ChampionSlot pulse so the tray tile
  // replays its glow on each mini/final-boss defeat. Sword is deliberately
  // allowed to pulse TWICE on a final-boss-kill turn — once in Upkeep
  // (applyChampionPower green-grant) and once again here (final-boss heal
  // bonus) — because those are two distinct passive fires of the Sword
  // identity. Power pulses ONLY from Upkeep applyChampionPower. Wisdom
  // pulses from the Draw-phase extra-card path (gameStore.ts initGame +
  // advancePhase).
  const championPassivePulseDelta = courageHealBonus > 0 || swordHealBonus > 0 ? 1 : 0;

  let nextPlayer: KidPlayer = {
    ...player,
    red: player.red - redCost + mountainKingBonus,
    keys: player.keys - keyCost + keyDrops,
    championPassivePulse: player.championPassivePulse + championPassivePulseDelta,
  };
  nextPlayer = applyHeartReward(nextPlayer, totalHeal);
  // r94e: layer optional gems / cardDraw drops onto the defeater. Runs
  // after heart-reward + key application so the defeated monster's
  // full-loot bundle lands in a single returned player object.
  nextPlayer = applyMonsterDropExtras(nextPlayer, drop, state.rng);

  const nextField = state.field.slice();
  nextField.splice(fieldIdx, 1);

  // Always-available monsters (e.g. Wild Wolf, §12) are NOT banished to the
  // Void — they remain in the always-available pool for the next buyer.
  const skipBanish = ALWAYS_AVAILABLE_MONSTER_BASE_IDS.has(baseIdOf(monster));
  const defeated = skipBanish ? state.defeated : [...state.defeated, monster];
  // embertide-g294: mirror the defeat into the visible Void pile so
  // the kid sees the just-killed monster face-up on the board. Skip the
  // mirror for always-available kills since the monster doesn't actually
  // leave play — it returns to the pool for the next buyer.
  const voided = skipBanish ? state.voided : [...state.voided, monster];

  // embertide-044: every successful center-row kill bumps the
  // Prism Chimera spawn counter. Regular monsters, mini-bosses,
  // and the legacy dark-lord final-boss all funnel through this slice —
  // wild/region slot bosses route through `dispatchCombat`
  // (gameStore.ts `fightMonster` action branch) and bump in the
  // `COMBAT_RESOLVE_WIN` reducer instead, so no double-count.
  const afterKill: KidGameState = {
    ...replacePlayer(state, playerIdx, nextPlayer),
    field: nextField,
    defeated,
    voided,
    centerRowKillCount: state.centerRowKillCount + 1,
  };

  // REQ-8 / u-2e: every successful field-monster defeat — regular, mini-
  // boss, or final-boss — decrements the shared Princess-in-Crystal
  // counter by 1 (floored at 0; no-op once the Princess is freed). The
  // decrement runs BEFORE the u-5a boss-defeat hooks so both step-updates
  // land in a single returned state.
  const afterCrystal = decrementCrystalCharges(afterKill, monster);
  // kill. u-6a/u-6b: wild-boss defeat also grants a fresh wisp to the
  // defeater (3-cap teammate routing + warn-and-drop on both-full).
  // No-op for regular beasts (bossTier absent).
  const afterBossHooks = applyBossDefeatHooks(afterCrystal, monster, playerIdx);
  // v2.1 gm0.17 (embertide-0jf): three-tier ember-shard drop.
  // Grunt/tough regulars bump `emberShardMeter` / `heartPieces` here;
  // slot-boss container drops live in the COMBAT_RESOLVE_WIN reducer.
  const afterHeart = applyHeartDropHooks(afterBossHooks, monster, playerIdx);
  // embertide-4uyn: dispatch every owned item-passive declaring
  // `trigger: 'on-monster-defeated'`. Runs AFTER the monster-drop +
  // boss + ember-shard hooks so the per-kill loot stack is monster-
  // owned first, passive-relic owned second.
  const afterPassives = applyMonsterDefeatedPassivesAt(afterHeart, playerIdx);
  // v2.1 REQ-21 / gm0.6: attached-chest bonus. Defeating a monster
  // stamped with `hasAttachedChest: true` opens a chest-std at no key
  // cost. Runs last so the chest reward layers on top of every other
  // defeat hook (princess crystal, boss tier, ember-shard meter,
  // 4uyn passives).
  if (monster.hasAttachedChest) {
    return applyAttachedChestBonus(afterPassives, playerIdx);
  }
  return afterPassives;
}

/**
 * Fire every item-passive on the player at `playerIdx` whose trigger is
 * `'on-monster-defeated'` (embertide-4uyn). Pure: returns a new state.
 * No-op when the player owns no qualifying passives.
 */
function applyMonsterDefeatedPassivesAt(state: KidGameState, playerIdx: number): KidGameState {
  const player = state.players[playerIdx];
  if (!player) return state;
  if (player.items.length === 0) return state;
  const next = applyItemPassivesForTrigger(player, 'on-monster-defeated', state.rng);
  if (next === player) return state;
  return replacePlayer(state, playerIdx, next);
}

/**
 * Resolve a fight against an always-available monster (currently only the
 * Wild Wolf, §12 / embertide-9yu). Applies the monster's red cost and
 * monster-drop HP-heal to `player` but leaves `state.defeated` untouched —
 * the monster is never removed from the always-available pool.
 *
 * Wild Wolf heal tuning (embertide-1uh): the monster-drop heal is
 * awarded ONLY on the first kill of the turn — subsequent kills in the
 * same turn still cost red (and drop keys if applicable) but grant no
 * heal. This caps the farm to one free heal per turn so the wolf can't
 * trivialize the HP economy.
 *
 * Throws if `monsterCard` has a role other than 'monster', or if the player
 * cannot pay the red cost.
 */
export function defeatAlwaysAvailableMonster(
  state: KidGameState,
  playerIdx: number,
  monsterCard: Card,
): KidGameState {
  const player = state.players[playerIdx];
  if (!player) throw new Error(`Invalid player index: ${playerIdx}`);
  if (monsterCard.role !== 'monster') {
    throw new Error(`defeatAlwaysAvailableMonster: expected role monster, got ${monsterCard.role}`);
  }

  const redCost = monsterCard.cost.red ?? 0;
  if (player.red < redCost) {
    throw new Error(`Insufficient red: need ${redCost}, have ${player.red}`);
  }

  const drop = extractDrop(monsterCard);
  const healFromDrop = drop?.hearts ?? 0;
  const keyDrops = drop?.keys ?? 0;

  const isWildWolf = baseIdOf(monsterCard) === 'wild-wolf';
  const skipHeal = isWildWolf && player.wildWolfKillsThisTurn > 0;
  const grantedHeal = skipHeal ? 0 : healFromDrop;

  let nextPlayer: KidPlayer = {
    ...player,
    red: player.red - redCost,
    keys: player.keys + keyDrops,
    wildWolfKillsThisTurn: isWildWolf
      ? player.wildWolfKillsThisTurn + 1
      : player.wildWolfKillsThisTurn,
  };
  nextPlayer = applyHeartReward(nextPlayer, grantedHeal);
  // r94e: gems / cardDraw layer the same way as for field monsters.
  // Wild Wolf farm cap (embertide-1uh) extends to extras: if the
  // wolf has already been killed this turn the extras skip too, so the
  // farm can't bypass the heal cap by routing rewards through the new
  // fields.
  if (!skipHeal) {
    nextPlayer = applyMonsterDropExtras(nextPlayer, drop, state.rng);
  }

  // REQ-8 / u-2e: always-available monster kills (currently only Wild
  // Wolf) count toward the shared Princess-in-Crystal counter. Same
  // semantics as field-monster defeats: every successful kill decrements
  // charges by 1, floored at 0, no-op once the Princess is freed.
  const afterCrystal = decrementCrystalCharges(
    replacePlayer(state, playerIdx, nextPlayer),
    monsterCard,
  );
  // u-5a: always-available monsters do not normally carry a boss tier
  // (Wild Wolf is a regular beast), but the hook is applied here for
  // symmetry so future always-available bosses (if any) route the same
  // way as field-boss kills.
  const afterBossHooks = applyBossDefeatHooks(afterCrystal, monsterCard, playerIdx);
  // v2.1 gm0.17: grunt/tough ember-shard drop. Wild Wolf is outside
  // both allowlists so this is a no-op for the current single
  // always-available monster; kept for symmetry with `fightMonster` so
  // a future always-available grunt (if any) routes the same way.
  const afterHeart = applyHeartDropHooks(afterBossHooks, monsterCard, playerIdx);
  // embertide-4uyn: 'on-monster-defeated' passives fire on every
  // monster kill, including always-available monsters (Wild Wolf today).
  // The Wild-Wolf farm cap (embertide-1uh) intentionally does NOT
  // gate passives — kids who buy a `bandits-cache` SHOULD still earn
  // the +1 gem on each Wolf kill; the cap only suppresses the heart
  // drop, not the passive economy.
  return applyMonsterDefeatedPassivesAt(afterHeart, playerIdx);
}
