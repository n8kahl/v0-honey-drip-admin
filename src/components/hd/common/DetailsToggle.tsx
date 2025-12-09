/**
 * DetailsToggle - Collapsible details section
 *
 * Progressive disclosure component for hiding verbose content.
 * Uses native <details> element for accessibility.
 */

import { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import { ChevronRight } from "lucide-react";

interface DetailsToggleProps {
  children: ReactNode;
  summary?: string;
  defaultOpen?: boolean;
  className?: string;
}

/**
 * Collapsible details section with "Details" or custom summary label.
 * Content is hidden by default and revealed on click.
 */
export function DetailsToggle({
  children,
  summary = "Details",
  defaultOpen = false,
  className,
}: DetailsToggleProps) {
  return (
    <details
      className={cn("group", className)}
      open={defaultOpen}
    >
      <summary className="flex items-center gap-1 text-[10px] text-[var(--text-faint)] cursor-pointer hover:text-[var(--text-muted)] transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
        <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
        {summary}
      </summary>
      <div className="mt-2 text-xs text-[var(--text-muted)] animate-fade-in-up">
        {children}
      </div>
    </details>
  );
}

export default DetailsToggle;
