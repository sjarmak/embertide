#!/usr/bin/env node
// fal-generate.mjs — one-shot fal.ai raster generator for the Elysian
// Cathedral art pipeline. Reads a prompt markdown file, dispatches to
// fal-ai/nano-banana-pro, downloads the resulting webp, and saves it to
// public/illustrations/.
//
// Usage:
//   FAL_API_KEY=... node scripts/fal-generate.mjs <prompt-md-path> [--out=<webp-path>]
//
// The prompt markdown must start with a frontmatter-style bullet list
// that declares `Raster:` and a `## Prompt` heading. Example:
//
//   - **Raster:** `public/illustrations/cathedral_monster_foo_001.webp`
//   ...
//   ## Prompt
//   Stained glass cathedral window illustration ...
//
// Defaults (matches existing rasters in docs/prompts/):
//   model:         fal-ai/nano-banana-pro
//   aspect_ratio:  1:1
//   output_format: webp
//   resolution:    2K
//   num_images:    1

import { readFile, writeFile, access } from 'node:fs/promises';
import { argv, env, exit, stdout, stderr } from 'node:process';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');

const FAL_ENDPOINT = 'https://fal.run/fal-ai/nano-banana-pro';
const DEFAULT_PARAMS = {
  aspect_ratio: '1:1',
  output_format: 'webp',
  resolution: '2K',
  num_images: 1,
};

