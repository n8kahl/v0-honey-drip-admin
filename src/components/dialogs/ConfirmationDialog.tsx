'use client';

import React, { useEffect, useRef } from 'react';
import { AlertCircle, Trash2, LogOut } from 'lucide-react';
import { cn } from '../../lib/utils';
import { focusRing } from '../../lib/a11y';

export type ConfirmationAction = 'delete' | 'exit' | 'remove' | 'warning';

export interface ConfirmationDialogProps {
  /**
   * Whether the dialog is open
   */
  isOpen: boolean;

  /**
   * Callback to close the dialog (without confirming)
   */
  onClose: () => void;

  /**
   * Callback when user confirms the action
   */
  onConfirm: () => void | Promise<void>;

  /**
   * Dialog title
   */
  title: string;

  /**
   * Dialog description/message
   */
  description: string;

  /**
   * Type of destructive action
   * @default "warning"
   */
  action?: ConfirmationAction;

  /**
   * Text for confirm button
   * @default "Confirm"
   */
  confirmLabel?: string;

  /**
   * Text for cancel button
   * @default "Cancel"
   */
  cancelLabel?: string;

  /**
   * Whether the action is currently in progress
   */
  isLoading?: boolean;

  /**
   * Custom className for wrapper
   */
  className?: string;
}

/**
 * ConfirmationDialog - Asks user to confirm destructive actions
 *
 * Used for irreversible operations like:
 * - Closing/exiting trades
 * - Deleting watchlist items
 * - Removing settings
 * - Account changes
 *
 * Usage:
 *   <ConfirmationDialog
 *     isOpen={showConfirm}
 *     onClose={() => setShowConfirm(false)}
 *     onConfirm={handleCloseTrade}
 *     title="Close Trade?"
 *     description="This trade will be marked as exited and moved to your history. This action cannot be undone."
 *     action="exit"
 *     confirmLabel="Close Trade"
 *   />
 */
export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  action = 'warning',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isLoading = false,
  className,
}: ConfirmationDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Focus cancel button when dialog opens
  useEffect(() => {
    if (isOpen && cancelButtonRef.current) {
      // Use setTimeout to ensure DOM is rendered
      setTimeout(() => cancelButtonRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isLoading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const actionConfig = {
    delete: {
      icon: Trash2,
      color: 'text-[var(--accent-negative)]',
      bgColor: 'bg-[var(--accent-negative)]/10',
    },
    exit: {
      icon: LogOut,
      color: 'text-[var(--accent-warning)]',
      bgColor: 'bg-[var(--accent-warning)]/10',
    },
    remove: {
      icon: Trash2,
      color: 'text-[var(--accent-negative)]',
      bgColor: 'bg-[var(--accent-negative)]/10',
    },
    warning: {
      icon: AlertCircle,
      color: 'text-[var(--accent-warning)]',
      bgColor: 'bg-[var(--accent-warning)]/10',
    },
  };

  const config = actionConfig[action];
  const Icon = config.icon;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={cn(
            'bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] w-full max-w-md shadow-lg',
            className
          )}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirmation-title"
          aria-describedby="confirmation-description"
        >
          {/* Icon */}
          <div className="flex justify-center pt-6">
            <div className={cn('p-3 rounded-full', config.bgColor)}>
              <Icon className={cn('w-6 h-6', config.color)} />
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 text-center">
            <h2 id="confirmation-title" className="text-lg font-semibold text-[var(--text-high)] mb-2">
              {title}
            </h2>
            <p id="confirmation-description" className="text-sm text-[var(--text-muted)]">
              {description}
            </p>
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 flex gap-3">
            <button
              ref={cancelButtonRef}
              onClick={onClose}
              disabled={isLoading}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-[var(--radius)] text-sm font-medium transition-colors border border-[var(--border-hairline)] text-[var(--text-high)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] disabled:opacity-50 disabled:cursor-not-allowed',
                focusRing
              )}
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-[var(--radius)] text-sm font-medium transition-all text-white disabled:opacity-50 disabled:cursor-not-allowed',
                focusRing,
                action === 'delete' || action === 'remove'
                  ? 'bg-[var(--accent-negative)] hover:bg-[var(--accent-negative)]/90'
                  : 'bg-[var(--accent-warning)] hover:bg-[var(--accent-warning)]/90'
              )}
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {confirmLabel}
                </span>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
