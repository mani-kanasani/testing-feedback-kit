'use client';

// For an app with no router: the page's place kept in the address after #, for example #/feedback/tickets/12.
import { useCallback, useEffect, useState } from 'react';

const read = (base: string) => {
  const hash = typeof window === 'undefined' ? '' : window.location.hash.replace(/^#\/?/, '');
  return hash === base || hash.startsWith(`${base}/`) ? hash.slice(base.length).replace(/^\//, '') : null;
};

/** Returns [the page's path, a way to go somewhere on it, the address for a path, whether the page is open now]. */
export function useHashPath(base = 'feedback') {
  const [path, setPath] = useState<string | null>(() => read(base));
  useEffect(() => {
    const onHash = () => setPath(read(base));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [base]);
  const hrefFor = useCallback((p: string) => `#/${base}${p ? `/${p}` : ''}`, [base]);
  const go = useCallback((p: string) => {
    window.location.hash = hrefFor(p);
  }, [hrefFor]);
  return { path: path ?? '', onPage: path !== null, go, hrefFor };
}
