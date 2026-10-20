import type { ISODate } from './types';

/** Fuso usado para decidir "que dia é hoje" — horário de Brasília. */
export const APP_TIME_ZONE = 'America/Sao_Paulo';

const MS_PER_DAY = 86_400_000;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const todayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const hourFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  hour: 'numeric',
  hourCycle: 'h23',
});

/** Data de hoje no Brasil, no formato `AAAA-MM-DD`. */
export function todayISO(now: Date = new Date()): ISODate {
  // O locale en-CA formata como AAAA-MM-DD.
  return todayFormatter.format(now);
}

/** Hora atual (0–23) no Brasil, usada na saudação. */
export function currentHour(now: Date = new Date()): number {
  return Number(hourFormatter.format(now));
}

export function isValidISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE_RE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Converte `AAAA-MM-DD` em um número de dias absoluto (sem horário nem fuso). */
function toDayNumber(iso: ISODate): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

function fromDayNumber(day: number): ISODate {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Quantidade de dias de `from` até `to` (negativo se `to` já passou). */
export function diffInDays(from: ISODate, to: ISODate): number {
  return Math.round(toDayNumber(to) - toDayNumber(from));
}

export function addDays(iso: ISODate, days: number): ISODate {
  return fromDayNumber(toDayNumber(iso) + days);
}

export function toISODate(year: number, monthIndex: number, day: number): ISODate {
  return fromDayNumber(Date.UTC(year, monthIndex, day) / MS_PER_DAY);
}

export function parseISODate(iso: ISODate): { year: number; monthIndex: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, monthIndex: month - 1, day };
}

/** Dia da semana (0 = domingo) de uma data de calendário. */
export function weekday(iso: ISODate): number {
  const { year, monthIndex, day } = parseISODate(iso);
  return new Date(Date.UTC(year, monthIndex, day)).getUTCDay();
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

// Formatação: a data é montada ao meio-dia UTC e formatada em UTC, então o
// dia exibido é sempre o mesmo dia guardado, em qualquer fuso do navegador.
function toDisplayDate(iso: ISODate): Date {
  const { year, monthIndex, day } = parseISODate(iso);
  return new Date(Date.UTC(year, monthIndex, day, 12));
}

const shortFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const dayMonthFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  day: '2-digit',
  month: 'short',
});
const longFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const monthYearFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
});

/** 15/11/2026 */
export function formatDate(iso: ISODate): string {
  return shortFormatter.format(toDisplayDate(iso));
}

/** 15 de nov. */
export function formatDayMonth(iso: ISODate): string {
  return dayMonthFormatter.format(toDisplayDate(iso)).replace(/\./g, '').replace(' de ', ' ');
}

/** Terça-feira, 20 de outubro de 2026 */
export function formatLongDate(iso: ISODate): string {
  const text = longFormatter.format(toDisplayDate(iso));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Outubro de 2026 */
export function formatMonthYear(year: number, monthIndex: number): string {
  const text = monthYearFormatter.format(new Date(Date.UTC(year, monthIndex, 1, 12)));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
