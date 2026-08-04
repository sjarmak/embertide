/**
 * @fileoverview Require HC design tokens in JSX color attributes.
 *
 * Literal fallbacks remain useful when an SVG renders before tokens.css is
 * available, but they must be owned by an `--hc-*` variable:
 *
 *   <path fill="var(--hc-jewel-sapphire-500, #2e4ba0)" />
 */

const COLOR_ATTRIBUTES = new Set(['fill', 'stroke', 'stopcolor', 'color']);
const HC_VAR_WITH_FALLBACK = /^var\(\s*--hc-[\w-]+\s*,/i;
const SVG_PAINT_SERVER = /^url\(\s*#[^)]+\s*\)$/i;
const HEX_COLOR = /(^|[\s,(])#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})(?=$|[\s,)])/i;
const RGB_COLOR = /rgba?\s*\(/i;

const isColorAttribute = (name) => {
  const normalized = name.toLowerCase();
  return COLOR_ATTRIBUTES.has(normalized) || normalized.startsWith('background');
};

const getStaticString = (value) => {
  if (!value) return null;
  if (value.type === 'Literal' && typeof value.value === 'string') return value.value;
  if (value.type !== 'JSXExpressionContainer') return null;

  const expression = value.expression;
  if (expression.type === 'Literal' && typeof expression.value === 'string') {
    return expression.value;
  }
  if (expression.type === 'TemplateLiteral' && expression.expressions.length === 0) {
    return expression.quasis[0]?.value.cooked ?? null;
  }
  return null;
};

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow bare hex and rgb()/rgba() literals in JSX color attributes; use a var(--hc-*, ...) token fallback.',
      recommended: true,
    },
    schema: [],
    messages: {
      rawColor:
        'Do not use a raw color in JSX `{{attribute}}`; use `var(--hc-*, <fallback>)`. (hc/no-raw-jsx-color)',
    },
  },

  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name?.type !== 'JSXIdentifier' || !isColorAttribute(node.name.name)) return;

        const value = getStaticString(node.value);
        if (value == null || HC_VAR_WITH_FALLBACK.test(value) || SVG_PAINT_SERVER.test(value))
          return;
        if (!HEX_COLOR.test(value) && !RGB_COLOR.test(value)) return;

        context.report({
          node,
          messageId: 'rawColor',
          data: { attribute: node.name.name },
        });
      },
    };
  },
};

export default rule;
