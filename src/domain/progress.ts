import { isCompleted } from './activities';
import type { Activity } from './types';

export interface Progress {
  total: number;
  completed: number;
  pending: number;
  /** Percentual exato (0–100), sem arredondamento. */
  ratio: number;
  /** Percentual arredondado para exibição. */
  percent: number;
}

/** Progresso = (concluídas ÷ total) × 100. Sem atividades, o progresso é 0%. */
export function computeProgress(activities: Activity[]): Progress {
  const total = activities.length;
  const completed = activities.filter(isCompleted).length;
  const ratio = total === 0 ? 0 : (completed / total) * 100;
  return { total, completed, pending: total - completed, ratio, percent: Math.round(ratio) };
}

/** Formata o percentual exato no padrão brasileiro (ex.: 37,5%). */
export function formatPercent(ratio: number, maximumFractionDigits = 1): string {
  return `${ratio.toLocaleString('pt-BR', { maximumFractionDigits })}%`;
}
