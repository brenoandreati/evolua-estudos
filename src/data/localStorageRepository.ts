import type { StudyData } from '../domain/types';
import { StorageUnavailableError, type StudyRepository } from './repository';
import { parseStudyData } from './schema';

export const STORAGE_KEY = 'evolua-estudos:dados:v1';

/** Chave dos dados de estudo de cada conta. */
export function storageKeyFor(userId: string): string {
  return `${STORAGE_KEY}:${userId}`;
}

/**
 * Dados salvos antes do acesso por login ficavam numa chave sem conta.
 * A primeira conta criada no aparelho passa a ser dona deles.
 */
export function adoptLegacyData(userId: string, storage: Storage | undefined = globalThis.localStorage): void {
  try {
    const legacy = storage?.getItem(STORAGE_KEY);
    const target = storageKeyFor(userId);
    if (storage && legacy != null && storage.getItem(target) === null) {
      storage.setItem(target, legacy);
      storage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Sem acesso ao armazenamento: a conta começa com os dados iniciais.
  }
}

/** Persistência no `localStorage` do navegador. */
export class LocalStorageRepository implements StudyRepository {
  constructor(
    private readonly key: string = STORAGE_KEY,
    private readonly storage: Storage | undefined = globalThis.localStorage,
  ) {}

  async load(): Promise<StudyData | null> {
    let raw: string | null;
    try {
      raw = this.storage?.getItem(this.key) ?? null;
    } catch (error) {
      throw new StorageUnavailableError(error);
    }
    if (raw === null) return null;

    let parsed: StudyData | null = null;
    try {
      parsed = parseStudyData(JSON.parse(raw));
    } catch {
      parsed = null;
    }
    if (parsed) return parsed;

    // Conteúdo corrompido: guarda uma cópia para não perder nada e recomeça.
    try {
      this.storage?.setItem(`${this.key}:backup-${Date.now()}`, raw);
    } catch {
      // Sem espaço para o backup; segue mesmo assim.
    }
    return null;
  }

  async save(data: StudyData): Promise<void> {
    if (!this.storage) throw new StorageUnavailableError();
    try {
      this.storage.setItem(this.key, JSON.stringify(data));
    } catch (error) {
      throw new StorageUnavailableError(error);
    }
  }

  subscribe(listener: (data: StudyData) => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const onStorage = (event: StorageEvent) => {
      if (event.key !== this.key || event.newValue === null) return;
      try {
        const parsed = parseStudyData(JSON.parse(event.newValue));
        if (parsed) listener(parsed);
      } catch {
        // Ignora alterações inválidas feitas em outra aba.
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }
}
