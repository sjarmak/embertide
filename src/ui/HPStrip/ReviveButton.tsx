import type { CSSProperties, JSX } from 'react';
import type { Phase } from '../../store/types';
import { HC_TOKENS } from '../../theme/tokens';

const REVIVE_BUTTON_STYLE: CSSProperties = {
  minWidth: 72,
  minHeight: 28,
  marginTop: 4,
  padding: '4px 10px',
  fontSize: 'var(--hc-text-xs)',
  fontWeight: 'var(--hc-font-weight-bold)',
  letterSpacing: HC_TOKENS.semantic['tracking-wide'],
  textTransform: 'uppercase',
  background: 'var(--hc-jewel-emerald-500, #1f7a46)',
  color: 'var(--hc-parchment-50, #fbf6e9)',
  border: '1px solid var(--hc-jewel-emerald-700, #0f5028)',
  borderRadius: 4,
  cursor: 'pointer',
};

const REVIVE_BUTTON_DISABLED_STYLE: CSSProperties = {
  ...REVIVE_BUTTON_STYLE,
  background: 'var(--hc-jewel-emerald-700, #0f5028)',
  color: 'var(--hc-text-muted, #b7ae95)',
  opacity: 0.55,
  cursor: 'not-allowed',
};

/**
 * Resolve the revive button's disabled reason. Returns `null` when the
 * button is enabled. Ordered by UX priority: phase guard first (the store
 * will throw otherwise), then per-incident revive budget.
 */
export function resolveReviveDisabledReason(
  phase: Phase,
  activePlayerRevivedThisIncident: boolean,
): string | null {
  if (phase !== 'Main') return `Revive only available during Main phase (currently ${phase})`;
  if (activePlayerRevivedThisIncident) return 'Revive already used this incident';
  return null;
}

export interface ReviveButtonProps {
  readonly playerId: string;
  readonly playerName: string;
  readonly phase: Phase;
  readonly activePlayerRevivedThisIncident: boolean;
  readonly onRevive: () => void;
}

/**
 * Revive button rendered beneath a downed teammate's HP row. The phase
 * and per-incident-budget guards mirror the store's `reviveTeammate`
 * preconditions, so the button only enables when the click would
 * actually succeed.
 */
export function ReviveButton({
  playerId,
  playerName,
  phase,
  activePlayerRevivedThisIncident,
  onRevive,
}: ReviveButtonProps): JSX.Element {
  const reason = resolveReviveDisabledReason(phase, activePlayerRevivedThisIncident);
  const disabled = reason !== null;
  const label = reason ?? `Revive ${playerName}`;
  return (
    <button
      type="button"
      data-testid={`hp-strip-${playerId}-revive-button`}
      data-touch-target="true"
      aria-label={label}
      title={label}
      disabled={disabled}
      style={disabled ? REVIVE_BUTTON_DISABLED_STYLE : REVIVE_BUTTON_STYLE}
      onClick={onRevive}
    >
      Revive
    </button>
  );
}
