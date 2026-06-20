import type { JSX } from 'react';
import { GENERIC_BASE_ID_THEME } from '../theme/generic';
import BossAltarPane from './BossAltarPane';
import { BossAltarCleared, BossAltarLocked, BossAltarPhaseLocked } from './BossAltarVariants';
import { BossStamp, bossSlotHpFor } from './BossStamp';
import { useRegionEncounterSlotState } from './useEncounterSlotState';

/**
 * REQ-32 (u-9d) + gm0.12 + rtf4 — Region-boss encounter slot. Pure render
 * over `useRegionEncounterSlotState`; four kinds map 1:1 to BossAltarPane
 * variants (cleared / phase-locked / key-locked / live).
 */
export default function RegionBossEncounterSlot(): JSX.Element {
  const state = useRegionEncounterSlotState();

  switch (state.kind) {
    case 'cleared':
      return (
        <BossAltarPane
          header="REGION BOSS"
          variant="region"
          disabled
          backdropZoneId={state.zoneId}
          ariaLabel="Region encounter — cleared"
          testId="region-boss-slot"
        >
          <BossAltarCleared label="Cleared" />
        </BossAltarPane>
      );
    case 'phase-locked':
      return (
        <BossAltarPhaseLocked
          header="REGION BOSS"
          variant="region"
          unlockTurn={state.unlockTurn}
          backdropZoneId={state.zoneId}
          testId="region-boss-slot-phase-locked"
        />
      );
    case 'key-locked':
      return <BossAltarLocked zoneId={state.zoneId} />;
    case 'live': {
      const name = GENERIC_BASE_ID_THEME[state.card.id] ?? state.card.id;
      const hp = bossSlotHpFor(state.card);
      return (
        <BossAltarPane
          header="REGION BOSS"
          variant="region"
          ariaLabel={`Engage region encounter — ${name}, HP ${hp}`}
          testId="region-boss-slot"
          backdropZoneId={state.zoneId}
          onClick={state.engage}
        >
          <BossStamp card={state.card} />
        </BossAltarPane>
      );
    }
  }
}
