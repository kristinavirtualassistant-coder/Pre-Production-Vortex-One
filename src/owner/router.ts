import { useCallback, useEffect, useState } from 'react';

/** Minimal history-API router scoped to /owner/* (the app has no router library; same convention as the customer app). */
export function currentPath(): string {
  const p = window.location.pathname.replace(/\/+$/, '');
  return p === '' ? '/' : p;
}
export function useOwnerPath() {
  const [path, setPath] = useState(currentPath());
  useEffect(() => {
    const onPop = () => setPath(currentPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = useCallback((to: string, replace = false) => {
    if (replace) window.history.replaceState({}, '', to); else window.history.pushState({}, '', to);
    setPath(currentPath());
    window.scrollTo(0, 0);
  }, []);
  return { path, navigate };
}
export const isOwnerPath = (pathname: string) => pathname === '/owner' || pathname.startsWith('/owner/');
