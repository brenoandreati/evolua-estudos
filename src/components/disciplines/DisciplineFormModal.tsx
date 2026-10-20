import { useState } from 'react';
import type { FormEvent } from 'react';
import type { DisciplineInput } from '../../domain/types';
import { navigate, paths } from '../../router';
import { useStudy } from '../../state/StudyProvider';
import { Field } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/ToastProvider';

export function DisciplineFormModal({ disciplineId, onClose }: { disciplineId?: string; onClose: () => void }) {
  const { data, actions } = useStudy();
  const { showToast } = useToast();
  const existing = disciplineId ? data.disciplines.find((d) => d.id === disciplineId) : undefined;

  const [form, setForm] = useState<DisciplineInput>({
    name: existing?.name ?? '',
    description: existing?.description ?? '',
    term: existing?.term ?? '',
  });
  const [error, setError] = useState<string>();

  const update = (key: keyof DisciplineInput, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === 'name') setError(undefined);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError('Informe o nome da disciplina.');
      document.getElementById('discipline-name')?.focus();
      return;
    }
    const duplicate = data.disciplines.some(
      (d) => d.id !== existing?.id && d.name.trim().toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'),
    );
    if (duplicate) {
      setError('Já existe uma disciplina com esse nome.');
      document.getElementById('discipline-name')?.focus();
      return;
    }

    if (existing) {
      actions.updateDiscipline(existing.id, form);
      showToast('Disciplina atualizada.');
      onClose();
    } else {
      const created = actions.addDiscipline(form);
      showToast('Disciplina criada. Agora adicione as atividades dela.');
      onClose();
      navigate(paths.discipline(created.id));
    }
  };

  return (
    <Modal
      title={existing ? 'Editar disciplina' : 'Nova disciplina'}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="discipline-form" className="button button--primary">
            {existing ? 'Salvar alterações' : 'Criar disciplina'}
          </button>
        </>
      }
    >
      <form id="discipline-form" className="form" onSubmit={onSubmit} noValidate>
        <Field id="discipline-name" label="Nome da disciplina" error={error} required>
          <input
            id="discipline-name"
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Ex.: Eletrônica Digital"
            maxLength={80}
            data-autofocus
          />
        </Field>
        <Field id="discipline-term" label="Período letivo ou módulo" hint="Opcional. Ex.: Módulo 2, 2º semestre de 2026.">
          <input
            id="discipline-term"
            type="text"
            value={form.term}
            onChange={(e) => update('term', e.target.value)}
            maxLength={60}
          />
        </Field>
        <Field id="discipline-description" label="Descrição" hint="Opcional.">
          <textarea
            id="discipline-description"
            rows={3}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Professor, plataforma, observações gerais…"
          />
        </Field>
      </form>
    </Modal>
  );
}
