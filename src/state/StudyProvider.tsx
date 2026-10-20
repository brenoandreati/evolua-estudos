import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, NetworkError } from '../api/client';
import { useToast } from '../components/ui/ToastProvider';
import { DataConflictError, type StudyRepository } from '../data';
import { todayISO } from '../domain/dates';
import type {
  Activity,
  ActivityInput,
  ActivityStatus,
  Discipline,
  DisciplineInput,
  ISODate,
  StudyData,
} from '../domain/types';
import { useClock } from '../hooks/useClock';
import { createId } from './id';
import { cleanActivityInput, resolveCompletedAt, studyReducer } from './studyReducer';

interface StudyActions {
  addDiscipline(input: DisciplineInput): Discipline;
  updateDiscipline(id: string, input: DisciplineInput): void;
  deleteDiscipline(id: string): void;
  addActivity(input: ActivityInput): Activity;
  updateActivity(id: string, input: ActivityInput): void;
  setActivityStatus(id: string, status: ActivityStatus): void;
  deleteActivity(id: string): void;
  /** Apaga todas as disciplinas e atividades da conta. */
  clearAllData(): void;
}

interface StudyContextValue {
  loading: boolean;
  /** Mensagem quando não foi possível carregar os dados (a tela oferece tentar de novo). */
  loadError: string | null;
  retryLoad(): void;
  data: StudyData;
  /** Data de hoje no Brasil (atualizada automaticamente). */
  today: ISODate;
  hour: number;
  /** Mensagem quando a última alteração não pôde ser salva. */
  storageError: string | null;
  actions: StudyActions;
}

const EMPTY_DATA: StudyData = { version: 1, disciplines: [], activities: [] };

const StudyContext = createContext<StudyContextValue | null>(null);

const MESSAGES = {
  offlineLoad: 'Sem conexão com a internet. Verifique sua rede para carregar seus dados.',
  loadError: 'Não foi possível carregar seus dados agora.',
  offlineSave: 'Sem conexão: suas últimas alterações ainda não foram salvas. Elas serão enviadas quando a internet voltar.',
  saveError: 'Não foi possível salvar suas últimas alterações. Tente de novo em instantes.',
};

export function StudyProvider({ children, repository: repo }: { children: ReactNode; repository: StudyRepository }) {
  const [data, dispatch] = useReducer(studyReducer, EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [storageError, setStorageError] = useState<string | null>(null);
  const { today, hour } = useClock();
  const { showToast } = useToast();
  // Último estado já gravado (ou recebido do servidor) — evita regravar à toa.
  const persisted = useRef<StudyData | null>(null);
  const latest = useRef(data);
  latest.current = data;

  // Carrega os dados da conta. Uma conta nova começa vazia.
  // Se o carregamento falhar, nada é salvo (para nunca sobrescrever os dados do servidor).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    repo
      .load()
      .then((saved) => {
        if (cancelled) return;
        if (saved) {
          persisted.current = saved;
          dispatch({ type: 'replaceAll', data: saved });
        } else {
          dispatch({ type: 'replaceAll', data: { ...EMPTY_DATA } });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof NetworkError ? MESSAGES.offlineLoad : MESSAGES.loadError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repo, loadAttempt]);

  const persist = useCallback(
    (snapshot: StudyData) => {
      repo
        .save(snapshot)
        .then(() => setStorageError(null))
        .catch((error: unknown) => {
          if (error instanceof DataConflictError) {
            // Outro aparelho salvou antes: mostra a versão mais recente.
            persisted.current = error.data;
            dispatch({ type: 'replaceAll', data: error.data });
            setStorageError(null);
            showToast('Seus dados foram atualizados com as alterações feitas em outro aparelho.', { tone: 'info' });
          } else if (error instanceof ApiError && error.status === 401) {
            // A sessão terminou: a tela de acesso aparece sozinha.
          } else {
            setStorageError(error instanceof NetworkError ? MESSAGES.offlineSave : MESSAGES.saveError);
          }
        });
    },
    [repo, showToast],
  );

  // Salva a cada alteração.
  useEffect(() => {
    if (loading || loadError || data === persisted.current) return;
    persisted.current = data;
    persist(data);
  }, [data, loading, loadError, persist]);

  // Quando a internet volta, envia o que ficou pendente.
  useEffect(() => {
    if (!storageError) return;
    const retry = () => persist(latest.current);
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [storageError, persist]);

  // Alterações feitas em outro aparelho aparecem ao voltar para a aba.
  useEffect(
    () =>
      repo.subscribe?.((incoming) => {
        persisted.current = incoming;
        dispatch({ type: 'replaceAll', data: incoming });
      }),
    [repo],
  );

  const retryLoad = useCallback(() => setLoadAttempt((n) => n + 1), []);

  const addDiscipline = useCallback((input: DisciplineInput): Discipline => {
    const now = new Date().toISOString();
    const discipline: Discipline = {
      id: createId('disciplina'),
      name: input.name.trim(),
      description: input.description.trim(),
      term: input.term.trim(),
      createdAt: now,
      updatedAt: now,
    };
    dispatch({ type: 'addDiscipline', discipline });
    return discipline;
  }, []);

  const addActivity = useCallback((input: ActivityInput): Activity => {
    const now = new Date().toISOString();
    const activity: Activity = {
      ...cleanActivityInput(input),
      id: createId('atividade'),
      completedAt: resolveCompletedAt(null, input.status, todayISO()),
      createdAt: now,
      updatedAt: now,
    };
    dispatch({ type: 'addActivity', activity });
    return activity;
  }, []);

  const actions = useMemo<StudyActions>(
    () => ({
      addDiscipline,
      updateDiscipline: (id, input) =>
        dispatch({ type: 'updateDiscipline', id, input, now: new Date().toISOString() }),
      deleteDiscipline: (id) => dispatch({ type: 'deleteDiscipline', id }),
      addActivity,
      updateActivity: (id, input) =>
        dispatch({ type: 'updateActivity', id, input, now: new Date().toISOString(), today: todayISO() }),
      setActivityStatus: (id, status) =>
        dispatch({ type: 'setActivityStatus', id, status, now: new Date().toISOString(), today: todayISO() }),
      deleteActivity: (id) => dispatch({ type: 'deleteActivity', id }),
      clearAllData: () => dispatch({ type: 'replaceAll', data: { version: 1, disciplines: [], activities: [] } }),
    }),
    [addDiscipline, addActivity],
  );

  const value = useMemo<StudyContextValue>(
    () => ({ loading, loadError, retryLoad, data, today, hour, storageError, actions }),
    [loading, loadError, retryLoad, data, today, hour, storageError, actions],
  );

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>;
}

export function useStudy(): StudyContextValue {
  const context = useContext(StudyContext);
  if (!context) throw new Error('useStudy deve ser usado dentro de <StudyProvider>.');
  return context;
}
