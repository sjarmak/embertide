import type { JSX } from 'react';
import type { BattlefieldCard } from '../types/combat';
import type { Card } from '../types/card';
import { ALWAYS_AVAILABLE, KID_CARDS } from '../data/cards';
import CardTemplate, { cardDisplayName } from './CardTemplate';
import { effectFor } from './effectText';
import './CombatBattlefield.css';

export interface CombatBattlefieldProps {
  readonly battlefield: readonly BattlefieldCard[];
}

/**
 * Illustration size inside CardTemplate for battlefield minions. Slightly
 * smaller than the combat hand tiles (96px) because the battlefield row is
 * a compact horizontal strip in front of the boss stage; the minions need
 * to read without dominating the vertical space.
 */
const BATTLEFIELD_ILLUSTRATION_SIZE = 72;

/**
 * Resolve a `BattlefieldCard.cardId` to the authoring Card so the UI can
 * render its display name + illustration. The engine stores `baseIdOf(card)`
 * in `cardId` at play time (see `combatEngine.applyPlayerEffect`), so we
 * look up in both the main registry (`KID_CARDS`) and the always-available
 * templates (`ALWAYS_AVAILABLE`). Returns `undefined` when the id does not
 * resolve — callers fall back to the raw cardId text so unexpected values
 * still render something rather than crashing.
 */
function resolveBattlefieldCard(cardId: string): Card | undefined {
  const fromRegistry = KID_CARDS.find((c) => c.id === cardId);
  if (fromRegistry) return fromRegistry;
  return ALWAYS_AVAILABLE.find((c) => c.id === cardId);
}

/**
 * CombatBattlefield — horizontal row of active battlefield minions. Each
 * tile shows the card's full stained-glass face via the shared CardTemplate
 * plus an overlaid `hp N / M` chip so players see live damage absorption
 * at a glance (PRD §B5 — front-to-back damage absorption).
 *
 * embertide-9u1 (nz8-c): replaces the previous flat 48px-art + name
 * tile with CardTemplate so battlefield minions read as the same cards
 * players purchased. Unresolvable cardIds (defensive path) still render a
 * raw-text tile so a future reducer bug doesn't crash the render tree.
 */
export default function CombatBattlefield({ battlefield }: CombatBattlefieldProps): JSX.Element {
  if (battlefield.length === 0) {
    return (
      <div
        data-testid="combat-battlefield"
        data-ornate-frame="true"
        className="combat-battlefield combat-battlefield-empty-wrap"
      >
        <span data-testid="combat-battlefield-empty" className="combat-battlefield-empty">
          No defenders
        </span>
      </div>
    );
  }

  return (
    <div data-testid="combat-battlefield" data-ornate-frame="true" className="combat-battlefield">
      {battlefield.map((card) => {
        const resolved = resolveBattlefieldCard(card.cardId);
        const displayName = resolved ? cardDisplayName(resolved) : card.cardId;
        const hpText = `${Math.max(0, card.hp)} / ${card.hpMax}`;
        const ariaLabel = `${displayName} hp ${Math.max(0, card.hp)} of ${card.hpMax}`;
        return (
          <div
            key={card.cardId}
            data-testid={`combat-battlefield-card-${card.cardId}`}
            className="combat-battlefield-card"
            aria-label={ariaLabel}
          >
            {resolved ? (
              <CardTemplate
                card={resolved}
                illustrationSize={BATTLEFIELD_ILLUSTRATION_SIZE}
                effect={effectFor(resolved)}
              />
            ) : (
              <span
                data-testid={`combat-battlefield-card-${card.cardId}-label`}
                className="combat-battlefield-card-fallback-label"
              >
                {displayName}
              </span>
            )}
            <span
              data-testid={`combat-battlefield-card-${card.cardId}-hp`}
              className="combat-battlefield-card-hp-chip"
              aria-hidden="true"
            >
              {hpText}
            </span>
          </div>
        );
      })}
    </div>
  );
}
