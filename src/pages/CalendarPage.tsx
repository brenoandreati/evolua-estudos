import { useMemo, useState } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, Flag, PlayCircle } from 'lucide-react';
import { EmptyState, PageHeader, UrgencyBadge } from '../components/ui/primitives';
import { countdownLabel, getUrgency, URGENCY_ORDER } from '../domain/activities';
import {
  WEEKDAY_SHORT,
  addDays,
  daysInMonth,
  formatDayMonth,
  formatLongDate,
  formatMonthYear,
  parseISODate,
  toISODate,
  weekday,
} from '../domain/dates';
import type { Activity, ISODate } from '../domain/types';
import { useStudy } from '../state/StudyProvider';
import { useUI } from '../state/UIProvider';

interface DayEvents {
  due: Activity[];
  start: Activity[];
}

const MAX_CHIPS = 3;

/** Datas visíveis no mês: semanas completas, de domingo a sábado. */
export function buildMonthGrid(year: number, monthIndex: number): ISODate[] {
  const first = toISODate(year, monthIndex, 1);
  const last = toISODate(year, monthIndex, daysInMonth(year, monthIndex));
  const start = addDays(first, -weekday(first));
  const end = addDays(last, 6 - weekday(last));
  const days: ISODate[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

export function CalendarPage() {
  const { data, today } = useStudy();
  const { openActivityDetails, openNewActivity } = useUI();
  const initial = parseISODate(today);
  const [month, setMonth] = useState({ year: initial.year, monthIndex: initial.monthIndex });
  const [selected, setSelected] = useState<ISODate>(today);

  const disciplineNames = useMemo(
    () => new Map(data.disciplines.map((d) => [d.id, d.name])),
    [data.disciplines],
  );

  // Um único índice por data, montado a partir das mesmas atividades do resto do sistema.
  const eventsByDate = useMemo(() => {
    const map = new Map<ISODate, DayEvents>();
    const get = (date: ISODate) => {
      let entry = map.get(date);
      if (!entry) {
        entry = { due: [], start: [] };
        map.set(date, entry);
      }
      return entry;
    };
    for (const activity of data.activities) {
      get(activity.dueDate).due.push(activity);
      if (activity.startDate && activity.startDate !== activity.dueDate) get(activity.startDate).start.push(activity);
    }
    for (const entry of map.values()) {
      entry.due.sort(
        (a, b) => URGENCY_ORDER[getUrgency(a, today)] - URGENCY_ORDER[getUrgency(b, today)] || a.title.localeCompare(b.title),
      );
    }
    return map;
  }, [data.activities, today]);

  const grid = useMemo(() => buildMonthGrid(month.year, month.monthIndex), [month]);

  const changeMonth = (delta: number) => {
    setMonth(({ year, monthIndex }) => {
      const next = monthIndex + delta;
      return { year: year + Math.floor(next / 12), monthIndex: ((next % 12) + 12) % 12 };
    });
  };

  const goToday = () => {
    const t = parseISODate(today);
    setMonth({ year: t.year, monthIndex: t.monthIndex });
    setSelected(today);
  };

  const selectDay = (date: ISODate) => {
    setSelected(date);
    const d = parseISODate(date);
    if (d.monthIndex !== month.monthIndex || d.year !== month.year) {
      setMonth({ year: d.year, monthIndex: d.monthIndex });
    }
  };

  const selectedEvents = eventsByDate.get(selected) ?? { due: [], start: [] };
  const isCurrentMonth = (date: ISODate) => parseISODate(date).monthIndex === month.monthIndex;

  return (
    <div className="page">
      <PageHeader
        title="Calendário"
        subtitle="Prazos e datas de início das suas atividades. Clique em um dia para ver os detalhes."
      />

      <div className="calendar-layout">
        <section className="card calendar" aria-label="Calendário mensal">
          <header className="calendar__header">
            <h2 className="calendar__title" aria-live="polite">
              {formatMonthYear(month.year, month.monthIndex)}
            </h2>
            <div className="calendar__nav">
              <button type="button" className="button button--ghost button--sm" onClick={goToday}>
                Hoje
              </button>
              <button type="button" className="icon-button icon-button--bordered" onClick={() => changeMonth(-1)} aria-label="Mês anterior">
                <ChevronLeft size={18} aria-hidden />
              </button>
              <button type="button" className="icon-button icon-button--bordered" onClick={() => changeMonth(1)} aria-label="Próximo mês">
                <ChevronRight size={18} aria-hidden />
              </button>
            </div>
          </header>

          <div className="calendar__grid">
            <div className="calendar__weekdays" aria-hidden>
              {WEEKDAY_SHORT.map((day) => (
                <span key={day} className="calendar__weekday">
                  {day}
                </span>
              ))}
            </div>
            <div className="calendar__days">
              {grid.map((date) => {
                const events = eventsByDate.get(date);
                const due = events?.due ?? [];
                const start = events?.start ?? [];
                const { day } = parseISODate(date);
                const label = [
                  formatLongDate(date),
                  due.length ? `${due.length} ${due.length === 1 ? 'prazo' : 'prazos'}` : '',
                  start.length ? `${start.length} ${start.length === 1 ? 'início' : 'inícios'}` : '',
                ]
                  .filter(Boolean)
                  .join(', ');
                const worst = due.length ? getUrgency(due[0], today) : null;
                return (
                  <button
                    key={date}
                    type="button"
                    aria-label={label}
                    aria-pressed={selected === date}
                    data-date={date}
                    className={[
                      'calendar__day',
                      isCurrentMonth(date) ? '' : 'is-outside',
                      date === today ? 'is-today' : '',
                      date === selected ? 'is-selected' : '',
                      worst ? `has-due has-due--${worst}` : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => selectDay(date)}
                  >
                    <span className="calendar__date">{day}</span>
                    <span className="calendar__events">
                      {due.slice(0, MAX_CHIPS).map((a) => (
                        <span key={`d-${a.id}`} className={`calendar__chip calendar__chip--${getUrgency(a, today)}`}>
                          {a.title}
                        </span>
                      ))}
                      {start.slice(0, Math.max(0, MAX_CHIPS - due.length)).map((a) => (
                        <span key={`s-${a.id}`} className="calendar__chip calendar__chip--start">
                          Início: {a.title}
                        </span>
                      ))}
                      {due.length + start.length > MAX_CHIPS && (
                        <span className="calendar__more">+{due.length + start.length - MAX_CHIPS} mais</span>
                      )}
                    </span>
                    {/* Versão compacta para celular */}
                    <span className="calendar__dots" aria-hidden>
                      {due.slice(0, 3).map((a) => (
                        <span key={`dd-${a.id}`} className={`dot dot--${getUrgency(a, today)}`} />
                      ))}
                      {start.length > 0 && due.length < 3 && <span className="dot dot--start" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <ul className="calendar__legend" aria-label="Legenda">
            <li><span className="dot dot--atrasada" /> Atrasada</li>
            <li><span className="dot dot--urgente" /> Urgente</li>
            <li><span className="dot dot--atencao" /> Atenção</li>
            <li><span className="dot dot--no_prazo" /> No prazo</li>
            <li><span className="dot dot--concluida" /> Concluída</li>
            <li><span className="dot dot--start" /> Início</li>
          </ul>
        </section>

        <aside className="card day-panel" aria-labelledby="dia-selecionado" data-testid="day-panel">
          <header className="day-panel__header">
            <h2 id="dia-selecionado" className="day-panel__title">
              {formatLongDate(selected)}
            </h2>
            {selected === today && <span className="chip chip--brand">Hoje</span>}
          </header>

          {selectedEvents.due.length === 0 && selectedEvents.start.length === 0 ? (
            <EmptyState icon={CalendarPlus} title="Nada marcado para este dia" />
          ) : (
            <>
              {selectedEvents.due.length > 0 && (
                <div className="day-panel__group">
                  <h3 className="day-panel__group-title">
                    <Flag size={15} aria-hidden /> Prazos
                  </h3>
                  <ul className="day-panel__list">
                    {selectedEvents.due.map((a) => (
                      <li key={a.id}>
                        <button type="button" className="day-panel__item" onClick={() => openActivityDetails(a.id)}>
                          <span className="day-panel__item-text">
                            <strong>{a.title}</strong>
                            <small>
                              {disciplineNames.get(a.disciplineId)} · {countdownLabel(a, today)}
                            </small>
                          </span>
                          <UrgencyBadge urgency={getUrgency(a, today)} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedEvents.start.length > 0 && (
                <div className="day-panel__group">
                  <h3 className="day-panel__group-title">
                    <PlayCircle size={15} aria-hidden /> Inícios
                  </h3>
                  <ul className="day-panel__list">
                    {selectedEvents.start.map((a) => (
                      <li key={a.id}>
                        <button type="button" className="day-panel__item" onClick={() => openActivityDetails(a.id)}>
                          <span className="day-panel__item-text">
                            <strong>{a.title}</strong>
                            <small>
                              {disciplineNames.get(a.disciplineId)} · prazo em {formatDayMonth(a.dueDate)}
                            </small>
                          </span>
                          <UrgencyBadge urgency={getUrgency(a, today)} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          <button
            type="button"
            className="button button--secondary day-panel__add"
            onClick={() => openNewActivity({ dueDate: selected, startDate: selected < today ? selected : today })}
          >
            <CalendarPlus size={16} aria-hidden />
            Adicionar atividade neste dia
          </button>
        </aside>
      </div>
    </div>
  );
}
