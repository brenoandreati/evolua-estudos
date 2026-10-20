import { useCallback, useMemo } from 'react';
import { useToast } from '../components/ui/ToastProvider';
import type { Activity, ActivityStatus, Discipline } from '../domain/types';
import { navigate, paths } from '../router';
import { useStudy } from './StudyProvider';
import { useUI } from './UIProvider';

/**
 * Ações de alto nível usadas pelas telas: combinam a alteração dos dados com
 * confirmação, mensagens de sucesso e opção de desfazer.
 */
export function useStudyCommands() {
  const { data, actions } = useStudy();
  const { showToast } = useToast();
  const { confirm, closeModal } = useUI();

  const setStatus = useCallback(
    (activity: Activity, status: ActivityStatus) => {
      const previous = activity.status;
      if (previous === status) return;
      actions.setActivityStatus(activity.id, status);
      const undo = { label: 'Desfazer', onClick: () => actions.setActivityStatus(activity.id, previous) };

      if (status === 'concluida') {
        showToast(`“${activity.title}” concluída! Seu progresso foi atualizado.`, { action: undo });
      } else if (previous === 'concluida') {
        showToast(`“${activity.title}” voltou para as pendências.`, { tone: 'info', action: undo });
      } else if (status === 'em_andamento') {
        showToast(`“${activity.title}” marcada como em andamento.`, { tone: 'info' });
      } else {
        showToast(`“${activity.title}” marcada como pendente.`, { tone: 'info' });
      }
    },
    [actions, showToast],
  );

  const toggleComplete = useCallback(
    (activity: Activity) => setStatus(activity, activity.status === 'concluida' ? 'pendente' : 'concluida'),
    [setStatus],
  );

  const deleteActivity = useCallback(
    async (activity: Activity) => {
      const ok = await confirm({
        title: 'Excluir atividade?',
        message: (
          <p>
            A atividade <strong>{activity.title}</strong> será excluída permanentemente e deixará de contar no
            progresso.
          </p>
        ),
        confirmLabel: 'Excluir atividade',
      });
      if (!ok) return false;
      actions.deleteActivity(activity.id);
      closeModal();
      showToast('Atividade excluída.', { tone: 'info' });
      return true;
    },
    [actions, closeModal, confirm, showToast],
  );

  const deleteDiscipline = useCallback(
    async (discipline: Discipline) => {
      const count = data.activities.filter((a) => a.disciplineId === discipline.id).length;
      const ok = await confirm({
        title: 'Excluir disciplina?',
        message: (
          <>
            <p>
              A disciplina <strong>{discipline.name}</strong> será excluída permanentemente.
            </p>
            {count > 0 && (
              <p className="confirm-message__warning">
                {count === 1
                  ? 'A atividade vinculada a ela também será apagada.'
                  : `As ${count} atividades vinculadas a ela também serão apagadas.`}
              </p>
            )}
          </>
        ),
        confirmLabel: 'Excluir disciplina',
      });
      if (!ok) return false;
      actions.deleteDiscipline(discipline.id);
      closeModal();
      if (window.location.hash.startsWith(paths.discipline(discipline.id))) {
        navigate(paths.disciplines, { replace: true });
      }
      showToast('Disciplina excluída.', { tone: 'info' });
      return true;
    },
    [actions, closeModal, confirm, data.activities, showToast],
  );

  const restoreInitialData = useCallback(async () => {
    const ok = await confirm({
      title: 'Restaurar dados iniciais?',
      message: (
        <>
          <p>
            O painel voltará ao estado original: as disciplinas <strong>Hidráulica e Pneumática</strong> e{' '}
            <strong>Segurança em Eletricidade</strong>, com suas atividades sem nenhuma conclusão.
          </p>
          <p className="confirm-message__warning">
            Atenção: todas as disciplinas, atividades e conclusões atuais serão substituídas. Essa ação não pode
            ser desfeita.
          </p>
        </>
      ),
      confirmLabel: 'Substituir e restaurar',
    });
    if (!ok) return false;
    actions.restoreInitialData();
    closeModal();
    navigate(paths.overview);
    showToast('Dados iniciais restaurados.');
    return true;
  }, [actions, closeModal, confirm, showToast]);

  return useMemo(
    () => ({ setStatus, toggleComplete, deleteActivity, deleteDiscipline, restoreInitialData }),
    [setStatus, toggleComplete, deleteActivity, deleteDiscipline, restoreInitialData],
  );
}
