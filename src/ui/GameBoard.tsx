import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore, currentPlayer } from '../store/gameStore';
import { KEY_VENDOR_ID } from '../data/cards';
import type { ZoneId } from '../store/types';
import { isColosseumUnlocked } from '../store/slices/zones';
import Field from './Field';
import type { ZoomedCardContext } from './Field';
import Hand from './Hand';
import InPlay from './InPlay';
import DiscardPile from './DiscardPile';
import VoidPane from './VoidPane';
import AlwaysRowStrip from './AlwaysRowStrip';
import PlayerTray from './PlayerTray';
import EmbertideStrip from './EmbertideStrip';
import TurnBanner from './TurnBanner';
import PlayAllStartersButton from './PlayAllStartersButton';
import PrincessCrystalCell from './PrincessCrystalCell';
import ChestReveal from './ChestReveal';
import CardSelectionModal from './CardSelectionModal';
import CardDetailModal from './CardDetailModal';
import PileViewerModal from './PileViewerModal';
import RulesBook from './RulesBook';
import DieRollReveal from './DieRollReveal';
import { useTouchPointer } from './useTouchPointer';
import { DUNGEON_BOSS_REWARD_TABLE, FOREST_SAGE_OMEN_TABLE } from '../store/gameStore';
import type { DungeonBossRewardOutcome, ForestSageOmenOutcome } from '../store/gameStore';
import ColosseumEntryPane from './ColosseumEntryPane';
import ZoneCell from './ZoneCell';
import ZoneAdvanceBanner from './ZoneAdvanceBanner';
import Pane from './Pane';
import CombatScreen from './CombatScreen';
import CombatTutorialBubble from './CombatTutorialBubble';
import WildBossEncounterSlot from './WildBossEncounterSlot';
import RegionBossEncounterSlot from './RegionBossEncounterSlot';
import VurmoxDestinySlot from './VurmoxDestinySlot';
import { ZONE_METADATA } from '../rules/zones';

const END_TURN_STYLE = {
  minWidth: 88,
  minHeight: 44,
} as const;

/**
 * Resolve the game-over headline text from the co-op outcome
 * (amendment A1/A2). v2 victory and loss are SHARED — both players win
 * or lose together — so the overlay no longer names a single winner.
 */
function formatOutcomeHeadline(outcome: 'win' | 'loss'): string {
  return outcome === 'win' ? 'Victory!' : 'Defeat';
}

function formatOutcomeBody(outcome: 'win' | 'loss'): string {
  return outcome === 'win'
    ? 'All three shards are yours — the realm is saved!'
    : 'Both heroes have fallen and no revive is available.';
}

/**
 * Format a Dungeon-Boss reward face into the kid-facing headline shown
 * by `DieRollReveal` (embertide-ynn4 die-roll-animation pass +
 * embertide-3wd6 d20 tier-curve redesign 2026-04-25). The outcome
 * table itself lives in gameStore.ts; this formatter renders the tier
 * with the tightest legible copy for a 6yo.
 */
function formatDungeonBossOutcome(face: number): string {
  const outcome: DungeonBossRewardOutcome | undefined = DUNGEON_BOSS_REWARD_TABLE[face];
  if (!outcome) return '';
  switch (outcome.tier) {
    case 'std':
      return 'Loot drop!';
    case 'mid':
      return 'Rare loot drop!';
    case 'legendary':
      return 'Legendary drop!';
    default: {
      const _exhaustive: never = outcome.tier;
      return _exhaustive;
    }
  }
}

/**
 * Forest-Sage omen face → kid-facing label. Mirrors
 * `formatDungeonBossOutcome`'s shape; the omen table lives in
 * gameStore.ts (FOREST_SAGE_OMEN_TABLE).
 */