async function loadEnvFile(path) {
  try {
    const content = await readFile(path, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (env[key]) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  } catch {
    // ~/.env optional
  }
}

function parsePromptMarkdown(md) {
  const rasterMatch = md.match(/\*\*Raster:\*\*\s*`([^`]+)`/);
  // Capture everything from `## Prompt` to end of file (or the next `##`
  // heading, whichever comes first). The previous form used the `m` flag
  // with non-greedy `+?`, which made `$` an end-of-LINE anchor and silently
  // truncated multi-paragraph prompts to their first paragraph — leaving
  // critical canonical details (e.g. Tidewraith's eel-serpent body, jellet
  // eye structure, Craghorn's CRITICAL EYE RENDERING block) out of the FAL
  // request entirely.
  const promptMatch = md.match(/##\s*Prompt\s*\n+([\s\S]+?)(?=\n##\s|\s*$)/);
  const paramsMatch = md.match(/\*\*Params:\*\*\s*(.+)/);
  if (!rasterMatch) throw new Error('Prompt md missing **Raster:** line');
  if (!promptMatch) throw new Error('Prompt md missing ## Prompt section');
  const raster = rasterMatch[1].trim();
  const prompt = promptMatch[1].trim();

  // Parse inline `key=value` pairs from the **Params:** bullet so a single
  // prompt doc is the source of truth for aspect ratio / format / resolution.
  const params = { ...DEFAULT_PARAMS };
  if (paramsMatch) {
    for (const kv of paramsMatch[1].matchAll(/`([^=]+)=([^`]+)`/g)) {
      const key = kv[1].trim();
      const raw = kv[2].trim();
      const num = Number(raw);
      params[key] = Number.isFinite(num) && String(num) === raw ? num : raw;
    }
  }
  return { raster, prompt, params };
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// Convert a uniform chroma-key background to an alpha channel.
//
// Supports BOTH the green (#00FF00) and magenta (#FF00FF) chroma contracts
// — some briefs were authored against a magenta backdrop, and a green-only
// keyer left the raw pink showing on the card face (the "+1 gem" pink-bg
// defect). `chroma` selects which channel-distance metric to key:
//   - 'green':   chromaness = G - max(R, B)   (subject forbids green)
//   - 'magenta': chromaness = min(R, B) - G   (subject forbids magenta)
// Uses a soft threshold so anti-aliased edges fall off cleanly, plus a
// spill-decontamination step that pulls any kept pixel's chroma channel(s)
// back toward the opposite channel so residual backdrop spill on the
// subject edge is neutralised.
function applyChromaKeyToAlpha(pngBuffer, chroma = 'green') {
  const decoded = PNG.sync.read(pngBuffer);
  const { data } = decoded;
  const HIGH = 120; // chromaness ≥ this → fully transparent
  const LOW = 50; // chromaness in (LOW, HIGH) → linear falloff
  const FALLOFF = HIGH - LOW;
  const isMagenta = chroma === 'magenta';
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const chromaness = isMagenta ? Math.min(r, b) - g : g - Math.max(r, b);
    let alpha = data[i + 3];
    if (chromaness >= HIGH) {
      alpha = 0;
    } else if (chromaness > LOW) {
      alpha = Math.round(alpha * (1 - (chromaness - LOW) / FALLOFF));
    }
    if (alpha > 0) {
      if (isMagenta) {
        // Magenta spill = residual high R and B on the subject. Clamp both
        // down toward green so a kept edge pixel loses the pink tint.
        if (r > g) data[i] = g;
        if (b > g) data[i + 2] = g;
      } else {
        const maxRB = Math.max(r, b);
        if (g > maxRB) data[i + 1] = maxRB;
      }
    }
    data[i + 3] = alpha;
  }
  decoded.colorType = 6; // RGBA
  return PNG.sync.write(decoded);
}

async function main() {
  const args = argv.slice(2);
  if (args.length < 1) {
    stderr.write('usage: fal-generate.mjs <prompt-md> [--out=<webp>] [--force]\n');
    exit(2);
  }
  const promptPath = resolve(args[0]);
  const outOverride = args.find((a) => a.startsWith('--out='))?.slice('--out='.length);
  const force = args.includes('--force');

  await loadEnvFile(resolve(env.HOME ?? '/root', '.env'));
  const key = env.FAL_API_KEY ?? env.FAL_KEY;
  if (!key) {
    stderr.write('FAL_API_KEY not set (checked ~/.env and env vars)\n');
    exit(2);
  }

  const md = await readFile(promptPath, 'utf8');
  const { raster, prompt, params } = parsePromptMarkdown(md);
  const rasterAbs = outOverride ? resolve(outOverride) : resolve(REPO_ROOT, raster);

  if (!force && (await exists(rasterAbs))) {
    stdout.write(`skip (exists): ${rasterAbs}\n`);
    return;
  }

  stdout.write(`→ ${basename(promptPath)}  (${prompt.length} chars, ${params.output_format})\n`);
  const body = JSON.stringify({ prompt, ...params });
  const res = await fetch(FAL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${key}`,
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fal.run ${res.status} ${res.statusText}: ${text}`);
  }
  const payload = await res.json();
  const url = payload?.images?.[0]?.url;
  if (!url) {
    throw new Error(`Unexpected fal.run response shape: ${JSON.stringify(payload)}`);
  }
  const webpRes = await fetch(url);
  if (!webpRes.ok) {
    throw new Error(`Fetching webp failed: ${webpRes.status} ${webpRes.statusText}`);
  }
  let buf = Buffer.from(await webpRes.arrayBuffer());
  const declaresChroma = params.output_format === 'png' && /chroma-key|#00FF00|#FF00FF/i.test(prompt);
  if (declaresChroma) {
    // Pick the chroma color the brief actually declares. Magenta (#FF00FF)
    // takes precedence only when explicitly named; otherwise default green.
    const chroma = /#FF00FF|magenta/i.test(prompt) ? 'magenta' : 'green';
    const before = buf.length;
    buf = applyChromaKeyToAlpha(buf, chroma);
    stdout.write(`  chroma-key (${chroma}) → alpha (${before} → ${buf.length} bytes)\n`);
  }
  await writeFile(rasterAbs, buf);
  stdout.write(`✓ saved ${rasterAbs} (${buf.length} bytes)\n`);
}

main().catch((err) => {
  stderr.write(`FAIL ${err.message}\n`);
  exit(1);
});
