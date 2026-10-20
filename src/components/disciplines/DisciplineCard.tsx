import { ChevronRight } from 'lucide-react';
import { countdownLabel, getUrgency, nextRelevantActivity } from '../../domain/activities';
import { formatDayMonth } from '../../domain/dates';
import { computeProgress } from '../../domain/progress';
import type { Activity, Discipline } from '../../domain/types';
import { paths } from '../../router';
import { useStudy } from '../../state/StudyProvider';
import { ProgressBar } from '../ui/primitives';

export function disciplineInitials(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-ZÁ-Ú]/.test(w))
    .filter(Boolean);
  const letters = (words.length >= 2 ? [words[0], words[1]] : [name]).map((w) => w.charAt(0));
  return letters.join('').toUpperCase();
}

export function DisciplineCard({ discipline, activities }: { discipline: Discipline; activities: Activity[] }) {
  const { today } = useStudy();
  const progress = computeProgress(activities);
  const next = nextRelevantActivity(activities, today);

  return (
    <a className="card discipline-card" href={paths.discipline(discipline.id)} data-testid="discipline-card">
      <div className="discipline-card__header">
        <span className="discipline-card__avatar" aria-hidden>
          {disciplineInitials(discipline.name)}
        </span>
        <div className="discipline-card__title">
          <h3>{discipline.name}</h3>
          {discipline.term && <p>{discipline.term}</p>}
        </div>
        <ChevronRight size={18} className="discipline-card__chevron" aria-hidden />
      </div>

      <div className="discipline-card__progress">
        <div className="discipline-card__progress-label">
          <span>Progresso</span>
          <strong data-testid="discipline-percent">{progress.percent}%</strong>
        </div>
        <ProgressBar value={progress.ratio} label={`Progresso de ${discipline.name}`} />
      </div>

      <div className="discipline-card__stats">
        <span>
          <strong>{progress.pending}</strong> {progress.pending === 1 ? 'pendente' : 'pendentes'}
        </span>
        <span>
          <strong>{progress.completed}</strong> {progress.completed === 1 ? 'concluída' : 'concluídas'}
        </span>
      </div>

      <div className="discipline-card__next">
        {next ? (
          <>
            <span className={`dot dot--${getUrgency(next, today)}`} aria-hidden />
            <span className="discipline-card__next-text">
              <span className="discipline-card__next-label">Próximo prazo</span>
              <span className="discipline-card__next-title">{next.title}</span>
            </span>
            <span className={`discipline-card__next-when countdown--${getUrgency(next, today)}`}>
              {countdownLabel(next, today)}
              <small>{formatDayMonth(next.dueDate)}</small>
            </span>
          </>
        ) : progress.total > 0 ? (
          <span className="discipline-card__next-done">Todas as atividades concluídas!</span>
        ) : (
          <span className="discipline-card__next-empty">Nenhuma atividade cadastrada ainda.</span>
        )}
      </div>
    </a>
  );
}
