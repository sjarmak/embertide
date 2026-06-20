import { useEffect, useRef, useState, type JSX } from 'react';
import { useGameStore } from '../store/gameStore';
import { COMBAT_PLAYS_PER_TURN } from '../core/balance';
import type { ZoneId } from '../store/types';
import ArtPendingFrame from './ArtPendingFrame';
import CombatBossStage from './CombatBossStage';
import CombatBattlefield from './CombatBattlefield';
import CombatHand from './CombatHand';
import { attackNameFor } from '../data/bossAttackNames';
import { HeartSocket } from './HPStrip';
import { tierForColosseumBoss, type TierId } from '../core/colosseum';
import './CombatScreen.css';

/**
 * REQ-33 (u-10a, PRD §D1) — Per-zone combat arena background map.
 *
 * pr2 (2026-04-23): split into wild / region tiers so wild-boss fights
 * feel like the zone's rough outer approach and region-boss fights feel
 * like the climactic inner sanctum. Regular-monster combat (field
 * entry) shares the wild BG since it's the less-sacred outer ground.
 *
 * u-10b commits the raster files; u-10a wires the resolver. Until the
 * rasters land, every `<img>` will fire `onError` and the ArtPendingFrame
 * fallback stays on screen — the `no-layout-shift` requirement (§D6) is
 * guaranteed by the fallback being an always-mounted peer layer.
 */
type CombatBgTier = 'wild' | 'region';

const ZONE_BACKGROUND_SRC: Record<ZoneId, Record<CombatBgTier, string>> = {
  sylvani: {
    wild: '/illustrations/cathedral_combat_bg_sylvani_wild_001.webp',
    region: '/illustrations/cathedral_combat_bg_sylvani_001.webp',
  },
  'emberpeak': {
    wild: '/illustrations/cathedral_combat_bg_emberpeak_wild_001.webp',
    region: '/illustrations/cathedral_combat_bg_emberpeak_001.webp',
  },
  // gdd.1: Maren combat backgrounds (FAL batch landed 2026-04-25).
  maren: {
    wild: '/illustrations/cathedral_combat_bg_maren_wild_001.webp',
    region: '/illustrations/cathedral_combat_bg_maren_001.webp',
  },
  // gdd.2: Hollow Shrine combat backgrounds (FAL batch landed 2026-04-25).
  'hollow-shrine': {
    wild: '/illustrations/cathedral_combat_bg_hollow_shrine_wild_001.webp',
    region: '/illustrations/cathedral_combat_bg_hollow_shrine_001.webp',
  },
  // gdd.3: Dune Sanctum combat backgrounds (FAL batch landed 2026-04-25).
  'dune-sanctum': {
    wild: '/illustrations/cathedral_combat_bg_dune_sanctum_wild_001.webp',
    region: '/illustrations/cathedral_combat_bg_dune_sanctum_001.webp',
  },
  'gilded-cage': {
    wild: '/illustrations/cathedral_combat_bg_gilded_cage_wild_001.webp',
    region: '/illustrations/cathedral_combat_bg_gilded_cage_001.webp',
  },
};

/**
 * Per-tier colosseum combat backdrop map (embertide-y3no, widened
 * to the full 5-tier set in embertide-wacl).
 *
 * The colosseum mode hosts boss-rush combat on a dedicated visual
 * surface separate from the per-zone arenas. The 5-tier raster set
 * was generated 2026-05-05 per the designer ruling
 * (`bd memories embertide-designer-ruling-colosseum-bg-tiers-2026-05-05`)
 * and ships all 5 webp files; the type `Record<TierId, string>` keeps
 * this map exhaustive — adding a new tier to `TierId` forces an entry
 * here at compile time.
 */
const COLOSSEUM_BACKGROUND_SRC: Record<TierId, string> = {
  1: '/illustrations/cathedral_colosseum_bg_tier1_001.webp',
  2: '/illustrations/cathedral_colosseum_bg_tier2_001.webp',
  3: '/illustrations/cathedral_colosseum_bg_tier3_001.webp',
  4: '/illustrations/cathedral_colosseum_bg_tier4_001.webp',
  5: '/illustrations/cathedral_colosseum_bg_tier5_001.webp',
};

