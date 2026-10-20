import { useState } from 'react';
import type { FormEvent } from 'react';
import { HardDrive, LogOut, RotateCcw, UserRound } from 'lucide-react';
import { useAuth, useCurrentUser } from '../../auth/AuthProvider';
import { useStudyCommands } from '../../state/useStudyCommands';
import { Field } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/ToastProvider';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const user = useCurrentUser();
  const { updateProfile } = useAuth();
  const { restoreInitialData, logout } = useStudyCommands();
  const { showToast } = useToast();
  const [name, setName] = useState(user.name);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await updateProfile({ name });
      showToast('Preferências salvas.');
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
        <Field id="settings-name" label="Como você quer ser chamado(a)?" hint="Usado na saudação da Visão geral.">
          <input
            id="settings-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            maxLength={60}
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
            <dt>CPF</dt>
            <dd>{user.cpfMasked}</dd>
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
          <RotateCcw size={16} aria-hidden /> Restaurar dados iniciais
        </h3>
        <p className="settings-block__text">
          Volta às duas disciplinas e oito atividades originais. Os dados atuais desta conta serão substituídos.
        </p>
        <button type="button" className="button button--danger-outline" onClick={() => void restoreInitialData()}>
          Restaurar dados iniciais
        </button>
      </div>
    </Modal>
  );
}
