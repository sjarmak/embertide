import type { ReactNode } from 'react';
import type { Card } from '../../types/card';
import type { CombatEffect } from '../../types/combatEffect';
import type { EffectSpec } from '../../types/effectSpec';
import { combatEffectFor } from '../../data/combatEffects';
import { effectTextBaseFor } from './effectTextBase';
import { passiveTextFor } from './passives';
import { tokenizeResourceText } from './tokens';

/**
 * Card-face text wrapper that composes `effectTextBaseFor`'s non-passive
 * base with any passive description(s) read through `passiveTextFor`
 * (ppf9.4.4 render policy). Two cases collapse here:
 *
 *  - Legacy 4uyn passive-only cards (`Card.effects.kind === 'item-passive'`):
 *    base is `''` (no early return matches; baseId switch defaults to `''`).
 *    Output is `'Passive: <description>'` — bit-identical to the previous
 *    direct `card.effects.description` read this function used to do.
 *
 *  - New dual-slot items (`Card.effects` = non-passive AND `Card.passive`
 *    set per ppf9.4 schema lock-in): base carries the on-equip / equip-bonus
 *    text, and the passive description is appended on a new line so both
 *    halves render on the card face. Newline join requires
 *    `white-space: pre-line` on `.card-template-effect` so the line break
 *    actually renders (CSS landed alongside this function).
 *
 *  - Non-passive cards: returns `base` unchanged.
 *
 * Multiple passives (a card with both `effects.kind === 'item-passive'` AND
 * `Card.passive`) are caught by the `cardPassives.test.ts` mutual-exclusion
 * invariant — `getPassives()` would also throw. So in practice the array is
 * either empty or one element; the join handles a 2+ array defensively.
 */
export function effectTextFor(card: Card): string {
  const base = effectTextBaseFor(card);
  const passiveText = passiveTextFor(card);
  if (passiveText.length === 0) return base;
  return base.length > 0 ? `${base}\n${passiveText}` : passiveText;
}

/**
 * JSX-flavored companion to `effectTextFor`. Returns the card summary with
 * each resource token replaced by an inline icon at ~12px. Returns `null`
 * when the card has no effect summary. Thin wrapper over
 * `tokenizeResourceText`.
 */
export function effectNodesFor(card: Card): ReactNode {
  return tokenizeResourceText(effectTextFor(card));
}

/**
 * Paired text + JSX nodes for a card's effect summary, computed in one pass.
 * Use when a render path needs BOTH — the plain text for an accessible name
 * or hidden test-span, and the tokenized JSX for visible rendering (e.g.
 * Hand + CardTemplate, Field + CardTemplate). Avoids the double
 * `effectTextFor` call that falls out of `effectTextFor(card)` followed by
 * `effectNodesFor(card)` in the same render (embertide-c5p).
 */
export interface CardEffect {
  /**
   * Composed full text — base + passive joined with `\n`. Used as the
   * accessible mirror (aria-label, hidden test span) so a screen reader
   * still hears the entire rules-text on a single tile.
   */
  readonly text: string;
  /**
   * Composed full nodes — tokenized `text`. Retained for callers that still
   * want a single-blob render path; the canonical card face (CardTemplate)
   * now uses `baseNodes` and `passiveNodes` so the passive line can carry
   * its own demoted styling (cby6).
   */
  readonly nodes: ReactNode;
  /** Base half — non-passive on-equip / hero / monster-drop text. */
  readonly baseText: string;
  readonly baseNodes: ReactNode;
  /** Passive half — `'Passive: <description>'` or `''`. */
  readonly passiveText: string;
  readonly passiveNodes: ReactNode;
}

export function effectFor(card: Card): CardEffect {
  const baseText = effectTextBaseFor(card);
  const passiveText = passiveTextFor(card);
  const text =
    passiveText.length === 0
      ? baseText
      : baseText.length > 0
        ? `${baseText}\n${passiveText}`
        : passiveText;
  return {
    text,
    nodes: tokenizeResourceText(text),
    baseText,
    baseNodes: tokenizeResourceText(baseText),
    passiveText,
    passiveNodes: tokenizeResourceText(passiveText),
  };
}

/**
 * Short combat-effect summary for the card face (embertide-2gp,
 * 2026-04-22). Shown as a second line below the main-board effect so
 * buyers can evaluate combat impact at purchase time — the thicker rev-2
 * combat deck makes every market card's in-combat behaviour a real
 * buying consideration, not a footnote.
 *
 * Returns '' for cards where a combat line would be redundant or noise:
 *   - The main-board effect already starts with "Combat:" — heirlooms
 *     and freed-princess display their combat info as their primary
 *     effect since they have no main-board on-play action.
 *   - The card resolves to the default combat-attack damage=1 filler —
 *     nothing meaningful to surface.
 *   - The card is a monster / chest / final-boss / etc. — those never
 *     reach the combat deck, so a "Combat: X" line would be confusing.
 *
 * Returns the LABEL-LESS effect text in canonical keyword-glossary
 * spelling (e.g. "Attack 3", "Block 4", "Multiattack 3 (1 each)") —
 * the "Combat — " section label is added by the card-face section
 * layer (`cardFaceSections` in ./sections). Spelling source of truth:
 * `combatKeywordText` below + docs/design/keyword-glossary.md (kw.card-
 * text-format / lhlo.38).
 */
