import { BookOpen, Plus } from 'lucide-react';
import { DisciplineCard } from '../components/disciplines/DisciplineCard';
import { EmptyState, PageHeader } from '../components/ui/primitives';
import { useStudy } from '../state/StudyProvider';
import { useUI } from '../state/UIProvider';

export function DisciplinesPage() {
  const { data } = useStudy();
  const { openNewDiscipline } = useUI();

  return (
    <div className="page">
      <PageHeader
        title="Minhas disciplinas"
        subtitle={
          data.disciplines.length === 1
            ? '1 disciplina cadastrada. Clique em uma disciplina para ver as atividades dela.'
            : `${data.disciplines.length} disciplinas cadastradas. Clique em uma disciplina para ver as atividades dela.`
        }
        actions={
          <button type="button" className="button button--primary" onClick={openNewDiscipline}>
            <Plus size={18} aria-hidden />
            Nova disciplina
          </button>
        }
      />

      {data.disciplines.length > 0 ? (
        <div className="discipline-grid">
          {data.disciplines.map((d) => (
            <DisciplineCard key={d.id} discipline={d} activities={data.activities.filter((a) => a.disciplineId === d.id)} />
          ))}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={BookOpen}
            title="Nenhuma disciplina cadastrada"
            description="Crie sua primeira disciplina para organizar as atividades e acompanhar o progresso."
            action={
              <button type="button" className="button button--primary" onClick={openNewDiscipline}>
                <Plus size={18} aria-hidden />
                Criar disciplina
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}
