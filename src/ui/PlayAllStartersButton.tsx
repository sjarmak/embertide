import type { JSX } from 'react';
import type { StoreApi, UseBoundStore } from 'zustand';
import { useGameStore as defaultUseGameStore, currentPlayer } from '../store/gameStore';
import type { GameStore } from '../store/gameStore';

export interface PlayAllStartersButtonProps {
  /**
   * Optional store override. Defaults to the app-level singleton
   * `useGameStore`; supplying a dedicated store makes the component easy
   * to exercise in isolation.
   */
  readonly store?: UseBoundStore<StoreApi<GameStore>>;
}

const TOUCH_TARGET_STYLE = {
  minWidth: 44,
  minHeight: 44,
} as const;

const END_TURN_TARGET_STYLE = {
  minWidth: 88,
  minHeight: 44,
} as const;

/**
 * Convenience button that plays every card in the active player's hand
 * in one tap (issue embertide-2l9; expanded by the play-all-cards
 * follow-up 2026-04-25). Each card is routed through the real
 * `playCard` pipeline so shards, draws, gains, etc. all increment
 * correctly. Cards whose `playCard` invocation throws (e.g., a hero
 * with a green cost the player can't pay) are skipped — the bulk
 * action stops at unplayable cards rather than failing the whole batch.
 *
 * Pre-fix the button only played starter shards; expanding to all
 * cards keeps the one-tap-fast-forward UX our 6yo playtester wanted
 * while letting affordable items / heroes go down on the same tap.
 *
 * IP-safety: label uses the generic "cards" terminology.
 *
 * embertide-0p8c (playtest 2026-05-26): when the hand is empty there
 * are no cards left to play, so the old behaviour rendered a greyed,
 * text-dimmed "Play all cards" button that read as broken. Instead, when
 * no playable actions remain we swap this slot for a lit "End Turn"
 * button so the next action the player needs is obvious and inviting.
 */
export default function PlayAllStartersButton({
  store,
}: PlayAllStartersButtonProps): JSX.Element | null {
  const useStore = store ?? defaultUseGameStore;
  const state = useStore();
  const playCard = useStore((s) => s.playCard);
  const endTurn = useStore((s) => s.endTurn);

  if (state.players.length === 0) return null;

  const active = currentPlayer(state);
  const handIds = active.hand.map((c) => c.id);

  // No cards left in hand → no "play" actions remain. Surface the lit
  // End Turn CTA here rather than a greyed, textless play-all button.
  if (handIds.length === 0) {
    const gameOver = state.outcome !== null;
    return (
      <button
        type="button"
        data-testid="play-all-end-turn"
        data-touch-target="true"
        className="end-turn-button tap-target"
        style={END_TURN_TARGET_STYLE}
        onClick={endTurn}
        disabled={gameOver}
        aria-label="End Turn"
      >
        End Turn
      </button>
    );
  }

  const handleClick = (): void => {
    // Route through playCard one at a time so the store's bookkeeping
    // stays authoritative. Catch per-card failures so unaffordable /
    // unplayable cards don't abort the rest of the bulk play.
    for (const id of handIds) {
      try {
        playCard(id);
      } catch {
        // unplayable in current state — skip and keep going
      }
    }
  };

  return (
    <button
      type="button"
      data-testid="play-all-cards"
      data-touch-target="true"
      className="play-all-starters tap-target"
      style={TOUCH_TARGET_STYLE}
      onClick={handleClick}
      aria-label="Play all cards"
    >
      Play all cards
    </button>
  );
}