export function combatSummaryTextFor(card: Card): string {
  // Role whitelist — these are the roles that can land in the combat
  // deck (heroes + active items + starters). j49z (2026-04-24): the
  // `starter-home` role was retired alongside its 4 entries; the
  // surviving starter roles are green + red.
  const isEligibleRole =
    card.role === 'hero' ||
    card.role === 'item' ||
    card.role === 'legendary-sword' ||
    card.role === 'starter-green' ||
    card.role === 'starter-red';
  if (!isEligibleRole) return '';

  // If the main-board text already advertises the combat effect (as
  // heirloom + freed-princess strings do), skip the second line to
  // avoid duplicating the same information on the card face.
  const mainText = effectTextFor(card);
  if (mainText.includes('Combat:')) return '';

  const effect = combatEffectFor(card);

  // Skip the filler default — non-overridden cards with no cost.red
  // resolve to combat-attack damage=1, which isn't worth a line.
  if (effect.kind === 'combat-attack' && effect.damage <= 1) return '';

  return combatKeywordText(effect);
}

/**
 * Map a structured `CombatEffect` to its label-less, keyword-glossary
 * spelling (kw.card-text-format / lhlo.38). The leading "Combat — "
 * section label is supplied by the section layer; this helper owns ONLY
 * the keyword phrasing so it stays the single source of truth shared by
 * `combatSummaryTextFor` (the second-line summary on market faces) and
 * `cardFaceSections` (combat-primary heirloom faces).
 *
 * Spellings track docs/design/keyword-glossary.md §COMBAT exactly:
 * Attack X / Block X / Stun / Weaken X / Vulnerable X / Multiattack N.
 * Heal X (§HEALTH) and Draw N (no glossary keyword — Draw stays plain,
 * unbolded by the section layer) cover the remaining combat-card shapes.
 */
export function combatKeywordText(effect: CombatEffect): string {
  switch (effect.kind) {
    case 'combat-attack':
      return `Attack ${effect.damage}`;
    case 'combat-absorb':
      return `Block ${effect.hp}`;
    case 'combat-heal':
      return `Heal ${effect.amount}`;
    case 'combat-draw':
      return `Draw ${effect.count}`;
    case 'combat-multishot':
      return `Multiattack ${effect.shots} (${effect.damage} each)`;
    case 'combat-attack-stun':
      return `Attack ${effect.damage} + Stun ${effect.stunTurns}`;
    case 'combat-weaken':
      return `Weaken ${effect.amount}`;
    case 'combat-vulnerable':
      return `Vulnerable ${effect.amount}`;
    default: {
      const _exhaustive: never = effect;
      return _exhaustive;
    }
  }
}

/**
 * Exhaustiveness sentinel for EffectSpec switches. Importing consumers can
 * call this in a default branch to force a compile error when a new
 * EffectSpec kind is added without handling (REQ-13 Phase 1 / u-1b).
 *
 * Currently unused by effectTextFor (which keys primarily on `role` and
 * `baseId`, not on `effects.kind`), but reserved for v2.1+ consumers where
 * effects will be dispatched per-kind.
 */
export function assertNeverEffect(effect: never): never {
  throw new Error(`Unhandled EffectSpec kind: ${JSON.stringify(effect)}`);
}

// Compile-time proof that EffectSpec stays exhaustive. The helper below is
// tree-shakable (never called at runtime) but if a new EffectSpec member
// is added, the function signature fails type-checking — the default
// branch's `never` narrowing breaks. This is the exhaustiveness gate
// mandated by u-1b's acceptance.
function _exhaustivenessGate(effect: EffectSpec): void {
  switch (effect.kind) {
    case 'gain':
    case 'shard':
    case 'draw':
    case 'combat-bonus':
    case 'damage-reduction':
    case 'monster-drop':
    case 'heal':
    case 'chest-draw':
    case 'on-play-power':
    case 'on-play-green-and-draw':
    case 'on-play-green-and-power':
    case 'item-passive':
    case 'roll-die':
    case 'banish-from-hand':
    case 'banish-from-discard':
    case 'shard-grant':
    case 'equip-bonus':
      return;
    default: {
      const _exhaustive: never = effect;
      return _exhaustive;
    }
  }
}
// Reference the gate so ESLint's no-unused-vars doesn't complain; the gate
// itself has no runtime effect and tree-shakes out of production bundles.
void _exhaustivenessGate;
