import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'docs/decisions/icon-final-art-packet/contact-sheet.png');

await mkdir(dirname(output), { recursive: true });

const server = await createServer({
  root,
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
});

let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Vite did not bind a TCP port');

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1200 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${address.port}/tools/icon-final-art-contact-sheet/index.html`, {
    waitUntil: 'networkidle',
  });
  await page.locator('#contact-sheet').screenshot({ path: output });
  process.stdout.write(`${output}\n`);
} finally {
  await browser?.close();
  await server.close();
}
