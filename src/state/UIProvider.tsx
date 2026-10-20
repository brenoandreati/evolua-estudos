import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityDetailsModal } from '../components/activities/ActivityDetailsModal';
import { ActivityFormModal } from '../components/activities/ActivityFormModal';
import { DisciplineFormModal } from '../components/disciplines/DisciplineFormModal';
import { ConfirmDialog, type ConfirmOptions } from '../components/ui/ConfirmDialog';
import { SettingsModal } from '../components/layout/SettingsModal';
import type { ActivityInput } from '../domain/types';

type ModalState =
  | { kind: 'activityForm'; activityId?: string; defaults?: Partial<ActivityInput> }
  | { kind: 'activityDetails'; activityId: string }
  | { kind: 'disciplineForm'; disciplineId?: string }
  | { kind: 'settings' };

interface UIContextValue {
  openNewActivity(defaults?: Partial<ActivityInput>): void;
  openEditActivity(activityId: string): void;
  openActivityDetails(activityId: string): void;
  openNewDiscipline(): void;
  openEditDiscipline(disciplineId: string): void;
  openSettings(): void;
  closeModal(): void;
  /** Pede confirmação ao usuário; resolve `true` se ele confirmar. */
  confirm(options: ConfirmOptions): Promise<boolean>;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);
  const resolveConfirm = useRef<((value: boolean) => void) | null>(null);

  const closeModal = useCallback(() => setModal(null), []);

  const confirm = useCallback((options: ConfirmOptions) => {
    resolveConfirm.current?.(false);
    setConfirmState(options);
    return new Promise<boolean>((resolve) => {
      resolveConfirm.current = resolve;
    });
  }, []);

  const finishConfirm = useCallback((value: boolean) => {
    resolveConfirm.current?.(value);
    resolveConfirm.current = null;
    setConfirmState(null);
  }, []);

  const value = useMemo<UIContextValue>(
    () => ({
      openNewActivity: (defaults) => setModal({ kind: 'activityForm', defaults }),
      openEditActivity: (activityId) => setModal({ kind: 'activityForm', activityId }),
      openActivityDetails: (activityId) => setModal({ kind: 'activityDetails', activityId }),
      openNewDiscipline: () => setModal({ kind: 'disciplineForm' }),
      openEditDiscipline: (disciplineId) => setModal({ kind: 'disciplineForm', disciplineId }),
      openSettings: () => setModal({ kind: 'settings' }),
      closeModal,
      confirm,
    }),
    [closeModal, confirm],
  );

  return (
    <UIContext.Provider value={value}>
      {children}
      {modal?.kind === 'activityForm' && (
        <ActivityFormModal
          key={modal.activityId ?? 'nova'}
          activityId={modal.activityId}
          defaults={modal.defaults}
          onClose={closeModal}
        />
      )}
      {modal?.kind === 'activityDetails' && (
        <ActivityDetailsModal activityId={modal.activityId} onClose={closeModal} />
      )}
      {modal?.kind === 'disciplineForm' && (
        <DisciplineFormModal disciplineId={modal.disciplineId} onClose={closeModal} />
      )}
      {modal?.kind === 'settings' && <SettingsModal onClose={closeModal} />}
      {confirmState && (
        <ConfirmDialog
          {...confirmState}
          onConfirm={() => finishConfirm(true)}
          onCancel={() => finishConfirm(false)}
        />
      )}
    </UIContext.Provider>
  );
}

export function useUI(): UIContextValue {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI deve ser usado dentro de <UIProvider>.');
  return context;
}
