import { CalendarDays, CalendarClock, CircleCheck, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import {
  STATUS_OPTIONS,
  activityTypeLabel,
  countdownLabel,
  getUrgency,
  isCompleted,
  isNotStartedYet,
} from '../../domain/activities';
import { formatDate, formatLongDate } from '../../domain/dates';
import type { ActivityStatus } from '../../domain/types';
import { paths } from '../../router';
import { useStudy } from '../../state/StudyProvider';
import { useUI } from '../../state/UIProvider';
import { useStudyCommands } from '../../state/useStudyCommands';
import { Modal } from '../ui/Modal';
import { UrgencyBadge } from '../ui/primitives';

export function ActivityDetailsModal({ activityId, onClose }: { activityId: string; onClose: () => void }) {
  const { data, today } = useStudy();
  const { openEditActivity } = useUI();
  const commands = useStudyCommands();
  const activity = data.activities.find((a) => a.id === activityId);

  if (!activity) {
    return (
      <Modal title="Atividade não encontrada" onClose={onClose} size="sm">
        <p>Esta atividade pode ter sido excluída.</p>
      </Modal>
    );
  }

  const discipline = data.disciplines.find((d) => d.id === activity.disciplineId);
  const urgency = getUrgency(activity, today);
  const completed = isCompleted(activity);

  return (
    <Modal
      title={activity.title}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="button button--ghost button--danger-text"
            onClick={() => void commands.deleteActivity(activity)}
          >
            <Trash2 size={16} aria-hidden />
            Excluir
          </button>
          <span className="modal__footer-spacer" />
          <button type="button" className="button button--secondary" onClick={() => openEditActivity(activity.id)}>
            <Pencil size={16} aria-hidden />
            Editar
          </button>
          {completed ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => commands.setStatus(activity, 'pendente')}
            >
              <RotateCcw size={16} aria-hidden />
              Reabrir
            </button>
          ) : (
            <button
              type="button"
              className="button button--success"
              onClick={() => commands.setStatus(activity, 'concluida')}
            >
              <CircleCheck size={16} aria-hidden />
              Concluir
            </button>
          )}
        </>
      }
    >
      <div className="details">
        <div className="details__badges">
          <UrgencyBadge urgency={urgency} />
          <span className={`details__countdown countdown--${urgency}`}>{countdownLabel(activity, today)}</span>
          {isNotStartedYet(activity, today) && <span className="chip">Ainda não iniciada</span>}
        </div>

        <dl className="details__grid">
          <div>
            <dt>Disciplina</dt>
            <dd>
              {discipline ? (
                <a href={paths.discipline(discipline.id)} onClick={onClose}>
                  {discipline.name}
                </a>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>{activityTypeLabel(activity)}</dd>
          </div>
          <div>
            <dt>
              <CalendarDays size={14} aria-hidden /> Início
            </dt>
            <dd>{formatLongDate(activity.startDate)}</dd>
          </div>
          <div>
            <dt>
              <CalendarClock size={14} aria-hidden /> Data limite
            </dt>
            <dd>{formatLongDate(activity.dueDate)}</dd>
          </div>
          {completed && activity.completedAt && (
            <div>
              <dt>
                <CircleCheck size={14} aria-hidden /> Concluída em
              </dt>
              <dd>{formatDate(activity.completedAt)}</dd>
            </div>
          )}
        </dl>

        <fieldset className="segmented" aria-label="Status da atividade">
          <legend className="details__label">Status</legend>
          <div className="segmented__options">
            {STATUS_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`segmented__option${activity.status === option.value ? ' is-active' : ''}`}
              >
                <input
                  type="radio"
                  name="activity-status"
                  value={option.value}
                  checked={activity.status === option.value}
                  onChange={() => commands.setStatus(activity, option.value as ActivityStatus)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <p className="details__label">Descrição ou observações</p>
          {activity.notes ? (
            <p className="details__notes">{activity.notes}</p>
          ) : (
            <p className="details__muted">Nenhuma observação. Use “Editar” para adicionar.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
