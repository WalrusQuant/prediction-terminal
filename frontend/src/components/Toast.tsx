import { useState, createContext, useContext, useCallback } from 'react';

interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

interface ToastContextType {
  showToast: (type: ToastMessage['type'], message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const getToastStyle = (type: ToastMessage['type']) => {
    const base = {
      padding: '12px 16px',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      fontSize: '13px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      animation: 'slideIn 0.3s ease-out',
    };

    switch (type) {
      case 'success':
        return { ...base, background: 'rgba(0, 212, 170, 0.15)', border: '1px solid var(--cyan)', color: 'var(--cyan)' };
      case 'error':
        return { ...base, background: 'rgba(255, 71, 87, 0.15)', border: '1px solid var(--red)', color: 'var(--red)' };
      case 'warning':
        return { ...base, background: 'rgba(255, 165, 2, 0.15)', border: '1px solid var(--yellow)', color: 'var(--yellow)' };
      case 'info':
      default:
        return { ...base, background: 'rgba(100, 100, 100, 0.15)', border: '1px solid var(--text-secondary)', color: 'var(--text-primary)' };
    }
  };

  const getIcon = (type: ToastMessage['type']) => {
    switch (type) {
      case 'success': return '[OK]';
      case 'error': return '[ERR]';
      case 'warning': return '[WARN]';
      case 'info': return '[INFO]';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Container */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        {toasts.map(toast => (
          <div key={toast.id} style={getToastStyle(toast.type)}>
            <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{getIcon(toast.type)}</span>
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                padding: '0 4px',
                fontSize: '16px',
                opacity: 0.7,
              }}
            >
              x
            </button>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
