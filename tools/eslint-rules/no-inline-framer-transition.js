/**
 * @fileoverview ESLint rule: disallow inline `transition` literals on
 * Framer Motion components.
 *
 * Enforces PRD A-5 / motion.md §1 — motion transitions must be imported
 * from a shared variants module (e.g. `src/motion/variants.ts`) so the
 * Elysian Cathedral UI has a single source of truth for motion tokens.
 *
 * Flagged patterns:
 *   <motion.X transition={{ duration: 0.5 }} />   // inline object
 *   <motion.Y transition="spring" />              // string literal
 *
 * Allowed patterns:
 *   <motion.X transition={EASE.smooth} />         // member expression
 *   <motion.Y transition={MY_VARIANTS} />         // identifier
 *   <motion.Z transition={getTransition()} />     // call expression (opaque)
 *
 * The rule ignores non-motion elements entirely (e.g. `<div transition={{...}} />`
 * is some other library's prop and out of scope).
 */

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow inline object or string `transition` literals on <motion.*> components. Import from src/motion/variants.ts per PRD A-5.',
      recommended: true,
    },
    schema: [],
    messages: {
      inlineTransition:
        "Do not use inline `transition` on <motion.*>. Import from 'src/motion/variants.ts' per PRD A-5 / motion.md §1. (hc/no-inline-framer-transition)",
    },
  },

  create(context) {
    return {
      JSXAttribute(node) {
        // 1. Must be a `transition` attribute.
        if (!node.name || node.name.type !== 'JSXIdentifier') return;
        if (node.name.name !== 'transition') return;

        // 2. Parent must be a <motion.X> JSX element.
        const opening = node.parent;
        if (!opening || opening.type !== 'JSXOpeningElement') return;
        const elName = opening.name;
        if (!elName || elName.type !== 'JSXMemberExpression') return;
        if (
          !elName.object ||
          elName.object.type !== 'JSXIdentifier' ||
          elName.object.name !== 'motion'
        ) {
          return;
        }

        // 3. Inspect the attribute value.
        const value = node.value;
        if (value == null) return; // shorthand, not meaningful

        // 3a. String literal: <motion.X transition="spring" />
        if (value.type === 'Literal' && typeof value.value === 'string') {
          context.report({ node, messageId: 'inlineTransition' });
          return;
        }

        // 3b. Expression container: <motion.X transition={...} />
        if (value.type === 'JSXExpressionContainer') {
          const expr = value.expression;
          if (!expr) return;
          if (expr.type === 'ObjectExpression') {
            context.report({ node, messageId: 'inlineTransition' });
            return;
          }
          // Identifier, MemberExpression, CallExpression, and other
          // non-literal expressions are allowed — they represent references
          // to shared variants or runtime-computed transitions.
        }
      },
    };
  },
};

export default rule;
