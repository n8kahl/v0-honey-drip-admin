import { useState, useRef, useEffect } from 'react';
import { formatPrice, cn } from '../../../lib/utils';
import { Check, X, Edit2, Loader2 } from 'lucide-react';

interface HDEditablePriceProps {
  value: number;
  onSave: (newValue: number) => Promise<void>;
  className?: string;
  label?: string;
  disabled?: boolean;
}

/**
 * Inline editable price component
 * Click to edit, Enter or click check to save, Escape or X to cancel
 */
export function HDEditablePrice({
  value,
  onSave,
  className,
  label,
  disabled = false,
}: HDEditablePriceProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Update editValue when value prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value.toString());
    }
  }, [value, isEditing]);

  const handleStartEdit = () => {
    if (disabled || isSaving) return;
    setEditValue(value.toString());
    setError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditValue(value.toString());
    setError(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    const newValue = parseFloat(editValue);

    // Validation
    if (isNaN(newValue) || newValue < 0) {
      setError('Invalid price');
      return;
    }

    if (newValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(newValue);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <div className="relative">
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">$</span>
          <input
            ref={inputRef}
            type="number"
            step="0.01"
            min="0"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            className={cn(
              "w-24 h-7 pl-4 pr-1 rounded text-sm tabular-nums",
              "bg-[var(--surface-1)] border",
              error ? "border-[var(--accent-negative)]" : "border-[var(--brand-primary)]",
              "text-[var(--text-high)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
            )}
          />
        </div>

        {isSaving ? (
          <Loader2 className="w-4 h-4 text-[var(--text-muted)] animate-spin" />
        ) : (
          <>
            <button
              onClick={handleSave}
              className="p-1 rounded hover:bg-[var(--accent-positive)]/20 text-[var(--accent-positive)] transition-colors"
              title="Save"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={handleCancel}
              className="p-1 rounded hover:bg-[var(--accent-negative)]/20 text-[var(--accent-negative)] transition-colors"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}

        {error && (
          <span className="text-[var(--accent-negative)] text-micro ml-1">{error}</span>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleStartEdit}
      disabled={disabled}
      className={cn(
        "group flex items-center gap-1.5 transition-colors",
        !disabled && "hover:text-[var(--brand-primary)]",
        disabled && "cursor-not-allowed opacity-60",
        className
      )}
      title={disabled ? undefined : "Click to edit"}
    >
      {label && (
        <span className="text-[var(--text-muted)] text-xs">{label}</span>
      )}
      <span className="tabular-nums">${formatPrice(value)}</span>
      {!disabled && (
        <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-muted)]" />
      )}
    </button>
  );
}
