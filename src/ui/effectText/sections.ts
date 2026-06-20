import { Fragment, type ReactNode, createElement } from 'react';
import type { Card } from '../../types/card';
import { combatEffectFor } from '../../data/combatEffects';
import { combatKeywordText, combatSummaryTextFor } from './effectFor';
import { effectTextBaseFor } from './effectTextBase';
import { tokenizeResourceText } from './tokens';

/**
 * Standardized card-face section renderer (kw.card-text-format / lhlo.38).
 *
 * Every card face renders its rules-text as game-wide labelled sections —
 * `Market — …` / `Combat — …` / `Omen — …` — per the locked ruling in
 * docs/design/keyword-glossary.md ("Card-text format is game-wide"). A
 * glossary keyword is BOLD on its first occurrence on a card, then plain
 * shorthand thereafter ("One keyword = one idea").
 *
 * This layer is intentionally thin: it keys off the EXISTING procedural
 * effect data (`effectTextBaseFor` for the market/omen line,
 * `combatSummaryTextFor` / `combatEffectFor` for the combat line) and adds
 * only the section LABEL and first-occurrence keyword bolding. The
 * underlying base/combat text helpers keep returning their plain strings,
 * so the bulk of the effectText test surface stays intact.
 */
export type CardFaceSectionLabel = 'Market' | 'Combat' | 'Omen';

export interface CardFaceSection {
  readonly label: CardFaceSectionLabel;
  /**
   * Label-less plain effect text (e.g. "+2g, +1 key", "Attack 4 + Stun 1").
   * Kept alongside `nodes` for accessible-name mirrors and tests that want
   * to assert the phrasing without walking the JSX tree.
   */
  readonly text: string;
  /**
   * Rendered effect: resource tokens replaced by inline icons (via
   * `tokenizeResourceText`) and glossary keywords wrapped in `<strong>` on
   * their first occurrence across the whole card face.
   */
  readonly nodes: ReactNode;
}

/**
 * Canonical glossary keywords that bold on first occurrence, spelled
 * exactly as in docs/design/keyword-glossary.md. Matched CASE-SENSITIVELY:
 * the market base strings spell their resources lowercase / as symbols
 * (`+1 key`, `+2 power`) and are rendered as inline ICONS by the resource
 * tokenizer, so the capitalized keyword forms here only ever match the
 * plain-text combat / omen / boss-state vocabulary — the two never collide.
 */
export const CARD_FACE_KEYWORDS: readonly string[] = [
  // COMBAT
  'Attack',
  'Block',
  'Stun',
  'Weaken',
  'Vulnerable',
  'Multiattack',
  // DICE / OMEN
  'Omen',
  // MARKET
  'Shards',
  'Power',
  'Acquire',
  'Defeat',
  'Key',
  'Open',
  // ITEM / AURELIA
  'Bomb',
  'Pierce',
  'Grapplethorn',
  'Reflect',
  'Reveal',
  'Disarm',
  // BOSS-STATE
  'Guarded',
  'Exposed',
  'Cycle',
  'Break',
  // HEALTH
  'Heal',
];

// Longest-first alternation so a longer keyword wins over any shorter
// prefix; `\b` word boundaries keep matches whole-word.
const KEYWORD_RE = new RegExp(
  `\\b(${[...CARD_FACE_KEYWORDS].sort((a, b) => b.length - a.length).join('|')})\\b`,
  'g',
);

/**
 * Render `text` into a node tree: resource tokens become inline icons and
 * each glossary keyword's FIRST occurrence (tracked in `seen`, shared
 * across all of a card's sections) is wrapped in `<strong>`. Subsequent
 * occurrences render plain.
 */
function renderSectionNodes(text: string, seen: Set<string>): ReactNode {
  const parts: ReactNode[] = [];
  let cursor = 0;
  let idx = 0;
  for (const match of text.matchAll(KEYWORD_RE)) {
    const keyword = match[0];
    const start = match.index ?? 0;
    if (start > cursor) {
      parts.push(
        createElement(
          Fragment,
          { key: `t-${idx}` },
          tokenizeResourceText(text.slice(cursor, start)),
        ),
      );
      idx += 1;
    }
    if (seen.has(keyword)) {
      parts.push(createElement(Fragment, { key: `k-${idx}` }, keyword));
    } else {
      seen.add(keyword);
      parts.push(createElement('strong', { key: `k-${idx}` }, keyword));
    }
    idx += 1;
    cursor = start + keyword.length;
  }
  if (cursor < text.length) {
    parts.push(
      createElement(Fragment, { key: `t-${idx}` }, tokenizeResourceText(text.slice(cursor))),
    );
  }
  return createElement(Fragment, null, ...parts);
}

/**
 * Build the ordered list of labelled sections for a card face.
 *
 * - Combat-primary cards (heirlooms / freed-princess) whose base text is
 *   itself a combat line ("Combat: …") render a SINGLE data-driven
 *   `Combat` section sourced from the structured `combatEffect`, so the
 *   legacy "Combat: N dmg" phrasing becomes glossary spelling.
 * - Otherwise the base text is the `Market` section, or `Omen` when the
 *   card's primary effect is a die roll (`effects.kind === 'roll-die'`).
 * - A second `Combat` section is appended from `combatSummaryTextFor`
 *   (already suppressed for ineligible roles, filler damage, and cards
 *   whose base already carries the combat line).
 *
 * Keyword bolding is first-occurrence-per-CARD: the shared `seen` set
 * spans every section so a keyword bolds once across the whole face.
 */
export function cardFaceSections(card: Card): CardFaceSection[] {
  const seen = new Set<string>();
  const sections: CardFaceSection[] = [];

  const baseText = effectTextBaseFor(card);

  if (baseText.startsWith('Combat:')) {
    const text = combatKeywordText(combatEffectFor(card));
    sections.push({ label: 'Combat', text, nodes: renderSectionNodes(text, seen) });
    return sections;
  }

  if (baseText.length > 0) {
    const label: CardFaceSectionLabel = card.effects.kind === 'roll-die' ? 'Omen' : 'Market';
    sections.push({ label, text: baseText, nodes: renderSectionNodes(baseText, seen) });
  }

  const combat = combatSummaryTextFor(card);
  if (combat.length > 0) {
    sections.push({ label: 'Combat', text: combat, nodes: renderSectionNodes(combat, seen) });
  }

  return sections;
}
