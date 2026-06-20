import { useEffect, type JSX } from 'react';
import { useGameStore } from '../store/gameStore';
import { currentRegionBossForZone } from '../rules/zones';
import { KID_CARDS } from '../data/cards';
import { GENERIC_BASE_ID_THEME } from '../theme/generic';
import BossAltarPane from './BossAltarPane';
import { BossAltarCleared } from './BossAltarVariants';
import { BossStamp, bossSlotHpFor } from './BossStamp';

const VURMOX_ID = 'cagewright-vurmox';
const TEMPLE_ZONE = 'gilded-cage' as const;

/**
 * REQ-32 (u-9d) — Vurmox DESTINY slot.
 *
 * Visually distinct successor to `<RegionBossEncounterSlot />` for the
 * Gilded Cage endgame: the purple-to-gold gradient border, persistent
 * flame animation, bespoke Vurmox ornament raster, and pulsing gold aura
 * flag the final encounter so kids can see the shift in stakes at a
 * glance. (The earlier 1.5× footprint was reverted in the 2026-04-22
 * Round 2 polish because it overflowed the altar row.)
 *
 * Mount contract: `<GameBoard />` only mounts this component when
 *     state.currentZone === 'gilded-cage'
 *     AND state.defeatedBossIds ⊇ { 'sentinel', 'silver-chimera' }
 * i.e. both Temple wild bosses are cleared. The slot nevertheless
 * defensively checks `currentRegionBossForZone` and falls back to a
 * cleared placeholder if Vurmox has been defeated. Tap dispatches
 * `engageRegionBossSlot('gilded-cage', 'cagewright-vurmox')` — the
 * same store action as the region-boss slot; only the visual treatment
 * differs.
 */
export default function VurmoxDestinySlot(): JSX.Element {
  const bossId = useGameStore((s) => currentRegionBossForZone(s, TEMPLE_ZONE));
  const engage = useGameStore((s) => s.engageRegionBossSlot);
  const fireTutorialBubbleOnce = useGameStore((s) => s.fireTutorialBubbleOnce);

  // REQ-32 (u-9e) — Destiny slot only mounts when the Gilded Cage is
  // active AND both Temple wild bosses are cleared, so this effect
  // firing means the spec's Temple+wilds-cleared condition is satisfied.
  useEffect(() => {
    if (bossId !== null) {
      fireTutorialBubbleOnce('destiny-slot-revealed');
    }
  }, [bossId, fireTutorialBubbleOnce]);

  const card = bossId === VURMOX_ID ? KID_CARDS.find((c) => c.id === VURMOX_ID) : undefined;
  const cleared = !card;

  if (cleared) {
    return (
      <BossAltarPane
        header="DESTINY"
        variant="destiny"
        disabled
        backdropZoneId={TEMPLE_ZONE}
        ariaLabel="Destiny — fulfilled"
        testId="vurmox-destiny-slot"
      >
        <BossAltarCleared label="Fulfilled" />
      </BossAltarPane>
    );
  }

  const name = GENERIC_BASE_ID_THEME[card.id] ?? card.id;
  const hp = bossSlotHpFor(card);

  return (
    <BossAltarPane
      header="DESTINY"
      variant="destiny"
      backdropZoneId={TEMPLE_ZONE}
      ariaLabel={`Face destiny — ${name}, HP ${hp}`}
      testId="vurmox-destiny-slot"
      onClick={() => engage(TEMPLE_ZONE, VURMOX_ID)}
    >
      <BossStamp card={card} />
    </BossAltarPane>
  );
}
