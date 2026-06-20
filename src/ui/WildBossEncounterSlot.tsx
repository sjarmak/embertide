import type { JSX } from 'react';
import { GENERIC_BASE_ID_THEME } from '../theme/generic';
import BossAltarPane from './BossAltarPane';
import { BossAltarCleared, BossAltarDormant } from './BossAltarVariants';
import { BossStamp, bossSlotHpFor } from './BossStamp';
import { useWildEncounterSlotState } from './useEncounterSlotState';

/**
 * REQ-32 (u-9d) + REQ-19 gm0.9 — Wild-boss encounter slot.
 *
 * Pure render over the discriminated state from `useWildEncounterSlotState`.
 * Three render branches map 1:1 to the union kinds — dormant (gm0.9 cue
 * with stir-turn subline), cleared (defeated placeholder), and live
 * (engage on tap).
 */
export default function WildBossEncounterSlot(): JSX.Element {
  const state = useWildEncounterSlotState();

  switch (state.kind) {
    case 'dormant':
      return (
        <BossAltarPane
          header="MINI BOSS"
          variant="wild"
          disabled
          ariaLabel={`Mini boss — dormant (${state.phaseLabel} phase), stirs at Turn ${state.unlockTurn}`}
          testId="wild-boss-slot-dormant"
        >
          <BossAltarDormant label="Dormant" unlockTurn={state.unlockTurn} />
        </BossAltarPane>
      );
    case 'cleared':
      return (
        <BossAltarPane
          header="MINI BOSS"
          variant="wild"
          disabled
          ariaLabel="Mini boss — cleared"
          testId="wild-boss-slot"
        >
          <BossAltarCleared label="Cleared" />
        </BossAltarPane>
      );
    case 'live': {
      const name = GENERIC_BASE_ID_THEME[state.card.id] ?? state.card.id;
      const hp = bossSlotHpFor(state.card);
      return (
        <BossAltarPane
          header="MINI BOSS"
          variant="wild"
          ariaLabel={`Engage mini boss — ${name}, HP ${hp}`}
          testId="wild-boss-slot"
          backdropZoneId={state.zoneId}
          onClick={state.engage}
        >
          <BossStamp card={state.card} />
        </BossAltarPane>
      );
    }
  }
}
