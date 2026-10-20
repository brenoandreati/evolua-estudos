import { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { LoadingScreen } from './components/ui/primitives';
import { ToastProvider } from './components/ui/ToastProvider';
import { ActivitiesPage } from './pages/ActivitiesPage';
import { CalendarPage } from './pages/CalendarPage';
import { CompletedPage } from './pages/CompletedPage';
import { DisciplineDetailPage } from './pages/DisciplineDetailPage';
import { DisciplinesPage } from './pages/DisciplinesPage';
import { OverviewPage } from './pages/OverviewPage';
import { useRoute, type Route } from './router';
import { StudyProvider, useStudy } from './state/StudyProvider';
import { UIProvider } from './state/UIProvider';

const TITLES: Record<Route['name'], string> = {
  overview: 'Visão geral',
  disciplines: 'Minhas disciplinas',
  discipline: 'Disciplina',
  activities: 'Todas as atividades',
  calendar: 'Calendário',
  completed: 'Atividades concluídas',
  notFound: 'Página não encontrada',
};

function CurrentPage({ route }: { route: Route }) {
  switch (route.name) {
    case 'overview':
    case 'notFound':
      return <OverviewPage />;
    case 'disciplines':
      return <DisciplinesPage />;
    case 'discipline':
      return <DisciplineDetailPage key={route.id} id={route.id} />;
    case 'activities':
      return <ActivitiesPage query={route.query} />;
    case 'calendar':
      return <CalendarPage />;
    case 'completed':
      return <CompletedPage />;
  }
}

function Screens() {
  const route = useRoute();
  const { loading, data } = useStudy();

  const disciplineName =
    route.name === 'discipline' ? data.disciplines.find((d) => d.id === route.id)?.name : undefined;

  useEffect(() => {
    document.title = `${disciplineName ?? TITLES[route.name]} · Evolua Estudos`;
  }, [route.name, disciplineName]);

  // Volta ao topo ao trocar de página (mas não ao mudar filtros na mesma página).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route.name, route.name === 'discipline' ? route.id : '']);

  return (
    <AppShell route={route}>
      {loading ? <LoadingScreen /> : <CurrentPage route={route} />}
    </AppShell>
  );
}

export function App() {
  return (
    <ToastProvider>
      <StudyProvider>
        <UIProvider>
          <Screens />
        </UIProvider>
      </StudyProvider>
    </ToastProvider>
  );
}
