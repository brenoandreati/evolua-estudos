import { ApiError, api } from '../api/client';
import type { StudyData } from '../domain/types';
import { findLegacyLocalData, forgetLegacyLocalData } from './legacyLocalData';
import { DataConflictError, type StudyRepository } from './repository';
import { parseStudyData } from './schema';

interface DataResponse {
  data: unknown;
  version: number;
}

/**
 * Dados de estudo guardados no servidor, na conta da pessoa.
 *
 * - Cada gravação informa a versão que este aparelho conhecia; se outro
 *   aparelho salvou antes, o servidor recusa e devolve a versão mais nova.
 * - Alterações feitas em sequência rápida são agrupadas: só a mais recente
 *   precisa ser enviada.
 */
export class HttpStudyRepository implements StudyRepository {
  private version = 0;
  private latest: StudyData | null = null;
  private running: Promise<void> | null = null;
  private legacyEmail: string | null = null;

  constructor(private readonly email: string) {}

  async load(): Promise<StudyData | null> {
    const response = await api<DataResponse>('/api/data');
    this.version = response.version;
    const data = parseStudyData(response.data);
    if (data) return data;

    // Conta nova no servidor: leva para a nuvem os dados que estavam só neste navegador.
    const legacy = findLegacyLocalData(this.email);
    if (legacy) {
      this.legacyEmail = this.email;
      await this.save(legacy).catch(() => {
        // Sem conexão agora: a próxima alteração envia tudo.
      });
    }
    return legacy;
  }

  save(data: StudyData): Promise<void> {
    this.latest = data;
    this.running ??= this.drain().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async drain(): Promise<void> {
    while (this.latest) {
      const next = this.latest;
      this.latest = null;
      await this.put(next);
    }
  }

  private async put(data: StudyData): Promise<void> {
    try {
      const response = await api<{ version: number }>('/api/data', {
        method: 'PUT',
        body: { data, version: this.version },
        keepalive: true,
      });
      this.version = response.version;
      if (this.legacyEmail) {
        forgetLegacyLocalData(this.legacyEmail);
        this.legacyEmail = null;
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        this.latest = null;
        this.version = typeof error.body.version === 'number' ? error.body.version : this.version;
        const current = parseStudyData(error.body.data) ?? { version: 1, disciplines: [], activities: [] };
        throw new DataConflictError(current);
      }
      throw error;
    }
  }

  /** Ao voltar para a aba, busca alterações feitas em outro aparelho. */
  subscribe(listener: (data: StudyData) => void): () => void {
    const refresh = async () => {
      if (document.visibilityState !== 'visible' || this.running) return;
      try {
        const response = await api<DataResponse>('/api/data');
        const data = parseStudyData(response.data);
        if (data && response.version > this.version && !this.running) {
          this.version = response.version;
          listener(data);
        }
      } catch {
        // Sem conexão agora: tenta de novo na próxima vez.
      }
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }
}
