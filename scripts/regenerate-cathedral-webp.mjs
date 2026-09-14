/**
 * Regenerate the 15 Cathedral assets that were originally committed as JPEG
 * or PNG payloads with misleading `.webp` names.
 *
 * Reproducibility contract:
 *   npm ci
 *   npm run illustrations:webp
 *
 * The npm lockfile pins sharp 0.34.3 and its platform libvips packages. This
 * script additionally refuses to run unless sharp reports libvips 8.17.1 and
 * libwebp 1.5.0, the exact encoder stack used for the committed output.
 * Sources are immutable blobs in commit 0f2a639; their SHA-256 values below
 * prevent a changed ref or corrupt object from silently producing new art.
 *
 * Encoder settings are explicit rather than relying on sharp defaults:
 *   JPEG sources: WebP lossy, quality 82, effort 4, 4:2:0 chroma
 *                 (smartSubsample false), no near-lossless mode.
 *   PNG sources:  WebP lossless, effort 6, exact alpha and visible RGB.
 *
 * Run with --check to regenerate in memory and require byte-identical files
 * without writing. The script also verifies RIFF/WEBP and VP8/VP8L headers.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SOURCE_COMMIT = '0f2a639836896b090c7fb84c6f393fbb2e12955b';
const REQUIRED_VERSIONS = { sharp: '0.34.3', vips: '8.17.1', webp: '1.5.0' };
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const checkOnly = process.argv.includes('--check');

const assets = [
  [
    'cathedral_setup_landing_001.webp',
    'jpeg',
    '60b8e793c2e3c3511fd1b8f5b16962faf5a5706217b6ad036195afccc92d633a',
  ],
  [
    'cathedral_altar_destiny_vurmox_001.webp',
    'png',
    'f0481f31eed8055f3649bd9dd6ece535f10184e577606e78e1595dacbb75c898',
  ],
  [
    'cathedral_altar_frame_region_001.webp',
    'png',
    'eb4cc05759f2d359ec2d8c5db519c191430dde790bd45d07039cfff381856ec6',
  ],
  [
    'cathedral_combat_bg_dune_sanctum_001.webp',
    'jpeg',
    'f63a0391b4f40720a3be490a8dfa67ca13b311674fa425d3a383963137b9daa5',
  ],
  [
    'cathedral_combat_bg_dune_sanctum_wild_001.webp',
    'jpeg',
    '7fc78cce82a766faf62367a0df471968d4cc026bc88d0cf88f3e02fac085700c',
  ],
  [
    'cathedral_combat_bg_emberpeak_001.webp',
    'jpeg',
    'ef676fbb4563817dc232c96d3cf1e5f601573041e6131015a27b3fbb39dc8e42',
  ],
  [
    'cathedral_combat_bg_emberpeak_wild_001.webp',
    'jpeg',
    '9abf53b08666d9fe8ce841954ec924224922950748a1d2512f9bf41ca5c337f9',
  ],
  [
    'cathedral_combat_bg_gilded_cage_001.webp',
    'jpeg',
    '897942436393d6cf7f96fa54f1a5096fb2d8a3107dc1eed31a294bc57c275e4b',
  ],
  [
    'cathedral_combat_bg_gilded_cage_wild_001.webp',
    'jpeg',
    '5e0611dd761f2924b9943b07342a2ccd0f6433ef596ca4ca223a065969e779e4',
  ],
  [
    'cathedral_combat_bg_hollow_shrine_001.webp',
    'jpeg',
    'ea254363665cd271d3311f5aaa6b4881939496f7dc1e22adecad68ff2463f932',
  ],
  [
    'cathedral_combat_bg_hollow_shrine_wild_001.webp',
    'jpeg',
    '645fcbf4e03370f90d926f1da0b9e9923743cc13171b37d7f41b24850d991053',
  ],
  [
    'cathedral_combat_bg_maren_001.webp',
    'jpeg',
    '7372bdfd7e2e3193d04a2e4610bb369a10fbb7ee677d063bbde6e533c73cf840',
  ],
  [
    'cathedral_combat_bg_maren_wild_001.webp',
    'jpeg',
    '377791c7695fc49ba4508375c146ab9ea21356efefbd82198fb1b298b1429231',
  ],
  [
    'cathedral_combat_bg_sylvani_001.webp',
    'jpeg',
    'faf1510b7bd2f6a599f7fefbadddd53e8abd7faca6145a267231664f53324d82',
  ],
  [
    'cathedral_combat_bg_sylvani_wild_001.webp',
    'jpeg',
    'c74a72cf8747a0adeba13125a5a5068185b0103ea598c7c1c83a0beea24f0dc5',
  ],
];

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function assertEncoderVersions() {
  for (const [name, expected] of Object.entries(REQUIRED_VERSIONS)) {
    if (sharp.versions[name] !== expected) {
      throw new Error(`Expected ${name} ${expected}, found ${sharp.versions[name] ?? 'none'}`);
    }
  }
}

function assertSourceHeader(bytes, kind, name) {
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  if ((kind === 'jpeg' && !isJpeg) || (kind === 'png' && !isPng)) {
    throw new Error(`${name}: expected ${kind.toUpperCase()} source header`);
  }
}

function assertWebpHeader(bytes, expectedChunk, name) {
  const riff = bytes.subarray(0, 4).toString('ascii');
  const webp = bytes.subarray(8, 12).toString('ascii');
  const chunk = bytes.subarray(12, 16).toString('ascii');
  if (riff !== 'RIFF' || webp !== 'WEBP' || chunk !== expectedChunk) {
    throw new Error(`${name}: expected RIFF/WEBP ${expectedChunk}, found ${riff}/${webp} ${chunk}`);
  }
}

async function encode(source, kind) {
  const encoder = sharp(source, { failOn: 'error', limitInputPixels: false });
  if (kind === 'png') {
    return encoder.webp({ lossless: true, effort: 6 }).toBuffer();
  }
  return encoder
    .webp({
      lossless: false,
      nearLossless: false,
      quality: 82,
      effort: 4,
      smartSubsample: false,
    })
    .toBuffer();
}

assertEncoderVersions();
sharp.concurrency(1);

let sourceBytes = 0;
let outputBytes = 0;
for (const [name, kind, expectedSourceHash] of assets) {
  const source = execFileSync('git', ['show', `${SOURCE_COMMIT}:public/illustrations/${name}`], {
    cwd: repoRoot,
    maxBuffer: 64 * 1024 * 1024,
  });
  assertSourceHeader(source, kind, name);
  const actualSourceHash = sha256(source);
  if (actualSourceHash !== expectedSourceHash) {
    throw new Error(`${name}: source SHA-256 ${actualSourceHash} != ${expectedSourceHash}`);
  }

  const output = await encode(source, kind);
  assertWebpHeader(output, kind === 'png' ? 'VP8L' : 'VP8 ', name);
  const target = join(repoRoot, 'public', 'illustrations', name);

  if (checkOnly) {
    const committed = readFileSync(target);
    if (!committed.equals(output)) {
      throw new Error(`${name}: committed file is not byte-identical to regenerated output`);
    }
  } else {
    const temporary = `${target}.tmp`;
    try {
      writeFileSync(temporary, output);
      renameSync(temporary, target);
    } catch (writeError) {
      try {
        unlinkSync(temporary);
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') {
          console.warn(`${name}: could not remove temporary file after write failure`);
        }
      }
      throw writeError;
    }
  }

  sourceBytes += source.length;
  outputBytes += output.length;
  console.log(`${checkOnly ? 'checked' : 'wrote'} ${name} ${source.length} -> ${output.length}`);
}

console.log(
  `${assets.length} genuine WebP files; saved ${sourceBytes - outputBytes} bytes (${(
    ((sourceBytes - outputBytes) / sourceBytes) *
    100
  ).toFixed(1)}%)`,
);
