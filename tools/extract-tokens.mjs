// tools/extract-tokens.mjs
//
// Extracts --hc-* CSS custom properties from src/styles/tokens.css and
// groups them into a structured object matching the shape of HC_TOKENS
// emitted to src/theme/tokens.ts.
//
// Pure ESM / no third-party deps so it can be imported from both the Vite
// plugin (TS) and the drift-check script (mjs).

import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Project root used to bound-check any path passed to `extractFromFile`.
// Resolved once at module load: this file lives at `<root>/tools/extract-tokens.mjs`,
// so the parent of its directory is the project root.
const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = resolve(dirname(__filename), '..');

const TOKEN_RE = /--hc-([a-z0-9-]+)\s*:\s*([^;]+);/g;

/**
 * Parse raw `--hc-*` declarations from a tokens.css source string.
 * Returns a flat { key: value } map where key is the full name minus the
 * `--hc-` prefix. Values preserve their CSS form (hex, rgba(), var(--hc-…)).
 *
 * @param {string} css
 * @returns {Record<string, string>}
 */
export function parseRawTokens(css) {
  const out = {};
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(css)) !== null) {
    const key = m[1].trim();
    const value = m[2].trim();
    if (key in out) {
      throw new Error(`Duplicate token: --hc-${key}`);
    }
    out[key] = value;
  }
  return out;
}

const JEWEL_FAMILIES = ['sapphire', 'emerald', 'ruby', 'amber', 'amethyst', 'pearl'];
const LEAD_FAMILIES = ['iron', 'gold', 'silver'];
const CHAMPION_NAMES = ['courage', 'wisdom', 'power', 'sword'];
const CHAMPION_SLOTS = ['fill', 'lead', 'glow'];
const RESOURCE_NAMES = ['shard-green', 'power', 'sword', 'heart', 'key', 'shield'];
const RESOURCE_SLOTS = ['gem', 'lead'];
const TIER_NAMES = ['small', 'medium', 'big'];
const TIER_SLOTS = ['glass', 'lead', 'cap'];

/**
 * Group a flat `raw` map into the nested HC_TOKENS structure.
 *
 * @param {Record<string, string>} raw
 * @returns {{
 *   jewel: Record<string, Record<string, string>>;
 *   lead: Record<string, Record<string, string>>;
 *   parchment: Record<string, string>;
 *   shadow: Record<string, string>;
 *   glow: Record<string, string>;
 *   champion: Record<string, Record<string, string>>;
 *   resource: Record<string, Record<string, string>>;
 *   tier: Record<string, Record<string, string>>;
 *   semantic: Record<string, string>;
 * }}
 */
export function groupTokens(raw) {
  /** @type {Record<string, Record<string, string>>} */
  const jewel = {};
  for (const fam of JEWEL_FAMILIES) jewel[fam] = {};

  /** @type {Record<string, Record<string, string>>} */
  const lead = {};
  for (const fam of LEAD_FAMILIES) lead[fam] = {};

  /** @type {Record<string, string>} */
  const parchment = {};
  /** @type {Record<string, string>} */
  const shadow = {};
  /** @type {Record<string, string>} */
  const glow = {};

  /** @type {Record<string, Record<string, string>>} */
  const champion = {};
  for (const name of CHAMPION_NAMES) champion[name] = {};

  /** @type {Record<string, Record<string, string>>} */
  const resource = {};
  for (const name of RESOURCE_NAMES) resource[name] = {};

  /** @type {Record<string, Record<string, string>>} */
  const tier = {};
  for (const name of TIER_NAMES) tier[name] = {};

  /** @type {Record<string, string>} */
  const semantic = {};

  for (const [key, value] of Object.entries(raw)) {
    // jewel-{family}-{step}
    const jewelMatch = key.match(/^jewel-([a-z]+)-(\d+)$/);
    if (jewelMatch) {
      const [, fam, step] = jewelMatch;
      if (!JEWEL_FAMILIES.includes(fam)) {
        throw new Error(`Unknown jewel family: ${fam} (in --hc-${key})`);
      }
      jewel[fam][step] = value;
      continue;
    }

    // lead-{family}-{step}
    const leadMatch = key.match(/^lead-([a-z]+)-(\d+)$/);
    if (leadMatch) {
      const [, fam, step] = leadMatch;
      if (!LEAD_FAMILIES.includes(fam)) {
        throw new Error(`Unknown lead family: ${fam} (in --hc-${key})`);
      }
      lead[fam][step] = value;
      continue;
    }

    // parchment-{step}
    const parchmentMatch = key.match(/^parchment-(\d+)$/);
    if (parchmentMatch) {
      parchment[parchmentMatch[1]] = value;
      continue;
    }

    // shadow-{step}
    const shadowMatch = key.match(/^shadow-(\d+)$/);
    if (shadowMatch) {
      shadow[shadowMatch[1]] = value;
      continue;
    }

    // glow-{name}
    const glowMatch = key.match(/^glow-([a-z]+)$/);
    if (glowMatch) {
      glow[glowMatch[1]] = value;
      continue;
    }

    // champion-{name}-{slot}
    const championMatch = key.match(/^champion-([a-z]+)-([a-z]+)$/);
    if (championMatch) {
      const [, name, slot] = championMatch;
      if (!CHAMPION_NAMES.includes(name)) {
        throw new Error(`Unknown champion: ${name} (in --hc-${key})`);
      }
      if (!CHAMPION_SLOTS.includes(slot)) {
        throw new Error(`Unknown champion slot: ${slot} (in --hc-${key})`);
      }
      champion[name][slot] = value;
      continue;
    }

    // resource-{name}-{slot} — name may contain a dash (shard-green)
    const resourceMatch = key.match(/^resource-(.+)-([a-z]+)$/);
    if (resourceMatch) {
      const [, name, slot] = resourceMatch;
      if (RESOURCE_NAMES.includes(name) && RESOURCE_SLOTS.includes(slot)) {
        resource[name][slot] = value;
        continue;
      }
    }

    // tier-{name}-{slot}
    const tierMatch = key.match(/^tier-([a-z]+)-([a-z]+)$/);
    if (tierMatch) {
      const [, name, slot] = tierMatch;
      if (TIER_NAMES.includes(name) && TIER_SLOTS.includes(slot)) {
        tier[name][slot] = value;
        continue;
      }
    }

    // Anything else → flat semantic record keyed by the suffix after --hc-.
    //
    // Semantic-bucket entries always store a `var(--hc-${key})` self-reference
    // rather than the raw CSS value. This keeps the TypeScript mirror honest:
    // the single source of truth for semantic values is the CSS custom
    // property at runtime, so callers resolve the var through the browser
    // cascade. This avoids drift when a token like --hc-lead-gold-700-alpha-35
    // is later rebalanced in tokens.css — the TS mirror references the token
    // by name, not by resolved literal.
    semantic[key] = `var(--hc-${key})`;
  }

  return { jewel, lead, parchment, shadow, glow, champion, resource, tier, semantic };
}

