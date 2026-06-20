import type { JSX } from 'react';
import type { CombatBoss } from '../types/combat';
import { isTierUnlocked, type ColosseumProgression, type TierId } from '../core/colosseum';
import { TIER_1_ROSTER } from '../data/colosseum/tier1';
import { TIER_2_ROSTER } from '../data/colosseum/tier2';
import { TIER_3_ROSTER } from '../data/colosseum/tier3';
import { TIER_4_ROSTER } from '../data/colosseum/tier4';
import { TIER_5_ROSTER } from '../data/colosseum/tier5';
import { bossDisplayName } from '../store/combatBootstrap';
import './ColosseumEntryPane.css';

/**
 * Colosseum HUD entry surface (embertide-4hr1.4).
 *
 * Renders a Cathedral-styled entry button + tier-progression preview
 * when the colosseum is unlocked (`isColosseumUnlocked(state) === true`).
 * Returns null when locked — the entry is invisible until the player
 * defeats both Sylvani gating bosses.
 *
 * Preview rows render only the tiers the player has already unlocked
 * (tiers unlock automatically as earlier ones are cleared, so the full
 * 1–5 ladder is redundant). Rendering every future tier overflowed the
 * right rail and pushed the End Turn button off-screen — a playability
 * breaker (embertide-vrqs). Before the first colosseum entry the
 * progression is empty, so we fall back to the entry tier (Tier I) as
 * an "up next" preview rather than rendering a blank pane.
 *
 * Click routing is delegated to the consumer via `onEnter` — the HUD
 * doesn't reach into the store directly so the component stays pure
 * and testable.
 */
export interface ColosseumEntryPaneProps {
  /** True iff `isColosseumUnlocked(state)` returns true. */
  readonly unlocked: boolean;
  /** Per-run tier-progression state read from the store. */
  readonly progression: ColosseumProgression;
  /** Called on entry click — wires to `enterColosseum` in the store. */
  readonly onEnter: () => void;
}

const TIER_ROSTERS: Readonly<Record<TierId, readonly CombatBoss[]>> = {
  1: TIER_1_ROSTER,
  2: TIER_2_ROSTER,
  3: TIER_3_ROSTER,
  4: TIER_4_ROSTER,
  5: TIER_5_ROSTER,
};

const TIER_ORDER: readonly TierId[] = [1, 2, 3, 4, 5];

/** The tier seeded on first colosseum entry — the early-game "up next". */
const ENTRY_TIER: TierId = 1;

const TIER_LABEL: Readonly<Record<TierId, string>> = {
  1: 'Tier I',
  2: 'Tier II',
  3: 'Tier III',
  4: 'Tier IV',
  5: 'Tier V',
};

// Roster preview strings precompute at module load — `TIER_ROSTERS` and
// `bossDisplayName` are static, so render-time recomputation is wasted work.
const TIER_PREVIEW: Readonly<Record<TierId, string>> = {
  1: TIER_ROSTERS[1].map((b) => bossDisplayName(b.sourceCardId)).join(' · '),
  2: TIER_ROSTERS[2].map((b) => bossDisplayName(b.sourceCardId)).join(' · '),
  3: TIER_ROSTERS[3].map((b) => bossDisplayName(b.sourceCardId)).join(' · '),
  4: TIER_ROSTERS[4].map((b) => bossDisplayName(b.sourceCardId)).join(' · '),
  5: TIER_ROSTERS[5].map((b) => bossDisplayName(b.sourceCardId)).join(' · '),
};

export default function ColosseumEntryPane({
  unlocked,
  progression,
  onEnter,
}: ColosseumEntryPaneProps): JSX.Element | null {
  if (!unlocked) return null;

  // Render only unlocked tiers (ascending). Future tiers are omitted —
  // they unlock automatically and rendering the full ladder overflowed
  // the rail (embertide-vrqs). Before first entry nothing is
  // unlocked, so fall back to the entry tier as an "up next" preview.
  const unlockedTiers = TIER_ORDER.filter((tier) => isTierUnlocked(progression, tier));
  const displayTiers = unlockedTiers.length > 0 ? unlockedTiers : [ENTRY_TIER];

  return (
    <button
      type="button"
      data-testid="colosseum-entry-pane"
      data-touch-target="true"
      className="colosseum-entry-pane"
      aria-label="Enter the Colosseum"
      onClick={onEnter}
    >
      <div className="colosseum-entry-pane-header">Colosseum</div>
      <ul className="colosseum-entry-pane-tiers" aria-label="Colosseum tier progression">
        {displayTiers.map((tier) => {
          const tierUnlocked = isTierUnlocked(progression, tier);
          return (
            <li
              key={tier}
              data-testid={`colosseum-tier-row-${tier}`}
              data-unlocked={tierUnlocked ? 'true' : 'false'}
              className="colosseum-entry-pane-tier-row"
            >
              <span className="colosseum-entry-pane-tier-label">{TIER_LABEL[tier]}</span>
              <span className="colosseum-entry-pane-tier-roster">{TIER_PREVIEW[tier]}</span>
            </li>
          );
        })}
      </ul>
    </button>
  );
}
