import { addDays, diffInDays, parseISODate } from './dates';
import type { Activity, ActivityStatus, ActivityType, ISODate, Urgency } from './types';

export const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: 'videoaula', label: 'Videoaula' },
  { value: 'exercicio', label: 'Exercício' },
  { value: 'exercicio_avaliativo', label: 'Exercício avaliativo' },
  { value: 'avaliacao_online', label: 'Avaliação online' },
  { value: 'recuperacao', label: 'Recuperação' },
  { value: 'trabalho', label: 'Trabalho' },
  { value: 'leitura', label: 'Leitura' },
  { value: 'outro', label: 'Outro' },
];

const TYPE_LABELS = Object.fromEntries(ACTIVITY_TYPES.map((t) => [t.value, t.label])) as Record<
  ActivityType,
  string
>;

export function activityTypeLabel(activity: Pick<Activity, 'type' | 'customType'>): string {
  if (activity.type === 'outro' && activity.customType.trim()) return activity.customType.trim();
  return TYPE_LABELS[activity.type] ?? 'Outro';
}

export const STATUS_OPTIONS: { value: ActivityStatus; label: string }[] = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluida', label: 'Concluída' },
];

export const URGENCY_INFO: Record<Urgency, { label: string; description: string }> = {
  atrasada: { label: 'Atrasada', description: 'O prazo já passou' },
  urgente: { label: 'Urgente', description: 'Vence em até 2 dias' },
  atencao: { label: 'Atenção', description: 'Vence em 3 a 5 dias' },
  no_prazo: { label: 'No prazo', description: 'Mais de 5 dias para o prazo' },
  concluida: { label: 'Concluída', description: 'Atividade finalizada' },
};

/** Ordem de prioridade: quanto menor, mais urgente. */
export const URGENCY_ORDER: Record<Urgency, number> = {
  atrasada: 0,
  urgente: 1,
  atencao: 2,
  no_prazo: 3,
  concluida: 4,
};

export function isCompleted(activity: Pick<Activity, 'status'>): boolean {
  return activity.status === 'concluida';
}

/** Dias que faltam até o prazo (negativo quando já passou). */
export function daysUntilDue(activity: Pick<Activity, 'dueDate'>, today: ISODate): number {
  return diffInDays(today, activity.dueDate);
}

/**
 * Classificação de urgência:
 * concluída (verde) › atrasada (vermelho) › 0–2 dias (laranja) ›
 * 3–5 dias (amarelo) › mais de 5 dias (azul).
 */
export function getUrgency(activity: Pick<Activity, 'status' | 'dueDate'>, today: ISODate): Urgency {
  if (isCompleted(activity)) return 'concluida';
  const days = daysUntilDue(activity, today);
  if (days < 0) return 'atrasada';
  if (days <= 2) return 'urgente';
  if (days <= 5) return 'atencao';
  return 'no_prazo';
}

export function isOverdue(activity: Pick<Activity, 'status' | 'dueDate'>, today: ISODate): boolean {
  return getUrgency(activity, today) === 'atrasada';
}

/** Prazo próximo: ainda não venceu e faltam no máximo 5 dias. */
export function isDueSoon(activity: Pick<Activity, 'status' | 'dueDate'>, today: ISODate): boolean {
  const urgency = getUrgency(activity, today);
  return urgency === 'urgente' || urgency === 'atencao';
}

/** A data de início ainda não chegou (e a atividade não foi concluída). */
export function isNotStartedYet(
  activity: Pick<Activity, 'status' | 'startDate'>,
  today: ISODate,
): boolean {
  return !isCompleted(activity) && Boolean(activity.startDate) && diffInDays(today, activity.startDate) > 0;
}

function plural(n: number, singular: string, pluralForm: string): string {
  return n === 1 ? singular : pluralForm;
}

/** Texto da contagem regressiva: "Vence hoje", "Faltam 2 dias", "Atrasada há 3 dias"… */
export function countdownLabel(activity: Pick<Activity, 'status' | 'dueDate'>, today: ISODate): string {
  if (isCompleted(activity)) return 'Concluída';
  const days = daysUntilDue(activity, today);
  if (days < 0) {
    const late = -days;
    return `Atrasada há ${late} ${plural(late, 'dia', 'dias')}`;
  }
  if (days === 0) return 'Vence hoje';
  if (days === 1) return 'Vence amanhã';
  if (days <= 5) return `Faltam ${days} dias`;
  return `Vence em ${days} dias`;
}

