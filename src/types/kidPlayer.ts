import type { Card } from './card';

/**
 * Store-independent Kid Mode player shape. Intentionally richer than the
 * shared `Player` interface in `src/types/game.ts`, which does not yet
 * model shards, keys, slotted inventory, HP, or chest counts. Pure rules
 * and resolvers may consume this domain type without initializing Zustand.
 */
/**
 * Typed champion identity (u-2c, REQ-3). Narrows the loose `championId: string`
 * contract to the four Kid Mode Champions. `championId` retains a loose
 * string type for backward compatibility with existing tests and the game-
 * config setup payload; the new `championSlot` tray field uses this tighter
 * type so UI code can switch exhaustively on it.
 */
export type ChampionId =
  | 'champion-courage'
  | 'champion-wisdom'
  | 'champion-power'
  | 'champion-sword';

export interface KidPlayer {
  readonly id: string;
  readonly name: string;
  readonly championId: string;
  /**
   * Dedicated passive-slot identity (u-2c / REQ-3). Populated at initGame
   * from `championId` via `resolveChampionSlot` in `slices/setup.ts`; null
   * only if the seat has not yet selected a valid champion (future-proofing
   * for v2.1 mid-game champion swap). Read by `src/ui/ChampionSlot.tsx` to
   * render the always-visible tray tile and gate the pulse-on-passive-fire
   * animation.
   */
  readonly championSlot: ChampionId | null;
  /**
   * Monotonic pulse counter for the ChampionSlot tray tile (u-2c). Bumps
   * every time THIS player's champion passive fires (power/sword SOT
   * resource grants, wisdom extra-draw, courage mini/final-boss HP heal).
   * Drives `key={player.championPassivePulse}` in ChampionSlot.tsx so the
   * glow + particle replays on every fire; value itself is opaque.
   */
  readonly championPassivePulse: number;
  /**
   * Current HP. v2 co-op pivot (amendment A2/A3): hearts became HP. 0 HP
   * enters DOWNED state (see `downed`) rather than immediately ending the
   * game. HP is clamped to `[0, hpMax]`; heals above `hpMax` are wasted.
   */
  readonly hp: number;
  /** Maximum HP for this player (default 5 at initGame). */
  readonly hpMax: number;
  /**
   * True when this player's HP reached 0 and they have not been revived
   * yet. Downed players cannot take main-phase actions (see §A3). Reset
   * to false when HP rises back above 0 (via teammate revive or wisp).
   */
  readonly downed: boolean;
  /**
   * Has this player already been teammate-revived during the CURRENT
   * downed incident? One teammate-revive per incident (amendment A3);
   * resets to false when the player becomes downed again (new incident)
   * and is set true by the teammate-revive action (u-1d).
   */
  readonly revivedThisIncident: boolean;
  readonly green: number;
  readonly red: number;
  readonly keys: number;
  readonly deck: readonly Card[];
  readonly hand: readonly Card[];
  readonly discard: readonly Card[];
  /**
   * Cards played this turn sitting face-up in front of the player
   * (Ascension-style "in play" zone, embertide-7c1). Flushed to
   * `discard` by `endTurn`. Items that successfully slot do NOT pass
   * through `inPlay` — they move straight to `slots`.
   */
  readonly inPlay: readonly Card[];
  /**
   * @deprecated (embertide-9yu) Legacy 2-slot inventory. Items are now
   * stored in `items` with no slot cost. The array is retained solely so
   * existing tests keep working while the migration settles; new code
   * MUST NOT write new items here.
   */
  readonly slots: readonly (Card | null)[];
  /**
   * Persistent Items zone (REQ-4 / amendment A6, u-2d — renamed from
   * `constructs` in §4.2 / embertide-9yu). Items and legendary-items
   * acquired by the player live here across turns and fire their
   * start-of-turn trigger every time the player's turn begins. Items are
   * unbounded per embertide-nmmc (2026-04-26) — every drop / buy
   * lands in the items zone with no upper cap.
   *
   * v2.0 populates this zone with item-active cards only; item-passive
   * is schema-allowed but no v2.0 card declares it (REQ-4 premortem L5).
   */
  readonly items: readonly Card[];
  readonly chestsOpened: number;
  /**
   * Wild-wolf kills already resolved this turn (embertide-1uh). Wild
   * Wolf grants its +1 HP-heal drop only on the FIRST kill of the turn;
   * subsequent kills still consume red and count as combat, but award no
   * heal. Reset to 0 for the outgoing player at end of turn.
   */
  readonly wildWolfKillsThisTurn: number;
  /**
   * Whether this player has already traded with Pell (key-vendor) this
   * seat-turn (embertide-5y13). Capped at 1 trade per active player
   * per turn so the green→key→chest treadmill no longer dominates the
   * field-buy economy. Reset to `false` for the outgoing player at end
   * of turn, mirroring the `wildWolfKillsThisTurn` reset.
   */
  readonly usedKeyVendorThisTurn: boolean;
  /**
   * True after the Princess is freed (REQ-8). Shared buff — both players
   * receive it in the same event, even though each player's flag is
   * per-player for implementation convenience. Read-only effect for v2.0;
   * v2.1 may hang derived mechanics off it.
   */
  readonly wisdomsLight: boolean;
  /**
   * Ember-shard accumulator (v2.1 gm0.16). Chest `ember-shard` rewards
   * increment this 0..3 counter; the 4th piece auto-promotes to a heart
   * container and resets to 0 while growing `hp` + `hpMax` via
   * `applyHeartReward`. Heart pieces are NOT cards and never enter the
   * items / discard / deck zones — this counter IS the authoritative
   * store of "pieces held".
   */
  readonly heartPieces: number;
  /**
   * Ember-shard meter accumulator (v2.1 gm0.17). 0..2 invariant — counts
   * grunt-tier monster defeats toward the next ember shard. Every 3rd
   * grunt kill (meter transitions 2 → 0 AND bumps `heartPieces` by 1 via
   * `addEmberShard`) promotes a piece. Resets to 0 on promotion. Not
   * consumed by tough-tier kills (those grant a piece directly) or
   * slot-boss defeats (those grant a full vital ember via
   * `applyHeartReward`). See `GRUNT_HEART_METER_IDS` in
   * `src/data/cards.ts` for the grunt-tier allowlist.
   */
  readonly emberShardMeter: number;
  /**
   * Ids of wisp-in-bottle copies that have ALREADY been consumed this
   * combat (v2.1 gm0.16). `playWispOn` re-equips a wisp-in-bottle on
   * first revive, then records its id here so a second revive in the
   * same combat does NOT re-equip (one bottle, one refill per combat).
   * Reset to `[]` at every `COMBAT_ENTER` dispatch.
   */
  readonly usedWispInBottleIds: readonly string[];
  /**
   * Permanent banish pile for deck-thinning (embertide-91p framework).
   * Cards moved here via `banishFromHand` / `banishFromDiscard` leave the
   * player's active rotation for the rest of the game. Retained as a
   * pile (not dropped to /dev/null) so future mechanics — "return N
   * banished cards", banished-card viewers, debug surfaces — can read
   * it without a schema migration.
   *
   * Initialized to `[]` at `initGame`. Not reset on zone advance or
   * combat boundaries — banish is permanent by design.
   */
  readonly banished: readonly Card[];
  /**
   * "Next chest item revealed" foresight flag (v2.1 REQ-9d, embertide-4hz6).
   * Set to `true` when this player commits a Dungeon-Boss reward roll on
   * face 2 or 3 — a peek-at-next-chest atmospheric reward. Consumed
   * (flipped back to false) the next time this player opens a chest, so
   * the foresight is a one-shot. UI surfaces the flag as a "next chest
   * item is revealed early" hint in the chest row; the underlying
   * mechanical effect on chest opening is intentionally minimal in this
   * landing (the bead's scope is the roll site, not the chest UI
   * rework). Initialized to `false` at `initGame`.
   */
  readonly nextChestItemRevealed: boolean;
}
