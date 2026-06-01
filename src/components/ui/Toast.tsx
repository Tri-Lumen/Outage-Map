'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastApi {
  push: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Returns a `push(message, tone)` function; a no-op when no provider is mounted. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? { push: () => {} };
}

let idSeq = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = idSeq++;
      // Cap the stack so a burst of changes can't fill the screen.
      setToasts((t) => [...t.slice(-3), { id, message, tone }]);
      setTimeout(() => remove(id), 5000);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <button key={t.id} type="button" className={`toast toast-${t.tone}`} onClick={() => remove(t.id)}>
            {t.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
