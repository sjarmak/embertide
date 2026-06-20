import type { JSX } from 'react';
import type { Card } from '../types/card';
import { GENERIC_BASE_ID_THEME } from '../theme/generic';
import { baseIdOf } from '../data/cards';
import { tierCombatHpFor } from '../core/bossHp';
import { bossHpFor } from '../data/bossAttackPatterns';
import { illustrationForCard } from './CardArt';

/**
 * HP displayed on the altar slot readout.
 *
 * embertide-3dc (rev-2 2026-04-22) — routes through `bossHpFor`
 * (the per-boss `BOSS_HP` tune) first so the altar label matches the
 * HP the player will actually face in combat. Before this fix, every
 * tuned boss had an altar / combat mismatch: Craghorn showed HP 8 on
 * the altar but combat opened at HP 10; Prism Chimera showed
 * HP 8 but combat opened at HP 24 (the alarming edge case).
 *
 * Contract mirrors `defaultCombatHpFor` in `gameStore.ts`:
 *   1. Per-boss `BOSS_HP` tune (`bossHpFor`) if present.
 *   2. Tier fallback (`tierCombatHpFor`) — wild=8, region=12.
 */
export function bossSlotHpFor(card: Card): number {
  const tuned = bossHpFor(card.id);
  if (tuned !== null) return tuned;
  return tierCombatHpFor(card);
}

export interface BossStampProps {
  readonly card: Card;
}

/**
 * Shared "boss stamp" interior used by every slot that renders a live
 * encounter — displays the boss art, display name, and starting HP row.
 * Exported so the per-variant slot components (Wild / Region / Vurmox)
 * can reuse a single interior without redeclaring layout.
 */
export function BossStamp({ card }: BossStampProps): JSX.Element {
  const name = GENERIC_BASE_ID_THEME[baseIdOf(card)] ?? card.id;
  const hp = bossSlotHpFor(card);
  const art = illustrationForCard(card, 96);

  return (
    <>
      <div className="boss-altar-pane-art" data-testid={`boss-altar-pane-art-${card.id}`}>
        {art}
      </div>
      <div className="boss-altar-pane-name" data-testid="boss-altar-pane-name">
        {name}
      </div>
      <div className="boss-altar-pane-hp" data-testid="boss-altar-pane-hp">
        {`HP ${hp}`}
      </div>
    </>
  );
}