/**
 * Module-level dedupe set for combat-background load failures. Mirrors
 * the pattern used in `BossAltarPane`: warn once per unique src for the
 * whole session, not once per mount.
 */
const warnedBackgroundSrcs = new Set<string>();

function warnBackgroundLoadFailure(src: string): void {
  if (warnedBackgroundSrcs.has(src)) return;
  warnedBackgroundSrcs.add(src);
  console.warn(`[combat-screen] background raster failed to load: ${src}`);
}

/**
 * Module-level dedupe set for unknown-colosseum-boss warnings. Same
 * shape as `warnedBackgroundSrcs` so a single bad save-file or hot-fix
 * boss only logs once per session.
 */
const warnedUnknownColosseumBosses = new Set<string>();

function warnUnknownColosseumBoss(sourceCardId: string): void {
  if (warnedUnknownColosseumBosses.has(sourceCardId)) return;
  warnedUnknownColosseumBosses.add(sourceCardId);
  console.warn(
    `[combat-screen] colosseum-slot combat with unrecognised boss sourceCardId: ${sourceCardId} (falling back to zone backdrop)`,
  );
}

/** Test-only escape hatch to clear the dedupe sets between cases. */
export function __resetBackgroundWarnings(): void {
  warnedBackgroundSrcs.clear();
  warnedUnknownColosseumBosses.clear();
}

/**
 * String-typed combat action shape. u-8c will add the reducer side; this
 * module only needs to MINT the action value and forward it to whatever
 * dispatcher is wired (store method, test spy, or no-op stub).
 */
export type CombatScreenAction =
  | { readonly type: 'PLAYER_PLAY_CARD'; readonly cardId: string }
  | { readonly type: 'PLAYER_PASS' }
  | { readonly type: 'COMBAT_ENTER' };

export interface CombatScreenProps {
  /**
   * Optional dispatcher override — primarily for tests. When omitted,
   * CombatScreen resolves `dispatchCombatAction` from the store at
   * call-time; u-8c will add that method. If neither is present the
   * dispatch no-ops safely (the button click still fires; u-8c wires
   * the reducer downstream).
   */
  readonly dispatchCombatAction?: (action: CombatScreenAction) => void;
}

/*
 * Layout classes moved to src/ui/CombatScreen.css (embertide-343,
 * nz8-d). The zone raster is now a full-viewport absolute-fill layer
 * behind the arena column rather than a scoped 96px strip at the top
 * of the screen. See CombatScreen.css for .combat-screen / .combat-bg /
 * .combat-bg-scrim / .combat-arena rules.
 */

/**
 * nz8-d designer feedback 2026-04-24: combat HP row shares the same
 * ruby-gradient HeartSocket pip glyph as the main-board HPStrip
 * (exported from HPStrip.tsx). The bespoke cathedral vital-ember
 * raster that shipped in embertide-9o9 felt visually inconsistent
 * with the main-board strip; consolidating to the pip keeps the HP
 * language identical across surfaces. 18px matches the compact combat
 * header proportions.
 */
const COMBAT_HEART_SIZE = 18;

/**
 * CombatScreen — full-viewport combat surface (PRD §B1). Mounted by
 * GameBoard when `state.activeCombat !== null`; returns `null`
 * otherwise. Owns the single store subscription for the combat slice
 * and forwards props into its three presentational children (boss
 * stage, battlefield, hand).
 *
 * Art: uses ArtPendingFrame for the background; a follow-up bead
 * (`u-8f-art`) tracks the finalized combat raster.
 *
 * nz8 rev-2 (2026-04-24): the text CombatLog was retired as UI clutter
 * per designer feedback — damage/play feedback now reads from animations
 * (HP bar damage pulse, battlefield hp chip updates, hand size
 * decrement) rather than plain-language event strings. The store still
 * populates `CombatState.combatLog` (wired via dispatchCombatAction's
 * describeAction helper) so debugging + future reinstatement remain
 * cheap; the array is simply unread by the UI layer.
 *
 * Tutorial (u-8g, PRD §B8): wires three in-combat event triggers
 * (card-played, boss-turn transition) via `fireCombatTutorialBubble`
 * from the store. Combat-entry, combat-win, and combat-loss are
 * driven by the reducer side (dispatchCombat) so the win / loss
 * bubbles survive the CombatScreen unmount on `activeCombat → null`.
 */
