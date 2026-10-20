import { useSyncExternalStore } from 'react';

/** Preferências pessoais (ficam separadas dos dados de estudo). */
export interface Preferences {
  userName: string;
}

const KEY = 'evolua-estudos:preferencias';
const DEFAULTS: Preferences = { userName: '' };
const listeners = new Set<() => void>();

function read(): Preferences {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return { userName: typeof parsed.userName === 'string' ? parsed.userName : '' };
  } catch {
    return DEFAULTS;
  }
}

let current: Preferences = read();

export function setPreferences(next: Partial<Preferences>): void {
  current = { ...current, ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Sem armazenamento: a preferência vale até fechar a página.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, () => current);
}
