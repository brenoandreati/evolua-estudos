import { describe, expect, it } from 'vitest';
import { computeProgress, formatPercent } from './progress';
import type { Activity } from './types';

function activities(total: number, completed: number): Activity[] {
  return Array.from({ length: total }, (_, i) => ({
    id: `a${i}`,
    disciplineId: 'd1',
    title: `Atividade ${i}`,
    type: 'exercicio',
    customType: '',
    startDate: '2026-10-19',
    dueDate: '2026-11-15',
    notes: '',
    status: i < completed ? 'concluida' : 'pendente',
    completedAt: i < completed ? '2026-10-20' : null,
    createdAt: '',
    updatedAt: '',
  }));
}

describe('computeProgress', () => {
  it('10 atividades com 4 concluídas = 40%', () => {
    expect(computeProgress(activities(10, 4))).toMatchObject({ total: 10, completed: 4, pending: 6, percent: 40 });
  });

  it('progresso geral: 6 de 16 = 37,5% (exibido como 38%)', () => {
    const all = [...activities(8, 4), ...activities(8, 2)];
    const progress = computeProgress(all);
    expect(progress.ratio).toBe(37.5);
    expect(progress.percent).toBe(38);
    expect(formatPercent(progress.ratio)).toBe('37,5%');
  });

  it('sem atividades, o progresso é 0%', () => {
    expect(computeProgress([])).toEqual({ total: 0, completed: 0, pending: 0, ratio: 0, percent: 0 });
  });

  it('tudo concluído = 100%', () => {
    expect(computeProgress(activities(3, 3)).percent).toBe(100);
  });
});
