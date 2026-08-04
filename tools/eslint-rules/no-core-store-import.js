/**
 * @fileoverview Prevent pure core modules from importing the Zustand layer.
 * Applied only to `src/core/**` by eslint.config.js.
 */

const STORE_PATH = /^(?:(?:\.\.\/)+store(?:\/|$)|src\/store(?:\/|$)|@\/store(?:\/|$))/;

const storeSource = (node) =>
  node && node.type === 'Literal' && typeof node.value === 'string' && STORE_PATH.test(node.value);

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow imports from src/store inside src/core.',
      recommended: true,
    },
    schema: [],
    messages: {
      storeImport:
        'Core modules must not import from src/store; move shared domain types or policy beneath the store boundary. (hc/no-core-store-import)',
    },
  },

  create(context) {
    const reportSource = (node) => {
      if (storeSource(node.source)) context.report({ node: node.source, messageId: 'storeImport' });
    };

    return {
      ImportDeclaration: reportSource,
      ExportNamedDeclaration: reportSource,
      ExportAllDeclaration: reportSource,
      ImportExpression(node) {
        if (storeSource(node.source)) context.report({ node: node.source, messageId: 'storeImport' });
      },
    };
  },
};

export default rule;
