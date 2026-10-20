import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  BookOpen,
  CalendarDays,
  CircleCheckBig,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Plus,
  Search,
  Settings,
  TriangleAlert,
} from 'lucide-react';
import { useCurrentUser } from '../../auth/AuthProvider';
import { isOverdue } from '../../domain/activities';
import { navigate, paths, type Route } from '../../router';
import { useStudy } from '../../state/StudyProvider';
import { useUI } from '../../state/UIProvider';
import { useStudyCommands } from '../../state/useStudyCommands';
import { Logo } from '../brand/Logo';
import { AttentionBell } from './AttentionBell';

const NAV_ITEMS = [
  { key: 'overview', label: 'Visão geral', short: 'Início', href: paths.overview, icon: LayoutDashboard },
  { key: 'disciplines', label: 'Minhas disciplinas', short: 'Disciplinas', href: paths.disciplines, icon: BookOpen },
  { key: 'activities', label: 'Todas as atividades', short: 'Atividades', href: paths.activities(), icon: ListChecks },
  { key: 'calendar', label: 'Calendário', short: 'Calendário', href: paths.calendar, icon: CalendarDays },
  { key: 'completed', label: 'Atividades concluídas', short: 'Concluídas', href: paths.completed, icon: CircleCheckBig },
] as const;

function activeKey(route: Route): string {
  return route.name === 'discipline' ? 'disciplines' : route.name;
}

export function AppShell({ route, children }: { route: Route; children: ReactNode }) {
  const { data, today, storageError } = useStudy();
  const { openNewActivity, openSettings } = useUI();
  const { logout } = useStudyCommands();
  const user = useCurrentUser();
  const current = activeKey(route);
  const overdueCount = data.activities.filter((a) => isOverdue(a, today)).length;

  return (
    <div className="app">
      <aside className="sidebar" aria-label="Menu principal">
        <a href={paths.overview} className="sidebar__brand" aria-label="Evolua Meus Estudos — Visão geral">
          <Logo />
        </a>

        <button type="button" className="button button--primary sidebar__cta" onClick={() => openNewActivity()}>
          <Plus size={18} aria-hidden />
          Nova atividade
        </button>

        <nav className="sidebar__nav">
          {NAV_ITEMS.map(({ key, label, href, icon: Icon }) => (
            <a
              key={key}
              href={href}
              className={`sidebar__link${current === key ? ' is-active' : ''}`}
              aria-current={current === key ? 'page' : undefined}
            >
              <Icon size={19} aria-hidden />
              <span>{label}</span>
              {key === 'activities' && overdueCount > 0 && (
                <span className="sidebar__count" title={`${overdueCount} atrasada(s)`}>
                  {overdueCount}
                </span>
              )}
            </a>
          ))}
        </nav>

        <div className="sidebar__footer">
          <button type="button" className="sidebar__link" onClick={openSettings}>
            <Settings size={19} aria-hidden />
            <span>Configurações</span>
          </button>
          <div className="sidebar__user">
            <span className="sidebar__avatar" aria-hidden>
              {(user.name.trim() || user.email).charAt(0).toUpperCase()}
            </span>
            <span className="sidebar__user-text">
              <strong>{user.name.trim() || 'Minha conta'}</strong>
              <small>{user.email}</small>
            </span>
            <button
              type="button"
              className="icon-button"
              onClick={() => void logout()}
              aria-label="Sair da conta"
              title="Sair da conta"
            >
              <LogOut size={18} aria-hidden />
            </button>
          </div>
        </div>
      </aside>

      <div className="app__main">
        <header className="topbar">
          <a href={paths.overview} className="topbar__brand" aria-label="Evolua Meus Estudos — Visão geral">
            <Logo compact />
            <span className="topbar__title">Evolua Meus Estudos</span>
          </a>
          <GlobalSearch route={route} />
          <div className="topbar__actions">
            <AttentionBell />
            <button type="button" className="icon-button topbar__settings" onClick={openSettings} aria-label="Configurações">
              <Settings size={20} aria-hidden />
            </button>
            <button type="button" className="button button--primary topbar__new" onClick={() => openNewActivity()}>
              <Plus size={18} aria-hidden />
              <span className="topbar__new-label">Nova atividade</span>
            </button>
          </div>
        </header>

        {storageError && (
          <div className="banner banner--warning" role="alert">
            <TriangleAlert size={18} aria-hidden />
            {storageError}
          </div>
        )}

        <main className="content" id="conteudo">
          {children}
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Navegação">
        {NAV_ITEMS.map(({ key, short, href, icon: Icon }) => (
          <a
            key={key}
            href={href}
            className={`bottom-nav__link${current === key ? ' is-active' : ''}`}
            aria-current={current === key ? 'page' : undefined}
          >
            <span className="bottom-nav__icon">
              <Icon size={21} aria-hidden />
              {key === 'activities' && overdueCount > 0 && <span className="bottom-nav__dot" aria-hidden />}
            </span>
            <span>{short}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

/** Busca por nome de atividade — leva para "Todas as atividades" com o termo aplicado. */
function GlobalSearch({ route }: { route: Route }) {
  const routeQuery = route.name === 'activities' ? (route.query.get('busca') ?? '') : '';
  const [value, setValue] = useState(routeQuery);

  useEffect(() => setValue(routeQuery), [routeQuery]);

  const apply = (text: string) => {
    if (route.name !== 'activities' && !text.trim()) return;
    const query: Record<string, string> = {};
    if (route.name === 'activities') route.query.forEach((v, k) => (query[k] = v));
    if (text.trim()) query.busca = text;
    else delete query.busca;
    // Ao buscar, procura em todas as atividades (pendentes e concluídas).
    if (route.name !== 'activities' && text.trim()) query.ver = 'todas';
    navigate(paths.activities(query), { replace: route.name === 'activities' });
  };

  return (
    <form
      className="search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        apply(value);
      }}
    >
      <Search size={18} className="search__icon" aria-hidden />
      <input
        type="search"
        className="search__input"
        placeholder="Buscar atividade pelo nome…"
        aria-label="Buscar atividade pelo nome"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          apply(event.target.value);
        }}
      />
    </form>
  );
}
