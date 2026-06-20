/**
 * Resolve a root-absolute public asset path against Vite's configured base.
 *
 * Vite rewrites asset URLs embedded in HTML and CSS (`url(...)`, `<link>`,
 * `<script>`) at build time so they pick up the configured `base`. It does
 * NOT rewrite string literals that are only used at RUNTIME as `<img src>` /
 * SVG `<image href>` values — e.g. the card-art raster specs and the
 * zone / boss / crystal / combat-background raster maps, which are plain
 * `/illustrations/...` strings in TS/JSON. Under a sub-path deploy
 * (`EMBERTIDE_BASE=/games/embertide/`) those root-absolute paths resolve to
 * the site root and 404. This helper rebases them at the point of use.
 *
 * `import.meta.env.BASE_URL` is `/` in dev + tests and `/games/embertide/`
 * in the sub-path build; Vite guarantees a trailing slash. External URLs
 * (`http(s):`, protocol-relative `//`, `data:`, `blob:`) pass through
 * unchanged, and the join is idempotent (an already-prefixed path is
 * returned as-is).
 */
function isExternal(path: string): boolean {
  return /^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:');
}

/**
 * Pure base-join. Exported for unit testing both the root (`/`) and the
 * sub-path (`/games/embertide/`) cases without mutating `import.meta.env`.
 */
export function joinBase(base: string, path: string): string {
  if (isExternal(path)) return path;
  const b = base || '/';
  if (b === '/') return path;
  if (path.startsWith(b)) return path;
  const trimmedBase = b.endsWith('/') ? b.slice(0, -1) : b;
  const rel = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${rel}`;
}

/** Rebase a public asset path against the active Vite base path. */
export function assetUrl(path: string): string {
  return joinBase(import.meta.env.BASE_URL ?? '/', path);
}
