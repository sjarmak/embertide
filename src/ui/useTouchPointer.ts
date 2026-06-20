import { useEffect, useState } from 'react';

/**
 * Returns `true` when the device is in the landscape-mobile layout —
 * the same media query that drives the icon-only card tiles in
 * app.css. True on phones / tablets in landscape OR any small
 * landscape viewport; false on desktop. Used to gate mobile-only
 * affordances like the tap-to-zoom card detail modal so the desktop
 * click-to-buy / click-to-play UX is preserved.
 *
 * Combined with `(pointer: coarse)` so non-landscape touch devices
 * (portrait phones, tablets) also get the modal route — kid play
 * should never silently buy a card the kid hasn't read.
 *
 * SSR-safe: returns `false` until mounted, then live-updates via the
 * MediaQueryList change event.
 */
export function useTouchPointer(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const query = '(pointer: coarse), (orientation: landscape) and (max-height: 500px)';
    const mql = window.matchMedia(query);
    setIsTouch(mql.matches);
    const onChange = (event: MediaQueryListEvent): void => setIsTouch(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isTouch;
}
