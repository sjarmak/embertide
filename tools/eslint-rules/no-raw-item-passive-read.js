/**
 * @fileoverview ESLint rule: disallow raw discriminator reads of the form
 * `<member>.kind <op> 'item-passive'` (or the symmetric reversed-operand
 * variant). Forces all firing-side passive lookups through `getPassives()`
 * in `src/data/cardPassives.ts` per the ppf9.4 schema lock-in.
 *
 * The single source of truth for "is this card carrying an item-passive,
 * and which slot is it in?" lives in `src/data/cardPassives.ts`. Reads
 * scattered across reducers / dispatchers were the pre-ppf9.4 status quo
 * and silently break when an item declares its passive in `Card.passive`
 * (the new second slot) instead of `Card.effects` — because the raw read
 * only inspects the first slot. Banning the read pattern outright is the
 * gate that makes dual-behaviour items safe to author.
 *
 * Flagged patterns (any equality operator: ===, !==, ==, !=):
 *   if (card.effects.kind === 'item-passive') {}        // canonical
 *   if (effect.kind !== 'item-passive') continue;       // aliased
 *   if ('item-passive' === e.kind) {}                   // reversed
 *   state.player.items[0].effects.kind === 'item-passive'  // deep chain
 *   card?.effects.kind !== 'item-passive'               // optional chain
 *
 * NOT flagged (different AST nodes — these are authoring shapes, not
 * runtime comparisons):
 *   const c: Card = { effects: { kind: 'item-passive', ... } };  // Property
 *   interface E { kind: 'item-passive'; }                        // TSPropertySignature
 *
 * Allowlist (file-level overrides in eslint.config.js):
 *   - src/data/cardPassives.ts    — the accessor itself.
 *   - src/ui/effectText.tsx        — render-policy site, migrated by ppf9.4.4.
 *   - src/**\/*.{test,spec}.{ts,tsx,js,jsx}  — test fixtures.
 *   - src/**\/__tests__/**          — test fixtures.
 */

const TARGET_LITERAL = 'item-passive';
const EQUALITY_OPS = new Set(['===', '!==', '==', '!=']);

const isTargetLiteral = (n) =>
  n.type === 'Literal' && typeof n.value === 'string' && n.value === TARGET_LITERAL;

// A MemberExpression terminating in property `kind`. Receiver chain
// (card.effects, effect, state.player.items[0].effects, etc.) is
// intentionally unconstrained — any path ending in `.kind` is treated as
// a discriminator read. ChainExpression wraps the optional-chaining
// variant `card?.effects.kind`.
const isKindMemberRead = (n) => {
  if (n.type === 'ChainExpression') return isKindMemberRead(n.expression);
  if (n.type !== 'MemberExpression') return false;
  if (n.computed) return false;
  return n.property.type === 'Identifier' && n.property.name === 'kind';
};

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "Disallow raw `<member>.kind <op> 'item-passive'` discriminator reads. Use getPassives(card) from src/data/cardPassives.ts so dual-behaviour items (Card.passive second-slot) are read correctly.",
      recommended: true,
    },
    schema: [],
    messages: {
      rawDiscriminantRead:
        "Do not compare `.kind` against 'item-passive' directly — read passives via getPassives(card) from src/data/cardPassives.ts so dual-slot items (Card.passive) are honored. (hc/no-raw-item-passive-read)",
    },
  },

  create(context) {
    return {
      BinaryExpression(node) {
        if (!EQUALITY_OPS.has(node.operator)) return;
        const { left, right } = node;
        if (
          (isKindMemberRead(left) && isTargetLiteral(right)) ||
          (isTargetLiteral(left) && isKindMemberRead(right))
        ) {
          context.report({ node, messageId: 'rawDiscriminantRead' });
        }
      },
    };
  },
};

export default rule;
