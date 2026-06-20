import type { CSSProperties, JSX } from 'react';
import type { Card } from '../types/card';
import { baseIdOf } from '../data/cards';
import { HC_TOKENS } from '../theme/tokens';
import ArtPendingFrame from './ArtPendingFrame';
import CardTemplate from './CardTemplate';

const TILE_TOUCH_STYLE: CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
};

const COOLDOWN_STYLE: CSSProperties = {
  fontSize: 'var(--hc-text-xs)',
  lineHeight: 1.1,
  textAlign: 'center',
  padding: '2px 4px',
  fontFamily: 'var(--hc-font-display)',
  fontWeight: 'var(--hc-font-weight-bold)',
  letterSpacing: HC_TOKENS.semantic['tracking-wider'],
  textTransform: 'uppercase',
  color: 'var(--hc-text-muted, #b7ae95)',
};

const TAP_BUTTON_STYLE: CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  padding: '4px 6px',
  marginTop: 4,
  fontFamily: 'var(--hc-font-display)',
  fontWeight: 'var(--hc-font-weight-bold)',
  fontSize: 'var(--hc-text-xs)',
  letterSpacing: HC_TOKENS.semantic['tracking-chrome'],
  textTransform: 'uppercase',
  color: 'var(--hc-text-primary, #e9dfca)',
  background: 'var(--hc-shadow-700, #131d3e)',
  border: '1px solid var(--hc-lead-gold-700, #8b6a2a)',
  borderRadius: 6,
  cursor: 'pointer',
};

const TAP_BUTTON_DISABLED_STYLE: CSSProperties = {
  ...TAP_BUTTON_STYLE,
  opacity: 0.45,
  cursor: 'not-allowed',
};

/**
 * Short start-of-turn summary for each known Relic item. Preserved as a
 * hidden span on each tile for the existing test contract; the visible
 * card face shows the full effect text via CardTemplate's rules box.
 *
 * Empty string for items whose mechanic is not a passive SOT trigger —
 * the wisp is the main example (`playFairyOn` is tap-dispatched).
 */
export function itemTriggerTextFor(card: Card): string {
  switch (baseIdOf(card)) {
    case 'short-sword':
      return '+1 power/turn';
    case 'tower-shield':
      return '+1g/turn';
    case 'short-bow':
      return '+1 power/turn';
    case 'curved-throwing-blade':
      return '+1 power/turn';
    case 'ancient-blade':
      return '+2 power/turn';
    default:
      return '';
  }
}

/**
 * Resolve the cooldown readout label for an item-active card. Returns
 * "Ready" when `cooldownTurns === 0` (or unset) and the numeric
 * turns-remaining count otherwise. Items that aren't item-active return
 * an empty string so the label is suppressed upstream.
 */
export function cooldownReadoutFor(card: Card): string {
  if (card.itemKind !== 'item-active') return '';
  const turns = card.cooldownTurns ?? 0;
  return turns <= 0 ? 'Ready' : String(turns);
}

export interface ItemCellProps {
  readonly card: Card;
  /**
   * Id of the currently-downed teammate, or `null` when no teammate is
   * downed. Wired only for the wisp tile — tapping the wisp fires
   * `onPlayFairy(downedTeammateId)` but ONLY when this prop is a non-null
   * string. Outside that context the tap button renders disabled so the
   * card is preserved (soft UX per amendment A6 — wisp NOT consumed).
   */
  readonly downedTeammateId?: string | null;
  /**
   * Tap-to-use dispatcher for the wisp. Called with the (non-null)
   * `downedTeammateId` on a valid tap. When absent, the wisp cell is
   * read-only (no button rendered) — other item cells are unaffected.
   */
  readonly onPlayFairy?: (teammateId: string) => void;
}

/**
 * Render a single item in the persistent Items zone (REQ-4 / u-2d).
 * Handles three variants off one shape:
 *
 *   - Relics (short-sword, tower-shield, short-bow, curved-throwing-blade,
 *     ancient-blade): render the card face + a hidden SOT trigger hint +
 *     the cooldown readout ("Ready" / "<N>").
 *   - Wisp: wrap the card face in `ArtPendingFrame` (finalized art has
 *     not shipped yet) + render a tap-to-use button whose enabled state
 *     matches the "downed teammate available" condition. Taps dispatch
 *     to `onPlayFairy(teammateId)` — which in turn calls `playFairyOn`
 *     in the store. Outside the downed context the button is disabled.
 *   - Future item-passive (v2.1): the `itemKind !== 'item-active'` branch
 *     keeps the cooldown readout suppressed — no code change needed when
 *     the first passive item ships.
 */
export default function ItemCell({
  card,
  downedTeammateId,
  onPlayFairy,
}: ItemCellProps): JSX.Element {
  const baseId = baseIdOf(card);
  const isFairy = baseId === 'wisp';
  const triggerText = itemTriggerTextFor(card);
  const cooldownLabel = cooldownReadoutFor(card);
  const hasTapHandler = typeof onPlayFairy === 'function';
  const tapEnabled = isFairy && hasTapHandler && typeof downedTeammateId === 'string';

  const body = <CardTemplate card={card} illustrationSize={96} />;

  return (
    <div
      className="card-tile field-card-tile hand-card-tile item-tile"
      data-testid={`item-${card.id}`}
      data-role={card.role}
      data-item-kind={card.itemKind ?? ''}
      style={TILE_TOUCH_STYLE}
    >
      {isFairy ? <ArtPendingFrame testIdSuffix="wisp-item-cell">{body}</ArtPendingFrame> : body}
      {cooldownLabel ? (
        <span data-testid={`item-cooldown-${card.id}`} style={COOLDOWN_STYLE}>
          {cooldownLabel}
        </span>
      ) : null}
      {triggerText ? (
        <span hidden data-testid={`item-effect-${card.id}`}>
          {triggerText}
        </span>
      ) : null}
      {isFairy && hasTapHandler ? (
        <button
          type="button"
          data-testid={`item-wisp-tap-${card.id}`}
          data-touch-target="true"
          aria-label="Use wisp on downed teammate"
          style={tapEnabled ? TAP_BUTTON_STYLE : TAP_BUTTON_DISABLED_STYLE}
          disabled={!tapEnabled}
          onClick={() => {
            if (!tapEnabled) return;
            // tapEnabled implies downedTeammateId is a non-null string.
            onPlayFairy(downedTeammateId as string);
          }}
        >
          Use on teammate
        </button>
      ) : null}
    </div>
  );
}
