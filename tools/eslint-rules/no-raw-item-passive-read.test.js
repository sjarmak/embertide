/**
 * @fileoverview RuleTester cases for `hc/no-raw-item-passive-read`.
 *
 * Run with:  node --test tools/eslint-rules/no-raw-item-passive-read.test.js
 *
 * The rule bans raw discriminator reads of the form `<member>.kind <op>
 * 'item-passive'` (or the symmetric `'item-passive' <op> <member>.kind`),
 * forcing all firing-side passive lookups through `getPassives()` in
 * src/data/cardPassives.ts. Authoring-position literals (object literal
 * `{ kind: 'item-passive' }`, type-position `kind: 'item-passive'`) are
 * different AST nodes (Property / TSPropertySignature) and naturally not
 * matched.
 */

import { RuleTester } from 'eslint';
import test from 'node:test';
import tsParser from '@typescript-eslint/parser';

import rule from './no-raw-item-passive-read.js';

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

test('hc/no-raw-item-passive-read', () => {
  ruleTester.run('no-raw-item-passive-read', rule, {
    valid: [
      // Object literal property — authoring shape, NOT a comparison.
      {
        code: "const x = { kind: 'item-passive', amount: 1 };",
      },
      // Type-position literal — TSPropertySignature, not BinaryExpression.
      {
        code: "interface E { kind: 'item-passive'; amount: number; }",
      },
      // Different discriminant literal — out of scope.
      {
        code: "if (e.kind === 'gain') {}",
      },
      // MemberExpression with non-`kind` property — out of scope.
      {
        code: "if (e.type === 'item-passive') {}",
      },
      // Comparison where neither side references `.kind` — out of scope.
      {
        code: "if (label === 'item-passive') {}",
      },
      // String concat / template literal — not a BinaryExpression equality op.
      {
        code: "const s = 'kind=' + 'item-passive';",
      },
    ],

    invalid: [
      // Canonical: card.effects.kind === 'item-passive'.
      {
        code: "if (card.effects.kind === 'item-passive') {}",
        errors: [{ messageId: 'rawDiscriminantRead' }],
      },
      // Aliased read: const e = card.effects; if (e.kind === 'item-passive')
      {
        code: "const e = card.effects; if (e.kind === 'item-passive') {}",
        errors: [{ messageId: 'rawDiscriminantRead' }],
      },
      // Negation: !==
      {
        code: "if (effect.kind !== 'item-passive') return;",
        errors: [{ messageId: 'rawDiscriminantRead' }],
      },
      // Loose equality: ==
      {
        code: "if (effect.kind == 'item-passive') {}",
        errors: [{ messageId: 'rawDiscriminantRead' }],
      },
      // Loose negation: !=
      {
        code: "if (effect.kind != 'item-passive') {}",
        errors: [{ messageId: 'rawDiscriminantRead' }],
      },
      // Symmetric operand order — string literal on the LEFT.
      {
        code: "if ('item-passive' === card.effects.kind) {}",
        errors: [{ messageId: 'rawDiscriminantRead' }],
      },
      // Deeper member chain still terminating in `.kind`.
      {
        code: "if (state.player.items[0].effects.kind === 'item-passive') {}",
        errors: [{ messageId: 'rawDiscriminantRead' }],
      },
      // Optional chaining: `card?.effects.kind === 'item-passive'`.
      {
        code: "if (card?.effects.kind !== 'item-passive') {}",
        errors: [{ messageId: 'rawDiscriminantRead' }],
      },
    ],
  });
});
