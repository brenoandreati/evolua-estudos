import type {
  Activity,
  ActivityInput,
  ActivityStatus,
  Discipline,
  DisciplineInput,
  ISODate,
  StudyData,
} from '../domain/types';

/**
 * Todas as alterações nos dados passam por este reducer (funções puras).
 * Data de hoje, horário e IDs chegam prontos nas ações, o que facilita os testes.
 */
export type StudyAction =
  | { type: 'replaceAll'; data: StudyData }
  | { type: 'addDiscipline'; discipline: Discipline }
  | { type: 'updateDiscipline'; id: string; input: DisciplineInput; now: string }
  | { type: 'deleteDiscipline'; id: string }
  | { type: 'addActivity'; activity: Activity }
  | { type: 'updateActivity'; id: string; input: ActivityInput; now: string; today: ISODate }
  | { type: 'setActivityStatus'; id: string; status: ActivityStatus; now: string; today: ISODate }
  | { type: 'deleteActivity'; id: string };

/** Mantém `completedAt` coerente com o status. */
export function resolveCompletedAt(
  previous: Pick<Activity, 'status' | 'completedAt'> | null,
  nextStatus: ActivityStatus,
  today: ISODate,
): ISODate | null {
  if (nextStatus !== 'concluida') return null;
  if (previous?.status === 'concluida' && previous.completedAt) return previous.completedAt;
  return today;
}

function cleanDisciplineInput(input: DisciplineInput): DisciplineInput {
  return { name: input.name.trim(), description: input.description.trim(), term: input.term.trim() };
}

export function cleanActivityInput(input: ActivityInput): ActivityInput {
  return {
    ...input,
    title: input.title.trim(),
    customType: input.type === 'outro' ? input.customType.trim() : '',
    notes: input.notes.trim(),
  };
}

export function studyReducer(state: StudyData, action: StudyAction): StudyData {
  switch (action.type) {
    case 'replaceAll':
      return action.data;

    case 'addDiscipline':
      return { ...state, disciplines: [...state.disciplines, action.discipline] };

    case 'updateDiscipline':
      return {
        ...state,
        disciplines: state.disciplines.map((d) =>
          d.id === action.id ? { ...d, ...cleanDisciplineInput(action.input), updatedAt: action.now } : d,
        ),
      };

    case 'deleteDiscipline':
      // Excluir a disciplina remove também todas as atividades dela.
      return {
        ...state,
        disciplines: state.disciplines.filter((d) => d.id !== action.id),
        activities: state.activities.filter((a) => a.disciplineId !== action.id),
      };

    case 'addActivity':
      return { ...state, activities: [...state.activities, action.activity] };

    case 'updateActivity':
      return {
        ...state,
        activities: state.activities.map((a) =>
          a.id === action.id
            ? {
                ...a,
                ...cleanActivityInput(action.input),
                completedAt: resolveCompletedAt(a, action.input.status, action.today),
                updatedAt: action.now,
              }
            : a,
        ),
      };

    case 'setActivityStatus':
      return {
        ...state,
        activities: state.activities.map((a) =>
          a.id === action.id && a.status !== action.status
            ? {
                ...a,
                status: action.status,
                completedAt: resolveCompletedAt(a, action.status, action.today),
                updatedAt: action.now,
              }
            : a,
        ),
      };

    case 'deleteActivity':
      return { ...state, activities: state.activities.filter((a) => a.id !== action.id) };
  }
}
