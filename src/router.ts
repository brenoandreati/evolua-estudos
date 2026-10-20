import { useEffect, useState } from 'react';

/**
 * Roteamento por hash (`#/disciplinas`). Funciona em qualquer hospedagem
 * estática, sem configuração de servidor.
 */
export type Route =
  | { name: 'overview' }
  | { name: 'disciplines' }
  | { name: 'discipline'; id: string }
  | { name: 'activities'; query: URLSearchParams }
  | { name: 'calendar' }
  | { name: 'completed' }
  | { name: 'notFound' };

export const paths = {
  overview: '#/',
  disciplines: '#/disciplinas',
  discipline: (id: string) => `#/disciplinas/${encodeURIComponent(id)}`,
  activities: (query?: Record<string, string>) => {
    const search = query ? new URLSearchParams(query).toString() : '';
    return search ? `#/atividades?${search}` : '#/atividades';
  },
  calendar: '#/calendario',
  completed: '#/concluidas',
};

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, search = ''] = raw.split('?');
  const segments = path.split('/').filter(Boolean);

  if (segments.length === 0) return { name: 'overview' };
  const [first, second] = segments;
  switch (first) {
    case 'disciplinas':
      return second ? { name: 'discipline', id: decodeURIComponent(second) } : { name: 'disciplines' };
    case 'atividades':
      return { name: 'activities', query: new URLSearchParams(search) };
    case 'calendario':
      return { name: 'calendar' };
    case 'concluidas':
      return { name: 'completed' };
    default:
      return { name: 'notFound' };
  }
}

export function navigate(path: string, options: { replace?: boolean } = {}): void {
  if (options.replace) {
    const url = new URL(window.location.href);
    url.hash = path;
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = path;
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}
