// tools/vite-plugin-tokens.ts
//
// Vite plugin that keeps src/theme/tokens.ts in sync with src/styles/tokens.css.
//
// Behavior:
//   - At build start (dev + prod) parses tokens.css, emits src/theme/tokens.ts.
//   - In dev mode, watches tokens.css and regenerates on edit.
//   - Logs `[tokens] emitted: N entries` so the pipeline is visible.
//
// The drift-check script (scripts/verify-tokens.mjs) imports the same
// extractor so CI can fail on mismatch between tokens.css and the committed
// tokens.ts mirror.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin, ViteDevServer } from 'vite';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — untyped sibling .mjs helper; we consume it via its public shape.
import { parseRawTokens, groupTokens, renderTokensModule } from './extract-tokens.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_SOURCE = resolve(__dirname, '..', 'src', 'styles', 'tokens.css');
const DEFAULT_OUTPUT = resolve(__dirname, '..', 'src', 'theme', 'tokens.ts');

export interface TokensPluginOptions {
  source?: string;
  output?: string;
}

interface GenerationResult {
  content: string;
  count: number;
}

function generate(sourcePath: string): GenerationResult {
  const css = readFileSync(sourcePath, 'utf8');
  const raw = parseRawTokens(css);
  const grouped = groupTokens(raw);
  return {
    content: renderTokensModule(grouped),
    count: Object.keys(raw).length,
  };
}

function writeIfChanged(target: string, content: string): boolean {
  try {
    const existing = readFileSync(target, 'utf8');
    if (existing === content) return false;
  } catch {
    // File missing — fall through to write.
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf8');
  return true;
}

export function tokensPlugin(options: TokensPluginOptions = {}): Plugin {
  const source = options.source ?? DEFAULT_SOURCE;
  const output = options.output ?? DEFAULT_OUTPUT;

  const emit = (): void => {
    const { content, count } = generate(source);
    const changed = writeIfChanged(output, content);
    if (changed) {
      console.log(`[tokens] emitted: ${count} entries`);
    } else {
      console.log(`[tokens] up-to-date: ${count} entries`);
    }
  };

  return {
    name: 'hc-tokens',
    buildStart() {
      emit();
    },
    configureServer(server: ViteDevServer) {
      emit();
      server.watcher.add(source);
      server.watcher.on('change', (file: string) => {
        if (resolve(file) === resolve(source)) {
          try {
            emit();
          } catch (error) {
            console.error('[tokens] regeneration failed:', error);
          }
        }
      });
    },
  };
}

export default tokensPlugin;
