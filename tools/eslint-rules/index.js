/**
 * @fileoverview Barrel export for local ESLint rules registered under the
 * `hc` (Elysian Cathedral) plugin namespace. Imported by `eslint.config.js`.
 */

import noInlineFramerTransition from './no-inline-framer-transition.js';
import noCoreStoreImport from './no-core-store-import.js';
import noRawJsxColor from './no-raw-jsx-color.js';
import noRawItemPassiveRead from './no-raw-item-passive-read.js';

/** @type {import('eslint').ESLint.Plugin} */
const hcPlugin = {
  meta: {
    name: 'hc',
    version: '0.1.0',
  },
  rules: {
    'no-inline-framer-transition': noInlineFramerTransition,
    'no-core-store-import': noCoreStoreImport,
    'no-raw-jsx-color': noRawJsxColor,
    'no-raw-item-passive-read': noRawItemPassiveRead,
  },
};

export default hcPlugin;
export {
  noCoreStoreImport,
  noInlineFramerTransition,
  noRawItemPassiveRead,
  noRawJsxColor,
};
