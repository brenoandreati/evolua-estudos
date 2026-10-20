import { LocalStorageRepository, storageKeyFor } from './localStorageRepository';
import type { StudyRepository } from './repository';

/** Ponto único de troca da forma de armazenamento. Cada conta tem seus próprios dados. */
export function createRepository(userId: string): StudyRepository {
  return new LocalStorageRepository(storageKeyFor(userId));
}

export type { StudyRepository } from './repository';
