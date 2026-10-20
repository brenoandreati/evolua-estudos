import { useState } from 'react';
import type { FormEvent } from 'react';
import { BookOpen } from 'lucide-react';
import { ACTIVITY_TYPES, STATUS_OPTIONS } from '../../domain/activities';
import { isValidISODate } from '../../domain/dates';
import type { ActivityInput, ActivityStatus, ActivityType } from '../../domain/types';
import { useStudy } from '../../state/StudyProvider';
import { useUI } from '../../state/UIProvider';
import { useToast } from '../ui/ToastProvider';
import { Modal } from '../ui/Modal';
import { Field } from '../ui/Field';
import { EmptyState } from '../ui/primitives';

type Errors = Partial<Record<keyof ActivityInput, string>>;

export function validateActivity(input: ActivityInput, disciplineIds: string[]): Errors {
  const errors: Errors = {};
  if (!input.title.trim()) errors.title = 'Informe o nome da atividade.';
  if (!disciplineIds.includes(input.disciplineId)) errors.disciplineId = 'Escolha a disciplina.';
  if (!isValidISODate(input.startDate)) errors.startDate = 'Informe a data de início.';
  if (!isValidISODate(input.dueDate)) errors.dueDate = 'Informe a data limite.';
  else if (isValidISODate(input.startDate) && input.dueDate < input.startDate) {
    errors.dueDate = 'A data limite não pode ser anterior à data de início.';
  }
  return errors;
}

interface ActivityFormModalProps {
  activityId?: string;
  defaults?: Partial<ActivityInput>;
  onClose: () => void;
}

export function ActivityFormModal({ activityId, defaults, onClose }: ActivityFormModalProps) {
  const { data, today, actions } = useStudy();
  const { openNewDiscipline } = useUI();
  const { showToast } = useToast();
  const existing = activityId ? data.activities.find((a) => a.id === activityId) : undefined;
  const isEditing = Boolean(existing);

  const [form, setForm] = useState<ActivityInput>(() => ({
    title: existing?.title ?? defaults?.title ?? '',
    disciplineId:
      existing?.disciplineId ?? defaults?.disciplineId ?? (data.disciplines.length === 1 ? data.disciplines[0].id : ''),
    type: existing?.type ?? defaults?.type ?? 'exercicio',
    customType: existing?.customType ?? defaults?.customType ?? '',
    startDate: existing?.startDate ?? defaults?.startDate ?? today,
    dueDate: existing?.dueDate ?? defaults?.dueDate ?? '',
    notes: existing?.notes ?? defaults?.notes ?? '',
    status: existing?.status ?? defaults?.status ?? 'pendente',
  }));
  const [errors, setErrors] = useState<Errors>({});

  const update = <K extends keyof ActivityInput>(key: K, value: ActivityInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found = validateActivity(
      form,
      data.disciplines.map((d) => d.id),
    );
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const firstField = Object.keys(found)[0];
      document.getElementById(`activity-${firstField}`)?.focus();
      return;
    }
    if (existing) {
      actions.updateActivity(existing.id, form);
      showToast('Atividade atualizada.');
    } else {
      actions.addActivity(form);
      showToast('Atividade cadastrada.');
    }
    onClose();
  };

  if (data.disciplines.length === 0) {
    return (
      <Modal title="Nova atividade" onClose={onClose} size="sm">
        <EmptyState
          icon={BookOpen}
          title="Cadastre uma disciplina primeiro"
          description="Toda atividade fica vinculada a uma disciplina. Crie a primeira e depois adicione as atividades."
          action={
            <button type="button" className="button button--primary" onClick={openNewDiscipline}>
              Criar disciplina
            </button>
          }
        />
      </Modal>
    );
  }

  return (
    <Modal
      title={isEditing ? 'Editar atividade' : 'Nova atividade'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="activity-form" className="button button--primary">
            {isEditing ? 'Salvar alterações' : 'Cadastrar atividade'}
          </button>
        </>
      }
    >
      <form id="activity-form" className="form" onSubmit={onSubmit} noValidate>
        <Field id="activity-title" label="Nome da atividade" error={errors.title} required>
          <input
            id="activity-title"
            type="text"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="Ex.: Lista de exercícios 2"
            maxLength={120}
            data-autofocus
          />
        </Field>

        <div className="form__row">
          <Field id="activity-disciplineId" label="Disciplina" error={errors.disciplineId} required>
            <select
              id="activity-disciplineId"
              value={form.disciplineId}
              onChange={(e) => update('disciplineId', e.target.value)}
            >
              <option value="" disabled>
                Selecione…
              </option>
              {data.disciplines.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>

          <Field id="activity-type" label="Tipo de atividade" required>
            <select
              id="activity-type"
              value={form.type}
              onChange={(e) => update('type', e.target.value as ActivityType)}
            >
              {ACTIVITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {form.type === 'outro' && (
          <Field id="activity-customType" label="Qual é o tipo?" hint="Opcional. Ex.: Seminário, Laboratório, Fórum.">
            <input
              id="activity-customType"
              type="text"
              value={form.customType}
              onChange={(e) => update('customType', e.target.value)}
              maxLength={40}
            />
          </Field>
        )}

        <div className="form__row">
          <Field id="activity-startDate" label="Data de início" error={errors.startDate} required>
            <input
              id="activity-startDate"
              type="date"
              value={form.startDate}
              onChange={(e) => update('startDate', e.target.value)}
            />
          </Field>
          <Field id="activity-dueDate" label="Data limite" error={errors.dueDate} required>
            <input
              id="activity-dueDate"
              type="date"
              value={form.dueDate}
              min={form.startDate || undefined}
              onChange={(e) => update('dueDate', e.target.value)}
            />
          </Field>
        </div>

        <Field id="activity-status" label="Status">
          <select
            id="activity-status"
            value={form.status}
            onChange={(e) => update('status', e.target.value as ActivityStatus)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="activity-notes" label="Descrição ou observações" hint="Opcional.">
          <textarea
            id="activity-notes"
            rows={3}
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Links, capítulos, combinados com o professor…"
          />
        </Field>
      </form>
    </Modal>
  );
}
