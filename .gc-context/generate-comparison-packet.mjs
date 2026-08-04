import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import playwright from '/home/ds/projects/embertide/node_modules/playwright/index.js';

const { chromium } = playwright;

const repo = '/home/ds/projects/embertide-lmw';
const preserved =
  '/home/ds/.gc-preserve/embertide/2026-08-04-stranded-worktree/illustrations';
const vault = '/home/ds/brain/Projects/Embertide';
const pngPath = join(vault, 'Illustration Recompression Comparison.png');
const notePath = join(vault, 'Illustration Recompression Comparison.md');

const names = [
  'cathedral_setup_landing_001.webp',
  'cathedral_altar_destiny_vurmox_001.webp',
  'cathedral_altar_frame_region_001.webp',
  'cathedral_combat_bg_dune_sanctum_001.webp',
  'cathedral_combat_bg_dune_sanctum_wild_001.webp',
  'cathedral_combat_bg_emberpeak_001.webp',
  'cathedral_combat_bg_emberpeak_wild_001.webp',
  'cathedral_combat_bg_gilded_cage_001.webp',
  'cathedral_combat_bg_gilded_cage_wild_001.webp',
  'cathedral_combat_bg_hollow_shrine_001.webp',
  'cathedral_combat_bg_hollow_shrine_wild_001.webp',
  'cathedral_combat_bg_maren_001.webp',
  'cathedral_combat_bg_maren_wild_001.webp',
  'cathedral_combat_bg_sylvani_001.webp',
  'cathedral_combat_bg_sylvani_wild_001.webp',
];

const highestProminence = new Set([
  'cathedral_setup_landing_001.webp',
  'cathedral_altar_destiny_vurmox_001.webp',
]);

const scratch = mkdtempSync(join(tmpdir(), 'embertide-illustration-comparison-'));
const mainDir = join(scratch, 'main');
execFileSync('mkdir', ['-p', mainDir]);