function formatForestSageOutcome(face: number): string {
  const outcome: ForestSageOmenOutcome | undefined = FOREST_SAGE_OMEN_TABLE[face];
  if (!outcome) return '';
  switch (outcome.kind) {
    case 'heal':
      return `Heal +${outcome.hp} HP`;
    case 'gems':
      return `+${outcome.amount} gems`;
    case 'peek-next-chest':
      return 'Peek next chest';
    case 'power':
      return `+${outcome.amount} power this turn`;
    case 'draw':
      return `Draw ${outcome.amount} card${outcome.amount === 1 ? '' : 's'}`;
    case 'rare-item':
      return 'Rare item drop';
    default: {
      const _exhaustive: never = outcome;
      return _exhaustive;
    }
  }
}

/**
 * Top-level game-play surface. Wires the active player's hand and tray to
 * the store, renders all players' trays, the shared field, and the
 * co-op end-of-game overlay when the shared outcome resolves.
 *
 * Issue embertide-2l9 adds the top-of-board turn banner, the
 * play-all-shards helper, a prominent End Turn button with a "nothing
 * more to play" hint when the active hand is tapped out, and cost badges
 * on every card face (via `Field` + `Hand`).
 */
export default function GameBoard(): JSX.Element {
  const state = useGameStore();
  const fightMonster = useGameStore((s) => s.fightMonster);
  const buyFromField = useGameStore((s) => s.buyFromField);
  const buyAlwaysAvailable = useGameStore((s) => s.buyAlwaysAvailable);
  const defeatAlwaysAvailable = useGameStore((s) => s.defeatAlwaysAvailable);
  const tradeWithKeyVendor = useGameStore((s) => s.tradeWithKeyVendor);
  const openChest = useGameStore((s) => s.openChest);
  const playCard = useGameStore((s) => s.playCard);
  const playCardFromInPlayDrop = useGameStore((s) => s.playCardFromInPlayDrop);
  const endTurn = useGameStore((s) => s.endTurn);
  const reviveTeammate = useGameStore((s) => s.reviveTeammate);
  const playWispOn = useGameStore((s) => s.playWispOn);
  const strikePrincessCrystal = useGameStore((s) => s.strikePrincessCrystal);
  const lastChestReward = useGameStore((s) => s.lastChestReward);
  // embertide-ymgc: parallel field carrying the resolved Card so the
  // chest reveal can render the rolled card's actual illustration via
  // CardTemplate (instead of a generic placeholder icon) for hero / item
  // / premium-item / wisp rolls.
  const lastChestRewardCard = useGameStore((s) => s.lastChestRewardCard);
  const clearLastChestReward = useGameStore((s) => s.clearLastChestReward);
  // embertide-91p (b): per-card banish prompt surface. Set by the
  // playCard reducer when a card with `effects.kind === 'banish-from-hand'`
  // resolves and the active player has banishable cards. Resolved by
  // tapping a card in the modal (→ banishFromHand) or cancelling
  // (→ cancelBanishChoice — effect fizzles).
  const pendingBanishChoice = useGameStore((s) => s.pendingBanishChoice);
  const banishFromHand = useGameStore((s) => s.banishFromHand);
  const cancelBanishChoice = useGameStore((s) => s.cancelBanishChoice);
  // v2.1 REQ-9d (embertide-4hz6): Dungeon Boss onDefeat reward roll.
  // Hydrated by COMBAT_RESOLVE_WIN on a region-boss kill; cleared by
  // `commitDungeonBossReward(face)` when the player taps a face card.
  // Modal-stack ordering: rendered ONLY when `lastChestReward === null`
  // so the chest reveal renders FIRST when both fire on the same kill.
  const pendingDungeonBossRoll = useGameStore((s) => s.pendingDungeonBossRoll);
  const commitDungeonBossReward = useGameStore((s) => s.commitDungeonBossReward);
  // v2.1 REQ-6 (embertide-gm0.10): Forest-Sage on-play omen roll.
  // Hydrated by `playCard` when forest-sage is played; cleared by
  // `commitForestSageOmen(face)` when the player taps a face card.
  // Modal-stack ordering: rendered ONLY when `lastChestReward === null`
  // AND no dungeon-boss roll is pending so the chest reveal / dungeon
  // reward modal both render FIRST when they fire concurrently.
  const pendingForestSageRoll = useGameStore((s) => s.pendingForestSageRoll);
  const commitForestSageOmen = useGameStore((s) => s.commitForestSageOmen);
  // embertide-4hr1.4 — colosseum HUD entry. Routes the boss-selection
  // path through `colosseum.engine`'s slot router on click; gated on the
  // `isColosseumUnlocked` derived selector so the entry is invisible
  // until the Sylvani unlock pair (Craghorn + Broodmaw) has fallen.
  const enterColosseum = useGameStore((s) => s.enterColosseum);
  const colosseumUnlocked = isColosseumUnlocked(state);

  // gy7n: tap-to-zoom card detail. On touch devices the parent
  // intercepts tile clicks and opens CardDetailModal so the player
  // can read the full card text on a tiny art-only mobile tile
  // before committing to the action.
  const isTouch = useTouchPointer();
  const [zoomedCardCtx, setZoomedCardCtx] = useState<ZoomedCardContext | null>(null);
  const onZoomCard = isTouch ? setZoomedCardCtx : undefined;
  // vj6s: tapping a discard / void pile opens the full-pile viewer
  // (PileViewerModal) showing EVERY card in the pile face-up — not just
  // the top card. Always wired regardless of touch detection so the
  // desktop player can inspect the whole pile too. We store only WHICH
  // pile is open; the card list is derived live from the store on each
  // render so the viewer stays in sync if the pile changes underneath.
  const [viewedPile, setViewedPile] = useState<'discard' | 'void' | null>(null);

  const hasPlayers = state.players.length > 0;
  const active = hasPlayers ? currentPlayer(state) : null;

  const gameOver = state.outcome !== null;

  // REQ-32 (u-9d) Temple-endgame condition. The region-boss slot is
  // replaced by the DESTINY slot once both Gilded Cage wild bosses
  // (Sentinel + Silver Chimera) are in `defeatedBossIds`. Same dispatch
  // (engageRegionBossSlot on 'cagewright-vurmox') — only the visuals
  // change.
  const showVurmoxDestiny =
    state.currentZone === 'gilded-cage' &&
    state.defeatedBossIds.includes('sentinel') &&
    state.defeatedBossIds.includes('silver-chimera');
  const outcomeHeadline = gameOver ? formatOutcomeHeadline(state.outcome!) : '';
  const outcomeBody = gameOver ? formatOutcomeBody(state.outcome!) : '';

  // Move focus to the outcome banner when the overlay mounts so keyboard
  // users aren't stranded on the now-disabled End Turn button and the
  // screen reader announces the headline reliably (role=alert announces
  // freshly-mounted content per WAI-ARIA).
  const outcomeBannerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (gameOver && outcomeBannerRef.current) {
      outcomeBannerRef.current.focus();
    }
  }, [gameOver]);

  // u-5a zone-advance banner. Fires when zoneHistory grows by one —
  // the entry appended is the zone that was just cleared. We track the
  // last observed length in a ref so we don't re-show the banner on
  // every re-render, and capture both the from- and to- zones at the
  // moment of the advance so the banner survives subsequent state
  // changes (e.g. downstream card effects during the same defeat
  // transaction).
  const lastObservedHistoryLenRef = useRef(state.zoneHistory.length);
  const [zoneAdvance, setZoneAdvance] = useState<{
    readonly fromZone: ZoneId;
    readonly toZone: ZoneId;
  } | null>(null);
  useEffect(() => {
    const prevLen = lastObservedHistoryLenRef.current;
    const currLen = state.zoneHistory.length;
    if (currLen > prevLen) {
      const fromZone = state.zoneHistory[currLen - 1];
      setZoneAdvance({ fromZone, toZone: state.currentZone });
    }
    lastObservedHistoryLenRef.current = currLen;
  }, [state.zoneHistory, state.currentZone]);
  const dismissZoneAdvance = useCallback(() => setZoneAdvance(null), []);

  // v2.1 combat gate (u-8f, PRD §B1). While a boss combat is resolving
  // the main board is replaced by <CombatScreen />; we keep the
  // `data-testid="game-board"` wrapper so smoke-level selectors still
  // resolve in both states. The main-board children are untouched
  // otherwise — activeCombat === null preserves the pre-u-8f render
  // byte-for-byte.
  if (state.activeCombat !== null) {
    return (
      <div data-testid="game-board" className="game-board" style={{ position: 'relative' }}>
        <CombatScreen />
        <CombatTutorialBubble />
      </div>
    );
  }

  return (
    <div data-testid="game-board" className="game-board" style={{ position: 'relative' }}>
      {/*
       * round2 (player layout pass): the zone backdrop art is lifted out of
       * `.board-grid` to back the ENTIRE game board — it now spans behind the
       * top always-available strip and the bottom player trays too, not just
       * the center grid. The player asked the background art to FILL the
       * window and shrink the solid-color bands top and bottom; making the
       * art the full-board field (with the parchment panes floating on top of
       * it) is what delivers that. All interactive bands sit at z-index >= 1
       * via the `.game-board > :not(zone-cell)` rule in app.css.
       */}
      {hasPlayers ? <ZoneCell zone={ZONE_METADATA[state.currentZone]} /> : null}
      {/*
       * 2026-04-26 follow-up: the cathedral title strip is gone. With
       * the always-row default-expanded, the 44px title bar above the
       * strip was still pushing the bottom of the player panes below
       * the viewport. TurnBanner + the status-bar Pane both relocate
       * into the always-row's right rail (below) so the entire HUD
       * cluster lives in a single band and the player panes get the
       * reclaimed vertical space. All testids (turn-banner, status-bar,
       * turn-count, deck-count, discard-count, active-player, gauge
       * chips) and Pane class contracts move with the components
       * unchanged — only their parent slot changed.
       */}
      {/*
       * embertide-uwg5 (2026-04-26): always-available + chest rows
       * collapse into a full-width top chip strip above the board grid.
       * Pre-uwg5 these rows lived inside `.board-side` (right rail).
       * The new placement makes them the second top-band — directly
       * under the cathedral title strip — so the kid sees every
       * always-buyable card in their first scan of the screen. Default
       * state is EXPANDED (full card tiles); chevron at the right edge
       * collapses to a 44px parchment-chip strip.
       */}
      {hasPlayers ? (
        <AlwaysRowStrip
          green={active?.green ?? 0}
          red={active?.red ?? 0}
          keys={active?.keys ?? 0}
          usedKeyVendorThisTurn={active?.usedKeyVendorThisTurn ?? false}
          chestRow={state.chestRow}
          onBuy={buyAlwaysAvailable}
          onFight={defeatAlwaysAvailable}
          onTrade={(vendorId) => {
            if (vendorId === KEY_VENDOR_ID) tradeWithKeyVendor();
          }}
          onOpenChest={openChest}
          // round2: top-row tiles are name+image only; route their taps
          // through the shared zoom modal for the full rules — ALWAYS
          // (desktop + touch), since the compact face has no rules text.
          onZoomCard={setZoomedCardCtx}
          statsExpanded={
            <>
              <TurnBanner
                currentPlayerIndex={state.currentPlayerIndex}
                turn={state.turn}
                championId={active?.championId}
              />
              <Pane
                colorFamily="neutral-shadow"
                density="compact"
                ariaLabel="Game status"
                className="status-bar"
                testId="status-bar"
              >
                <span data-testid="turn-count">Turn {state.turn}</span>
                {active ? (
                  <>
                    <span data-testid="deck-count">Deck: {active.deck.length}</span>
                    <span data-testid="discard-count">Discard: {active.discard.length}</span>
                    <span data-testid="active-player">Active: {active.name}</span>
                  </>
                ) : null}
                {state.currentZone === 'maren' ? (
                  <span data-testid="tide-gauge-chip" title="Tide rises while you stay in Tidehold">
                    🌊 Tide {state.tideGauge}/4
                  </span>
                ) : null}
                {state.currentZone === 'hollow-shrine' ? (
                  <span
                    data-testid="shadow-creep-chip"
                    title="Monsters grow bolder the longer you stay in the Hollow Shrine"
                  >
                    🌑 Shadow {state.shadowCreep}/3
                  </span>
                ) : null}
                {state.currentZone === 'dune-sanctum' ? (
                  <span
                    data-testid="sandstorm-chip"
                    title="The sandstorm builds the longer you stay in the Dune Sanctum"
                  >
                    🌪️ Sandstorm {state.sandstormCounter}/3
                  </span>
                ) : null}
              </Pane>
            </>
          }
          statsCollapsed={
            <TurnBanner
              currentPlayerIndex={state.currentPlayerIndex}
              turn={state.turn}
              championId={active?.championId}
            />
          }
        />
      ) : null}
      <div className="board-grid" data-testid="board-grid">
        <div className="board-main">
          <div className="market-row" data-testid="market-row">
            <Field
              cards={state.field}
              onFight={fightMonster}
              onBuy={buyFromField}
              onOpenChest={openChest}
              green={active?.green ?? 0}
              red={active?.red ?? 0}
              keys={active?.keys ?? 0}
              // 2026-06-20: market tiles now act on direct tap; the detail
              // modal moved onto the per-tile corner magnifier. Wire the
              // zoom handler UNCONDITIONALLY (not just on touch, like the
              // always-available row above) so the magnifier — and full
              // rules — are available on desktop and touch alike.
              onZoomCard={setZoomedCardCtx}
            />
          </div>

          {active ? (
            <>
              {/*
               * embertide-fsyd (2026-04-26): InPlay drop-zone gap +
               * ItemsRow → bag chip rework. The play-zones row now hosts
               * only InPlay (drop-target / in-play surface). The items
               * bag chip + popover live inside PlayerTray's tray-items
               * cell, so the items row no longer competes with InPlay
               * for horizontal space here.
               */}
              {/*
               * lqg6 (2026-04-26 rev-3): DiscardPile migrated OUT of
               * the play-zones / hand-row right slot down to the
               * trays-row, alongside the player tray panes. User
               * direction: surfacing the discard adjacent to the Hand
               * read as "this is something you can play" — confusing.
               * Moving it next to the player tray panes (where the
               * future Void pane from g294 will also live) makes the
               * discard read as a player-state surface, not a market
               * tile.
               *
               * The play-zones / hand-row right slots remain in place
               * (the hand-row slot still hosts PlayAllStartersButton;
               * the play-zones slot is now an empty spacer reserving
               * the same width so InPlay and Hand cream panes still
               * left-align via centred-equal-width-rows). End Turn
               * migrated to the board-side rail beneath
               * crystal-embertide (see the .board-side block).
               */}
              <div className="play-zones">
                <InPlay cards={active.inPlay} onDropPlayCard={playCardFromInPlayDrop} />
                <div className="play-zones-right-slot" aria-hidden="true" />
              </div>
              <div className="hand-row">
                <Hand cards={active.hand} onPlay={playCard} onZoomCard={onZoomCard} />
                <div className="hand-row-right-slot">
                  <PlayAllStartersButton />
                </div>
              </div>
              {/*
               * Designer feedback 2026-04-22 (revised): the EmbertideStrip
               * renders ALWAYS and always at the END of the `.trays` flex
               * row — AFTER every PlayerTray — so it reads as a shared
               * resource adjacent to all players rather than entangled
               * with P1. This gives consistent placement across all
               * player counts:
               *   1p: [P1 | Embertide]
               *   2p: [P1 | P2 | Embertide]
               *   3p: [P1 | P2 | P3 | Embertide]
               *   4p: [P1 | P2 | P3 | P4 | Embertide]
               * The wrapper keeps `data-testid="embertide-hud"` so existing
               * smoke assertions still resolve.
               */}
              {/*
               * arq3 (2026-04-26): End Turn moved OUT of the .trays cream
               * parchment plate and into a sibling position inside the
               * new .trays-row wrapper. The .trays plate now contains
               * only the player panes (+ shared items-bag chips inside
               * each tray); the End Turn CTA lives outside the plate
               * just as PlayAllStartersButton lives outside the hand
               * pane on .hand-row.
               */}
              <div className="trays-row">
                <div className="trays">
                  {state.players.map((p, idx) => {
                    const isActive = idx === state.currentPlayerIndex;
                    // u-2a wiring (amendment A3 revive flow):
                    // only the non-active player's tray is a "teammate view"
                    // from the reviver's perspective — that's where the
                    // Revive button surfaces when the teammate is downed.
                    const isTeammateView = !isActive;
                    const activePlayer = state.players[state.currentPlayerIndex];
                    const activeRevived = activePlayer?.revivedThisIncident ?? false;
                    // 35rv (2026-04-26): the items-bag chip moved INTO each
                    // PlayerTray, so the tray needs the downed-teammate id
                    // + wisp dispatcher to surface tap-to-use on the
                    // active player's chip.
                    const downedTeammateId =
                      state.players.find((other) => other.downed && other.id !== active.id)?.id ??
                      null;
                    return (
                      <PlayerTray
                        key={p.id}
                        player={p}
                        isActive={isActive}
                        isTeammateView={isTeammateView}
                        onRevive={isTeammateView ? () => reviveTeammate(p.id) : undefined}
                        phase={state.phase}
                        activePlayerRevivedThisIncident={activeRevived}
                        downedTeammateId={downedTeammateId}
                        onPlayWisp={playWispOn}
                      />
                    );
                  })}
                </div>
                {/*
                 * lqg6 (2026-04-26 rev-3) + g294 (2026-04-26): pile
                 * column to the right of the trays plate. Hosts
                 * DiscardPile + VoidPane side-by-side so the player has
                 * a dedicated board strip for "what just happened to my
                 * cards" — the discard sink (parchment, comes back next
                 * shuffle) + the void sink (TOTK-gloom backdrop, gone
                 * for good), adjacent to the player tray panes.
                 */}
                <div className="trays-row-pile-column" data-testid="trays-row-pile-column">
                  <DiscardPile cards={active.discard} onOpenPile={() => setViewedPile('discard')} />
                  <VoidPane cards={state.voided} onOpenPile={() => setViewedPile('void')} />
                </div>
              </div>
            </>
          ) : null}
        </div>

        <aside className="board-side">
          {/*
           * embertide-9eou (2026-04-26): the right-rail is now a
           * vertical column with a strict three-tier order:
           *   1. Boss Altar row (top) — Wild + Region/Destiny slots.
           *   2. PrincessCrystalCell (middle) — full-size raster +
           *      integrity bar + Aurelia freed-portrait.
           *   3. EmbertideStrip in its cathedral niche (bottom).
           * Pre-9eou the Embertide + Crystal lived as 56px discs in the
           * cathedral title-strip's center slot (7cew + v7u4) — flagged
           * as "extremely amateur" on visual review. Restoring the
           * canonical empty-slot-fills-with-gold-stained-glass shard
           * art and surrounding it with an ornate gothic niche reads
           * as a proper cathedral artifact rather than a bare
           * medallion. Both the title-strip center slot and the
           * `.trays`-band peers are gone.
           */}
          <div className="board-side-crystal-rail">
            <div className="boss-altar-row" data-testid="boss-altar-row">
              {/*
               * Designer polish 2026-04-22: when the DESTINY slot is
               * live, the cleared wild-slot placeholder next to it is
               * redundant at endgame — both Temple wild bosses are
               * guaranteed defeated (that's the Destiny mount gate).
               * Hide the wild slot entirely so the row reads cleanly
               * as "Destiny only". Round 2 polish reverted destiny's
               * earlier 1.5× scale to 1×, so the old "overflow into
               * the wild slot" reason no longer applies — but the
               * "cleared state is redundant" reason still does.
               */}
              {!showVurmoxDestiny && <WildBossEncounterSlot />}
              {showVurmoxDestiny ? <VurmoxDestinySlot /> : <RegionBossEncounterSlot />}
            </div>
            {/*
             * 9eou rev-2 (2026-04-26): the Crystal + Embertide share a
             * single cream parchment pane (`.crystal-embertide-pane`)
             * instead of separate cells. Per user feedback the dark
             * arched niche around the Embertide read as out of place;
             * one shared cream plate matches the trays + always-row
             * cathedral palette and lets both artifacts breathe.
             */}
            {hasPlayers ? (
              <div className="crystal-embertide-pane" data-testid="crystal-embertide-pane">
                <PrincessCrystalCell
                  crystal={state.princessCrystal}
                  phase={state.phase}
                  outcome={state.outcome}
                  activePlayerDowned={active?.downed ?? false}
                  onStrike={strikePrincessCrystal}
                />
                <div className="embertide-hud" data-testid="embertide-hud">
                  <EmbertideStrip shards={state.sharedEmbertide} />
                </div>
              </div>
            ) : null}
            {/*
             * lqg6 (2026-04-26): End Turn migrated from .trays-row to
             * the board-side rail beneath the crystal-embertide pane.
             * Designer feedback — the End Turn CTA reads more clearly
             * as a "commit your turn" anchor on the right rail next
             * to the shared progress artifacts (Embertide + Princess
             * Crystal) than buried alongside the player trays.
             */}
            {/*
             * embertide-4hr1.4 — colosseum entry surface. Sits
             * beneath the crystal-embertide pane on the right rail,
             * above End Turn, so it reads as a destination next to
             * the shared progress artifacts. Returns null when locked
             * (`isColosseumUnlocked === false`) — the entry is
             * invisible until the Sylvani unlock pair has fallen.
             */}
            {hasPlayers ? (
              <ColosseumEntryPane
                unlocked={colosseumUnlocked}
                progression={state.colosseumProgression}
                onEnter={enterColosseum}
              />
            ) : null}
            {hasPlayers ? <RulesBook /> : null}
            {hasPlayers ? (
              <button
                type="button"
                data-testid="end-turn"
                data-touch-target="true"
                className="end-turn-button board-side-end-turn"
                style={END_TURN_STYLE}
                onClick={endTurn}
                disabled={gameOver}
              >
                End Turn
              </button>
            ) : null}
          </div>
        </aside>
      </div>{' '}
      {gameOver
        ? // Portal the game-over overlay to document.body so its
          // `position: fixed` is always resolved against the viewport — not
          // whichever ancestor may later acquire transform/perspective/filter
          // (which would otherwise become the containing block and shrink the
          // overlay to that ancestor's box). See embertide-dxz.
          createPortal(
            <div
              className="winner-overlay"
              data-testid="winner-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Game Over"
            >
              <div
                ref={outcomeBannerRef}
                data-testid="winner-banner"
                className="winner-banner"
                role="alert"
                tabIndex={-1}
              >
                <div className="winner-banner-headline">{outcomeHeadline}</div>
                <div className="winner-banner-body">{outcomeBody}</div>
              </div>
            </div>,
            document.body ?? document.documentElement,
          )
        : null}
      {zoneAdvance
        ? // Portal the zone-advance banner so its fixed-position top-
          // center placement isn't constrained by any transform/filter
          // on a GameBoard ancestor (same rationale as winner-overlay).
          createPortal(
            <ZoneAdvanceBanner
              fromZone={zoneAdvance.fromZone}
              toZone={zoneAdvance.toZone}
              onDismiss={dismissZoneAdvance}
            />,
            document.body ?? document.documentElement,
          )
        : null}
      {lastChestReward
        ? // Portal the chest-reveal backdrop to document.body for the same
          // reason the winner overlay is portaled (embertide-dxz): both
          // are full-screen `position: fixed` overlays, and if any ancestor
          // of game-board later acquires transform/perspective/filter, the
          // backdrop's fixed positioning would be clipped to that ancestor
          // rather than the viewport. See embertide-y2p.
          createPortal(
            <div className="chest-reveal-backdrop" data-testid="chest-reveal-backdrop">
              <ChestReveal
                reward={lastChestReward}
                card={lastChestRewardCard}
                onComplete={clearLastChestReward}
              />
            </div>,
            document.body ?? document.documentElement,
          )
        : null}
      {/*
        v2.1 REQ-9d (embertide-4hz6) + ynn4 die-roll-animation pass
        (2026-04-25): Dungeon Boss onDefeat reward reveal. Mounted ONLY
        when `pendingDungeonBossRoll !== null` AND `lastChestReward
        === null` so the chest reveal takes priority on any kill that
        both popped a chest and rolled the reward. The DieRollReveal
        animates a single die landing on the pre-rolled face; on
        dismiss `commitDungeonBossReward()` applies the outcome and
        clears the surface.
      */}
      {pendingDungeonBossRoll && !lastChestReward
        ? createPortal(
            <DieRollReveal
              face={pendingDungeonBossRoll.face}
              onDismiss={() => commitDungeonBossReward()}
              title="Dungeon Boss Reward"
              outcomeLabel={formatDungeonBossOutcome(pendingDungeonBossRoll.face)}
              dieType="d20"
            />,
            document.body ?? document.documentElement,
          )
        : null}
      {/*
        v2.1 REQ-6 (embertide-gm0.10) + ynn4 die-roll-animation
        pass: Forest-Sage on-play omen reveal. Mounted when
        `pendingForestSageRoll !== null` AND no higher-priority modal
        is up (chest reveal + dungeon-boss roll both preempt so the
        modal stack stays one-deep).
      */}
      {pendingForestSageRoll && !lastChestReward && !pendingDungeonBossRoll
        ? createPortal(
            <DieRollReveal
              face={pendingForestSageRoll.face}
              onDismiss={() => commitForestSageOmen()}
              title="Forest Sage Omen"
              outcomeLabel={formatForestSageOutcome(pendingForestSageRoll.face)}
            />,
            document.body ?? document.documentElement,
          )
        : null}
      {/*
        embertide-91p (b): per-card banish prompt. Renders the
        CardSelectionModal when a `banish-from-hand` EffectSpec
        resolves on play. Tapping a card dispatches `banishFromHand`
        (which clears `pendingBanishChoice`); ESC / backdrop tap fires
        `cancelBanishChoice` so the effect fizzles. The modal portals
        to document.body itself, so no extra wrapper is needed here.
      */}
      {pendingBanishChoice && active
        ? (() => {
            const choosable = active.hand.filter((c) => pendingBanishChoice.cardIds.includes(c.id));
            return (
              <CardSelectionModal
                cards={choosable}
                onSelect={(cardId) => banishFromHand(cardId)}
                onCancel={cancelBanishChoice}
              />
            );
          })()
        : null}
      {/*
        v2.1 combat tutorial bubble (u-8g, PRD §B8). Mounted on the main-
        board branch so `combat-win` / `combat-loss` bubbles — set at
        RESOLVE dispatch and therefore visible AFTER activeCombat goes
        back to null — survive the CombatScreen unmount transition.
      */}
      <CombatTutorialBubble />
      {/*
        gy7n: tap-to-zoom card detail. On touch devices, taps on Field
        / Hand tiles set `zoomedCardCtx` instead of dispatching the
        action directly. The modal renders the full card and routes
        the player's confirmation through `ctx.action()`.
      */}
      {zoomedCardCtx ? (
        <CardDetailModal
          card={zoomedCardCtx.card}
          actionLabel={zoomedCardCtx.actionLabel}
          disabled={zoomedCardCtx.disabled}
          onAction={
            zoomedCardCtx.action
              ? () => {
                  zoomedCardCtx.action?.();
                  setZoomedCardCtx(null);
                }
              : undefined
          }
          onClose={() => setZoomedCardCtx(null)}
        />
      ) : null}
      {/*
        vj6s: full-pile viewer. Tapping the Discard or Void pile opens an
        overlay listing EVERY card in that pile (not just the top), read-
        only with a Close button. Cards are derived live from the store so
        the list reflects the current pile contents.
      */}
      {viewedPile ? (
        <PileViewerModal
          label={viewedPile === 'discard' ? 'Discard' : 'Void'}
          cards={viewedPile === 'discard' ? (active?.discard ?? []) : state.voided}
          onClose={() => setViewedPile(null)}
        />
      ) : null}
    </div>
  );
}
