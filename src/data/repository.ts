import type { StudyData } from '../domain/types';

/**
 * Contrato de persistência do painel. A implementação atual
 * (`HttpStudyRepository`) guarda os dados no servidor, na conta da pessoa;
 * telas e regras de negócio só conhecem esta interface.
 */
export interface StudyRepository {
  /** Retorna os dados salvos ou `null` se a conta ainda não tem nada salvo. */
  load(): Promise<StudyData | null>;
  save(data: StudyData): Promise<void>;
  /** Avisa quando os dados mudam fora desta tela (ex.: em outro aparelho). */
  subscribe?(listener: (data: StudyData) => void): () => void;
}

/** Os dados foram alterados em outro aparelho; `data` é a versão mais recente. */
export class DataConflictError extends Error {
  constructor(readonly data: StudyData) {
    super('Seus dados foram alterados em outro aparelho.');
    this.name = 'DataConflictError';
  }
}
