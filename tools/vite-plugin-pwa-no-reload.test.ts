import { describe, expect, it } from 'vitest';
import { removeForcedClientReload } from './vite-plugin-pwa-no-reload';

const generatedWorker = `
self.addEventListener('activate', (e) => {
  self.registration.unregister()
    .then(() => self.clients.matchAll())
    .then((clients) => {
      clients.forEach((client) => {
        if (client instanceof WindowClient)
          client.navigate(client.url);
      });
      return Promise.resolve();
    })
    .then(() => {
      self.caches.keys().then((cacheNames) => {
        Promise.all(
          cacheNames.map((cacheName) => {
            return self.caches.delete(cacheName);
          }),
        );
      })
    });
});
`;

describe('removeForcedClientReload', () => {
  it('preserves cleanup while removing forced navigation', () => {
    const worker = removeForcedClientReload(generatedWorker);

    expect(worker).toContain('self.registration.unregister()');
    expect(worker).toContain('self.caches.delete(cacheName)');
    expect(worker).not.toContain('client.navigate(');
    expect(worker).not.toContain('self.clients.matchAll()');
  });

  it('fails closed when the generated worker shape changes', () => {
    expect(() =>
      removeForcedClientReload(generatedWorker.replace('client.navigate', 'client.open')),
    ).toThrow('refusing to ship an unverified reload path');
  });
});
