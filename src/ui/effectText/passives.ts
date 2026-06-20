import type { Card } from '../../types/card';
import { getPassives } from '../../data/cardPassives';

/**
 * Passive-line text for a card, separated from the base text so the card
 * face can render it as its own demoted span (cby6 / ppf9-4d.1). Returns
 * the joined `'Passive: <description>'` lines for cards with one or more
 * passives, or `''` for non-passive cards.
 *
 * Mutual-exclusion guarantees from `getPassives()` mean the returned
 * string carries either zero or one `Passive:` line in practice; the
 * join handles a defensive 2+ array for forward-compat with hypothetical
 * multi-passive authoring.
 */
export function passiveTextFor(card: Card): string {
  const passives = getPassives(card);
  if (passives.length === 0) return '';
  return passives.map((passive) => `Passive: ${passive.description}`).join('\n');
}
