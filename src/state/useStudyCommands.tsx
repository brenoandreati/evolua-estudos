import { useCallback, useMemo } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { resetIntro } from '../components/brand/WelcomeSplash';
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
  const auth = useAuth();

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

  const clearAllData = useCallback(async () => {
    const count = data.activities.length;
    const ok = await confirm({
      title: 'Apagar todos os dados?',
      message: (
        <>
          <p>
            Todas as disciplinas e atividades desta conta serão apagadas
            {count > 0 ? <> ({count === 1 ? '1 atividade' : `${count} atividades`})</> : null}, e o painel volta a
            ficar vazio para você começar do zero.
          </p>
          <p className="confirm-message__warning">Essa ação não pode ser desfeita.</p>
        </>
      ),
      confirmLabel: 'Apagar tudo',
    });
    if (!ok) return false;
    actions.clearAllData();
    closeModal();
    navigate(paths.overview);
    showToast('Todos os dados foram apagados.', { tone: 'info' });
    return true;
  }, [actions, closeModal, confirm, data.activities.length, showToast]);

  const logout = useCallback(async () => {
    const ok = await confirm({
      title: 'Sair da conta?',
      message: <p>Seus dados continuam salvos neste aparelho. Para voltar, entre com seu e-mail e senha ou com o Google.</p>,
      confirmLabel: 'Sair',
      tone: 'primary',
    });
    if (!ok) return false;
    closeModal();
    await auth.logout();
    resetIntro();
    navigate(paths.overview, { replace: true });
    showToast('Você saiu da sua conta.', { tone: 'info' });
    return true;
  }, [auth, closeModal, confirm, showToast]);

  return useMemo(
    () => ({ setStatus, toggleComplete, deleteActivity, deleteDiscipline, clearAllData, logout }),
    [setStatus, toggleComplete, deleteActivity, deleteDiscipline, clearAllData, logout],
  );
}
