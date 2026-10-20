import { useMemo, useState } from 'react';
import { CircleCheckBig } from 'lucide-react';
import { ActivityList } from '../components/activities/ActivityItem';
import { EmptyState, PageHeader } from '../components/ui/primitives';
import { compareByCompletion, isCompleted } from '../domain/activities';
import { computeProgress } from '../domain/progress';
import { useStudy } from '../state/StudyProvider';

export function CompletedPage() {
  const { data } = useStudy();
  const [disciplineId, setDisciplineId] = useState('');

  const completed = useMemo(
    () =>
      data.activities
        .filter((a) => isCompleted(a) && (!disciplineId || a.disciplineId === disciplineId))
        .sort(compareByCompletion),
    [data.activities, disciplineId],
  );
  const progress = computeProgress(data.activities);

  return (
    <div className="page">
      <PageHeader
        title="Atividades concluídas"
        subtitle={
          progress.completed === 0
            ? 'Seu histórico de atividades finalizadas aparecerá aqui.'
            : `${progress.completed} de ${progress.total} atividades concluídas · ${progress.percent}% do curso. Desmarque uma atividade para reabri-la.`
        }
      />

      {data.disciplines.length > 1 && progress.completed > 0 && (
        <div className="card filters filters--inline">
          <label className="filters__field">
            <span>Disciplina</span>
            <select value={disciplineId} onChange={(e) => setDisciplineId(e.target.value)}>
              <option value="">Todas as disciplinas</option>
              {data.disciplines.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="card list-card">
        {completed.length > 0 ? (
          <ActivityList activities={completed} label="Atividades concluídas" />
        ) : (
          <EmptyState
            icon={CircleCheckBig}
            title="Nenhuma atividade concluída ainda"
            description="Quando terminar uma atividade, marque o círculo ao lado dela. Ela sai das pendências e fica registrada aqui."
          />
        )}
      </div>
    </div>
  );
}
