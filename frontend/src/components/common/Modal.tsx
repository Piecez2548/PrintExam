import React, { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'lg',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
  };

  return (
    <div data-testid="modal-overlay" className="fixed inset-0 z-50 overflow-y-auto overscroll-contain">
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div
          role="dialog"
          aria-modal="true"
          data-testid="modal-panel"
          className={`relative flex h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] w-full min-h-0 flex-col transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all dark:bg-slate-900 sm:h-[calc(100dvh-3rem)] sm:max-h-[calc(100dvh-3rem)] ${maxWidthClasses[maxWidth]} border border-slate-200 dark:border-slate-800 z-10`}
        >
          {/* Header */}
          <div data-testid="modal-header" className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div data-testid="modal-body" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">{children}</div>
        </div>
      </div>
    </div>
  );
};
