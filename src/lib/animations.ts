/**
 * Animation and transition utilities for smooth visual feedback
 */

/**
 * Smooth fade-in animation
 * Used for modals, dialogs, popups
 */
export const fadeIn = 'animate-in fade-in duration-200';

/**
 * Smooth fade-out animation
 */
export const fadeOut = 'animate-out fade-out duration-200';

/**
 * Smooth zoom-in animation
 * Used for expanding elements
 */
export const zoomIn = 'animate-in zoom-in-95 duration-200';

/**
 * Smooth zoom-out animation
 */
export const zoomOut = 'animate-out zoom-out-95 duration-200';

/**
 * Slide-in from top animation
 */
export const slideInTop = 'animate-in slide-in-from-top-2 duration-300';

/**
 * Slide-in from bottom animation
 */
export const slideInBottom = 'animate-in slide-in-from-bottom-2 duration-300';

/**
 * Smooth transition for colors
 */
export const colorTransition = 'transition-colors duration-200';

/**
 * Smooth transition for all properties
 */
export const smoothTransition = 'transition-all duration-200';

/**
 * Smooth shadow transition
 */
export const shadowTransition = 'transition-shadow duration-200';

/**
 * Smooth opacity transition
 */
export const opacityTransition = 'transition-opacity duration-200';

/**
 * Smooth transform transition (scale, translate, rotate)
 */
export const transformTransition = 'transition-transform duration-200';

/**
 * Button hover effect - subtle scale
 */
export const buttonHoverScale = 'hover:scale-105 active:scale-95 transition-transform duration-200';

/**
 * Button hover effect - color only (for minimal buttons)
 */
export const buttonHoverColor = 'hover:opacity-80 active:opacity-90 transition-opacity duration-200';

/**
 * Interactive element - slight lift on hover
 */
export const interactiveHover = 'hover:shadow-md hover:-translate-y-0.5 transition-all duration-200';

/**
 * Disabled state - reduce opacity
 */
export const disabledState = 'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none';

/**
 * Focus state with smooth transition
 */
export const focusStateSmooth = 'focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:ring-offset-2 focus:ring-offset-[var(--bg-base)] transition-all duration-200';

/**
 * Loading state - spinner animation
 */
export const loadingSpinner = 'animate-spin duration-1000';

/**
 * Pulse animation for attention
 */
export const pulse = 'animate-pulse';

/**
 * Bounce animation
 */
export const bounce = 'animate-bounce';

/**
 * Tooltip slide and fade animation
 */
export const tooltipAnimation = 'animate-in fade-in zoom-in-95 duration-150';

/**
 * Card or panel hover effect
 */
export const cardHover = 'hover:border-[var(--brand-primary)]/50 hover:shadow-sm transition-all duration-200';

/**
 * Smooth route transition (for Next.js page changes)
 */
export const pageTransition = 'animate-in fade-in duration-300';

/**
 * List item staggered animation helper
 */
export const listItemAnimation = (index: number) => ({
  animationDelay: `${index * 50}ms`,
});
