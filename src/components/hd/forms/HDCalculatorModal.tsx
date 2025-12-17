import { useState, useEffect } from 'react';
import { Delete, X } from 'lucide-react';
import { HDButton } from '../common/HDButton';
import { cn, roundPrice } from '../../../lib/utils';

interface HDCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: number) => void;
  initialValue?: number;
  title: string;
  label?: string;
}

export function HDCalculatorModal({
  isOpen,
  onClose,
  onConfirm,
  initialValue = 0,
  title,
  label = 'Price'
}: HDCalculatorModalProps) {
  // Round initial value to avoid floating point artifacts (e.g., 1.149999999 → 1.15)
  const [display, setDisplay] = useState(roundPrice(initialValue).toString());

  useEffect(() => {
    if (isOpen) {
      setDisplay(roundPrice(initialValue).toString());
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleNumberClick = (num: string) => {
    if (display === '0' || display === '0.00') {
      setDisplay(num);
    } else {
      setDisplay(display + num);
    }
  };

  const handleDecimalClick = () => {
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const handleClear = () => {
    setDisplay('0');
  };

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const handleConfirm = () => {
    const value = parseFloat(display);
    if (!isNaN(value)) {
      // Round to 2 decimals to ensure clean value
      onConfirm(roundPrice(value));
      onClose();
    }
  };

  const buttons = [
    '7', '8', '9',
    '4', '5', '6',
    '1', '2', '3',
    '.', '0', 'C'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)] shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-hairline)]">
          <h3 className="text-[var(--text-high)] uppercase tracking-wide text-xs">{title}</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-[var(--radius)] text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-1)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Display */}
        <div className="p-6">
          <div className="mb-2">
            <label className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide">
              {label}
            </label>
          </div>
          <div className="bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] p-4 mb-6">
            <div className="text-[var(--brand-primary)] text-3xl tabular-nums text-right">
              ${display}
            </div>
          </div>

          {/* Calculator Grid */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {buttons.map((btn) => (
              <button
                key={btn}
                onClick={() => {
                  if (btn === 'C') handleClear();
                  else if (btn === '.') handleDecimalClick();
                  else handleNumberClick(btn);
                }}
                className={cn(
                  'h-14 rounded-[var(--radius)] text-lg font-medium transition-colors',
                  btn === 'C'
                    ? 'bg-[var(--accent-negative)]/20 text-[var(--accent-negative)] hover:bg-[var(--accent-negative)]/30'
                    : 'bg-[var(--surface-1)] text-[var(--text-high)] hover:bg-[var(--surface-3)] border border-[var(--border-hairline)]'
                )}
              >
                {btn}
              </button>
            ))}
          </div>

          {/* Backspace Button */}
          <button
            onClick={handleBackspace}
            className="w-full h-12 mb-4 rounded-[var(--radius)] bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-3)] transition-colors border border-[var(--border-hairline)] flex items-center justify-center gap-2"
          >
            <Delete className="w-4 h-4" />
            <span className="text-sm">Backspace</span>
          </button>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onClose}
              className="h-12 rounded-[var(--radius)] bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-3)] transition-colors border border-[var(--border-hairline)]"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="h-12 rounded-[var(--radius)] bg-[var(--brand-primary)] text-[var(--bg-base)] hover:bg-[var(--brand-primary)]/90 transition-colors font-medium"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
