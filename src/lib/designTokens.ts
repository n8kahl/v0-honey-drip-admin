// Design System Constants for Honey Drip Admin
// Use these constants throughout the app for consistency

export const DESIGN_TOKENS = {
  // Text Colors (Zinc scale for consistency)
  text: {
    high: 'text-zinc-100',       // Primary text - var(--text-high)
    med: 'text-zinc-300',         // Secondary text - var(--text-med)
    muted: 'text-zinc-400',       // Tertiary text - var(--text-muted)
    faint: 'text-zinc-500',       // Disabled/placeholder - var(--text-faint)
  },
  
  // Interactive States
  hover: {
    scale: 'hover:scale-105',
    glow: 'hover:shadow-lg hover:shadow-[var(--brand-primary)]/20',
    bg: 'hover:bg-zinc-800/50',
    text: 'hover:text-zinc-100',
  },
  
  active: {
    scale: 'active:scale-100',
    glow: 'shadow-lg shadow-[var(--brand-primary)]/30',
    border: 'border-l-2 border-l-[var(--brand-primary)]',
  },
  
  // Badge Styles
  badge: {
    base: 'px-2 py-0.5 rounded-md text-xs font-medium transition-all',
    glow: 'shadow-md shadow-[var(--brand-primary)]/40 ring-1 ring-[var(--brand-primary)]/30',
    active: 'bg-[var(--brand-primary)]/20 text-[var(--brand-primary)]',
    inactive: 'bg-zinc-800/50 text-zinc-400',
  },
  
  // Tap Targets (Mobile-first)
  tap: {
    min: 'min-h-[48px] min-w-[48px]', // WCAG minimum
    touch: 'touch-manipulation select-none',
  },
  
  // Borders
  border: {
    hairline: 'border-zinc-800/50',
    strong: 'border-zinc-700',
    focus: 'border-[var(--brand-primary)]',
  },
  
  // Transitions
  transition: {
    fast: 'transition-all duration-150 ease-out',
    base: 'transition-all duration-300 ease-out',
    slow: 'transition-all duration-500 ease-out',
  },
} as const;

// Helper to combine badge styles
export const getBadgeClasses = (isActive: boolean) => {
  const base = DESIGN_TOKENS.badge.base;
  const state = isActive ? DESIGN_TOKENS.badge.active : DESIGN_TOKENS.badge.inactive;
  const glow = isActive ? DESIGN_TOKENS.badge.glow : '';
  return `${base} ${state} ${glow} ${DESIGN_TOKENS.transition.fast}`;
};

// Helper for tap targets
export const getTapTargetClasses = () => {
  return `${DESIGN_TOKENS.tap.min} ${DESIGN_TOKENS.tap.touch}`;
};

// Helper for hover effects
export const getHoverClasses = (withGlow = false) => {
  return `${DESIGN_TOKENS.hover.scale} ${withGlow ? DESIGN_TOKENS.hover.glow : DESIGN_TOKENS.hover.bg} ${DESIGN_TOKENS.transition.fast}`;
};
