import { HttpStudyRepository } from './httpStudyRepository';
import type { StudyRepository } from './repository';

/** Ponto único de troca da forma de armazenamento. Cada conta tem seus próprios dados. */
export function createRepository(user: { email: string }): StudyRepository {
  return new HttpStudyRepository(user.email);
}

export { DataConflictError } from './repository';
export type { StudyRepository } from './repository';
