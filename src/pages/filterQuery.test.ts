import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS } from '../domain/activities';
import { filtersFromQuery, filtersToQuery } from './filterQuery';
import { buildMonthGrid } from './CalendarPage';

describe('filtros no endereço da página', () => {
  it('ida e volta preservam os filtros', () => {
    const filters = {
      ...DEFAULT_FILTERS,
      view: 'atrasadas' as const,
      search: 'avaliação',
      disciplineId: 'd1',
      type: 'recuperacao' as const,
      period: 'personalizado' as const,
      from: '2026-11-01',
      to: '2026-11-30',
    };
    const query = new URLSearchParams(filtersToQuery(filters));
    expect(filtersFromQuery(query)).toEqual(filters);
  });

  it('ignora valores inválidos', () => {
    const filters = filtersFromQuery(new URLSearchParams('ver=xyz&tipo=abc&periodo=nunca&de=ontem'));
    expect(filters).toEqual(DEFAULT_FILTERS);
  });
});

describe('buildMonthGrid', () => {
  it('monta semanas completas de domingo a sábado', () => {
    const grid = buildMonthGrid(2026, 10); // novembro de 2026
    expect(grid[0]).toBe('2026-11-01'); // 1º de novembro de 2026 é domingo
    expect(grid.at(-1)).toBe('2026-12-05');
    expect(grid.length % 7).toBe(0);
  });
});
