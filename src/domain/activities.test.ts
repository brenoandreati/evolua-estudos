import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTERS,
  activityTypeLabel,
  countdownLabel,
  filterActivities,
  getUrgency,
  isNotStartedYet,
  nextRelevantActivity,
  periodRange,
} from './activities';
import type { Activity } from './types';

const TODAY = '2026-11-10';

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    disciplineId: 'd1',
    title: 'Atividade',
    type: 'exercicio',
    customType: '',
    startDate: '2026-11-01',
    dueDate: '2026-11-20',
    notes: '',
    status: 'pendente',
    completedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('getUrgency', () => {
  it.each([
    ['2026-11-09', 'atrasada'], // venceu ontem
    ['2026-11-10', 'urgente'], // vence hoje (0 dias)
    ['2026-11-12', 'urgente'], // 2 dias
    ['2026-11-13', 'atencao'], // 3 dias
    ['2026-11-15', 'atencao'], // 5 dias
    ['2026-11-16', 'no_prazo'], // 6 dias
  ])('prazo %s → %s', (dueDate, expected) => {
    expect(getUrgency(makeActivity({ dueDate }), TODAY)).toBe(expected);
  });

  it('atividade concluída nunca aparece como atrasada', () => {
    const done = makeActivity({ dueDate: '2026-10-01', status: 'concluida', completedAt: '2026-10-05' });
    expect(getUrgency(done, TODAY)).toBe('concluida');
    expect(countdownLabel(done, TODAY)).toBe('Concluída');
  });

  it('atividade em andamento segue a mesma regra de prazo', () => {
    expect(getUrgency(makeActivity({ status: 'em_andamento', dueDate: '2026-11-08' }), TODAY)).toBe('atrasada');
  });
});

describe('countdownLabel', () => {
  it.each([
    ['2026-11-10', 'Vence hoje'],
    ['2026-11-11', 'Vence amanhã'],
    ['2026-11-12', 'Faltam 2 dias'],
    ['2026-11-15', 'Faltam 5 dias'],
    ['2026-11-22', 'Vence em 12 dias'],
    ['2026-11-09', 'Atrasada há 1 dia'],
    ['2026-11-07', 'Atrasada há 3 dias'],
  ])('prazo %s → "%s"', (dueDate, expected) => {
    expect(countdownLabel(makeActivity({ dueDate }), TODAY)).toBe(expected);
  });
});

describe('isNotStartedYet', () => {
  it('identifica atividades com início no futuro', () => {
    expect(isNotStartedYet(makeActivity({ startDate: '2026-11-23' }), TODAY)).toBe(true);
    expect(isNotStartedYet(makeActivity({ startDate: '2026-11-10' }), TODAY)).toBe(false);
    expect(isNotStartedYet(makeActivity({ startDate: '2026-11-23', status: 'concluida' }), TODAY)).toBe(false);
  });
});

describe('activityTypeLabel', () => {
  it('usa o nome livre quando o tipo é "Outro"', () => {
    expect(activityTypeLabel({ type: 'outro', customType: 'Seminário' })).toBe('Seminário');
    expect(activityTypeLabel({ type: 'outro', customType: '' })).toBe('Outro');
    expect(activityTypeLabel({ type: 'avaliacao_online', customType: '' })).toBe('Avaliação online');
  });
});

describe('nextRelevantActivity', () => {
  it('prioriza atrasadas e ignora concluídas', () => {
    const list = [
      makeActivity({ id: 'futura', dueDate: '2026-11-30' }),
      makeActivity({ id: 'feita', dueDate: '2026-11-01', status: 'concluida', completedAt: '2026-11-01' }),
      makeActivity({ id: 'atrasada', dueDate: '2026-11-08' }),
    ];
    expect(nextRelevantActivity(list, TODAY)?.id).toBe('atrasada');
  });
});

describe('filterActivities', () => {
  const list = [
    makeActivity({ id: 'a', title: 'Avaliação online', type: 'avaliacao_online', dueDate: '2026-11-15' }),
    makeActivity({ id: 'b', title: 'Exercício avaliativo', type: 'exercicio_avaliativo', dueDate: '2026-11-09' }),
    makeActivity({ id: 'c', title: 'Videoaulas', type: 'videoaula', dueDate: '2026-11-15', disciplineId: 'd2', status: 'em_andamento' }),
    makeActivity({ id: 'd', title: 'Recuperação', type: 'recuperacao', dueDate: '2026-11-30', status: 'concluida', completedAt: '2026-11-02' }),
  ];
  const ids = (result: Activity[]) => result.map((a) => a.id);

  it('pendentes: exclui concluídas e ordena por urgência', () => {
    expect(ids(filterActivities(list, DEFAULT_FILTERS, TODAY))).toEqual(['b', 'a', 'c']);
  });

  it('separa em andamento, atrasadas, prazo próximo e concluídas', () => {
    expect(ids(filterActivities(list, { ...DEFAULT_FILTERS, view: 'em_andamento' }, TODAY))).toEqual(['c']);
    expect(ids(filterActivities(list, { ...DEFAULT_FILTERS, view: 'atrasadas' }, TODAY))).toEqual(['b']);
    expect(ids(filterActivities(list, { ...DEFAULT_FILTERS, view: 'prazo_proximo' }, TODAY))).toEqual(['a', 'c']);
    expect(ids(filterActivities(list, { ...DEFAULT_FILTERS, view: 'concluidas' }, TODAY))).toEqual(['d']);
    expect(filterActivities(list, { ...DEFAULT_FILTERS, view: 'todas' }, TODAY)).toHaveLength(4);
  });

  it('filtra por disciplina, tipo e busca sem acentos', () => {
    expect(ids(filterActivities(list, { ...DEFAULT_FILTERS, disciplineId: 'd2' }, TODAY))).toEqual(['c']);
    expect(ids(filterActivities(list, { ...DEFAULT_FILTERS, type: 'avaliacao_online' }, TODAY))).toEqual(['a']);
    expect(ids(filterActivities(list, { ...DEFAULT_FILTERS, search: 'avaliacao' }, TODAY))).toEqual(['a']);
    expect(ids(filterActivities(list, { ...DEFAULT_FILTERS, view: 'todas', search: 'RECUPERA' }, TODAY))).toEqual(['d']);
  });

  it('filtra por período do prazo', () => {
    expect(ids(filterActivities(list, { ...DEFAULT_FILTERS, period: 'proximos_7' }, TODAY))).toEqual(['a', 'c']);
    expect(
      ids(filterActivities(list, { ...DEFAULT_FILTERS, period: 'personalizado', from: '2026-11-01', to: '2026-11-10' }, TODAY)),
    ).toEqual(['b']);
  });

  it('calcula o intervalo de "Este mês"', () => {
    expect(periodRange({ period: 'este_mes', from: '', to: '' }, '2026-12-15')).toEqual({
      start: '2026-12-01',
      end: '2026-12-31',
    });
    expect(periodRange({ period: 'este_mes', from: '', to: '' }, '2028-02-10')).toEqual({
      start: '2028-02-01',
      end: '2028-02-29',
    });
  });
});
