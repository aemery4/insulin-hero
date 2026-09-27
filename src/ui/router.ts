import { useEffect, useState } from 'react';

// Hash routing works on GitHub Pages without any 404.html fallback.
export const ROUTES = ['scene', 'log', 'history', 'settings'] as const;
export type Route = (typeof ROUTES)[number];

export function parseRoute(hash: string): Route {
  const name = hash.replace(/^#\/?/, '');
  return (ROUTES as readonly string[]).includes(name) ? (name as Route) : 'scene';
}

export function navigate(route: Route) {
  window.location.hash = route === 'scene' ? '/' : `/${route}`;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