const records = names.map((name) => {
  const mainPath = join(mainDir, name);
  const mainBytes = execFileSync(
    'git',
    ['-C', repo, 'show', `origin/main:public/illustrations/${name}`],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  writeFileSync(mainPath, mainBytes);
  const recompressedPath = join(preserved, name);
  const recompressedBytes = statSync(recompressedPath).size;
  return {
    name,
    mainPath,
    recompressedPath,
    mainBytes: mainBytes.length,
    recompressedBytes,
    savedBytes: mainBytes.length - recompressedBytes,
    savedPercent: ((mainBytes.length - recompressedBytes) / mainBytes.length) * 100,
  };
});

const totalMain = records.reduce((sum, record) => sum + record.mainBytes, 0);
const totalRecompressed = records.reduce((sum, record) => sum + record.recompressedBytes, 0);
const totalSaved = totalMain - totalRecompressed;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

// Measure the altar ornament's real desktop target from the production CSS at
// the project's canonical 1280x800 viewport. The representative engaged pane
// matches BossStamp's tallest normal state.
const tokens = readFileSync(join(repo, 'src/styles/tokens.css'), 'utf8');
const appCss = readFileSync(join(repo, 'src/styles/app.css'), 'utf8');
const altarCss = readFileSync(join(repo, 'src/ui/BossAltarPane.css'), 'utf8');
await page.setContent(`<!doctype html><style>${tokens}\n${appCss}\n${altarCss}</style>
  <div class="board-side"><div class="board-side-crystal-rail"><div class="boss-altar-row">
    <button class="boss-altar-pane" data-variant="region">
      <div class="boss-altar-pane-header">REGION BOSS</div>
      <div class="boss-altar-pane-body">
        <div class="boss-altar-pane-art"></div>
        <div class="boss-altar-pane-name">BROODMAW</div>
        <div class="boss-altar-pane-hp">HP 18</div>
      </div>
    </button>
  </div></div></div>`);
const altarBox = await page.locator('.boss-altar-pane').boundingBox();
if (!altarBox) throw new Error('Could not measure boss altar pane');
const altarWidth = Math.round(altarBox.width);
const altarHeight = Math.round(altarBox.height);

const fileUrl = (path) => pathToFileURL(path).href;
const escapeHtml = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const humanBytes = (bytes) => `${(bytes / 1_000_000).toFixed(2)} MB`;
const binaryMegabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MiB`;

const rows = records
  .map((record, index) => {
    const isAltar = record.name.includes('_altar_');
    const isHighestProminence = highestProminence.has(record.name);
    const dimensions = isAltar ? `${altarWidth} x ${altarHeight}px` : '1280 x 800px';
    const renderClass = isAltar ? 'asset altar-asset' : 'asset viewport-asset';
    return `<section class="comparison ${isAltar ? 'altar-row' : ''} ${isHighestProminence ? 'highest-prominence' : ''}">
      <h2>${index + 1}. ${escapeHtml(record.name)}${isHighestProminence ? ' <span class="prominence-label">HIGHEST-PROMINENCE SURFACE</span>' : ''}</h2>
      <p class="meta">Compared at ${dimensions} &middot; CSS <code>object-fit: cover</code> &middot;
        ${humanBytes(record.mainBytes)} &rarr; ${humanBytes(record.recompressedBytes)}
        (${record.savedPercent.toFixed(1)}% smaller)</p>
      <div class="pair">
        <figure><figcaption>MAIN (origin/main)</figcaption><div class="asset-stage"><img class="${renderClass}" src="${fileUrl(record.mainPath)}"></div></figure>
        <figure><figcaption>RECOMPRESSED</figcaption><div class="asset-stage"><img class="${renderClass}" src="${fileUrl(record.recompressedPath)}"></div></figure>
      </div>
    </section>`;
  })
  .join('\n');

const recordFor = (name) => records.find((record) => record.name === name);
const cropSpecs = [
  {
    name: 'cathedral_combat_bg_hollow_shrine_001.webp',
    label: 'Gradient / mist — central fog and blue light falloff',
    pos: '50% 68%',
    kind: 'landscape',
  },
  {
    name: 'cathedral_combat_bg_sylvani_wild_001.webp',
    label: 'Gradient / foliage — dark tonal transitions and leaf edges',
    pos: '55% 42%',
    kind: 'landscape',
  },
  {
    name: 'cathedral_altar_destiny_vurmox_001.webp',
    label: 'Fine ornament — gold leading, chains, lanterns, and purple flame',
    pos: '50% 35%',
    kind: 'portrait',
  },
  {
    name: 'cathedral_altar_frame_region_001.webp',
    label: 'Fine ornament — altar frame edges and transparent cutout boundary',
    pos: '50% 28%',
    kind: 'portrait',
  },
];

const crops = cropSpecs
  .map((spec) => {
    const record = recordFor(spec.name);
    return `<section class="crop-comparison">
      <h3>${escapeHtml(spec.label)}</h3>
      <p class="meta">Diagnostic detail crop at approximately source-pixel scale (about 2x normal background render magnification; inspection aid, not normal display size).</p>
      <div class="pair">
        <figure><figcaption>MAIN CROP</figcaption><div class="crop ${spec.kind}"><img style="object-position:${spec.pos}" src="${fileUrl(record.mainPath)}"></div></figure>
        <figure><figcaption>RECOMPRESSED CROP</figcaption><div class="crop ${spec.kind}"><img style="object-position:${spec.pos}" src="${fileUrl(record.recompressedPath)}"></div></figure>
      </div>
    </section>`;
  })
  .join('\n');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { margin: 0; width: 2760px; padding: 56px; color: #f7f1df; background: #0b0d13; font: 22px/1.35 Arial, sans-serif; }
  header { margin-bottom: 48px; }
  h1 { margin: 0 0 12px; font: 700 48px/1.1 Georgia, serif; color: #e8c66a; }
  h2 { margin: 0 0 6px; font-size: 27px; color: #f7f1df; }
  h3 { margin: 0 0 6px; font-size: 26px; color: #e8c66a; }
  .prominence-label { margin-left: 18px; color: #e8c66a; font: 700 16px/1.2 Arial, sans-serif; letter-spacing: .06em; }
  p { margin: 4px 0; }
  .lede { max-width: 1900px; font-size: 25px; }
  .meta { color: #bfc5cf; font-size: 19px; }
  code { color: #e8c66a; }
  .comparison, .crop-comparison { margin: 0 0 46px; padding-top: 28px; border-top: 1px solid #4b4f59; }
  .pair { display: grid; grid-template-columns: 1280px 1280px; gap: 32px; }
  figure { margin: 12px 0 0; }
  figcaption { height: 38px; color: #e8c66a; font-weight: 700; letter-spacing: .08em; font-size: 18px; }
  .asset-stage { width: 1280px; min-height: 800px; display: grid; place-items: center; background: #05080f; border: 2px solid #77715f; overflow: hidden; }
  .viewport-asset { width: 1280px; height: 800px; object-fit: cover; display: block; }
  .altar-row .asset-stage { min-height: 320px; }
  .altar-asset { width: ${altarWidth}px; height: ${altarHeight}px; object-fit: cover; display: block; border: 1px solid #b89142; }
  .crop { width: 1280px; height: 520px; overflow: hidden; border: 2px solid #77715f; background: #05080f; }
  .crop img { width: 2752px; height: 1536px; object-fit: none; display: block; }
  .crop.portrait img { width: 1792px; height: 2400px; }
  footer { border-top: 1px solid #4b4f59; padding-top: 28px; color: #bfc5cf; }
</style></head><body>
  <header><h1>Illustration recompression comparison</h1>
    <p class="lede">Neutral evidence packet: main is on the left and the preserved recompressed candidate is on the right. Backgrounds are rendered at the game's canonical 1280 x 800 viewport; altar ornaments are rendered at the measured ${altarWidth} x ${altarHeight}px engaged-pane size at that viewport.</p>
    <p class="lede">The 15 candidates reduce these files from ${humanBytes(totalMain)} to ${humanBytes(totalRecompressed)}, a ${humanBytes(totalSaved)} (${((totalSaved / totalMain) * 100).toFixed(1)}%) first-load saving.</p>
    <p class="lede">The setup landing and Vurmox destiny altar are shown first and marked as the two highest-prominence surfaces under the pre-registered review bar.</p>
  </header>
  ${rows}
  <section><h1>Worst-case detail crops</h1><p class="lede">These enlarged crops isolate the two named risks: smooth-gradient banding and loss of fine ornament linework.</p></section>
  ${crops}
  <footer>Generated from <code>origin/main</code> and the read-only preserved candidate directory on 2026-08-04. This packet makes no recommendation.</footer>
</body></html>`;

const htmlPath = join(scratch, 'packet.html');
writeFileSync(htmlPath, html);
await page.setViewportSize({ width: 2760, height: 1000 });
await page.goto(fileUrl(htmlPath), { waitUntil: 'load' });
await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth));
await page.screenshot({ path: pngPath, fullPage: true, type: 'png' });
await browser.close();

