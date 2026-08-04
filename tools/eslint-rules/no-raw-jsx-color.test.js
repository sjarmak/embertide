/**
 * @fileoverview RuleTester cases for `hc/no-raw-jsx-color`.
 *
 * The HC token contract applies to JSX color attributes as well as CSS:
 * authors may use `var(--hc-*, <literal fallback>)`, but may not bypass the
 * token palette with a bare hex or rgb()/rgba() literal.
 */

import { RuleTester } from 'eslint';
import test from 'node:test';
import tsParser from '@typescript-eslint/parser';

import rule from './no-raw-jsx-color.js';

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

test('hc/no-raw-jsx-color', () => {
  ruleTester.run('no-raw-jsx-color', rule, {
    valid: [
      {
        code: 'const x = <path fill="var(--hc-jewel-sapphire-500, #2e4ba0)" />;',
      },
      {
        code: 'const x = <stop stopColor="var(--hc-glow-pearl, rgba(242, 244, 247, 0.35))" />;',
      },
      {
        code: 'const x = <path fill="url(#d20-facet-1)" stroke="currentColor" />;',
      },
      {
        code: 'const x = <div color={themeColor} backgroundColor={getBackground()} />;',
      },
      {
        code: 'const x = <div data-color="#ffffff" />;',
      },
    ],

    invalid: [
      {
        code: 'const x = <path fill="#fff" />;',
        errors: [{ messageId: 'rawColor' }],
      },
      {
        code: 'const x = <path stroke={"#12345678"} />;',
        errors: [{ messageId: 'rawColor' }],
      },
      {
        code: 'const x = <stop stopColor="rgb(10, 20, 30)" />;',
        errors: [{ messageId: 'rawColor' }],
      },
      {
        code: 'const x = <div color="rgba(10, 20, 30, 0.5)" />;',
        errors: [{ messageId: 'rawColor' }],
      },
      {
        code: 'const x = <div background="#123456" />;',
        errors: [{ messageId: 'rawColor' }],
      },
      {
        code: 'const x = <div backgroundColor="#123456" />;',
        errors: [{ messageId: 'rawColor' }],
      },
      {
        code: 'const x = <div backgroundImage="rgb(10 20 30)" />;',
        errors: [{ messageId: 'rawColor' }],
      },
    ],
  });
});
