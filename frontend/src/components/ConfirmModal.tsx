'use client';

import React, { useEffect, useId, useRef, useState } from 'react';

export type ConfirmLevel = 'danger' | 'warning' | 'info';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when the user confirms. May return a promise; the modal shows a spinner until it settles. */
  onConfirm: () => void | Promise<void>;
  title: string;
  /** Bold one-line summary of what will happen, e.g. "This permanently cancels the escrow." */
  impactSummary?: string;
  description?: React.ReactNode;
  level?: ConfirmLevel;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When set, the user must type this exact text (e.g. "CANCEL") before confirming. */
  confirmText?: string;
  /** External loading flag (e.g. a transaction handled by the parent). */
  isLoading?: boolean;
}

interface LevelStyle {
  iconWrap: string;
  icon: string;
  button: string;
  ring: string;
  label: string;
}

const LEVEL_STYLES: Record<ConfirmLevel, LevelStyle> = {
  danger: {
    iconWrap: 'bg-red-500/15 border-red-500/40',
    icon: 'text-red-400',
    button: 'bg-red-600 hover:bg-red-500 focus-visible:ring-red-400',
    ring: 'focus:border-red-500',
    label: 'Danger',
  },
  warning: {
    iconWrap: 'bg-amber-500/15 border-amber-500/40',
    icon: 'text-amber-400',
    button: 'bg-amber-600 hover:bg-amber-500 focus-visible:ring-amber-400',
    ring: 'focus:border-amber-500',
    label: 'Warning',
  },
  info: {
    iconWrap: 'bg-blue-500/15 border-blue-500/40',
    icon: 'text-blue-400',
    button: 'bg-blue-600 hover:bg-blue-500 focus-visible:ring-blue-400',
    ring: 'focus:border-blue-500',
    label: 'Notice',
  },
};

/** Exact (case-sensitive) comparison so "cancel" does not unlock a "CANCEL" confirmation. */
export function isConfirmTextMatch(input: string, expected?: string): boolean {
  if (!expected) return true;
  return input.trim() === expected;
}

function LevelIcon({ level, className }: { level: ConfirmLevel; className: string }) {
  if (level === 'info') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2L1 21h22L12 2zm1 15h-2v-2h2v2zm0-4h-2V9h2v4z" />
    </svg>
  );
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  impactSummary,
  description,
  level = 'danger',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmText,
  isLoading = false,
}: ConfirmModalProps) {
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const inputId = useId();
  const styles = LEVEL_STYLES[level];
  const busy = isLoading || pending;
  const matched = isConfirmTextMatch(typed, confirmText);

  // Reset typed text and focus the safest control when the dialog opens
  useEffect(() => {
    if (!isOpen) return;
    setTyped('');
    setPending(false);
    const frame = requestAnimationFrame(() => {
      (inputRef.current || cancelRef.current)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  // Escape closes (unless busy) and Tab is trapped inside the dialog
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        if (!busy) onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, busy, onClose]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (busy || !matched) return;
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        aria-busy={busy}
        data-testid="confirm-modal"
        data-level={level}
        className="animate-menu-fade-in w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${styles.iconWrap}`}
          >
            <LevelIcon level={level} className={`h-6 w-6 ${styles.icon}`} />
          </div>
          <div className="min-w-0 space-y-1.5">
            <h3 id={titleId} className="text-lg font-bold text-white">
              {title}
            </h3>
            <div id={descId} className="space-y-1.5">
              {impactSummary && (
                <p data-testid="confirm-impact" className="text-sm font-bold text-white">
                  {impactSummary}
                </p>
              )}
              {description && <div className="text-xs leading-relaxed text-slate-400">{description}</div>}
            </div>
          </div>
        </div>

        {confirmText && (
          <div className="space-y-1.5">
            <label htmlFor={inputId} className="block text-xs text-slate-300">
              Type <span className="font-mono font-bold text-white">{confirmText}</span> to confirm
            </label>
            <input
              ref={inputRef}
              id={inputId}
              data-testid="confirm-text-input"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleConfirm();
                }
              }}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
              placeholder={confirmText}
              aria-invalid={typed.length > 0 && !matched}
              className={`w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 font-mono text-sm text-white placeholder-slate-600 focus:outline-none disabled:opacity-60 ${styles.ring}`}
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-800 pt-4">
          <button
            ref={cancelRef}
            type="button"
            data-testid="confirm-cancel"
            disabled={busy}
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            data-testid="confirm-submit"
            disabled={busy || !matched}
            onClick={() => void handleConfirm()}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${styles.button}`}
          >
            {busy && (
              <svg
                data-testid="confirm-spinner"
                className="h-3.5 w-3.5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
            )}
            {busy ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
