import { describe, expect, it } from 'vitest';
import { sampleStudyData } from '../test/fixtures';
import { parseStudyData } from './schema';

describe('parseStudyData', () => {
  it('descarta registros inválidos e atividades sem disciplina', () => {
    const seed = sampleStudyData();
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

  it('remove os registros de exemplo das primeiras versões, preservando o que a pessoa criou', () => {
    const now = '2026-10-20T12:00:00.000Z';
    const legacyDiscipline = (id: string, name: string) => ({ id, name, description: '', term: '', createdAt: now, updatedAt: now });
    const activity = (id: string, disciplineId: string) => ({
      id,
      disciplineId,
      title: id,
      type: 'exercicio',
      startDate: '2026-10-19',
      dueDate: '2026-11-15',
      status: 'pendente',
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const parsed = parseStudyData({
      version: 1,
      disciplines: [
        legacyDiscipline('seed-hidraulica-pneumatica', 'Exemplo 1'),
        legacyDiscipline('seed-seguranca-eletricidade', 'Exemplo 2'),
        legacyDiscipline('disciplina-propria', 'Minha disciplina'),
      ],
      activities: [
        activity('seed-hidraulica-pneumatica--videoaulas', 'seed-hidraulica-pneumatica'),
        activity('seed-seguranca-eletricidade--avaliacao', 'seed-seguranca-eletricidade'),
        // Atividade criada pela pessoa dentro de uma disciplina de exemplo: fica.
        activity('atividade-propria-1', 'seed-seguranca-eletricidade'),
        activity('atividade-propria-2', 'disciplina-propria'),
      ],
    });
    expect(parsed?.disciplines.map((d) => d.id)).toEqual(['seed-seguranca-eletricidade', 'disciplina-propria']);
    expect(parsed?.activities.map((a) => a.id)).toEqual(['atividade-propria-1', 'atividade-propria-2']);
  });

  it('rejeita estruturas inválidas', () => {
    expect(parseStudyData(null)).toBeNull();
    expect(parseStudyData({ disciplines: 'x' })).toBeNull();
  });
});
