/**
 * Visual verification for the stained-glass d20 (embertide-x4r2,
 * commit 5c48e76 + post-capture polish). Mirrors the production
 * D20Face SVG (src/ui/DieRollReveal.tsx) into a parchment panel
 * matching the production modal so the user can eyeball facets, gold
 * leading, specular gloss, and numeral legibility.
 *
 * Captures faces 1, 14, 20 (settled) plus a mid-tumble snapshot.
 *
 * Note: this spec inlines the SVG markup rather than mounting the
 * React component — keep this in sync with src/ui/DieRollReveal.tsx
 * if the D20Face geometry, gradients, or stroke widths change.
 */

import { test } from '@playwright/test';
import { bootApp } from './harness';

const D20_SVG = (face: number, rotateDeg = 0): string => `
  <svg viewBox="0 0 88 88" width="128" height="128" style="display:block; transform: rotate(${rotateDeg}deg); filter: drop-shadow(0 6px 14px rgba(0,0,0,0.5));">
    <defs>
      <linearGradient id="f1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#8fb8ee" stop-opacity="0.92"/><stop offset="100%" stop-color="#1a3568" stop-opacity="0.98"/></linearGradient>
      <linearGradient id="f2" x1="1" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6e9bdc" stop-opacity="0.88"/><stop offset="100%" stop-color="#102347" stop-opacity="0.98"/></linearGradient>
      <linearGradient id="f3" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stop-color="#385d9d" stop-opacity="0.92"/><stop offset="100%" stop-color="#070f25" stop-opacity="0.98"/></linearGradient>
      <linearGradient id="f4" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#4773b6" stop-opacity="0.9"/><stop offset="100%" stop-color="#0f1f3f" stop-opacity="0.98"/></linearGradient>
      <linearGradient id="f5" x1="1" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#9cc1f0" stop-opacity="0.92"/><stop offset="100%" stop-color="#1d3a6d" stop-opacity="0.98"/></linearGradient>
      <radialGradient id="ctr" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#fbf3d8"/><stop offset="70%" stop-color="#e6cf95"/><stop offset="100%" stop-color="#b88f48"/></radialGradient>
      <radialGradient id="gloss" cx="30%" cy="22%" r="55%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.45"/><stop offset="60%" stop-color="#ffffff" stop-opacity="0.08"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
    </defs>
    <polygon points="44,2 84,31 69,80 19,80 4,31" fill="#1a2e57" stroke="#7a5a1e" stroke-width="2.5" stroke-linejoin="round"/>
    <polygon points="44,2 84,31 61,49 55,28" fill="url(#f1)" stroke="#b89142" stroke-width="1.8" stroke-linejoin="round"/>
    <polygon points="84,31 69,80 44,62 61,49" fill="url(#f2)" stroke="#b89142" stroke-width="1.8" stroke-linejoin="round"/>
    <polygon points="69,80 19,80 27,49 44,62" fill="url(#f3)" stroke="#b89142" stroke-width="1.8" stroke-linejoin="round"/>
    <polygon points="19,80 4,31 33,28 27,49" fill="url(#f4)" stroke="#b89142" stroke-width="1.8" stroke-linejoin="round"/>
    <polygon points="4,31 44,2 55,28 33,28" fill="url(#f5)" stroke="#b89142" stroke-width="1.8" stroke-linejoin="round"/>
    <polygon points="44,62 27,49 33,28 55,28 61,49" fill="url(#ctr)" stroke="#7a5a1e" stroke-width="1.8" stroke-linejoin="round"/>
    <text x="44" y="44" text-anchor="middle" dominant-baseline="central" font-family="Cinzel, serif" font-size="22" font-weight="800" fill="#1a1005" letter-spacing="0.02em">${face}</text>
    <polygon points="44,2 84,31 69,80 19,80 4,31" fill="url(#gloss)" pointer-events="none"/>
  </svg>`;

async function captureD20(
  page: import('@playwright/test').Page,
  face: number,
  label: string,
  rotateDeg = 0,
): Promise<void> {
  await bootApp(page);
  await page.setContent(`
    <html><body style="margin:0; padding:48px; background: radial-gradient(circle at 30% 25%, #f7eccf 0%, #dbc289 65%, #b28a48 100%); display:flex; align-items:center; justify-content:center; min-height:100vh;">
      <div style="background: radial-gradient(circle at 30% 25%, #f7eccf 0%, #dbc289 65%, #b28a48 100%); border:2px solid #b89142; border-radius:18px; padding:32px 44px; box-shadow:0 0 0 4px rgba(184,145,66,0.35), 0 12px 40px rgba(0,0,0,0.45); display:flex; flex-direction:column; align-items:center; gap:20px;">
        <div style="font-family:Cinzel, serif; font-size:22px; font-weight:700; color:#1a1005; letter-spacing:0.06em; text-transform:uppercase;">Region Boss Reward</div>
        <div style="width:144px; height:144px; background: radial-gradient(circle at 50% 45%, rgba(232,189,89,0.28) 0%, rgba(232,189,89,0.12) 35%, transparent 70%); border-radius:50%; display:flex; align-items:center; justify-content:center;">${D20_SVG(face, rotateDeg)}</div>
        <div style="font-family:Cinzel, serif; font-size:18px; font-weight:600; color:#1a1005; background:rgba(255,255,255,0.55); padding:8px 14px; border:1px solid #b89142; border-radius:10px;">Face ${face}</div>
      </div>
    </body></html>`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `.screenshots/x4r2-d20-${label}.png`, fullPage: false });
}

test('x4r2: stained-glass d20 face 1 (lower bound)', async ({ page }) => {
  await captureD20(page, 1, 'face-1');
});
test('x4r2: stained-glass d20 face 14 (mid tier)', async ({ page }) => {
  await captureD20(page, 14, 'face-14');
});
test('x4r2: stained-glass d20 face 20 (legendary tier)', async ({ page }) => {
  await captureD20(page, 20, 'face-20');
});
test('x4r2: stained-glass d20 mid-tumble (rotated 180deg, displaying random face)', async ({
  page,
}) => {
  await captureD20(page, 7, 'mid-tumble', 180);
});
