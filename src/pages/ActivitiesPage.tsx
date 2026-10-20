import { useMemo } from 'react';
import { FilterX, Inbox, Plus, Search, SearchX } from 'lucide-react';
import { ActivityList } from '../components/activities/ActivityItem';
import { EmptyState, PageHeader } from '../components/ui/primitives';
import {
  ACTIVITY_TYPES,
  DEFAULT_FILTERS,
  PERIOD_OPTIONS,
  STATUS_VIEWS,
  filterActivities,
  matchesView,
  type ActivityFilters,
  type PeriodFilter,
  type StatusView,
} from '../domain/activities';
import type { ActivityType } from '../domain/types';
import { navigate, paths } from '../router';
import { useStudy } from '../state/StudyProvider';
import { useUI } from '../state/UIProvider';
import { filtersFromQuery, filtersToQuery, hasExtraFilters } from './filterQuery';

const EMPTY_MESSAGES: Record<StatusView, { title: string; description: string }> = {
  pendentes: { title: 'Nenhuma atividade pendente', description: 'Você está em dia! Cadastre novas atividades quando surgirem.' },
  em_andamento: {
    title: 'Nenhuma atividade em andamento',
    description: 'Ao começar uma atividade, use o menu ⋮ e escolha “Marcar como em andamento”.',
  },
  atrasadas: { title: 'Nenhuma atividade atrasada', description: 'Ótimo! Todos os prazos estão sob controle.' },
  prazo_proximo: { title: 'Nenhum prazo próximo', description: 'Nenhuma atividade vence nos próximos 5 dias.' },
  concluidas: { title: 'Nenhuma atividade concluída ainda', description: 'Marque o círculo ao lado de uma atividade para concluí-la.' },
  todas: { title: 'Nenhuma atividade cadastrada', description: 'Cadastre sua primeira atividade para começar.' },
};

export function ActivitiesPage({ query }: { query: URLSearchParams }) {
  const { data, today } = useStudy();
  const { openNewActivity } = useUI();
  const filters = useMemo(() => filtersFromQuery(query), [query]);

  const setFilters = (patch: Partial<ActivityFilters>) => {
    navigate(paths.activities(filtersToQuery({ ...filters, ...patch })), { replace: true });
  };

  const results = useMemo(() => filterActivities(data.activities, filters, today), [data.activities, filters, today]);

  // Contagem por aba considerando os demais filtros.
  const counts = useMemo(() => {
    const base = filterActivities(data.activities, { ...filters, view: 'todas' }, today);
    return Object.fromEntries(
      STATUS_VIEWS.map((v) => [v.value, base.filter((a) => matchesView(a, v.value, today)).length]),
    ) as Record<StatusView, number>;
  }, [data.activities, filters, today]);

  const extraFilters = hasExtraFilters(filters);
  const empty = EMPTY_MESSAGES[filters.view];

  return (
    <div className="page">
      <PageHeader
        title="Todas as atividades"
        subtitle={`${results.length} ${results.length === 1 ? 'atividade encontrada' : 'atividades encontradas'}`}
        actions={
          <button
            type="button"
            className="button button--primary"
            onClick={() => openNewActivity(filters.disciplineId ? { disciplineId: filters.disciplineId } : undefined)}
          >
            <Plus size={18} aria-hidden />
            Nova atividade
          </button>
        }
      />

      <div className="tabs" role="tablist" aria-label="Situação das atividades">
        {STATUS_VIEWS.map((view) => (
          <button
            key={view.value}
            type="button"
            role="tab"
            aria-selected={filters.view === view.value}
            className={`tabs__tab tabs__tab--${view.value}${filters.view === view.value ? ' is-active' : ''}`}
            onClick={() => setFilters({ view: view.value })}
          >
            {view.label}
            <span className="tabs__count">{counts[view.value]}</span>
          </button>
        ))}
      </div>

      <div className="card filters" role="group" aria-label="Filtros">
        <label className="filters__search search">
          <Search size={18} className="search__icon" aria-hidden />
          <input
            type="search"
            className="search__input"
            placeholder="Buscar pelo nome…"
            aria-label="Buscar atividade pelo nome"
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
          />
        </label>

        <label className="filters__field">
          <span>Disciplina</span>
          <select value={filters.disciplineId} onChange={(e) => setFilters({ disciplineId: e.target.value })}>
            <option value="">Todas as disciplinas</option>
            {data.disciplines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        <label className="filters__field">
          <span>Tipo</span>
          <select value={filters.type} onChange={(e) => setFilters({ type: e.target.value as ActivityType | '' })}>
            <option value="">Todos os tipos</option>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="filters__field">
          <span>Período do prazo</span>
          <select value={filters.period} onChange={(e) => setFilters({ period: e.target.value as PeriodFilter })}>
            {PERIOD_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        {filters.period === 'personalizado' && (
          <>
            <label className="filters__field">
              <span>De</span>
              <input type="date" value={filters.from} onChange={(e) => setFilters({ from: e.target.value })} />
            </label>
            <label className="filters__field">
              <span>Até</span>
              <input
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(e) => setFilters({ to: e.target.value })}
              />
            </label>
          </>
        )}

        {extraFilters && (
          <button
            type="button"
            className="button button--ghost button--sm filters__clear"
            onClick={() => setFilters({ ...DEFAULT_FILTERS, view: filters.view })}
          >
            <FilterX size={16} aria-hidden />
            Limpar filtros
          </button>
        )}
      </div>

      <div className="card list-card">
        {results.length > 0 ? (
          <ActivityList activities={results} label="Atividades" />
        ) : extraFilters ? (
          <EmptyState
            icon={SearchX}
            title="Nenhuma atividade com esses filtros"
            description="Tente outro termo de busca ou limpe os filtros."
            action={
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setFilters({ ...DEFAULT_FILTERS, view: filters.view })}
              >
                Limpar filtros
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={Inbox}
            title={empty.title}
            description={empty.description}
            tone={filters.view === 'atrasadas' || filters.view === 'prazo_proximo' ? 'success' : 'neutral'}
            action={
              filters.view === 'todas' || filters.view === 'pendentes' ? (
                <button type="button" className="button button--primary" onClick={() => openNewActivity()}>
                  <Plus size={18} aria-hidden />
                  Nova atividade
                </button>
              ) : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
