import { LocalStorageRepository } from './localStorageRepository';
import type { StudyRepository } from './repository';

/** Ponto único de troca da forma de armazenamento. */
export function createRepository(): StudyRepository {
  return new LocalStorageRepository();
}

export type { StudyRepository } from './repository';
