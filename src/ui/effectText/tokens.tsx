import type { ReactNode } from 'react';
import { ICON_BY_UNIT, SHARD_ICON_BY_KEY, isShardKey, isUnitKey } from './icons';

/** Matches a `+N <unit>` resource token. Two source vocabularies coexist:
 *
 *   Card-format (from `effectTextFor`): `+1g`, `+1♥`, `+2 power`,
 *   `+1 key` — unit is either attached to the amount with no space (g, ♥)
 *   or separated by a space (power, key).
 *
 *   Natural-format (from champion.passiveDescription, embertide-6y2):
 *   `+1 heart`, `+2 power`, `+1 green`, `+1 bonus heart`.
 *
 * Unit alternation:
 *   - `g` / `green` → green shard
 *   - `power`       → sword (red combat power; see bd memory
 *                      card-cost-icon-convention — never a shard)
 *   - `key`         → key
 *   - `♥` / `heart` → heart
 *
 * An optional `bonus` adjective may appear between the amount and the unit
 * (e.g. `+1 bonus heart`) — it is captured and preserved as text prefix
 * inside the token span so the qualifier stays visible next to the icon.
 *
 * The bare letter `g` is unambiguous in effect strings: the other words
 * that appear (Draw, Play, per kill, on boss, first kill, Relic, /turn,
 * Endgame, heroes, extra, card, turn) are all multi-letter and never a
 * bare `g`.
 */
const TOKEN_RE =
  /\+(\d+)(?:\s+(bonus)\s+)?\s*(g|power|key|\u2665|heart|green)(?=\b|$|[^A-Za-z\u2665])/gu;

/**
 * Embertide-shard token regex (REQ-13 Phase 2d / gm0.4). Matches the
 * canonical `"Wisdom shard"` / `"Courage shard"` / `"Power shard"`
 * spelling produced by `effectTextFor` for `shard-grant` EffectSpec
 * cards. Case-insensitive on the shard name (so author-style "wisdom
 * shard" still tokenizes if anyone types it lowercase) but the rendered
 * label preserves the original capitalization. The trailing word
 * `shard` is captured as the boundary so the regex doesn't gobble
 * adjacent text.
 */
const SHARD_TOKEN_RE = /(Wisdom|Courage|Power)\s+shard(?=\b|$|[^A-Za-z])/g;

interface ResourceMatch {
  readonly start: number;
  readonly end: number;
  readonly node: ReactNode;
}

function collectMatches(text: string): readonly ResourceMatch[] {
  const out: ResourceMatch[] = [];
  let tokenIdx = 0;
  // Resource tokens (+N <unit>). matchAll yields a fresh stateless
  // iterator per call (vs TOKEN_RE.exec which shares `lastIndex` across
  // invocations).
  for (const match of text.matchAll(TOKEN_RE)) {
    const [full, amount, bonus, unit] = match;
    // Narrow `unit` via `in` so that any future regex alternation that
    // drifts from ICON_BY_UNIT fails loudly at the type level rather
    // than returning `undefined` into JSX.
    if (!isUnitKey(unit)) continue;
    out.push({
      start: match.index,
      end: match.index + full.length,
      node: (
        <span key={`tok-${tokenIdx}`} className="effect-text-token">
          {`+${amount} `}
          {bonus ? `${bonus} ` : ''}
          {ICON_BY_UNIT[unit]}
        </span>
      ),
    });
    tokenIdx += 1;
  }
  // Shard tokens ("<Capitalized> shard" — REQ-13 Phase 2d / gm0.4).
  // The shard label stays visible next to the icon so the grant reads
  // as "Wisdom <icon>" rather than just an opaque triangle.
  for (const match of text.matchAll(SHARD_TOKEN_RE)) {
    const [full, shardWord] = match;
    const lower = shardWord.toLowerCase();
    if (!isShardKey(lower)) continue;
    out.push({
      start: match.index,
      end: match.index + full.length,
      node: (
        <span key={`shard-${tokenIdx}`} className="effect-text-token">
          {`${shardWord} `}
          {SHARD_ICON_BY_KEY[lower]}
        </span>
      ),
    });
    tokenIdx += 1;
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * Tokenize a resource-text string into a `ReactNode` tree where each
 * `+N <unit>` token is replaced by `+N<icon>`, preserving surrounding text
 * and the optional `bonus` qualifier. Handles both the card-format
 * vocabulary produced by `effectTextFor` and the natural-format
 * vocabulary used by `champion.passiveDescription` (embertide-6y2).
 *
 * Returns `null` for the empty string so callers can conditionally render.
 *
 * Accessibility: this node tree is for SIGHTED rendering only. Callers
 * that need an accessible name (aria-label / hidden mirror) must pass the
 * original plain-text string to screen readers — icons alone don't carry
 * the semantic of "plus one heart" for assistive tech.
 */
export function tokenizeResourceText(text: string): ReactNode {
  if (text.length === 0) return null;

  const matches = collectMatches(text);
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const m of matches) {
    // Skip overlapping matches (defensive: shouldn't happen given our
    // disjoint regexes, but cheap insurance against future drift).
    if (m.start < cursor) continue;
    if (m.start > cursor) {
      parts.push(text.slice(cursor, m.start));
    }
    parts.push(m.node);
    cursor = m.end;
  }
  if (cursor < text.length) {
    // Trailing text — everything after the last token (or the entire
    // string if no tokens were found, e.g. 'Draw 2').
    parts.push(text.slice(cursor));
  }
  return <>{parts}</>;
}
