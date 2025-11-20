import { useEffect } from 'react';

export type KeyboardShortcutHandler = (event: KeyboardEvent) => void;

export interface KeyboardShortcut {
  /**
   * Key combination (e.g., "Ctrl+K", "Cmd+J", "Escape")
   */
  key: string;

  /**
   * Description for help/discovery UI
   */
  description: string;

  /**
   * Callback function when shortcut is triggered
   */
  action: KeyboardShortcutHandler;

  /**
   * Categories for organizing shortcuts in help UI
   * @default "general"
   */
  category?: 'general' | 'navigation' | 'trading' | 'view' | 'help';

  /**
   * Whether to prevent default browser behavior
   * @default true
   */
  preventDefault?: boolean;

  /**
   * Whether to stop event propagation
   * @default false
   */
  stopPropagation?: boolean;
}

/**
 * Parse keyboard shortcut string into usable key combination
 * Examples: "Ctrl+K", "Cmd+J", "Escape", "Enter", "Ctrl+Shift+S"
 */
function parseShortcut(shortcutStr: string): {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  key: string;
} {
  const parts = shortcutStr.toLowerCase().split('+');
  const parsed = {
    ctrl: false,
    shift: false,
    alt: false,
    meta: false,
    key: '',
  };

  for (const part of parts) {
    if (part === 'ctrl') parsed.ctrl = true;
    else if (part === 'cmd' || part === 'meta') parsed.meta = true;
    else if (part === 'shift') parsed.shift = true;
    else if (part === 'alt') parsed.alt = true;
    else parsed.key = part;
  }

  return parsed;
}

/**
 * Check if a keyboard event matches a shortcut definition
 */
function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  const parsed = parseShortcut(shortcut.key);
  const eventKey = event.key.toLowerCase();

  // Check modifiers
  if (parsed.ctrl !== event.ctrlKey) return false;
  if (parsed.shift !== event.shiftKey) return false;
  if (parsed.alt !== event.altKey) return false;
  if (parsed.meta !== event.metaKey) return false;

  // Check the actual key
  if (parsed.key === 'escape') return eventKey === 'escape';
  if (parsed.key === 'enter') return eventKey === 'enter';
  if (parsed.key === 'tab') return eventKey === 'tab';
  if (parsed.key === ' ') return eventKey === ' ';
  if (parsed.key === 'arrowup') return eventKey === 'arrowup';
  if (parsed.key === 'arrowdown') return eventKey === 'arrowdown';
  if (parsed.key === 'arrowleft') return eventKey === 'arrowleft';
  if (parsed.key === 'arrowright') return eventKey === 'arrowright';

  return eventKey === parsed.key;
}

/**
 * useKeyboardShortcuts - Hook for registering keyboard shortcuts
 *
 * Usage:
 *   useKeyboardShortcuts([
 *     {
 *       key: 'Ctrl+K',
 *       description: 'Open search',
 *       action: () => openSearch(),
 *       category: 'general'
 *     },
 *     {
 *       key: '1',
 *       description: 'Go to Live tab',
 *       action: () => setActiveTab('live'),
 *       category: 'navigation'
 *     }
 *   ]);
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input/textarea
      const target = event.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true';

      // Allow some shortcuts even when typing (like Escape)
      if (isTyping) {
        const escapableShortcuts = ['escape'];
        const isEscapable = shortcuts.some(
          (s) => escapableShortcuts.includes(s.key.toLowerCase()) && matchesShortcut(event, s)
        );
        if (!isEscapable) return;
      }

      // Find matching shortcut
      for (const shortcut of shortcuts) {
        if (matchesShortcut(event, shortcut)) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          if (shortcut.stopPropagation) {
            event.stopPropagation();
          }
          shortcut.action(event);
          break; // Only handle first matching shortcut
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

/**
 * Format shortcut for display
 * Examples: "Ctrl+K" -> "Ctrl + K", "Cmd+J" -> "⌘ + J"
 */
export function formatShortcutForDisplay(shortcutStr: string): string {
  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  return shortcutStr
    .split('+')
    .map((part) => {
      const p = part.trim().toLowerCase();
      if (p === 'cmd' || p === 'meta') return isMac ? '⌘' : 'Cmd';
      if (p === 'ctrl') return isMac ? '⌃' : 'Ctrl';
      if (p === 'shift') return isMac ? '⇧' : 'Shift';
      if (p === 'alt') return isMac ? '⌥' : 'Alt';
      if (p === 'escape') return 'Esc';
      if (p === 'enter') return '↵';
      if (p === 'tab') return 'Tab';
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' + ');
}
