/**
 * Modelo de dados do painel. As datas de calendário são guardadas como texto
 * no formato `AAAA-MM-DD` (sem horário), o que evita qualquer erro de fuso
 * horário ao comparar prazos.
 */

/** Data de calendário no formato `AAAA-MM-DD`. */
export type ISODate = string;

export type ActivityType =
  | 'videoaula'
  | 'exercicio'
  | 'exercicio_avaliativo'
  | 'avaliacao_online'
  | 'recuperacao'
  | 'trabalho'
  | 'leitura'
  | 'outro';

/** Situação registrada pelo usuário. */
export type ActivityStatus = 'pendente' | 'em_andamento' | 'concluida';

/** Classificação automática calculada a partir do prazo e da data de hoje. */
export type Urgency = 'atrasada' | 'urgente' | 'atencao' | 'no_prazo' | 'concluida';

export interface Discipline {
  id: string;
  name: string;
  description: string;
  /** Período letivo ou módulo (ex.: "2º semestre de 2026", "Módulo 3"). */
  term: string;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  disciplineId: string;
  title: string;
  type: ActivityType;
  /** Nome livre do tipo, usado quando `type` é "outro". */
  customType: string;
  startDate: ISODate;
  dueDate: ISODate;
  notes: string;
  status: ActivityStatus;
  /** Data em que a atividade foi concluída; `null` enquanto não concluída. */
  completedAt: ISODate | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudyData {
  version: 1;
  disciplines: Discipline[];
  activities: Activity[];
}

export type DisciplineInput = Pick<Discipline, 'name' | 'description' | 'term'>;

export type ActivityInput = Pick<
  Activity,
  'disciplineId' | 'title' | 'type' | 'customType' | 'startDate' | 'dueDate' | 'notes' | 'status'
>;
