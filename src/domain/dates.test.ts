import { describe, expect, it } from 'vitest';
import {
  addDays,
  diffInDays,
  formatDate,
  formatDayMonth,
  formatLongDate,
  formatMonthYear,
  isValidISODate,
  todayISO,
  weekday,
} from './dates';

describe('todayISO', () => {
  it('usa a data do Brasil, não a data UTC', () => {
    // 02:30 UTC de 21/10 ainda é 23:30 de 20/10 em Brasília.
    expect(todayISO(new Date('2026-10-21T02:30:00Z'))).toBe('2026-10-20');
    // 03:00 UTC já é meia-noite em Brasília.
    expect(todayISO(new Date('2026-10-21T03:00:00Z'))).toBe('2026-10-21');
  });
});

describe('diffInDays', () => {
  it('conta dias de calendário, sem influência de horário', () => {
    expect(diffInDays('2026-10-20', '2026-10-20')).toBe(0);
    expect(diffInDays('2026-10-20', '2026-11-15')).toBe(26);
    expect(diffInDays('2026-11-18', '2026-11-15')).toBe(-3);
  });

  it('atravessa viradas de mês, de ano e anos bissextos', () => {
    expect(diffInDays('2026-12-30', '2027-01-02')).toBe(3);
    expect(diffInDays('2028-02-28', '2028-03-01')).toBe(2);
    expect(diffInDays('2027-02-28', '2027-03-01')).toBe(1);
  });
});

describe('addDays / weekday', () => {
  it('soma e subtrai dias', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('identifica o dia da semana', () => {
    expect(weekday('2026-10-20')).toBe(2); // terça-feira
    expect(weekday('2026-11-15')).toBe(0); // domingo
  });
});

describe('isValidISODate', () => {
  it('aceita apenas datas reais no formato AAAA-MM-DD', () => {
    expect(isValidISODate('2026-11-15')).toBe(true);
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('15/11/2026')).toBe(false);
    expect(isValidISODate('')).toBe(false);
    expect(isValidISODate(null)).toBe(false);
  });
});

describe('formatação em português', () => {
  it('formata datas sem deslocar o dia', () => {
    expect(formatDate('2026-11-15')).toBe('15/11/2026');
    expect(formatDayMonth('2026-11-09')).toBe('09 nov');
    expect(formatLongDate('2026-10-20')).toBe('Terça-feira, 20 de outubro de 2026');
    expect(formatMonthYear(2026, 10)).toBe('Novembro de 2026');
  });
});
