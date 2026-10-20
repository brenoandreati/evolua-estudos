import type { Activity, ActivityType, Discipline, StudyData } from './types';

interface SeedActivity {
  key: string;
  title: string;
  type: ActivityType;
  startDate: string;
  dueDate: string;
}

const SEED_DISCIPLINES: { id: string; name: string }[] = [
  { id: 'seed-hidraulica-pneumatica', name: 'Hidráulica e Pneumática' },
  { id: 'seed-seguranca-eletricidade', name: 'Segurança em Eletricidade' },
];

const SEED_ACTIVITIES: SeedActivity[] = [
  {
    key: 'videoaulas',
    title: 'Videoaulas e exercícios',
    type: 'videoaula',
    startDate: '2026-10-19',
    dueDate: '2026-11-15',
  },
  {
    key: 'exercicio-avaliativo',
    title: 'Exercício avaliativo online',
    type: 'exercicio_avaliativo',
    startDate: '2026-11-01',
    dueDate: '2026-11-09',
  },
  {
    key: 'avaliacao',
    title: 'Avaliação online',
    type: 'avaliacao_online',
    startDate: '2026-11-09',
    dueDate: '2026-11-15',
  },
  {
    key: 'recuperacao',
    title: 'Recuperação online',
    type: 'recuperacao',
    startDate: '2026-11-23',
    dueDate: '2026-11-30',
  },
];

/**
 * Dados iniciais: duas disciplinas com quatro atividades cada, nenhuma concluída.
 * Os IDs são fixos para que os dados iniciais nunca sejam duplicados.
 */
export function createSeedData(now: Date = new Date()): StudyData {
  const timestamp = now.toISOString();

  const disciplines: Discipline[] = SEED_DISCIPLINES.map((d) => ({
    id: d.id,
    name: d.name,
    description: '',
    term: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  const activities: Activity[] = SEED_DISCIPLINES.flatMap((d) =>
    SEED_ACTIVITIES.map((a) => ({
      id: `${d.id}--${a.key}`,
      disciplineId: d.id,
      title: a.title,
      type: a.type,
      customType: '',
      startDate: a.startDate,
      dueDate: a.dueDate,
      notes: '',
      status: 'pendente' as const,
      completedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  );

  return { version: 1, disciplines, activities };
}