export default function CombatScreen({
  dispatchCombatAction,
}: CombatScreenProps = {}): JSX.Element | null {
  const combat = useGameStore((s) => s.activeCombat);
  const players = useGameStore((s) => s.players);
  const currentZone = useGameStore((s) => s.currentZone);
  const fireBubble = useGameStore((s) => s.fireCombatTutorialBubble);

  // u-10a (REQ-33 §D1/§D6): track whether the zone-specific raster has
  // loaded or errored. Both states keep the wrapper div dimensions
  // stable — the ArtPendingFrame is mounted as a fallback peer ONLY
  // while the raster is still pending (not-yet-loaded). Once the raster
  // loads successfully the ribbon is unmounted so it doesn't persist on
  // top of the final art (embertide-y5x).
  const [backgroundFailed, setBackgroundFailed] = useState(false);
  const [backgroundLoaded, setBackgroundLoaded] = useState(false);

  // Track previous combat-hand size + activeActor to detect in-combat
  // transitions (card played, players → boss turn). Refs persist across
  // renders without forcing extra re-renders of child components.
  const prevHandSizeRef = useRef<number | null>(null);
  const prevActiveActorRef = useRef<'players' | 'boss' | null>(null);
  // Fire each combat-teaching bubble at MOST once per combat instance.
  // The CombatScreen unmounts when activeCombat → null, so a fresh
  // combat gets a fresh CombatScreen mount = fresh refs = bubbles fire
  // again. Prevents "every card play pops a tutorial" regression.
  const cardPlayedFiredRef = useRef(false);
  const bossTurnFiredRef = useRef(false);

  const handSize = combat?.combatHand.length ?? null;
  const activeActor = combat?.activeActor ?? null;

  useEffect(() => {
    // Detect a card-play transition: the hand size strictly decreased
    // since the last render. Skip the initial observation (prev === null)
    // so the mount event doesn't false-positive as a play. Fire the
    // teaching bubble only ONCE per combat (first play teaches the
    // mechanic; subsequent plays don't need the same bubble).
    const prev = prevHandSizeRef.current;
    if (prev !== null && handSize !== null && handSize < prev && !cardPlayedFiredRef.current) {
      fireBubble('combat-card-played');
      cardPlayedFiredRef.current = true;
    }
    prevHandSizeRef.current = handSize;
  }, [handSize, fireBubble]);

  useEffect(() => {
    // Detect a players → boss handoff. Fire once per combat — the
    // progressive-disclosure gate in pickCombatBubble already gates
    // this to second+ combats, but within a combat we don't want the
    // same bubble on every boss turn.
    const prev = prevActiveActorRef.current;
    if (prev === 'players' && activeActor === 'boss' && !bossTurnFiredRef.current) {
      fireBubble('combat-boss-turn');
      bossTurnFiredRef.current = true;
    }
    prevActiveActorRef.current = activeActor;
  }, [activeActor, fireBubble]);

  // pr2: pick the arena tier from the combat-entry path. region-boss
  // slot → reverent inner sanctum; everything else (wild-boss slot or
  // a field regular-monster) → the rougher outer wild arena. Resolved
  // up here (before the early-return) so the src-change useEffect can
  // sit above the null-guard and obey the rules-of-hooks ordering.
  //
  // y3no: colosseum-slot combats override the zone-keyed map with the
  // dedicated per-tier colosseum backdrop. Tier is recovered from the
  // boss's sourceCardId via the slot router's reverse lookup; null is
  // a defensive escape for any boss not in a tier roster (shouldn't
  // happen in practice — slotRouter populates from the rosters). When
  // the defensive path fires, warn once per unique sourceCardId so
  // hot-fix bosses or save-file forward-compat regressions surface in
  // the console rather than silently rendering the zone backdrop.
  const colosseumTier: TierId | null =
    combat?.entryContext.entrySource === 'colosseum-slot'
      ? tierForColosseumBoss(combat.boss.sourceCardId)
      : null;
  if (combat?.entryContext.entrySource === 'colosseum-slot' && colosseumTier === null) {
    warnUnknownColosseumBoss(combat.boss.sourceCardId);
  }
  const bgTier: CombatBgTier =
    combat?.entryContext.entrySource === 'region-boss-slot' ? 'region' : 'wild';
  const backgroundSrc =
    colosseumTier !== null
      ? COLOSSEUM_BACKGROUND_SRC[colosseumTier]
      : ZONE_BACKGROUND_SRC[currentZone][bgTier];

  // embertide-y5x: if the resolved raster src changes mid-session
  // (zone advance, boss-tier swap) reset the loaded/failed flags so
  // the ArtPendingFrame ribbon surfaces while the new raster loads,
  // and an error on the new src is recaptured.
  useEffect(() => {
    setBackgroundLoaded(false);
    setBackgroundFailed(false);
  }, [backgroundSrc]);

  if (combat === null) return null;

  const handlePlayCard = (cardId: string): void => {
    const action: CombatScreenAction = { type: 'PLAYER_PLAY_CARD', cardId };
    if (dispatchCombatAction) {
      dispatchCombatAction(action);
      return;
    }
    // Store-side dispatchCombatAction takes a CombatTurnAction which
    // requires a playerId; use the first attacker from entryContext.
    const playerId = combat.entryContext.attackerPlayerIds[0] ?? 'p0';
    const state = useGameStore.getState() as {
      readonly dispatchCombatAction?: (a: unknown) => void;
    };
    state.dispatchCombatAction?.({ type: 'PLAYER_PLAY_CARD', cardId, playerId });
  };

  const handlePass = (): void => {
    if (dispatchCombatAction) {
      dispatchCombatAction({ type: 'PLAYER_PASS' });
      return;
    }
    const state = useGameStore.getState() as {
      readonly dispatchCombatAction?: (a: unknown) => void;
    };
    state.dispatchCombatAction?.({ type: 'PLAYER_PASS' });
  };

  const playsThisTurn = combat.playsThisTurn ?? 0;
  const capReached = playsThisTurn >= COMBAT_PLAYS_PER_TURN;
  const isPlayersTurn = combat.activeActor === 'players';
  const handEmpty = combat.combatHand.length === 0;
  const mustPass = isPlayersTurn && (capReached || handEmpty);

  // Block card plays when the per-turn cap is reached so clicks don't
  // silently no-op. The hand renders disabled; the Pass Turn button
  // takes over as the required next action.
  const handlePlayCardGuarded =
    capReached || !isPlayersTurn
      ? () => {
          /* cap reached — ignore further plays until Pass Turn */
        }
      : handlePlayCard;

  return (
    <div
      data-testid="combat-screen"
      className="combat-screen"
      data-bg-loaded={backgroundLoaded ? 'true' : 'false'}
    >
      {/*
       * Backdrop layer — full-viewport absolute-fill behind the arena.
       * Hosts the ArtPendingFrame fallback (mounted as a peer so the
       * wrapper's dimensions stay stable while the raster is loading or
       * errored), the zone <img>, and the legibility scrim. Retains the
       * legacy `combat-bg-slot` testid so the no-layout-shift + raster-
       * failure assertions in CombatScreen.test.tsx still resolve.
       */}
      <div className="combat-bg" data-testid="combat-bg-slot">
        {!backgroundLoaded ? (
          <ArtPendingFrame testIdSuffix="combat-bg" followUpBeadId="u-8f-art" />
        ) : null}
        {backgroundSrc && !backgroundFailed ? (
          <img
            src={backgroundSrc}
            alt=""
            aria-hidden="true"
            draggable={false}
            data-testid="combat-bg-image"
            data-zone={currentZone}
            data-colosseum-tier={colosseumTier !== null ? String(colosseumTier) : undefined}
            loading="lazy"
            decoding="async"
            className="combat-bg-image"
            onLoad={() => {
              setBackgroundLoaded(true);
            }}
            onError={() => {
              warnBackgroundLoadFailure(backgroundSrc);
              setBackgroundFailed(true);
              setBackgroundLoaded(false);
            }}
          />
        ) : null}
        <div className="combat-bg-scrim" aria-hidden="true" />
      </div>
      <div className="combat-arena">
        {/* Player hearts row — main-board tray is unmounted during
            combat, so surface per-player HP + downed state here.
            Kid-legible: each player shows a heart + NAME · HP/MAX,
            with a red "DOWN" chip when downed. */}
        <div data-testid="combat-player-hp-row" className="combat-player-hp-row">
          <span className="combat-player-hp-row-label">Hearts</span>
          {players.map((p) => {
            // Render each HP slot as a HeartSocket pip shared with the
            // main-board HPStrip (ruby-gradient shard for filled,
            // outline for empty; cracked overlay when downed). The
            // wrapper span preserves the `combat-player-hp-heart-${id}-${i}`
            // testid so CombatScreen.test.tsx's per-slot data-filled
            // assertions still resolve.
            const hearts: JSX.Element[] = [];
            for (let i = 0; i < p.hpMax; i += 1) {
              const filled = i < p.hp;
              hearts.push(
                <span
                  key={i}
                  data-testid={`combat-player-hp-heart-${p.id}-${i}`}
                  data-filled={filled ? 'true' : 'false'}
                  aria-hidden="true"
                  style={{
                    display: 'inline-flex',
                    width: COMBAT_HEART_SIZE,
                    height: COMBAT_HEART_SIZE,
                    lineHeight: 0,
                  }}
                >
                  <HeartSocket
                    playerId={p.id}
                    index={i}
                    filled={filled}
                    downed={p.downed}
                    size={COMBAT_HEART_SIZE}
                  />
                </span>,
              );
            }
            return (
              <div
                key={p.id}
                data-testid={`combat-player-hp-${p.id}`}
                data-downed={p.downed ? 'true' : 'false'}
                className="combat-player-hp-chip"
              >
                <span
                  data-testid={`combat-player-hp-hearts-${p.id}`}
                  role="img"
                  aria-label={`hp ${p.hp} of ${p.hpMax}`}
                  className="combat-player-hp-hearts"
                >
                  {hearts}
                </span>
                <span className="combat-player-hp-name">{p.name}</span>
                <span
                  data-testid={`combat-player-hp-readout-${p.id}`}
                  className="combat-player-hp-readout"
                >
                  {p.hp} / {p.hpMax}
                </span>
                {p.downed ? <span className="combat-player-hp-downed-chip">DOWN</span> : null}
              </div>
            );
          })}
        </div>
        <CombatBossStage
          boss={combat.boss}
          activeActor={combat.activeActor}
          bossStunTurns={combat.bossStunTurns ?? 0}
          attackName={attackNameFor(combat.boss, {
            turnIndex: combat.turnIndex,
            tideGaugeSnapshot: combat.tideGaugeSnapshot,
            echoQueue: combat.echoQueue,
          })}
        />
        <CombatBattlefield battlefield={combat.battlefield} />
        <div
          data-testid="combat-plays-counter"
          className="combat-plays-counter"
          data-cap-reached={capReached ? 'true' : 'false'}
        >
          Plays this turn: {playsThisTurn}/{COMBAT_PLAYS_PER_TURN}
          {mustPass ? ' — End Turn to face the boss' : ''}
        </div>
        <CombatHand cards={combat.combatHand} onPlayCard={handlePlayCardGuarded} />
        <div className="combat-pass-turn-row">
          {/*
           * embertide-d5wm — explicit "End Turn → Boss Strikes"
           * button. The handoff is intentionally manual (NOT auto) so
           * the player retains agency to skip remaining plays / hold
           * the line; the boss-intent indicator above the portrait
           * tells them exactly what they're walking into. data-must-pass
           * surfaces the cap/empty-hand pressure state for QA + the
           * playtester pulse-glow style. Keyboard-accessible via the
           * native button + space/enter.
           */}
          <button
            type="button"
            data-testid="combat-pass-turn"
            data-must-pass={mustPass ? 'true' : 'false'}
            className="end-turn-button combat-pass-turn-button"
            onClick={handlePass}
            disabled={!isPlayersTurn}
          >
            {isPlayersTurn ? 'End Turn → Boss Strikes' : 'Boss Turn…'}
          </button>
        </div>
      </div>
    </div>
  );
}
