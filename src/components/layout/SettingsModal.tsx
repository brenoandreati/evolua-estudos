import { useState } from 'react';
import type { FormEvent } from 'react';
import { Cloud, LogOut, Trash2, UserRoundX, UserRound } from 'lucide-react';
import { useAuth, useCurrentUser } from '../../auth/AuthProvider';
import { useStudyCommands } from '../../state/useStudyCommands';
import { Field } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/ToastProvider';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const user = useCurrentUser();
  const { updateProfile } = useAuth();
  const { clearAllData, logout, deleteAccount } = useStudyCommands();
  const { showToast } = useToast();
  const [name, setName] = useState(user.name);
  const [nameError, setNameError] = useState<string>();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setNameError('Informe como você quer ser chamado(a).');
      document.getElementById('settings-name')?.focus();
      return;
    }
    try {
      await updateProfile({ name });
      showToast('Nome de usuário atualizado.');
      onClose();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Não foi possível salvar. Tente novamente.', {
        tone: 'error',
      });
    }
  };

  return (
    <Modal
      title="Configurações"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="settings-form" className="button button--primary">
            Salvar
          </button>
        </>
      }
    >
      <form id="settings-form" className="form" onSubmit={onSubmit}>
        <Field
          id="settings-name"
          label="Nome de usuário"
          hint="É assim que a plataforma chama você na Visão geral."
          error={nameError}
        >
          <input
            id="settings-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(undefined);
            }}
            placeholder="Seu nome"
            maxLength={40}
            data-autofocus
          />
        </Field>
      </form>

      <div className="settings-block">
        <h3 className="settings-block__title">
          <UserRound size={16} aria-hidden /> Sua conta
        </h3>
        <dl className="settings-account">
          <div>
            <dt>E-mail</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Forma de acesso</dt>
            <dd>{user.provider === 'google' ? 'Conta Google' : 'E-mail e senha'}</dd>
          </div>
        </dl>
        <button type="button" className="button button--secondary" onClick={() => void logout()}>
          <LogOut size={16} aria-hidden />
          Sair da conta
        </button>
      </div>

      <div className="settings-block">
        <h3 className="settings-block__title">
          <Cloud size={16} aria-hidden /> Onde ficam seus dados
        </h3>
        <p className="settings-block__text">
          Sua conta, disciplinas e atividades ficam guardadas na nuvem e são salvas automaticamente a cada
          alteração. Você pode entrar de qualquer aparelho com seu e-mail e encontrar tudo como deixou.
        </p>
      </div>

      <div className="settings-block settings-block--danger">
        <h3 className="settings-block__title">
          <Trash2 size={16} aria-hidden /> Começar do zero
        </h3>
        <p className="settings-block__text">
          Apaga todas as disciplinas e atividades desta conta. Sua conta continua ativa.
        </p>
        <button type="button" className="button button--danger-outline" onClick={() => void clearAllData()}>
          Apagar todos os dados
        </button>
      </div>

      <div className="settings-block settings-block--danger">
        <h3 className="settings-block__title">
          <UserRoundX size={16} aria-hidden /> Excluir minha conta
        </h3>
        <p className="settings-block__text">
          Apaga sua conta e todos os seus dados permanentemente. Para usar de novo, será preciso criar outro acesso.
        </p>
        <button type="button" className="button button--danger-outline" onClick={() => void deleteAccount()}>
          Excluir minha conta
        </button>
      </div>
    </Modal>
  );
}