const tableRows = records
  .map(
    (record) =>
      `| \`${record.name}\` | ${humanBytes(record.mainBytes)} | ${humanBytes(record.recompressedBytes)} | ${record.savedPercent.toFixed(1)}% |`,
  )
  .join('\n');

const markdown = `# Illustration recompression comparison

![Side-by-side comparison](./${basename(pngPath)})

The trade in plain English: these 15 files make the first load **14.3 MB smaller**, while lossy recompression can make smooth color changes look stepped or fine decorative lines look softer; the packet puts both versions side by side so that trade can be judged visually.

This is a neutral evidence packet. It makes no recommendation; the ruling belongs in embertide-1lw.

## How the comparison is sized

- The 12 combat backgrounds are shown at **1280 x 800 px**, the project's canonical gameplay target. Production CSS fills the combat viewport and uses \`object-fit: cover\` (\`src/ui/CombatScreen.css\`).
- The setup landing background is shown at **1280 x 800 px**. Production CSS covers the setup viewport with the image centered (\`src/styles/app.css\`, \`.setup-root-cathedral\`).
- Both altar ornaments are shown at **${altarWidth} x ${altarHeight} px**, measured from the production boss-altar CSS in the tallest normal engaged state at a 1280 x 800 viewport. Production CSS uses \`object-fit: cover\` (\`src/ui/BossAltarPane.css\`).
- The final four rows are explicitly enlarged diagnostic crops, not normal render sizes. They isolate smooth mist/dark gradients and intricate frame/chain linework.
- The setup landing and Vurmox destiny altar appear first and are labeled as the two highest-prominence surfaces under the pre-registered review bar.

## File sizes

| File | Main | Recompressed | Saved |
|---|---:|---:|---:|
${tableRows}
| **Total** | **${humanBytes(totalMain)}** | **${humanBytes(totalRecompressed)}** | **${((totalSaved / totalMain) * 100).toFixed(1)}% (${humanBytes(totalSaved)})** |

The established inventory framing is a **14.3 MB first-load saving** (22.6 MB to 8.4 MB). In exact units, the files move from ${humanBytes(totalMain)} (${binaryMegabytes(totalMain)}) to ${humanBytes(totalRecompressed)} (${binaryMegabytes(totalRecompressed)}), saving ${humanBytes(totalSaved)} (${binaryMegabytes(totalSaved)}). The inventory figures use binary-sized totals rounded to one decimal place while retaining the familiar “MB” label; the table uses decimal MB consistently per file.

## Sources and scope

- Main images: extracted read-only with \`git show origin/main:public/illustrations/<file>\` from commit \`0f2a639\`.
- Candidate images: read-only from \`/home/ds/.gc-preserve/embertide/2026-08-04-stranded-worktree/illustrations/\`.
- All 15 files named by embertide-1lw are included.
- The packet does not identify the recompression tool or settings; those are unknown and remain part of the later ruling/requalification work if the candidate is accepted.
`;
writeFileSync(notePath, markdown);

console.log(JSON.stringify({ pngPath, notePath, altarWidth, altarHeight, totalMain, totalRecompressed, totalSaved }, null, 2));
rmSync(scratch, { recursive: true, force: true });
