// React se usa implícitamente para el JSX
import { useToast } from './use-toast.tsx';

export const Toaster = () => {
  const { toasts } = useToast();

  if (!toasts || toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-0 right-0 z-50 p-4 space-y-4 w-full max-w-xs">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`p-4 rounded-md text-sm shadow-lg ${
            toast.variant === 'destructive' 
              ? 'bg-red-500 text-white' 
              : 'bg-white text-gray-900 border border-gray-100'
          }`}
          style={{ 
            opacity: toast.visible ? 1 : 0,
            transition: 'opacity 200ms ease-in-out'
          }}
        >
          {toast.title && (
            <div className="font-semibold mb-1">{toast.title}</div>
          )}
          {toast.description && (
            <div className="text-sm">{toast.description}</div>
          )}
        </div>
      ))}
    </div>
  );
};
