import { cn } from '../../lib/utils';
import { AlertTriangle } from 'lucide-react';

interface HDConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
}

export function HDConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  confirmVariant = 'danger',
}: HDConfirmDialogProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[200] animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)] p-6 max-w-md w-full pointer-events-auto animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Icon */}
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[var(--accent-negative)]/10 mb-4">
            <AlertTriangle className="w-6 h-6 text-[var(--accent-negative)]" />
          </div>

          {/* Title */}
          <h3 className="text-[var(--text-high)] font-semibold mb-2">
            {title}
          </h3>

          {/* Message */}
          <p className="text-[var(--text-med)] text-sm mb-6">
            {message}
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-[var(--radius)] border border-[var(--border-hairline)] text-[var(--text-high)] hover:bg-[var(--surface-1)] transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className={cn(
                'flex-1 py-2.5 px-4 rounded-[var(--radius)] font-medium transition-colors',
                confirmVariant === 'danger' && 'bg-[var(--accent-negative)] text-white hover:bg-[var(--accent-negative)]/90',
                confirmVariant === 'warning' && 'bg-[var(--brand-primary)] text-[var(--bg-base)] hover:bg-[var(--brand-primary)]/90',
                confirmVariant === 'primary' && 'bg-[var(--accent-positive)] text-white hover:bg-[var(--accent-positive)]/90'
              )}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
