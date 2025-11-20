/**
 * Accessibility utilities and animation helpers
 */

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
