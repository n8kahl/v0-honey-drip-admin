/**
 * Z-Index Scale
 *
 * Centralized z-index values to prevent stacking conflicts.
 * Higher values appear above lower values.
 *
 * Usage:
 * import { Z_INDEX } from '@/lib/zIndex';
 * className={`fixed ${Z_INDEX.HEADER}`}
 */

export const Z_INDEX = {
  // Base layers (0-9)
  BASE: 'z-0',
  BELOW: 'z-[-1]',

  // Sticky elements (10-19)
  STICKY_HEADER: 'z-10',

  // Fixed bottom elements (20-29)
  BOTTOM_NAV: 'z-20',

  // Docks and panels (30-39)
  DOCK: 'z-30',
  PANEL: 'z-40',

  // Primary navigation and headers (40-49)
  HEADER: 'z-50',

  // Dropdowns and menus (50-59)
  DROPDOWN: 'z-50',

  // Sheets and drawers (60-69)
  SHEET_BACKDROP: 'z-60',
  SHEET_CONTENT: 'z-60',

  // Standard dialogs (70-79)
  DIALOG_BACKDROP: 'z-70',
  DIALOG_CONTENT: 'z-70',

  // Popovers (80-89)
  POPOVER: 'z-80',

  // Tooltips (90-99)
  TOOLTIP: 'z-90',

  // Toasts and notifications (100-109)
  TOAST: 'z-[100]',

  // Critical system dialogs (110-119)
  CRITICAL_DIALOG_BACKDROP: 'z-[110]',
  CRITICAL_DIALOG_CONTENT: 'z-[110]',
} as const;

/**
 * Numeric z-index values for cases where Tailwind classes can't be used
 */
export const Z_INDEX_VALUES = {
  BASE: 0,
  BELOW: -1,
  STICKY_HEADER: 10,
  BOTTOM_NAV: 20,
  DOCK: 30,
  PANEL: 40,
  HEADER: 50,
  DROPDOWN: 50,
  SHEET_BACKDROP: 60,
  SHEET_CONTENT: 60,
  DIALOG_BACKDROP: 70,
  DIALOG_CONTENT: 70,
  POPOVER: 80,
  TOOLTIP: 90,
  TOAST: 100,
  CRITICAL_DIALOG_BACKDROP: 110,
  CRITICAL_DIALOG_CONTENT: 110,
} as const;
