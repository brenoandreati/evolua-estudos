import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { StudyRepository } from '../data';
import { todayISO } from '../domain/dates';
import { createSeedData } from '../domain/seed';
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
  restoreInitialData(): void;
}

interface StudyContextValue {
  loading: boolean;
  data: StudyData;
  /** Data de hoje no Brasil (atualizada automaticamente). */
  today: ISODate;
  hour: number;
  /** Mensagem quando não foi possível salvar no navegador. */
  storageError: string | null;
  actions: StudyActions;
}

const EMPTY_DATA: StudyData = { version: 1, disciplines: [], activities: [] };

const StudyContext = createContext<StudyContextValue | null>(null);

const STORAGE_ERROR_MESSAGE =
  'Não foi possível salvar no navegador. Suas alterações valem só enquanto esta página estiver aberta.';

export function StudyProvider({ children, repository: repo }: { children: ReactNode; repository: StudyRepository }) {
  const [data, dispatch] = useReducer(studyReducer, EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const { today, hour } = useClock();
  // Último estado já gravado (ou recebido do armazenamento) — evita regravar à toa.
  const persisted = useRef<StudyData | null>(null);

  // Carrega os dados salvos. Na primeira visita, grava os dados iniciais uma única vez.
  useEffect(() => {
    let cancelled = false;
    repo
      .load()
      .then((saved) => {
        if (cancelled) return;
        if (saved) {
          persisted.current = saved;
          dispatch({ type: 'replaceAll', data: saved });
        } else {
          dispatch({ type: 'replaceAll', data: createSeedData() });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setStorageError(STORAGE_ERROR_MESSAGE);
        dispatch({ type: 'replaceAll', data: createSeedData() });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repo]);

  // Salva a cada alteração.
  useEffect(() => {
    if (loading || data === persisted.current) return;
    persisted.current = data;
    repo
      .save(data)
      .then(() => setStorageError(null))
      .catch(() => setStorageError(STORAGE_ERROR_MESSAGE));
  }, [data, loading, repo]);

  // Mantém várias abas abertas em sincronia.
  useEffect(
    () =>
      repo.subscribe?.((incoming) => {
        persisted.current = incoming;
        dispatch({ type: 'replaceAll', data: incoming });
      }),
    [repo],
  );

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
      restoreInitialData: () => dispatch({ type: 'replaceAll', data: createSeedData() }),
    }),
    [addDiscipline, addActivity],
  );

  const value = useMemo<StudyContextValue>(
    () => ({ loading, data, today, hour, storageError, actions }),
    [loading, data, today, hour, storageError, actions],
  );

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>;
}

export function useStudy(): StudyContextValue {
  const context = useContext(StudyContext);
  if (!context) throw new Error('useStudy deve ser usado dentro de <StudyProvider>.');
  return context;
}
