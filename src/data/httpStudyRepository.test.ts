import { afterEach, describe, expect, it, vi } from 'vitest';
import { sampleStudyData } from '../test/fixtures';
import { HttpStudyRepository } from './httpStudyRepository';
import { findLegacyLocalData } from './legacyLocalData';
import { DataConflictError } from './repository';

const EMAIL = 'ana@teste.com';
const EMPTY = { version: 1 as const, disciplines: [], activities: [] };

type Handler = (method: string, body: { data?: unknown; version?: number } | undefined) => [number, unknown];

/** Servidor falso: registra as chamadas e responde conforme o teste. */
function mockServer(handler: Handler) {
  const calls: { method: string; body?: { data?: unknown; version?: number } }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const method = init.method ?? 'GET';
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, body });
      const [status, response] = handler(method, body);
      return new Response(JSON.stringify(response), { status });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('HttpStudyRepository', () => {
  it('envia a versão conhecida e guarda a nova', async () => {
    let serverVersion = 3;
    const calls = mockServer((method) =>
      method === 'GET' ? [200, { data: EMPTY, version: serverVersion }] : [200, { version: ++serverVersion }],
    );
    const repo = new HttpStudyRepository(EMAIL);
    await repo.load();
    await repo.save(sampleStudyData());
    await repo.save(EMPTY);
    expect(calls.filter((c) => c.method === 'PUT').map((c) => c.body?.version)).toEqual([3, 4]);
  });

  it('agrupa alterações rápidas: só a mais recente é enviada depois da que está em andamento', async () => {
    let version = 1;
    const calls = mockServer((method) =>
      method === 'GET' ? [200, { data: EMPTY, version }] : [200, { version: ++version }],
    );
    const repo = new HttpStudyRepository(EMAIL);
    await repo.load();
    const first = { ...EMPTY, disciplines: [] };
    const second = sampleStudyData();
    const third = { ...sampleStudyData(), activities: [] };
    await Promise.all([repo.save(first), repo.save(second), repo.save(third)]);
    const puts = calls.filter((c) => c.method === 'PUT');
    expect(puts).toHaveLength(2);
    expect((puts[1].body?.data as { activities: unknown[] }).activities).toHaveLength(0);
  });

  it('conflito: devolve a versão mais nova do servidor', async () => {
    const newer = sampleStudyData();
    mockServer((method) =>
      method === 'GET'
        ? [200, { data: EMPTY, version: 1 }]
        : [409, { error: 'Seus dados foram alterados em outro aparelho.', data: newer, version: 5 }],
    );
    const repo = new HttpStudyRepository(EMAIL);
    await repo.load();
    const error = await repo.save(EMPTY).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DataConflictError);
    expect((error as DataConflictError).data.activities).toHaveLength(8);
  });

  it('conta nova: leva para a nuvem os dados que estavam no navegador e os apaga daqui', async () => {
    localStorage.setItem('evolua-estudos:contas:v1', JSON.stringify([{ id: 'local-1', email: EMAIL }]));
    localStorage.setItem('evolua-estudos:dados:v1:local-1', JSON.stringify(sampleStudyData()));
    const calls = mockServer((method) =>
      method === 'GET' ? [200, { data: null, version: 0 }] : [200, { version: 1 }],
    );
    const loaded = await new HttpStudyRepository(EMAIL).load();
    expect(loaded?.activities).toHaveLength(8);
    expect(calls.find((c) => c.method === 'PUT')?.body?.version).toBe(0);
    expect(findLegacyLocalData(EMAIL)).toBeNull();
    expect(localStorage.getItem('evolua-estudos:contas:v1')).toBeNull();
  });

  it('não mexe nos dados do navegador de outro e-mail', async () => {
    localStorage.setItem('evolua-estudos:contas:v1', JSON.stringify([{ id: 'local-2', email: 'outra@teste.com' }]));
    localStorage.setItem('evolua-estudos:dados:v1:local-2', JSON.stringify(sampleStudyData()));
    mockServer(() => [200, { data: null, version: 0 }]);
    expect(await new HttpStudyRepository(EMAIL).load()).toBeNull();
    expect(findLegacyLocalData('outra@teste.com')?.activities).toHaveLength(8);
  });
});
