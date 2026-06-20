import type { JSX } from 'react';
import { motion } from 'framer-motion';
import { GreenRupee, Key, Chest, Sword } from '../icons';
import type { KidPlayer, Phase } from '../store/types';
import HPStrip from './HPStrip';
import ChampionSlot from './ChampionSlot';
import ItemsBagChip from './ItemsBagChip';

export interface PlayerTrayProps {
  readonly player: KidPlayer;
  readonly isActive: boolean;
  /**
   * Is THIS tray rendering the teammate (non-viewing) player? When true
   * and `player.downed` the HPStrip will surface a Revive button wired to
   * `onRevive`. See HPStrip for the full availability matrix.
   */
  readonly isTeammateView?: boolean;
  /** Fires when the viewer clicks Revive on this tray's HPStrip. */
  readonly onRevive?: () => void;
  /**
   * Current turn phase — gates the HPStrip's Revive button. Revive only
   * works in 'Main' phase; the store throws otherwise, so the button
   * mirrors the guard as a disabled state.
   */
  readonly phase: Phase;
  /**
   * Has the ACTIVE (reviving) player already revived this incident?
   * Forwarded through to HPStrip so the Revive button reflects the
   * per-incident budget.
   */
  readonly activePlayerRevivedThisIncident: boolean;
  /**
   * 35rv (2026-04-26): id of the currently-downed teammate (or null).
   * Forwarded to the active player's items-bag-chip popover so the
   * wisp cell's tap-to-use button can target them. Only meaningful
   * when this tray is the active player.
   */
  readonly downedTeammateId?: string | null;
  /** 35rv: tap-to-use dispatcher for the wisp. Active player only. */
  readonly onPlayFairy?: (teammateId: string) => void;
}

const COUNTER_SPRING = {
  type: 'spring' as const,
  duration: 0.3,
};

const COUNTER_INITIAL = { scale: 1.3 };
const COUNTER_ANIMATE = { scale: 1 };

/**
 * Compact status display for a single player. Shows HP (via HPStrip),
 * shards, power, keys, chest count, and the Items-zone count (renamed
 * from Constructs per u-2d).
 *
 * Each numeric counter is wrapped in a `motion.span` keyed on its current
 * value. When the number changes React remounts the span, which triggers a
 * one-shot spring "pulse" drawing the player's eye to the delta (issue
 * embertide-2l9).
 *
 * v2 u-2a: the legacy `tray-counter-hearts` block (Heart icon + numeric HP
 * counter + ephemeral HeartFeedback +N tag) is replaced by <HPStrip />,
 * which is hpMax-aware and renders per-shard sockets + the downed state +
 * the revive affordance for teammate-view trays. The `tray-hearts-{id}`
 * testid is retired; callers must use the new `hp-strip-{id}` surface.
 */
export default function PlayerTray({
  player,
  isActive,
  isTeammateView = false,
  onRevive,
  phase,
  activePlayerRevivedThisIncident,
  downedTeammateId = null,
  onPlayFairy,
}: PlayerTrayProps): JSX.Element {
  return (
    <div
      className={`tray${isActive ? ' tray-active' : ''}`}
      data-testid={`player-tray-${player.id}`}
      data-active={isActive ? 'true' : 'false'}
    >
      <div className="tray-header">
        <strong>{player.name}</strong>
      </div>
      <HPStrip
        player={player}
        isActive={isActive}
        isTeammateView={isTeammateView}
        onRevive={onRevive}
        phase={phase}
        activePlayerRevivedThisIncident={activePlayerRevivedThisIncident}
      />
      <ChampionSlot player={player} isActive={isActive} />
      <div className="tray-counters">
        <span className="tray-counter" aria-label="green">
          <GreenRupee size={24} />
          <motion.span
            key={player.green}
            data-testid={`tray-green-${player.id}`}
            initial={COUNTER_INITIAL}
            animate={COUNTER_ANIMATE}
            transition={COUNTER_SPRING}
          >
            {player.green}
          </motion.span>
        </span>
        <span className="tray-counter" aria-label="power">
          <Sword size={24} />
          <motion.span
            key={player.red}
            data-testid={`tray-red-${player.id}`}
            initial={COUNTER_INITIAL}
            animate={COUNTER_ANIMATE}
            transition={COUNTER_SPRING}
          >
            {player.red}
          </motion.span>
        </span>
        <span className="tray-counter" aria-label="chests-opened">
          <Chest size={24} />
          <span data-testid={`tray-chests-${player.id}`}>{player.chestsOpened}</span>
        </span>
        <span className="tray-counter" aria-label="keys">
          <Key size={24} />
          <motion.span
            key={player.keys}
            data-testid={`tray-keys-${player.id}`}
            initial={COUNTER_INITIAL}
            animate={COUNTER_ANIMATE}
            transition={COUNTER_SPRING}
          >
            {player.keys}
          </motion.span>
        </span>
        {/*
         * arq3 (2026-04-26): items button moved up into the tray-counters
         * row alongside the chest counter (was its own row 4 below). This
         * collapses the player tray from 4 grid rows to 3 — the pane is
         * shorter and the chest icon + items button sit side-by-side.
         * Each player has their OWN items button (35rv 2026-04-26): only
         * the active player's chip is interactive (taps open the popover);
         * non-active trays render a disabled chip so the tray grid stays
         * consistent across seats. Wisp tap-to-use routing on the active
         * chip uses `downedTeammateId` + `onPlayFairy` from GameBoard.
         */}
        <span className="tray-counter tray-counter-items" aria-label="items">
          <ItemsBagChip
            cards={player.items}
            playerId={player.id}
            interactive={isActive}
            downedTeammateId={isActive ? downedTeammateId : null}
            onPlayFairy={isActive ? onPlayFairy : undefined}
          />
        </span>
      </div>
    </div>
  );
}
