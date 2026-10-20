import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CircleAlert, Clock } from 'lucide-react';
import { compareByUrgency, countdownLabel, getUrgency, isDueSoon, isOverdue } from '../../domain/activities';
import { paths } from '../../router';
import { useStudy } from '../../state/StudyProvider';
import { useUI } from '../../state/UIProvider';

/** Sino de avisos: atividades atrasadas e com prazo nos próximos 5 dias. */
export function AttentionBell() {
  const { data, today } = useStudy();
  const { openActivityDetails } = useUI();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const items = useMemo(
    () =>
      data.activities
        .filter((a) => isOverdue(a, today) || isDueSoon(a, today))
        .sort(compareByUrgency(today)),
    [data.activities, today],
  );
  const disciplineNames = useMemo(() => new Map(data.disciplines.map((d) => [d.id, d.name])), [data.disciplines]);
  const hasOverdue = items.some((a) => isOverdue(a, today));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>('.bell__trigger')?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="bell" ref={rootRef}>
      <button
        type="button"
        className="icon-button bell__trigger"
        aria-label={items.length > 0 ? `Avisos de prazo (${items.length})` : 'Avisos de prazo'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={20} aria-hidden />
        {items.length > 0 && (
          <span className={`bell__badge${hasOverdue ? ' bell__badge--danger' : ''}`} aria-hidden>
            {items.length > 9 ? '9+' : items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="bell__panel" role="dialog" aria-label="Avisos de prazo">
          <header className="bell__header">
            <strong>Avisos de prazo</strong>
            <small>Atrasadas e vencendo em até 5 dias</small>
          </header>

          {items.length === 0 ? (
            <p className="bell__empty">Tudo em dia! Nenhum prazo apertado no momento.</p>
          ) : (
            <ul className="bell__list">
              {items.map((activity) => {
                const urgency = getUrgency(activity, today);
                const Icon = urgency === 'atrasada' ? CircleAlert : Clock;
                return (
                  <li key={activity.id}>
                    <button
                      type="button"
                      className="bell__item"
                      onClick={() => {
                        setOpen(false);
                        openActivityDetails(activity.id);
                      }}
                    >
                      <span className={`bell__icon bell__icon--${urgency}`}>
                        <Icon size={18} aria-hidden />
                      </span>
                      <span className="bell__text">
                        <strong>{activity.title}</strong>
                        <small>{disciplineNames.get(activity.disciplineId)}</small>
                        <span className={`bell__when countdown--${urgency}`}>{countdownLabel(activity, today)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <a className="bell__footer" href={paths.activities()} onClick={() => setOpen(false)}>
            Ver todas as pendências
          </a>
        </div>
      )}
    </div>
  );
}
