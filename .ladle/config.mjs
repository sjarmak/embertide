// Ladle 5 config for the Elysian Cathedral component harness.
//
// Stories live colocated under `src/**/*.stories.{ts,tsx}` (default glob).
// We pin the dev port to keep it out of Vite's 5173 lane and to make the
// CI/dev address predictable. `ladle build` writes a static site to
// `build/` (Ladle's default outDir), separate from Vite's `dist/`.

/** @type {import('@ladle/react').UserConfig} */
export default {
  port: 61000,
  previewPort: 61001,
  // `outDir` defaults to `build` — keep that to avoid colliding with
  // Vite's `dist/`. The verify-no-placeholders.mjs script scans `dist/`
  // only, so Ladle output is unaffected.
};
