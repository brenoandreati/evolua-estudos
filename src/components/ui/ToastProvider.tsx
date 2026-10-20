import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react';

type ToastTone = 'success' | 'info' | 'error';

interface ToastOptions {
  tone?: ToastTone;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface ToastItem extends Required<Pick<ToastOptions, 'tone' | 'duration'>> {
  id: number;
  message: string;
  action?: ToastOptions['action'];
}

interface ToastContextValue {
  showToast(message: string, options?: ToastOptions): void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS = { success: CircleCheck, info: Info, error: TriangleAlert };

function Toast({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const Icon = ICONS[toast.tone];

  useEffect(() => {
    const timer = window.setTimeout(onClose, toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.duration, onClose]);

  return (
    <div className={`toast toast--${toast.tone}`} role="status">
      <Icon className="toast__icon" size={20} aria-hidden />
      <span className="toast__message">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className="toast__action"
          onClick={() => {
            toast.action?.onClick();
            onClose();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" className="toast__close" onClick={onClose} aria-label="Fechar aviso">
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const showToast = useCallback((message: string, options: ToastOptions = {}) => {
    const toast: ToastItem = {
      id: nextId.current++,
      message,
      tone: options.tone ?? 'success',
      duration: options.duration ?? (options.action ? 6000 : 3500),
      action: options.action,
    };
    // No máximo três avisos na tela ao mesmo tempo.
    setToasts((list) => [...list.slice(-2), toast]);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toasts.map((toast) => (
          <ToastWithClose key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastWithClose({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const onClose = useCallback(() => onDismiss(toast.id), [onDismiss, toast.id]);
  return <Toast toast={toast} onClose={onClose} />;
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast deve ser usado dentro de <ToastProvider>.');
  return context;
}
