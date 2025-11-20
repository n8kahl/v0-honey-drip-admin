/**
 * Accessibility utilities for keyboard navigation and screen readers
 */

/**
 * Focus ring classes for keyboard navigation
 * Shows a visual indicator when element is focused via keyboard
 */
export const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]';

/**
 * Check if event is from keyboard interaction (Enter or Space)
 */
export function isKeyboardEvent(
  event: React.KeyboardEvent
): boolean {
  return event.key === 'Enter' || event.key === ' ';
}

/**
 * Check if element is focusable
 */
export function isFocusableElement(element: HTMLElement): boolean {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  return element.matches(focusableSelectors);
}

/**
 * Handle keyboard activation (Enter/Space) on clickable elements
 * For <div> or <span> elements that act as buttons
 */
export function handleKeyDown(
  event: React.KeyboardEvent,
  callback: () => void
): void {
  if (isKeyboardEvent(event)) {
    event.preventDefault();
    callback();
  }
}

/**
 * ARIA live region announces changes to screen readers
 * Use for dynamic content updates
 */
export const ariaLiveAttributes = {
  // Polite - announces after user stops typing
  polite: {
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
  },
  // Assertive - announces immediately
  assertive: {
    role: 'alert',
    'aria-live': 'assertive',
    'aria-atomic': 'true',
  },
};

/**
 * Skip to main content link styling
 * Visible only on focus, helps keyboard users navigate faster
 */
export const skipLinkClasses = 'sr-only focus:not-sr-only focus:fixed focus:top-0 focus:left-0 focus:z-50 focus:p-2 focus:bg-[var(--brand-primary)] focus:text-white focus:rounded';

/**
 * Screen reader only text
 * Hidden visually but available to assistive technology
 */
export const srOnlyClasses = 'sr-only';

/**
 * Tooltip keyboard hint for screen reader users
 */
export const getAriaLabel = (label: string, shortcut?: string): string => {
  if (!shortcut) return label;
  return `${label} (${shortcut})`;
};

/**
 * Fade-in animation utility
 * Returns CSS classes for smooth fade-in transitions
 */
export const fadeIn = (duration: number = 200) => {
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: duration / 1000 },
  };
};

/**
 * Color transition utility
 * Returns CSS classes for smooth color transitions
 */
export const colorTransition = (duration: number = 150) => {
  return `transition-colors duration-${duration}`;
};

/**
 * Focus visible utility
 * Ensures focus rings are only shown on keyboard navigation
 */
export const focusVisible = () => {
  return 'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';
};

/**
 * Screen reader only utility
 * Visually hides content while keeping it accessible to screen readers
 */
export const srOnly = () => {
  return 'sr-only';
};
