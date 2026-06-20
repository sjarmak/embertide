/**
 * ElysianDefs — shared SVG `<defs>` mounted once near the App root.
 *
 * Spec: .claude/design/elysian-cathedral/icons.md §2 (verbatim).
 *
 * Renders a zero-size, position-absolute, aria-hidden `<svg>` containing
 * the two filters icons reference by URL fragment:
 *   - `#hc-glass-refract` — applied to a `<g>` wrapping the jewel fill
 *     on hover for "magic" refraction.
 *   - `#hc-soft-glow` — applied to highlight layers on boss / champion
 *     icons only (Monster eyes, Boss eye glow, etc).
 *
 * Mount once in App. Do **not** apply either filter to every icon by
 * default — performance and visual discipline both suffer.
 *
 * **Status (T-5):** component is exported but NOT yet mounted in App.tsx;
 * V-1 mounts it. Stories smoke-test the rendering shape today.
 */
export function ElysianDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <filter id="hc-glass-refract" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="1.8" numOctaves="1" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="0.6" />
        </filter>
        <filter id="hc-soft-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}
