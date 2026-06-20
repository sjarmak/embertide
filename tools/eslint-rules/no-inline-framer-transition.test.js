/**
 * @fileoverview RuleTester cases for `hc/no-inline-framer-transition`.
 *
 * Run with:  node --test tools/eslint-rules/no-inline-framer-transition.test.js
 *
 * Uses ESLint 9's `RuleTester` with the `@typescript-eslint/parser` so we
 * can exercise TSX-shaped JSX inputs (the production codebase is TS).
 */

import { RuleTester } from 'eslint';
import test from 'node:test';
import tsParser from '@typescript-eslint/parser';

import rule from './no-inline-framer-transition.js';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ecmaFeatures: { jsx: true },
    },
  },
});

// RuleTester.run triggers Node's test runner under the hood when invoked
// inside a `node --test` process. We wrap in a top-level `test` so the
// run is visible in the harness output.
test('hc/no-inline-framer-transition', () => {
  ruleTester.run('no-inline-framer-transition', rule, {
    valid: [
      // Identifier reference — canonical allowed shape.
      {
        code: 'const T = {}; const x = <motion.div transition={T} />;',
      },
      // MemberExpression reference (e.g. EASE.smooth).
      {
        code: 'const EASE = { smooth: {} }; const x = <motion.span transition={EASE.smooth} />;',
      },
      // CallExpression — treated as opaque, allowed.
      {
        code: 'const getT = () => ({}); const x = <motion.button transition={getT()} />;',
      },
      // Non-motion element with inline object — out of scope, ignored.
      {
        code: 'const x = <div transition={{ duration: 0.5 }} />;',
      },
      // motion.* without transition attr — ignored.
      {
        code: 'const x = <motion.div animate={{ x: 1 }} />;',
      },
      // motion.* with no attributes at all — ignored.
      {
        code: 'const x = <motion.div />;',
      },
      // Different attribute on motion.* using an inline object — ignored.
      {
        code: 'const x = <motion.section initial={{ opacity: 0 }} />;',
      },
      // Namespaced/plain element with string transition — ignored (not motion).
      {
        code: 'const x = <section transition="spring" />;',
      },
    ],

    invalid: [
      // Inline object on motion.div.
      {
        code: "const x = <motion.div transition={{ duration: 0.6, type: 'spring' }} />;",
        errors: [{ messageId: 'inlineTransition' }],
      },
      // Empty inline object.
      {
        code: 'const x = <motion.span transition={{}} />;',
        errors: [{ messageId: 'inlineTransition' }],
      },
      // String literal transition.
      {
        code: 'const x = <motion.button transition="spring" />;',
        errors: [{ messageId: 'inlineTransition' }],
      },
      // Inline object with nested properties on motion.path (svg motion).
      {
        code: 'const x = <motion.path transition={{ ease: [0.4, 0, 0.2, 1], duration: 0.3 }} />;',
        errors: [{ messageId: 'inlineTransition' }],
      },
    ],
  });
});
