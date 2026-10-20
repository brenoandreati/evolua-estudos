import { describe, expect, it } from 'vitest';
import { createSeedData } from '../domain/seed';
import type { ActivityInput } from '../domain/types';
import { studyReducer } from './studyReducer';

const NOW = '2026-10-20T12:00:00.000Z';
const TODAY = '2026-10-20';
const HP = 'seed-hidraulica-pneumatica';
const SE = 'seed-seguranca-eletricidade';

describe('createSeedData', () => {
  it('cria 2 disciplinas com 4 atividades cada, nenhuma concluída', () => {
    const seed = createSeedData();
    expect(seed.disciplines.map((d) => d.name)).toEqual(['Hidráulica e Pneumática', 'Segurança em Eletricidade']);
    expect(seed.activities).toHaveLength(8);
    expect(seed.activities.every((a) => a.status === 'pendente' && a.completedAt === null)).toBe(true);
    expect(new Set(seed.activities.map((a) => a.id)).size).toBe(8);

    const hp = seed.activities.filter((a) => a.disciplineId === HP);
    expect(hp.map((a) => [a.title, a.startDate, a.dueDate])).toEqual([
      ['Videoaulas e exercícios', '2026-10-19', '2026-11-15'],
      ['Exercício avaliativo online', '2026-11-01', '2026-11-09'],
      ['Avaliação online', '2026-11-09', '2026-11-15'],
      ['Recuperação online', '2026-11-23', '2026-11-30'],
    ]);
  });
});

describe('studyReducer', () => {
  const seed = createSeedData(new Date(NOW));
  const firstId = seed.activities[0].id;

  it('concluir registra a data de conclusão; reabrir limpa', () => {
    const done = studyReducer(seed, { type: 'setActivityStatus', id: firstId, status: 'concluida', now: NOW, today: TODAY });
    expect(done.activities[0]).toMatchObject({ status: 'concluida', completedAt: TODAY });

    const reopened = studyReducer(done, { type: 'setActivityStatus', id: firstId, status: 'pendente', now: NOW, today: TODAY });
    expect(reopened.activities[0]).toMatchObject({ status: 'pendente', completedAt: null });
  });

  it('editar uma atividade concluída mantém a data original de conclusão', () => {
    const done = studyReducer(seed, { type: 'setActivityStatus', id: firstId, status: 'concluida', now: NOW, today: '2026-10-21' });
    const a = done.activities[0];
    const input: ActivityInput = { ...a, title: '  Novo nome  ' };
    const edited = studyReducer(done, { type: 'updateActivity', id: firstId, input, now: NOW, today: '2026-10-25' });
    expect(edited.activities[0]).toMatchObject({ title: 'Novo nome', completedAt: '2026-10-21' });
  });

  it('excluir disciplina remove as atividades vinculadas', () => {
    const next = studyReducer(seed, { type: 'deleteDiscipline', id: HP });
    expect(next.disciplines.map((d) => d.id)).toEqual([SE]);
    expect(next.activities).toHaveLength(4);
    expect(next.activities.every((a) => a.disciplineId === SE)).toBe(true);
  });

  it('excluir atividade a remove do cálculo', () => {
    const next = studyReducer(seed, { type: 'deleteActivity', id: firstId });
    expect(next.activities).toHaveLength(7);
    expect(next.activities.some((a) => a.id === firstId)).toBe(false);
  });

  it('não altera o estado original (imutável)', () => {
    studyReducer(seed, { type: 'deleteActivity', id: firstId });
    expect(seed.activities).toHaveLength(8);
  });
});
