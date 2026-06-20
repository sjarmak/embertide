import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import type { CombatBoss } from '../types/combat';
import { DESPERATION_HP_PCT } from '../core/balance';
import { bossPortraitForBaseId } from './CardArt';
import { nameForBaseId } from './CardTemplate';
import { Sword } from '../icons';
import './CombatBossStage.css';

const DAMAGE_PULSE_MS = 600;

/**
 * Portrait size for the bespoke boss raster (embertide-f3z, nz8-a).
 * Enlarged from the 80px side-panel size to a centerpiece scale. The
 * responsive ceiling (`min(256px, 40vh)`) keeps the portrait dominant on
 * tablets while preventing it from consuming the full viewport on short
 * phones — tuned against a 667px iPhone SE reference.
 *
 * The numeric prop value below is the LOGICAL upper bound consumed by
 * `renderIllustration`; CSS clamps the rendered SVG to `min(256px, 40vh)`
 * via the .combat-boss-stage-portrait rule.
 */
const BOSS_PORTRAIT_LOGICAL_SIZE = 360;

/**
 * Number of jeweled sockets rendered across the HP bar (REQ-33 §D4).
 * Positioned at 20/40/60/80% via `.combat-boss-hp-socket[data-hp-socket-index]`
 * rules in `CombatBossStage.css`. Four sockets echoes the four-quarter
 * HP reading ("boss at 3/4, 1/2, 1/4, dead") without cluttering the bar.
 */
const HP_SOCKET_COUNT = 4;

export interface CombatBossStageProps {
  readonly boss: CombatBoss;
  /**
   * Whose sub-turn is resolving. When `'boss'` the stage surfaces the
   * attack-telegraph banner so the kids can see the incoming hit
   * before it lands (PRD §B3 — legibility > polish).
   */
  readonly activeActor: 'players' | 'boss';
  /**
   * Outstanding boss-stun counter (embertide-d5wm). When `> 0` the
   * intent indicator renders a "Stunned" badge instead of the damage
   * preview because the next boss-turn will be skipped by
   * `reduceBossResolve`. Optional + defaults to 0 so existing call
   * sites and pre-d5wm test fixtures stay valid without churn.
   */
  readonly bossStunTurns?: number;
  /**
   * Per-boss-per-cycle attack name for the telegraph banner
   * (embertide-9lj6). When omitted, the banner falls back to the
   * generic "Boss winds up for N" string. The lookup itself lives in
   * `src/data/bossAttackNames.ts` and is invoked one level up
   * (CombatScreen) so this component stays a pure renderer.
   */
  readonly attackName?: string;
}

/**
 * Compose the "N / M" readout from an hp + hpMax pair. Clamped at 0 to
 * guard against negative hp slipping through from a reducer bug.
 */
function formatHpReadout(hp: number, hpMax: number): string {
  const safeHp = Math.max(0, hp);
  return `${safeHp} / ${hpMax}`;
}

/**
 * Compose the telegraph banner text. embertide-9lj6 (designer
 * ruling 2026-04-25): banner now reads "<Attack> — winds up for N"
 * when the caller supplies a per-boss-per-cycle attack name; falls
 * back to the generic "Boss winds up for N" string when the name is
 * absent (defensive — keeps pre-9lj6 fixtures and unknown-boss
 * fallbacks rendering legibly rather than blowing up).
 */
function formatTelegraph(damage: number, attackName?: string): string {
  const lead = attackName && attackName.length > 0 ? attackName : 'Boss';
  return `${lead} winds up for ${damage}`;
}

/**
 * Boss intent shape for the next boss-turn (embertide-d5wm).
 *
 * Computed from the same inputs `reduceBossResolve` consumes so the
 * UI preview matches what will actually land:
 *
 *   - `kind:'stun'` when `bossStunTurns > 0` — boss-turn will be skipped.
 *   - `kind:'attack'` otherwise — `damage` is the upcoming
 *     `damagePerTurn` and `aoe` flips true when the boss is below the
 *     desperation threshold (matches `effectiveTargeting`).
 *
 * Pure function — no engine state mutation. Mirrors the desperation
 * gate in `core/combatEngine.ts::effectiveTargeting` so any future
 * tuning in `DESPERATION_HP_PCT` updates both call sites uniformly.
 */
type BossIntent =
  | { readonly kind: 'attack'; readonly damage: number; readonly aoe: boolean }
  | { readonly kind: 'stun' };

function computeBossIntent(boss: CombatBoss, bossStunTurns: number): BossIntent {
  if (bossStunTurns > 0) {
    return { kind: 'stun' };
  }
  const aoe = boss.attackPattern.targeting === 'aoe' || boss.hp < DESPERATION_HP_PCT * boss.hpMax;
  return { kind: 'attack', damage: boss.attackPattern.damagePerTurn, aoe };
}

/**
 * CombatBossStage — centerpiece combat surface (PRD §B3, embertide-f3z).
 *
 * Replaces the prior CombatBossPanel side-panel layout with a vertical
 * stage: dominant boss portrait (~256px) framed in a stained-glass arch,
 * with name + HP readout + HP bar + optional telegraph banner stacked
 * below. The solid shadow-700 panel fill is retired — the stage sits
 * transparently on top of the full-viewport zone backdrop landed by
 * nz8-d (embertide-343).
 *
 * Preserves (from CombatBossPanel): damage-pulse animation on the HP bar
 * fill, four jeweled HP sockets at 20/40/60/80%, HP bar `role=progressbar`
 * a11y, telegraph banner with `role=status aria-live=polite`, portrait
 * resolution via `illustrationForBaseId(boss.sourceCardId, ...)`.
 *
 * External testids stay stable: `combat-boss-stage` (formerly
 * `combat-boss-panel`), `combat-boss-hp-bar`, `combat-boss-hp-bar-fill`,
 * `combat-boss-hp-readout`, `combat-boss-hp-socket-\${i}`,
 * `combat-boss-telegraph`, `combat-boss-portrait`, `combat-boss-label`.
 */
