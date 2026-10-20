import { useState } from 'react';
import type { FormEvent } from 'react';
import { HardDrive, LogOut, Trash2, UserRound } from 'lucide-react';
import { useAuth, useCurrentUser } from '../../auth/AuthProvider';
import { useStudyCommands } from '../../state/useStudyCommands';
import { Field } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/ToastProvider';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const user = useCurrentUser();
  const { updateProfile } = useAuth();
  const { clearAllData, logout } = useStudyCommands();
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
    } catch {
      showToast('Não foi possível salvar. Tente novamente.', { tone: 'error' });
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
          <HardDrive size={16} aria-hidden /> Onde ficam seus dados
        </h3>
        <p className="settings-block__text">
          Sua conta e suas atividades ficam salvas automaticamente neste navegador, neste aparelho. Os dados
          continuam aqui ao fechar ou atualizar a página, mas não aparecem em outros aparelhos e são apagados se
          você limpar os dados de navegação.
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
    </Modal>
  );
}
