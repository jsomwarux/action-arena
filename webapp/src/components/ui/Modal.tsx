import { useEffect, type PropsWithChildren, type ReactNode } from 'react';

import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { cn } from '@/lib/cn';

export type ModalProps = PropsWithChildren<{
  className?: string;
  /** Rendered in the footer, right-aligned. Typically Buttons. */
  footer?: ReactNode;
  onClose: () => void;
  open: boolean;
  /** Optional secondary line under the title. */
  subtitle?: string;
  title: string;
}>;

/**
 * Web equivalent of components/ui/modal-shell.tsx.
 *
 * Mobile's ModalShell exists to re-provide safe-area insets inside a native
 * <Modal>; on the web the equivalent job is a portal, a scrim, Escape-to-close
 * and background scroll locking.
 */
export function Modal({
  children,
  className,
  footer,
  onClose,
  open,
  subtitle,
  title,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-arena-bg/80 p-6 backdrop-blur-sm"
      onClick={onClose}
      role="presentation">
      <div
        aria-labelledby="arena-modal-title"
        aria-modal
        className={cn(
          'w-full max-w-lg rounded-2xl border border-white/10 bg-arena-surface/95 shadow-[0_24px_64px_rgba(0,0,0,0.55)] backdrop-blur-xl',
          className,
        )}
        onClick={(event) => event.stopPropagation()}
        role="dialog">
        <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="min-w-0">
            <h2 className="arena-heading text-2xl leading-none" id="arena-modal-title">
              {title}
            </h2>
            {subtitle ? <p className="mt-1.5 text-sm text-textMuted">{subtitle}</p> : null}
          </div>
          <button
            aria-label="Close"
            className="rounded-lg p-1 text-white/55 transition hover:bg-white/10 hover:text-white"
            onClick={onClose}
            type="button">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="px-6 py-5">{children}</div>

        {footer ? (
          <footer className="flex justify-end gap-3 border-t border-border px-6 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