export default function CombatBossStage({
  boss,
  activeActor,
  bossStunTurns = 0,
  attackName,
}: CombatBossStageProps): JSX.Element {
  const hpPct = boss.hpMax > 0 ? Math.max(0, Math.min(100, (boss.hp / boss.hpMax) * 100)) : 0;
  const readout = formatHpReadout(boss.hp, boss.hpMax);
  const showTelegraph = activeActor === 'boss';
  const portrait = bossPortraitForBaseId(boss.sourceCardId, BOSS_PORTRAIT_LOGICAL_SIZE);

  // embertide-d5wm — Slay-the-Spire-style intent indicator anchored
  // above the boss portrait. Renders the upcoming boss-turn damage
  // (or a "Stunned" badge if the boss-turn will be skipped) so the
  // player can prep with what they play. Hidden once the boss is
  // dead — the combat is over and there is no next boss-turn.
  const bossDefeated = boss.hp <= 0;
  const intent = computeBossIntent(boss, bossStunTurns);

  // Rev-2 2026-04-22: pulse the HP-bar fill when boss HP decreases so
  // every player hit has a visible impact beat. `data-damaged` is
  // flipped true for ~600ms (DAMAGE_PULSE_MS) then cleared, driving
  // the `.combat-boss-damage-pulse` keyframe animation in the CSS.
  // Purely visual — never mutates engine state.
  const prevHpRef = useRef<number>(boss.hp);
  const [damaged, setDamaged] = useState(false);
  useEffect(() => {
    if (boss.hp < prevHpRef.current) {
      setDamaged(true);
      const t = setTimeout(() => setDamaged(false), DAMAGE_PULSE_MS);
      prevHpRef.current = boss.hp;
      return () => clearTimeout(t);
    }
    prevHpRef.current = boss.hp;
    return undefined;
  }, [boss.hp]);

  return (
    <div
      data-testid="combat-boss-stage"
      data-ornate-frame="true"
      data-damaged={damaged ? 'true' : 'false'}
      className="combat-boss-stage combat-boss-panel"
      aria-label={`Boss hp ${Math.max(0, boss.hp)} of ${boss.hpMax}`}
    >
      <div className="combat-boss-stage-arch">
        {bossDefeated ? null : (
          <div
            data-testid="boss-intent-indicator"
            data-intent-kind={intent.kind}
            data-intent-aoe={intent.kind === 'attack' && intent.aoe ? 'true' : 'false'}
            role="status"
            aria-live="polite"
            aria-label={
              intent.kind === 'stun'
                ? 'Boss is stunned next turn'
                : `Boss will attack for ${intent.damage}${
                    intent.aoe ? ' to all targets' : ''
                  } next turn`
            }
            className="combat-boss-intent"
          >
            {intent.kind === 'stun' ? (
              <span className="combat-boss-intent-stun" aria-hidden="true">
                <span className="combat-boss-intent-icon" aria-hidden="true">
                  {'✨'}
                </span>
                <span className="combat-boss-intent-label">Stunned</span>
              </span>
            ) : (
              <span className="combat-boss-intent-attack" aria-hidden="true">
                <span className="combat-boss-intent-icon" aria-hidden="true">
                  {/* fhzh (2026-04-25): swap unicode ⚔ for the Sword
                      SVG icon — the same 'power' icon used everywhere
                      else (red-shard/red-cost surfaces). The previous
                      glyph rendered as an X to kids. */}
                  <Sword size={20} />
                </span>
                <span data-testid="boss-intent-damage" className="combat-boss-intent-damage">
                  {intent.damage}
                </span>
                {intent.aoe ? (
                  <span data-testid="boss-intent-aoe-badge" className="combat-boss-intent-aoe">
                    AOE
                  </span>
                ) : null}
              </span>
            )}
          </div>
        )}
        <div
          data-testid="combat-boss-portrait"
          className="combat-boss-stage-portrait"
          aria-hidden="true"
        >
          {portrait}
        </div>
      </div>
      <div className="combat-boss-stage-info">
        <div className="combat-boss-stage-header">
          <span data-testid="combat-boss-label" className="combat-boss-stage-name">
            {nameForBaseId(boss.sourceCardId)}
          </span>
          <span data-testid="combat-boss-hp-readout" className="combat-boss-stage-hp-readout">
            {readout}
          </span>
        </div>
        <div
          data-testid="combat-boss-hp-bar"
          role="progressbar"
          aria-valuenow={Math.max(0, boss.hp)}
          aria-valuemin={0}
          aria-valuemax={boss.hpMax}
          className="combat-boss-stage-hp-bar"
        >
          <div
            data-testid="combat-boss-hp-bar-fill"
            className="combat-boss-stage-hp-bar-fill"
            style={{ width: `${hpPct}%` }}
          />
          {Array.from({ length: HP_SOCKET_COUNT }, (_, i) => (
            <span
              key={`hp-socket-${i}`}
              data-testid={`combat-boss-hp-socket-${i}`}
              data-hp-socket-index={i}
              className="combat-boss-hp-socket"
              aria-hidden="true"
            />
          ))}
        </div>
        {showTelegraph ? (
          <div
            data-testid="combat-boss-telegraph"
            role="status"
            aria-live="polite"
            className="combat-boss-stage-telegraph"
          >
            {formatTelegraph(boss.attackPattern.damagePerTurn, attackName)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
