import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyHCFlag, resolveHCFlag } from './hc/flag';

// Elysian Cathedral flag boot (embertide-9vm / PRD V-2). Must run
// before the first render so any `[data-hc="on"]` CSS selectors apply on
// the initial paint. Falls back silently when localStorage is blocked
// (e.g. cookies disabled) — resolveHCFlag then uses the env default.
let storage: Storage | null = null;
try {
  storage = typeof window !== 'undefined' ? window.localStorage : null;
} catch {
  storage = null;
}

applyHCFlag(
  resolveHCFlag({
    search: typeof window !== 'undefined' ? window.location.search : '',
    storage,
    env: import.meta.env.MODE,
  }),
);

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
