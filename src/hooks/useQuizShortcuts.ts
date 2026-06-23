import { useEffect } from 'react';

export interface QuizShortcuts {
  goPrev: () => void;
  goNext: () => void;
  selectOption: (index: number) => void;
  submitMultiple: () => void;
}

const optionKeys = new Map<string, number>([
  ['1', 0], ['2', 1], ['3', 2], ['4', 3],
  ['7', 0], ['8', 1], ['9', 2], ['0', 3]
]);

const prevKeys = new Set(['h', 'arrowleft', 'arrowup', 'k']);
const nextKeys = new Set(['j', 'arrowdown', 'arrowright', 'l']);

export const useQuizShortcuts = (shortcuts: QuizShortcuts, enabled: boolean) => {
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const key = event.key.toLowerCase();
      if (optionKeys.has(key)) {
        event.preventDefault();
        shortcuts.selectOption(optionKeys.get(key)!);
        return;
      }
      if (prevKeys.has(key)) {
        event.preventDefault();
        shortcuts.goPrev();
        return;
      }
      if (nextKeys.has(key)) {
        event.preventDefault();
        shortcuts.goNext();
        return;
      }
      if (key === ' ') {
        event.preventDefault();
        shortcuts.submitMultiple();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts, enabled]);
};