/** Ordena por urgência e, depois, pelo prazo mais próximo. */
export function compareByUrgency(today: ISODate) {
  return (a: Activity, b: Activity): number =>
    URGENCY_ORDER[getUrgency(a, today)] - URGENCY_ORDER[getUrgency(b, today)] ||
    a.dueDate.localeCompare(b.dueDate) ||
    a.title.localeCompare(b.title, 'pt-BR');
}

/** Concluídas mais recentes primeiro. */
export function compareByCompletion(a: Activity, b: Activity): number {
  return (
    (b.completedAt ?? '').localeCompare(a.completedAt ?? '') ||
    b.updatedAt.localeCompare(a.updatedAt) ||
    a.title.localeCompare(b.title, 'pt-BR')
  );
}

/** Próximo prazo relevante entre as atividades não concluídas. */
export function nextRelevantActivity(activities: Activity[], today: ISODate): Activity | undefined {
  return activities.filter((a) => !isCompleted(a)).sort(compareByUrgency(today))[0];
}

// ---------------------------------------------------------------------------
// Filtros

export type StatusView = 'todas' | 'pendentes' | 'em_andamento' | 'atrasadas' | 'prazo_proximo' | 'concluidas';

export const STATUS_VIEWS: { value: StatusView; label: string }[] = [
  { value: 'pendentes', label: 'Pendentes' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'atrasadas', label: 'Atrasadas' },
  { value: 'prazo_proximo', label: 'Prazo próximo' },
  { value: 'concluidas', label: 'Concluídas' },
  { value: 'todas', label: 'Todas' },
];

export type PeriodFilter = 'qualquer' | 'hoje' | 'proximos_7' | 'proximos_30' | 'este_mes' | 'personalizado';

export const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: 'qualquer', label: 'Qualquer prazo' },
  { value: 'hoje', label: 'Vence hoje' },
  { value: 'proximos_7', label: 'Próximos 7 dias' },
  { value: 'proximos_30', label: 'Próximos 30 dias' },
  { value: 'este_mes', label: 'Este mês' },
  { value: 'personalizado', label: 'Intervalo personalizado' },
];

export interface ActivityFilters {
  view: StatusView;
  search: string;
  disciplineId: string; // '' = todas
  type: ActivityType | ''; // '' = todos
  period: PeriodFilter;
  from: ISODate | ''; // usado com período personalizado
  to: ISODate | '';
}

export const DEFAULT_FILTERS: ActivityFilters = {
  view: 'pendentes',
  search: '',
  disciplineId: '',
  type: '',
  period: 'qualquer',
  from: '',
  to: '',
};

export function matchesView(activity: Activity, view: StatusView, today: ISODate): boolean {
  switch (view) {
    case 'todas':
      return true;
    case 'pendentes':
      return !isCompleted(activity);
    case 'em_andamento':
      return activity.status === 'em_andamento';
    case 'atrasadas':
      return isOverdue(activity, today);
    case 'prazo_proximo':
      return isDueSoon(activity, today);
    case 'concluidas':
      return isCompleted(activity);
  }
}

/** Intervalo (inclusivo) de prazos para cada período; `null` = sem limite. */
export function periodRange(
  filters: Pick<ActivityFilters, 'period' | 'from' | 'to'>,
  today: ISODate,
): { start: ISODate | null; end: ISODate | null } {
  switch (filters.period) {
    case 'qualquer':
      return { start: null, end: null };
    case 'hoje':
      return { start: today, end: today };
    case 'proximos_7':
      return { start: today, end: addDays(today, 7) };
    case 'proximos_30':
      return { start: today, end: addDays(today, 30) };
    case 'este_mes': {
      const { year, monthIndex } = parseISODate(today);
      const first = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
      const last = addDays(
        monthIndex === 11 ? `${year + 1}-01-01` : `${year}-${String(monthIndex + 2).padStart(2, '0')}-01`,
        -1,
      );
      return { start: first, end: last };
    }
    case 'personalizado':
      return { start: filters.from || null, end: filters.to || null };
  }
}

/** Remove acentos e caixa para a busca por nome. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function filterActivities(
  activities: Activity[],
  filters: ActivityFilters,
  today: ISODate,
): Activity[] {
  const query = normalizeText(filters.search);
  const { start, end } = periodRange(filters, today);

  const result = activities.filter((activity) => {
    if (!matchesView(activity, filters.view, today)) return false;
    if (filters.disciplineId && activity.disciplineId !== filters.disciplineId) return false;
    if (filters.type && activity.type !== filters.type) return false;
    if (start && activity.dueDate < start) return false;
    if (end && activity.dueDate > end) return false;
    if (query && !normalizeText(activity.title).includes(query)) return false;
    return true;
  });

  return filters.view === 'concluidas'
    ? result.sort(compareByCompletion)
    : result.sort(compareByUrgency(today));
}
