'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
}

interface ToastApi {
  push: (message: string, tone?: ToastTone, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Returns a `push(message, tone, action)` function; a no-op when no provider is mounted. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? { push: () => {} };
}

let idSeq = 1;
// Toasts carrying an undo action stay up longer — 5s isn't enough time to
// notice, read, and click "Undo" after a delete.
const DEFAULT_TIMEOUT_MS = 5000;
const ACTION_TIMEOUT_MS = 8000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: ToastTone = 'info', action?: ToastAction) => {
      const id = idSeq++;
      // Cap the stack so a burst of changes can't fill the screen.
      setToasts((t) => [...t.slice(-3), { id, message, tone, action }]);
      setTimeout(() => remove(id), action ? ACTION_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <button type="button" className="toast-dismiss" onClick={() => remove(t.id)}>
              {t.message}
            </button>
            {t.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => { t.action!.onClick(); remove(t.id); }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
