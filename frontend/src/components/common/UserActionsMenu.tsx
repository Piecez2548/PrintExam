import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Edit, KeyRound, Power, Settings2, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type UserAction = 'edit' | 'resetPassword' | 'toggleStatus' | 'closeAccount';

interface UserActionsMenuProps {
  isOpen: boolean;
  isActive: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (action: UserAction) => void;
}

export const UserActionsMenu: React.FC<UserActionsMenuProps> = ({
  isOpen,
  isActive,
  onOpenChange,
  onSelect,
}) => {
  const { t } = useTranslation('admin');
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;

      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const edge = 8;
      const gap = 4;
      const maxLeft = Math.max(edge, window.innerWidth - menuRect.width - edge);
      const left = Math.max(edge, Math.min(triggerRect.right - menuRect.width, maxLeft));
      const roomBelow = window.innerHeight - triggerRect.bottom - edge;
      const roomAbove = triggerRect.top - edge;
      const openAbove = roomBelow < menuRect.height + gap && roomAbove > roomBelow;
      const desiredTop = openAbove
        ? triggerRect.top - menuRect.height - gap
        : triggerRect.bottom + gap;
      const maxTop = Math.max(edge, window.innerHeight - menuRect.height - edge);

      setPosition({ top: Math.max(edge, Math.min(desiredTop, maxTop)), left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    document.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const focusFrame = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    });
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      onOpenChange(false);
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
    };
  }, [isOpen, onOpenChange]);

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === 'Escape') {
      event.preventDefault();
      onOpenChange(false);
      triggerRef.current?.focus();
      return;
    }

    if (event.key === 'Tab') {
      onOpenChange(false);
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      items[event.key === 'Home' ? 0 : items.length - 1]?.focus();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = currentIndex < 0
        ? (direction > 0 ? 0 : items.length - 1)
        : (currentIndex + direction + items.length) % items.length;
      items[nextIndex]?.focus();
    }
  };

  const selectAction = (action: UserAction) => {
    onOpenChange(false);
    if (action === 'toggleStatus') triggerRef.current?.focus();
    onSelect(action);
  };

  const menu = isOpen && createPortal(
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label={t('userActions.manage')}
      onKeyDown={handleMenuKeyDown}
      className="fixed z-[80] w-56 max-w-[calc(100vw-1rem)] max-h-[calc(100vh-1rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 text-sm shadow-xl shadow-slate-900/15 outline-none dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40"
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => selectAction('edit')}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <Edit className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
        <span>{t('userActions.edit')}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => selectAction('resetPassword')}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <KeyRound className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
        <span>{t('userActions.resetPassword')}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => selectAction('toggleStatus')}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <Power className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
        <span>{isActive ? t('userActions.suspend') : t('userActions.activate')}</span>
      </button>

      <div role="separator" className="my-1.5 border-t border-slate-200 dark:border-slate-700" />

      <button
        type="button"
        role="menuitem"
        onClick={() => selectAction('closeAccount')}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-medium text-rose-700 transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-500 dark:text-rose-300 dark:hover:bg-rose-950/50"
      >
        <Trash2 className="h-4 w-4 shrink-0" />
        <span>{t('userActions.closeAccount')}</span>
      </button>
    </div>,
    document.body,
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => onOpenChange(!isOpen)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            onOpenChange(true);
          }
        }}
        className="inline-flex min-h-10 w-28 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <Settings2 className="h-4 w-4 shrink-0" />
        <span>{t('userActions.manage')}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {menu}
    </>
  );
};
