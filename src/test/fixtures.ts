import type { Activity, ActivityType, StudyData } from '../domain/types';

/** Dados fictícios para os testes: duas disciplinas com quatro atividades cada. */
export const TEST_DISCIPLINES = [
  { id: 'teste-matematica', name: 'Matemática Aplicada' },
  { id: 'teste-fisica', name: 'Física Geral' },
];

const TEST_ACTIVITIES: { key: string; title: string; type: ActivityType; startDate: string; dueDate: string }[] = [
  { key: 'videoaulas', title: 'Videoaulas e exercícios', type: 'videoaula', startDate: '2026-10-19', dueDate: '2026-11-15' },
  { key: 'exercicio', title: 'Exercício avaliativo online', type: 'exercicio_avaliativo', startDate: '2026-11-01', dueDate: '2026-11-09' },
  { key: 'avaliacao', title: 'Avaliação online', type: 'avaliacao_online', startDate: '2026-11-09', dueDate: '2026-11-15' },
  { key: 'recuperacao', title: 'Recuperação online', type: 'recuperacao', startDate: '2026-11-23', dueDate: '2026-11-30' },
];

export function sampleStudyData(now: Date = new Date('2026-10-20T12:00:00Z')): StudyData {
  const timestamp = now.toISOString();
  return {
    version: 1,
    disciplines: TEST_DISCIPLINES.map((d) => ({
      ...d,
      description: '',
      term: '',
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
    activities: TEST_DISCIPLINES.flatMap((d) =>
      TEST_ACTIVITIES.map(
        (a): Activity => ({
          id: `${d.id}--${a.key}`,
          disciplineId: d.id,
          title: a.title,
          type: a.type,
          customType: '',
          startDate: a.startDate,
          dueDate: a.dueDate,
          notes: '',
          status: 'pendente',
          completedAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        }),
      ),
    ),
  };
}
