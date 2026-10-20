import { Check, Circle, CirclePlay, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import {
  activityTypeLabel,
  countdownLabel,
  getUrgency,
  isCompleted,
  isNotStartedYet,
} from '../../domain/activities';
import { formatDate, formatDayMonth } from '../../domain/dates';
import type { Activity } from '../../domain/types';
import { useStudy } from '../../state/StudyProvider';
import { useUI } from '../../state/UIProvider';
import { useStudyCommands } from '../../state/useStudyCommands';
import { Menu, type MenuItem } from '../ui/Menu';
import { UrgencyBadge } from '../ui/primitives';

interface ActivityItemProps {
  activity: Activity;
  /** Mostra o nome da disciplina (desligado na página da própria disciplina). */
  showDiscipline?: boolean;
}

export function ActivityItem({ activity, showDiscipline = true }: ActivityItemProps) {
  const { data, today } = useStudy();
  const { openActivityDetails, openEditActivity } = useUI();
  const commands = useStudyCommands();

  const completed = isCompleted(activity);
  const urgency = getUrgency(activity, today);
  const discipline = data.disciplines.find((d) => d.id === activity.disciplineId);
  const notStarted = isNotStartedYet(activity, today);

  const menuItems: MenuItem[] = [
    { label: 'Editar', icon: Pencil, onSelect: () => openEditActivity(activity.id) },
  ];
  if (completed) {
    menuItems.push({ label: 'Reabrir atividade', icon: RotateCcw, onSelect: () => commands.setStatus(activity, 'pendente') });
  } else if (activity.status === 'em_andamento') {
    menuItems.push({ label: 'Voltar para pendente', icon: Circle, onSelect: () => commands.setStatus(activity, 'pendente') });
  } else {
    menuItems.push({
      label: 'Marcar como em andamento',
      icon: CirclePlay,
      onSelect: () => commands.setStatus(activity, 'em_andamento'),
    });
  }
  menuItems.push({ label: 'Excluir', icon: Trash2, onSelect: () => void commands.deleteActivity(activity), tone: 'danger' });

  return (
    <li className={`activity-item activity-item--${urgency}`} data-testid="activity-item">
      <label className="check" title={completed ? 'Desfazer conclusão' : 'Marcar como concluída'}>
        <input
          type="checkbox"
          checked={completed}
          onChange={() => commands.toggleComplete(activity)}
          aria-label={completed ? `Reabrir “${activity.title}”` : `Concluir “${activity.title}”`}
        />
        <span className="check__box" aria-hidden>
          <Check size={14} strokeWidth={3} />
        </span>
      </label>

      <button type="button" className="activity-item__main" onClick={() => openActivityDetails(activity.id)}>
        <span className="activity-item__title">{activity.title}</span>
        <span className="activity-item__meta">
          {showDiscipline && discipline && <span className="activity-item__discipline">{discipline.name}</span>}
          <span>{activityTypeLabel(activity)}</span>
          {activity.status === 'em_andamento' && <span className="chip chip--progress">Em andamento</span>}
          {notStarted && <span className="chip">Ainda não iniciada · começa {formatDayMonth(activity.startDate)}</span>}
        </span>
      </button>

      <div className="activity-item__due">
        <span className={`activity-item__countdown countdown--${urgency}`}>{countdownLabel(activity, today)}</span>
        <span className="activity-item__date">
          {completed && activity.completedAt
            ? `em ${formatDate(activity.completedAt)}`
            : `Prazo ${formatDate(activity.dueDate)}`}
        </span>
      </div>

      <div className="activity-item__badge">
        <UrgencyBadge urgency={urgency} />
      </div>

      <Menu label={`Ações de “${activity.title}”`} items={menuItems} />
    </li>
  );
}

export function ActivityList({
  activities,
  showDiscipline = true,
  label,
}: {
  activities: Activity[];
  showDiscipline?: boolean;
  label: string;
}) {
  return (
    <ul className="activity-list" aria-label={label}>
      {activities.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} showDiscipline={showDiscipline} />
      ))}
    </ul>
  );
}
