import * as React from 'react';
import { useState, createContext, useContext } from 'react';

export type ToastVariant = 'default' | 'destructive';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  visible: boolean;
}

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = ({ title, description, variant = 'default', duration = 5000 }: ToastOptions): string => {
    const id = Math.random().toString(36).substring(2, 9);
    
    setToasts((prevToasts) => [
      ...prevToasts,
      { id, title, description, variant, visible: true },
    ]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prevToasts) =>
          prevToasts.map((t) =>
            t.id === id ? { ...t, visible: false } : t
          )
        );

        setTimeout(() => {
          setToasts((prevToasts) => prevToasts.filter((t) => t.id !== id));
        }, 300);
      }, duration);
    }

    return id;
  };

  const dismiss = (id: string): void => {
    setToasts((prevToasts) =>
      prevToasts.map((t) =>
        t.id === id ? { ...t, visible: false } : t
      )
    );

    setTimeout(() => {
      setToasts((prevToasts) => prevToasts.filter((t) => t.id !== id));
    }, 300);
  };

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  
  if (context === undefined) {
    // Fallback para cuando se usa fuera del provider
    return {
      toasts: [],
      toast: (options: ToastOptions): string => {
        console.warn("useToast fue llamado fuera de ToastProvider. Implementando fallback.");
        console.log("Toast:", options);
        return Math.random().toString(36).substring(2, 9);
      },
      dismiss: (id: string): void => {
        console.warn("useToast fue llamado fuera de ToastProvider. Implementando fallback.");
      }
    };
  }
  
  return context;
};
