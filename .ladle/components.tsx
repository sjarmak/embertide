// Ladle Provider: load Elysian Cathedral tokens so var(--hc-*) resolves
// inside story previews. Without this, illustrations render invisible
// because every fill/stroke references a CSS custom property that isn't
// defined in the preview iframe.
import type { GlobalProvider } from '@ladle/react';
import '../src/styles/tokens.css';

export const Provider: GlobalProvider = ({ children }) => <>{children}</>;
