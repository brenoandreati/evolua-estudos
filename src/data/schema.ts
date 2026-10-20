import { ACTIVITY_TYPES, STATUS_OPTIONS } from '../domain/activities';
import { isValidISODate } from '../domain/dates';
import type { Activity, ActivityStatus, ActivityType, Discipline, StudyData } from '../domain/types';

const TYPE_VALUES = new Set<string>(ACTIVITY_TYPES.map((t) => t.value));
const STATUS_VALUES = new Set<string>(STATUS_OPTIONS.map((s) => s.value));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function parseDiscipline(raw: unknown): Discipline | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  const now = new Date().toISOString();
  return {
    id: raw.id,
    name: raw.name,
    description: str(raw.description),
    term: str(raw.term),
    createdAt: str(raw.createdAt, now),
    updatedAt: str(raw.updatedAt, now),
  };
}

function parseActivity(raw: unknown): Activity | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || typeof raw.disciplineId !== 'string') return null;
  if (typeof raw.title !== 'string' || !isValidISODate(raw.dueDate)) return null;

  const now = new Date().toISOString();
  const status = (STATUS_VALUES.has(str(raw.status)) ? raw.status : 'pendente') as ActivityStatus;
  const completedAt = isValidISODate(raw.completedAt) ? raw.completedAt : null;

  return {
    id: raw.id,
    disciplineId: raw.disciplineId,
    title: raw.title,
    type: (TYPE_VALUES.has(str(raw.type)) ? raw.type : 'outro') as ActivityType,
    customType: str(raw.customType),
    startDate: isValidISODate(raw.startDate) ? raw.startDate : raw.dueDate,
    dueDate: raw.dueDate,
    notes: str(raw.notes),
    status,
    completedAt: status === 'concluida' ? (completedAt ?? raw.dueDate) : null,
    createdAt: str(raw.createdAt, now),
    updatedAt: str(raw.updatedAt, now),
  };
}

/**
 * Valida dados vindos do armazenamento. Registros malformados são descartados
 * individualmente; se a estrutura geral for inválida, retorna `null`.
 */
export function parseStudyData(raw: unknown): StudyData | null {
  if (!isRecord(raw) || !Array.isArray(raw.disciplines) || !Array.isArray(raw.activities)) {
    return null;
  }
  const disciplines = raw.disciplines.map(parseDiscipline).filter((d): d is Discipline => d !== null);
  const disciplineIds = new Set(disciplines.map((d) => d.id));
  const activities = raw.activities
    .map(parseActivity)
    .filter((a): a is Activity => a !== null && disciplineIds.has(a.disciplineId));
  return { version: 1, disciplines, activities };
}
