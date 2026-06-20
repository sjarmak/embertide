import type { JSX } from 'react';
import { GreenRupee, Key, Sword } from '../icons';

export interface CostBadgeProps {
  readonly green?: number;
  readonly red?: number;
  readonly keys?: number;
}

const ICON_SIZE = 16;

/**
 * Compact cost readout rendered on field / hand card faces. Each non-zero
 * resource renders as a small "<icon> <n>" pair. Zero and negative values
 * are omitted so cheap cards stay visually uncluttered.
 *
 * IP-safety: uses generic icons shared with the rest of the UI. The
 * combat resource (engine-internal `red`) is shown as a Sword and labelled
 * "power" — never as a shard / money icon.
 */
export default function CostBadge({
  green = 0,
  red = 0,
  keys = 0,
}: CostBadgeProps): JSX.Element | null {
  const hasAny = green > 0 || red > 0 || keys > 0;
  if (!hasAny) return null;

  return (
    <span className="cost-badge" data-testid="cost-badge">
      {green > 0 ? (
        <span
          className="cost-badge-item"
          data-testid="cost-badge-green"
          aria-label={`cost green ${green}`}
        >
          <GreenRupee size={ICON_SIZE} />
          <span className="cost-badge-value">{green}</span>
        </span>
      ) : null}
      {red > 0 ? (
        <span
          className="cost-badge-item"
          data-testid="cost-badge-red"
          aria-label={`cost power ${red}`}
        >
          <Sword size={ICON_SIZE} />
          <span className="cost-badge-value">{red}</span>
        </span>
      ) : null}
      {keys > 0 ? (
        <span
          className="cost-badge-item"
          data-testid="cost-badge-keys"
          aria-label={`cost keys ${keys}`}
        >
          <Key size={ICON_SIZE} />
          <span className="cost-badge-value">{keys}</span>
        </span>
      ) : null}
    </span>
  );
}
