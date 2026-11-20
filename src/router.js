// Tiny hash router: works on static hosting without server rewrites.
import { useEffect, useState } from 'react';

function parse() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path: path || '/', query: Object.fromEntries(new URLSearchParams(qs)) };
}

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(path) {
  window.location.hash = path;
}

/** Replace the current entry (so Back does not return to a finished step). */
export function swap(path) {
  window.location.replace(`#${path}`);
}

export function back(fallback = '/') {
  if (window.history.length > 1) window.history.back();
  else go(fallback);
}

export const href = (path) => `#${path}`;

/** match('/asha/w/:id', '/asha/w/w_1') → { id: 'w_1' } or null */
export function match(pattern, path) {
  const a = pattern.split('/');
  const b = path.split('/');
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}
