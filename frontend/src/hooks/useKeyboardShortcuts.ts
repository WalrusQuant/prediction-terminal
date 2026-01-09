import { useEffect, useCallback } from 'react';

interface UseKeyboardShortcutsOptions {
  onEscape?: () => void;
  onEnter?: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  onEscape,
  onEnter,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger if user is typing in an input/textarea/select
      const target = e.target as HTMLElement;
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
      }

      // Only trigger Enter if not in a text input (to avoid form conflicts)
      if (e.key === 'Enter' && onEnter && !isInput) {
        e.preventDefault();
        onEnter();
      }
    },
    [onEscape, onEnter, enabled]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
