/**
 * @fileoverview Barrel export for local ESLint rules registered under the
 * `hc` (Elysian Cathedral) plugin namespace. Imported by `eslint.config.js`.
 */

import noInlineFramerTransition from './no-inline-framer-transition.js';
import noRawItemPassiveRead from './no-raw-item-passive-read.js';

/** @type {import('eslint').ESLint.Plugin} */
const hcPlugin = {
  meta: {
    name: 'hc',
    version: '0.1.0',
  },
  rules: {
    'no-inline-framer-transition': noInlineFramerTransition,
    'no-raw-item-passive-read': noRawItemPassiveRead,
  },
};

export default hcPlugin;
export { noInlineFramerTransition, noRawItemPassiveRead };
