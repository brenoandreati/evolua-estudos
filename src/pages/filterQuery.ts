import {
  ACTIVITY_TYPES,
  DEFAULT_FILTERS,
  PERIOD_OPTIONS,
  STATUS_VIEWS,
  type ActivityFilters,
  type PeriodFilter,
  type StatusView,
} from '../domain/activities';
import { isValidISODate } from '../domain/dates';
import type { ActivityType } from '../domain/types';

// Os filtros ficam no endereço da página (ex.: #/atividades?ver=atrasadas),
// então dá para voltar, atualizar ou salvar o link sem perder a seleção.

const VIEWS = new Set<string>(STATUS_VIEWS.map((v) => v.value));
const TYPES = new Set<string>(ACTIVITY_TYPES.map((t) => t.value));
const PERIODS = new Set<string>(PERIOD_OPTIONS.map((p) => p.value));

export function filtersFromQuery(query: URLSearchParams): ActivityFilters {
  const view = query.get('ver') ?? '';
  const type = query.get('tipo') ?? '';
  const period = query.get('periodo') ?? '';
  const from = query.get('de') ?? '';
  const to = query.get('ate') ?? '';
  return {
    view: VIEWS.has(view) ? (view as StatusView) : DEFAULT_FILTERS.view,
    search: query.get('busca') ?? '',
    disciplineId: query.get('disciplina') ?? '',
    type: TYPES.has(type) ? (type as ActivityType) : '',
    period: PERIODS.has(period) ? (period as PeriodFilter) : DEFAULT_FILTERS.period,
    from: isValidISODate(from) ? from : '',
    to: isValidISODate(to) ? to : '',
  };
}

export function filtersToQuery(filters: ActivityFilters): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.view !== DEFAULT_FILTERS.view) query.ver = filters.view;
  if (filters.search) query.busca = filters.search;
  if (filters.disciplineId) query.disciplina = filters.disciplineId;
  if (filters.type) query.tipo = filters.type;
  if (filters.period !== DEFAULT_FILTERS.period) query.periodo = filters.period;
  if (filters.period === 'personalizado') {
    if (filters.from) query.de = filters.from;
    if (filters.to) query.ate = filters.to;
  }
  return query;
}

/** Algum filtro além da aba de status está ativo? */
export function hasExtraFilters(filters: ActivityFilters): boolean {
  return Boolean(
    filters.search || filters.disciplineId || filters.type || filters.period !== DEFAULT_FILTERS.period,
  );
}