/**
 * Read and parse the tokens.css file at the given path.
 *
 * Defense-in-depth: rejects any path that resolves outside the project root.
 * Build-tool usage today only passes hardcoded in-repo paths, but this is an
 * exported module API — if a caller ever routed a partially-controlled path
 * (env var, Vite module id, config value) into it, a `../../etc/passwd` style
 * payload must not be able to read arbitrary files on the build host.
 *
 * Known limitation — symlinks are not resolved. The guard uses lexical path
 * arithmetic (`resolve` + `relative`), not `realpathSync`. A symlink inside
 * the repo pointing at an outside target (e.g. `tokens.css → /etc/passwd`)
 * would pass the guard because its resolved path still sits under the repo
 * root. This is the explicitly-accepted trade-off: `realpathSync` throws on
 * broken symlinks in CI and on untracked worktrees, and an attacker with
 * write access inside the repo is already a full compromise. If a future
 * caller accepts user-controlled paths, layer `realpathSync` on top here.
 *
 * @param {string} inputPath
 */
export function extractFromFile(inputPath) {
  const abs = resolve(inputPath);
  if (relative(PROJECT_ROOT, abs).startsWith('..')) {
    throw new Error(`extractFromFile: path escapes project root: ${relative(process.cwd(), abs)}`);
  }
  const css = readFileSync(abs, 'utf8');
  const raw = parseRawTokens(css);
  const grouped = groupTokens(raw);
  return { raw, grouped, count: Object.keys(raw).length };
}

/**
 * Serialize a plain-object tree as a TypeScript `as const` literal.
 *
 * @param {unknown} value
 * @param {number} depth
 */
function serializeValue(value, depth) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') {
    // Single-quote JS string with backslash-safe escaping.
    const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
  }
  if (typeof value !== 'object') return String(value);

  const indent = '  '.repeat(depth);
  const inner = '  '.repeat(depth + 1);
  const entries = Object.entries(value);
  if (entries.length === 0) return '{}';
  const body = entries
    .map(([k, v]) => {
      // Numeric keys get bare, non-numeric get quoted if they contain non-identifier chars.
      const keyStr =
        /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) || /^\d+$/.test(k) ? k : `'${k.replace(/'/g, "\\'")}'`;
      return `${inner}${keyStr}: ${serializeValue(v, depth + 1)},`;
    })
    .join('\n');
  return `{\n${body}\n${indent}}`;
}

/**
 * Render the full contents of `src/theme/tokens.ts`.
 *
 * @param {ReturnType<typeof groupTokens>} grouped
 * @returns {string}
 */
export function renderTokensModule(grouped) {
  const body = serializeValue(grouped, 0);
  return [
    '// src/theme/tokens.ts',
    '//',
    '// AUTO-GENERATED from src/styles/tokens.css by tools/vite-plugin-tokens.ts.',
    '// DO NOT edit by hand. Run `npm run dev` or `npm run verify:tokens` to regenerate.',
    '//',
    '// Source of truth: .claude/design/elysian-cathedral/palette.md',
    '',
    `export const HC_TOKENS = ${body} as const;`,
    '',
    'export type HCTokens = typeof HC_TOKENS;',
    '',
  ].join('\n');
}
