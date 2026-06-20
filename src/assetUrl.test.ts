import { describe, it, expect } from 'vitest';
import { joinBase, assetUrl } from './assetUrl';

describe('joinBase', () => {
  it('is a no-op at the root base', () => {
    expect(joinBase('/', '/illustrations/foo.webp')).toBe('/illustrations/foo.webp');
  });

  it('prefixes a sub-path base onto a root-absolute asset path', () => {
    expect(joinBase('/games/embertide/', '/illustrations/foo.webp')).toBe(
      '/games/embertide/illustrations/foo.webp',
    );
  });

  it('normalizes a path missing its leading slash', () => {
    expect(joinBase('/games/embertide/', 'illustrations/foo.webp')).toBe(
      '/games/embertide/illustrations/foo.webp',
    );
  });

  it('is idempotent — does not double-prefix an already-based path', () => {
    expect(joinBase('/games/embertide/', '/games/embertide/illustrations/foo.webp')).toBe(
      '/games/embertide/illustrations/foo.webp',
    );
  });

  it('passes external + inline URLs through unchanged', () => {
    expect(joinBase('/games/embertide/', 'https://cdn.example/a.webp')).toBe(
      'https://cdn.example/a.webp',
    );
    expect(joinBase('/games/embertide/', '//cdn.example/a.webp')).toBe('//cdn.example/a.webp');
    expect(joinBase('/games/embertide/', 'data:image/png;base64,AAAA')).toBe(
      'data:image/png;base64,AAAA',
    );
    expect(joinBase('/games/embertide/', 'blob:abc')).toBe('blob:abc');
  });

  it('treats an empty base as root', () => {
    expect(joinBase('', '/illustrations/foo.webp')).toBe('/illustrations/foo.webp');
  });
});

describe('assetUrl', () => {
  // In the vitest/Vite transform import.meta.env.BASE_URL defaults to '/', so
  // assetUrl is a pass-through here — the sub-path behavior is covered by the
  // joinBase tests above (assetUrl is a thin wrapper over it).
  it('returns root-absolute asset paths unchanged under the default test base', () => {
    expect(assetUrl('/illustrations/foo.webp')).toBe('/illustrations/foo.webp');
  });
});
