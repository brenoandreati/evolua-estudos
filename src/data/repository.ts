import type { StudyData } from '../domain/types';

/**
 * Contrato de persistência do painel.
 *
 * A primeira versão salva no navegador (`LocalStorageRepository`). Para usar
 * um banco de dados com login no futuro, basta criar outra implementação
 * desta interface (por exemplo, chamando uma API HTTP) e trocá-la em
 * `src/data/index.ts` — telas e regras de negócio não mudam.
 */
export interface StudyRepository {
  /** Retorna os dados salvos ou `null` se ainda não houver nada salvo. */
  load(): Promise<StudyData | null>;
  save(data: StudyData): Promise<void>;
  /** Avisa quando os dados mudam fora desta aba (ex.: outra aba aberta). */
  subscribe?(listener: (data: StudyData) => void): () => void;
}

export class StorageUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('Não foi possível acessar o armazenamento do navegador.');
    this.name = 'StorageUnavailableError';
    this.cause = cause;
  }
}
