#!/usr/bin/env node
// art-preview-server.mjs — zero-dependency local gallery for reviewing the
// card rasters in public/illustrations/. Groups by category, badges the ones
// already regenerated (read from scripts/.regen-done.txt), and serves images.
//
//   node scripts/art-preview-server.mjs [--port=4317]
import { createServer } from 'node:http';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DIR = join(ROOT, 'public', 'illustrations');
const PORT = Number(process.argv.find((a) => a.startsWith('--port='))?.split('=')[1] ?? 4317);

const MIME = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };

function regenerated() {
  try {
    return new Set(readFileSync(join(HERE, '.regen-done.txt'), 'utf8').split('\n').filter(Boolean));
  } catch {
    return new Set();
  }
}

// cathedral_<category>_<rest>_001.webp → category bucket
function categoryOf(f) {
  const m = f.match(/^cathedral_([a-z]+)_/);
  const c = m ? m[1] : 'other';
  if (f.includes('_boss_door')) return 'boss door';
  if (f.startsWith('cathedral_combat_bg')) return 'combat bg';
  return { hero: 'hero', monster: 'monster', item: 'item', altar: 'altar/relic', zone: 'zone', chest: 'chest', colosseum: 'colosseum' }[c] ?? c;
}

function page() {
  const done = regenerated();
  const files = readdirSync(DIR).filter((f) => MIME[extname(f)]).sort();
  const groups = new Map();
  for (const f of files) {
    const cat = categoryOf(f);
    if (!groups.has(cat)) groups.set(cat, []);
    const base = f.replace(/_001\.(webp|png)$/, '');
    groups.get(cat).push({ f, isNew: done.has(base + '.md') });
  }
  const order = ['hero', 'monster', 'item', 'combat bg', 'boss door', 'altar/relic', 'zone', 'chest', 'colosseum', 'other'];
  const cats = [...groups.keys()].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
  const newCount = files.filter((f) => done.has(f.replace(/_001\.(webp|png)$/, '') + '.md')).length;

  const sections = cats.map((cat) => {
    const items = groups.get(cat);
    const n = items.filter((i) => i.isNew).length;
    const cells = items.map((i) => `
      <figure class="${i.isNew ? 'new' : 'old'}">
        <img loading="lazy" src="/img/${encodeURIComponent(i.f)}" alt="${i.f}">
        ${i.isNew ? '<span class="badge">REGENERATED</span>' : '<span class="badge old">legacy</span>'}
        <figcaption>${i.f.replace(/^cathedral_/, '').replace(/_001\.(webp|png)$/, '')}</figcaption>
      </figure>`).join('');
    return `<h2>${cat} <small>${n}/${items.length} regenerated</small></h2><div class="grid">${cells}</div>`;
  }).join('');

  return `<!doctype html><meta charset="utf8"><title>Embertide — Art Preview</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; background:#0b0e16; color:#e8e3d8; font:15px/1.4 system-ui,sans-serif; }
  header { position:sticky; top:0; background:#0b0e16ee; backdrop-filter:blur(6px); padding:14px 20px; border-bottom:1px solid #2a2f3e; z-index:2; }
  h1 { margin:0; font-size:18px; } header small { color:#9aa3b8; }
  h2 { margin:28px 20px 8px; font-size:16px; text-transform:capitalize; } h2 small { color:#8a93a8; font-weight:400; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:14px; padding:0 20px; }
  figure { margin:0; position:relative; background:#141926; border:1px solid #232838; border-radius:10px; overflow:hidden; }
  figure.new { border-color:#3a7d4f; }
  img { width:100%; aspect-ratio:1; object-fit:cover; display:block; }
  figcaption { padding:6px 8px; font-size:11px; color:#aab2c6; word-break:break-word; }
  .badge { position:absolute; top:6px; left:6px; font-size:9px; font-weight:700; letter-spacing:.04em; padding:3px 6px; border-radius:5px; background:#2e7d4f; color:#fff; }
  .badge.old { background:#4a4030; color:#cdbfa3; }
  figure.old img { opacity:.55; filter:saturate(.7); }
</style>
<header><h1>Embertide — Art Preview <small>· ${newCount}/${files.length} regenerated · green = new original art, dim = legacy (awaiting regen)</small></h1></header>
${sections}`;
}

createServer((req, res) => {
  try {
    if (req.url === '/' || req.url === '') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf8' });
      return res.end(page());
    }
    if (req.url.startsWith('/img/')) {
      const name = decodeURIComponent(req.url.slice('/img/'.length));
      const p = join(DIR, name);
      if (!p.startsWith(DIR) || !existsSync(p)) { res.writeHead(404); return res.end('nope'); }
      res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      return res.end(readFileSync(p));
    }
    res.writeHead(404); res.end('not found');
  } catch (e) {
    res.writeHead(500); res.end(String(e));
  }
}).listen(PORT, () => console.log(`art preview → http://localhost:${PORT}/`));
