import { useState } from 'react';
import type { FormEvent } from 'react';
import { HardDrive, RotateCcw } from 'lucide-react';
import { setPreferences, usePreferences } from '../../hooks/usePreferences';
import { useStudyCommands } from '../../state/useStudyCommands';
import { Field } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/ToastProvider';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const preferences = usePreferences();
  const { restoreInitialData } = useStudyCommands();
  const { showToast } = useToast();
  const [name, setName] = useState(preferences.userName);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setPreferences({ userName: name.trim() });
    showToast('Preferências salvas.');
    onClose();
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
            maxLength={40}
            data-autofocus
          />
        </Field>
      </form>

      <div className="settings-block">
        <h3 className="settings-block__title">
          <HardDrive size={16} aria-hidden /> Onde ficam seus dados
        </h3>
        <p className="settings-block__text">
          Tudo é salvo automaticamente neste navegador, neste aparelho. Os dados continuam aqui ao fechar ou
          atualizar a página, mas não aparecem em outros aparelhos e são apagados se você limpar os dados de
          navegação.
        </p>
      </div>

      <div className="settings-block settings-block--danger">
        <h3 className="settings-block__title">
          <RotateCcw size={16} aria-hidden /> Restaurar dados iniciais
        </h3>
        <p className="settings-block__text">
          Volta às duas disciplinas e oito atividades originais. Os dados atuais serão substituídos.
        </p>
        <button type="button" className="button button--danger-outline" onClick={() => void restoreInitialData()}>
          Restaurar dados iniciais
        </button>
      </div>
    </Modal>
  );
}
