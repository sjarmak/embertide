import { RuleTester } from 'eslint';
import test from 'node:test';
import tsParser from '@typescript-eslint/parser';

import rule from './no-core-store-import.js';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  },
});

test('hc/no-core-store-import', () => {
  ruleTester.run('no-core-store-import', rule, {
    valid: [
      "import type { KidPlayer } from '../types/kidPlayer';",
      "import { getPassives } from '../../data/cardPassives';",
      "import value from '@scope/store-client';",
    ],
    invalid: [
      {
        code: "import { useGameStore } from '../store/gameStore';",
        errors: [{ messageId: 'storeImport' }],
      },
      {
        code: "import type { KidPlayer } from '../../store/types';",
        errors: [{ messageId: 'storeImport' }],
      },
      {
        code: "export { applyDamage } from '../../../store/gameStore';",
        errors: [{ messageId: 'storeImport' }],
      },
      {
        code: "const store = import('src/store/gameStore');",
        errors: [{ messageId: 'storeImport' }],
      },
      {
        code: "export * from '@/store/types';",
        errors: [{ messageId: 'storeImport' }],
      },
    ],
  });
});
