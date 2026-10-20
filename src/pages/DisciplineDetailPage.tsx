import { useMemo, useState } from 'react';
import { ArrowLeft, ClipboardList, Pencil, Plus, Trash2 } from 'lucide-react';
import { ActivityList } from '../components/activities/ActivityItem';
import { EmptyState, PageHeader, ProgressBar } from '../components/ui/primitives';
import { compareByCompletion, compareByUrgency, isCompleted, isOverdue } from '../domain/activities';
import { computeProgress } from '../domain/progress';
import { paths } from '../router';
import { useStudy } from '../state/StudyProvider';
import { useUI } from '../state/UIProvider';
import { useStudyCommands } from '../state/useStudyCommands';

type Tab = 'pendentes' | 'concluidas' | 'todas';

export function DisciplineDetailPage({ id }: { id: string }) {
  const { data, today } = useStudy();
  const { openNewActivity, openEditDiscipline } = useUI();
  const { deleteDiscipline } = useStudyCommands();
  const [tab, setTab] = useState<Tab>('pendentes');

  const discipline = data.disciplines.find((d) => d.id === id);
  const activities = useMemo(() => data.activities.filter((a) => a.disciplineId === id), [data.activities, id]);

  const lists = useMemo(() => {
    const pending = activities.filter((a) => !isCompleted(a)).sort(compareByUrgency(today));
    const completed = activities.filter(isCompleted).sort(compareByCompletion);
    return { pendentes: pending, concluidas: completed, todas: [...pending, ...completed] };
  }, [activities, today]);

  if (!discipline) {
    return (
      <div className="page">
        <div className="card">
          <EmptyState
            icon={ClipboardList}
            title="Disciplina não encontrada"
            description="Ela pode ter sido excluída."
            action={
              <a className="button button--secondary" href={paths.disciplines}>
                Ver minhas disciplinas
              </a>
            }
          />
        </div>
      </div>
    );
  }

  const progress = computeProgress(activities);
  const overdue = activities.filter((a) => isOverdue(a, today)).length;
  const shown = lists[tab];

  return (
    <div className="page">
      <a className="back-link" href={paths.disciplines}>
        <ArrowLeft size={16} aria-hidden />
        Minhas disciplinas
      </a>

      <PageHeader
        eyebrow={discipline.term || 'Disciplina'}
        title={discipline.name}
        subtitle={discipline.description || undefined}
        actions={
          <>
            <button
              type="button"
              className="icon-button icon-button--bordered"
              onClick={() => openEditDiscipline(discipline.id)}
              aria-label="Editar disciplina"
              title="Editar disciplina"
            >
              <Pencil size={18} aria-hidden />
            </button>
            <button
              type="button"
              className="icon-button icon-button--bordered icon-button--danger"
              onClick={() => void deleteDiscipline(discipline)}
              aria-label="Excluir disciplina"
              title="Excluir disciplina"
            >
              <Trash2 size={18} aria-hidden />
            </button>
            <button
              type="button"
              className="button button--primary"
              onClick={() => openNewActivity({ disciplineId: discipline.id })}
            >
              <Plus size={18} aria-hidden />
              Nova atividade
            </button>
          </>
        }
      />

      <section className="card discipline-summary" aria-label="Progresso da disciplina">
        <div className="discipline-summary__percent">
          <span data-testid="discipline-detail-percent">{progress.percent}%</span>
          <small>concluído</small>
        </div>
        <div className="discipline-summary__bar">
          <ProgressBar value={progress.ratio} label={`Progresso de ${discipline.name}`} size="lg" />
          <p>
            {progress.total === 0
              ? 'Nenhuma atividade cadastrada. Adicione a primeira para acompanhar o progresso.'
              : `${progress.completed} de ${progress.total} atividades concluídas`}
          </p>
        </div>
        <dl className="discipline-summary__stats">
          <div>
            <dt>Pendentes</dt>
            <dd>{progress.pending}</dd>
          </div>
          <div>
            <dt>Atrasadas</dt>
            <dd className={overdue > 0 ? 'is-danger' : undefined}>{overdue}</dd>
          </div>
          <div>
            <dt>Concluídas</dt>
            <dd className="is-success">{progress.completed}</dd>
          </div>
        </dl>
      </section>

      <div className="tabs" role="tablist" aria-label="Atividades da disciplina">
        {(
          [
            ['pendentes', 'Pendentes'],
            ['concluidas', 'Concluídas'],
            ['todas', 'Todas'],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={`tabs__tab${tab === value ? ' is-active' : ''}`}
            onClick={() => setTab(value)}
          >
            {label}
            <span className="tabs__count">{lists[value].length}</span>
          </button>
        ))}
      </div>

      <div className="card list-card">
        {shown.length > 0 ? (
          <ActivityList activities={shown} showDiscipline={false} label={`Atividades de ${discipline.name}`} />
        ) : (
          <EmptyState
            icon={ClipboardList}
            tone={tab === 'pendentes' && activities.length > 0 ? 'success' : 'neutral'}
            title={
              activities.length === 0
                ? 'Nenhuma atividade nesta disciplina'
                : tab === 'pendentes'
                  ? 'Tudo concluído por aqui!'
                  : 'Nenhuma atividade concluída ainda'
            }
            description={
              activities.length === 0
                ? 'Cadastre videoaulas, exercícios, provas e outras tarefas desta disciplina.'
                : undefined
            }
            action={
              activities.length === 0 ? (
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => openNewActivity({ disciplineId: discipline.id })}
                >
                  <Plus size={18} aria-hidden />
                  Cadastrar primeira atividade
                </button>
              ) : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
