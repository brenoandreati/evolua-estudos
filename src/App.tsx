import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { AuthScreen } from './auth/AuthScreen';
import { WelcomeSplash, markIntroShown, shouldShowIntro } from './components/brand/WelcomeSplash';
import { AppShell } from './components/layout/AppShell';
import { CloudOff } from 'lucide-react';
import { EmptyState, LoadingScreen } from './components/ui/primitives';
import { ToastProvider } from './components/ui/ToastProvider';
import { ActivitiesPage } from './pages/ActivitiesPage';
import { CalendarPage } from './pages/CalendarPage';
import { createRepository } from './data';
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
  const { loading, loadError, retryLoad, data } = useStudy();

  const disciplineName =
    route.name === 'discipline' ? data.disciplines.find((d) => d.id === route.id)?.name : undefined;

  useEffect(() => {
    document.title = `${disciplineName ?? TITLES[route.name]} · Evolua Meus Estudos`;
  }, [route.name, disciplineName]);

  // Volta ao topo ao trocar de página (mas não ao mudar filtros na mesma página).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route.name, route.name === 'discipline' ? route.id : '']);

  return (
    <AppShell route={route}>
      {loadError ? (
        <div className="card">
          <EmptyState
            icon={CloudOff}
            title="Não foi possível carregar seus dados"
            description={loadError}
            action={
              <button type="button" className="button button--primary" onClick={retryLoad}>
                Tentar de novo
              </button>
            }
          />
        </div>
      ) : loading ? (
        <LoadingScreen />
      ) : (
        <CurrentPage route={route} />
      )}
    </AppShell>
  );
}

/** Área logada: cada conta tem os próprios dados de estudo. */
function SignedInApp({ email }: { email: string }) {
  const repository = useMemo(() => createRepository({ email }), [email]);
  return (
    <StudyProvider repository={repository}>
      <UIProvider>
        <Screens />
      </UIProvider>
    </StudyProvider>
  );
}

function AccessGate() {
  const { state } = useAuth();
  const [showIntro, setShowIntro] = useState(false);
  const userId = state.status === 'signedIn' ? state.user.id : null;

  // Ao entrar na plataforma, toca a abertura (uma vez por visita).
  useEffect(() => {
    if (userId && shouldShowIntro()) {
      markIntroShown();
      setShowIntro(true);
    }
  }, [userId]);

  const finishIntro = useCallback(() => setShowIntro(false), []);

  if (state.status === 'loading') return <LoadingScreen />;
  if (state.status === 'signedOut') return <AuthScreen notice={state.reason} />;
  return (
    <>
      <SignedInApp key={state.user.id} email={state.user.email} />
      {showIntro && <WelcomeSplash name={state.user.name} onDone={finishIntro} />}
    </>
  );
}

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AccessGate />
      </AuthProvider>
    </ToastProvider>
  );
}
