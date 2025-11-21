import * as React from "react";

/**
 * Mobile breakpoint aligned with Tailwind's lg: breakpoint (1024px)
 * This ensures consistency between useIsMobile() and CSS media queries
 * - Mobile: < 1024px (matches lg:hidden)
 * - Desktop: >= 1024px (matches hidden lg:flex)
 */
const MOBILE_BREAKPOINT = 1024;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
