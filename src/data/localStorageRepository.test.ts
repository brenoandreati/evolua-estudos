import { describe, expect, it } from 'vitest';
import { createSeedData } from '../domain/seed';
import { LocalStorageRepository, STORAGE_KEY } from './localStorageRepository';
import { parseStudyData } from './schema';

describe('LocalStorageRepository', () => {
  it('retorna null quando ainda não há dados', async () => {
    expect(await new LocalStorageRepository().load()).toBeNull();
  });

  it('salva e carrega os dados', async () => {
    const repo = new LocalStorageRepository();
    const data = createSeedData();
    await repo.save(data);
    expect(await repo.load()).toEqual(data);
  });

  it('guarda um backup e recomeça se o conteúdo estiver corrompido', async () => {
    localStorage.setItem(STORAGE_KEY, '{isto não é json');
    expect(await new LocalStorageRepository().load()).toBeNull();
    const backups = Object.keys(localStorage).filter((k) => k.startsWith(`${STORAGE_KEY}:backup-`));
    expect(backups).toHaveLength(1);
    expect(localStorage.getItem(backups[0])).toBe('{isto não é json');
  });
});

describe('parseStudyData', () => {
  it('descarta registros inválidos e atividades sem disciplina', () => {
    const seed = createSeedData();
    const parsed = parseStudyData({
      ...seed,
      activities: [
        ...seed.activities,
        { id: 'orfa', disciplineId: 'nao-existe', title: 'Órfã', dueDate: '2026-11-01' },
        { id: 'sem-prazo', disciplineId: seed.disciplines[0].id, title: 'Sem prazo' },
      ],
    });
    expect(parsed?.activities).toHaveLength(8);
  });

  it('rejeita estruturas inválidas', () => {
    expect(parseStudyData(null)).toBeNull();
    expect(parseStudyData({ disciplines: 'x' })).toBeNull();
  });
});
