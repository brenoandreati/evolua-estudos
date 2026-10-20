import { describe, expect, it } from 'vitest';
import { sampleStudyData } from '../test/fixtures';
import type { ActivityInput } from '../domain/types';
import { studyReducer } from './studyReducer';

const NOW = '2026-10-20T12:00:00.000Z';
const TODAY = '2026-10-20';
const MAT = 'teste-matematica';
const FIS = 'teste-fisica';

describe('studyReducer', () => {
  const seed = sampleStudyData(new Date(NOW));
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
    const next = studyReducer(seed, { type: 'deleteDiscipline', id: MAT });
    expect(next.disciplines.map((d) => d.id)).toEqual([FIS]);
    expect(next.activities).toHaveLength(4);
    expect(next.activities.every((a) => a.disciplineId === FIS)).toBe(true);
  });

  it('excluir atividade a remove do cálculo', () => {
    const next = studyReducer(seed, { type: 'deleteActivity', id: firstId });
    expect(next.activities).toHaveLength(7);
    expect(next.activities.some((a) => a.id === firstId)).toBe(false);
  });

  it('apagar tudo deixa o painel vazio', () => {
    const next = studyReducer(seed, { type: 'replaceAll', data: { version: 1, disciplines: [], activities: [] } });
    expect(next.disciplines).toHaveLength(0);
    expect(next.activities).toHaveLength(0);
  });

  it('não altera o estado original (imutável)', () => {
    studyReducer(seed, { type: 'deleteActivity', id: firstId });
    expect(seed.activities).toHaveLength(8);
  });
});
