import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

const FORCED_CLIENT_RELOAD = `    .then(() => self.clients.matchAll())
    .then((clients) => {
      clients.forEach((client) => {
        if (client instanceof WindowClient)
          client.navigate(client.url);
      });
      return Promise.resolve();
    })
`;

export function removeForcedClientReload(serviceWorker: string): string {
  if (!serviceWorker.includes('self.registration.unregister()')) {
    throw new Error('Expected the generated service worker to unregister itself.');
  }
  if (!serviceWorker.includes('self.caches.delete(cacheName)')) {
    throw new Error('Expected the generated service worker to clear Cache Storage.');
  }
  if (!serviceWorker.includes(FORCED_CLIENT_RELOAD)) {
    throw new Error(
      'The vite-plugin-pwa self-destroying worker changed; refusing to ship an unverified reload path.',
    );
  }

  const safeWorker = serviceWorker.replace(FORCED_CLIENT_RELOAD, '');
  if (safeWorker.includes('client.navigate(')) {
    throw new Error('The generated service worker still force-reloads a client.');
  }
  return safeWorker;
}

export function pwaNoForcedReload(): Plugin {
  let serviceWorkerPath: string;

  return {
    name: 'embertide-pwa-no-forced-reload',
    apply: 'build',
    enforce: 'post',
    configResolved(config: ResolvedConfig) {
      serviceWorkerPath = resolve(config.root, config.build.outDir, 'sw.js');
    },
    closeBundle: {
      order: 'post',
      sequential: true,
      async handler() {
        const serviceWorker = await readFile(serviceWorkerPath, 'utf8');
        await writeFile(serviceWorkerPath, removeForcedClientReload(serviceWorker), 'utf8');
      },
    },
  };
}
