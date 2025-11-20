'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { KeyboardShortcut, formatShortcutForDisplay } from '../../hooks/useKeyboardShortcuts';
import { fadeIn, colorTransition } from '../../lib/a11y';

export interface KeyboardShortcutsDialogProps {
  /**
   * Whether the dialog is open
   */
  isOpen: boolean;

  /**
   * Callback to close the dialog
   */
  onClose: () => void;

  /**
   * List of shortcuts to display
   */
  shortcuts: KeyboardShortcut[];
}

/**
 * KeyboardShortcutsDialog - Shows available keyboard shortcuts
 *
 * Organized by category with formatted key combinations.
 * Typically triggered by Cmd+? or accessed from help menu.
 *
 * Usage:
 *   <KeyboardShortcutsDialog
 *     isOpen={showHelp}
 *     onClose={() => setShowHelp(false)}
 *     shortcuts={allShortcuts}
 *   />
 */
export function KeyboardShortcutsDialog({
  isOpen,
  onClose,
  shortcuts,
}: KeyboardShortcutsDialogProps) {
  // Group shortcuts by category
  const categories = Array.from(
    new Map(
      shortcuts.map((s) => [s.category || 'general', s])
    ).keys()
  ).filter((cat) => shortcuts.some((s) => (s.category || 'general') === cat));

  const categoryLabels: Record<string, string> = {
    general: 'General',
    navigation: 'Navigation',
    trading: 'Trading',
    view: 'View',
    help: 'Help',
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn('fixed inset-0 z-40 bg-black/50 backdrop-blur-sm', fadeIn)}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={cn(
            'bg-[var(--surface-1)] rounded-[var(--radius)] border border-[var(--border-hairline)] w-full max-w-2xl max-h-[80vh] flex flex-col shadow-lg',
            fadeIn
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[var(--border-hairline)]">
            <h2 className="text-xl font-semibold text-[var(--text-high)]">
              Keyboard Shortcuts
            </h2>
            <button
              onClick={onClose}
              className={cn(
                'p-2 rounded-[var(--radius)] hover:bg-[var(--surface-2)] text-[var(--text-muted)]',
                colorTransition
              )}
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 p-6 space-y-6">
            {categories.map((category) => {
              const categoryShortcuts = shortcuts.filter(
                (s) => (s.category || 'general') === category
              );

              return (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase mb-3 tracking-wide">
                    {categoryLabels[category as keyof typeof categoryLabels] || category}
                  </h3>

                  <div className="space-y-2">
                    {categoryShortcuts.map((shortcut, idx) => (
                      <div
                        key={`${shortcut.key}-${idx}`}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-[var(--radius)] hover:bg-[var(--surface-2)] group',
                          colorTransition
                        )}
                      >
                        <span className="text-[var(--text-high)] text-sm">
                          {shortcut.description}
                        </span>
                        <kbd
                          className={cn(
                            'text-xs font-semibold px-3 py-1.5 rounded-[calc(var(--radius)-2px)]',
                            'bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border-hairline)]',
                            'group-hover:bg-[var(--surface-3)]',
                            'whitespace-nowrap flex-shrink-0 ml-4',
                            colorTransition
                          )}
                        >
                          {formatShortcutForDisplay(shortcut.key)}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer hint */}
          <div className="p-4 border-t border-[var(--border-hairline)] bg-[var(--surface-2)]/50">
            <p className="text-xs text-[var(--text-muted)] text-center">
              Press <kbd className="px-1.5 py-0.5 bg-[var(--surface-3)] rounded text-[10px] border border-[var(--border-hairline)]">Esc</kbd> to close
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
