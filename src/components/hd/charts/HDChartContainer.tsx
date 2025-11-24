/**
 * HDChartContainer - Collapsible chart area wrapper
 * Manages collapse/expand state with localStorage persistence
 * Used to wrap dual 1m+5m chart view with smooth animations
 */

import React, { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface HDChartContainerProps {
  title?: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

const STORAGE_KEY = "hdchart-container-expanded";

export function HDChartContainer({
  title = "Charts",
  children,
  defaultExpanded = true,
  className = "",
}: HDChartContainerProps) {
  const [isExpanded, setIsExpanded] = useState(() => {
    try {
      const stored =
        typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      console.log(`[HDChartContainer] localStorage ${STORAGE_KEY}:`, stored);
      if (stored !== null) {
        const expanded = stored === "true";
        console.log(`[HDChartContainer] Initializing with isExpanded=${expanded} from localStorage`);
        return expanded;
      }
    } catch {
      // localStorage not available
    }
    console.log(`[HDChartContainer] Initializing with defaultExpanded=${defaultExpanded}`);
    return defaultExpanded;
  });

  // Persist state to localStorage
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, String(isExpanded));
      }
    } catch {
      // localStorage not available, ignore silently
    }
  }, [isExpanded]);

  const toggleExpanded = () => {
    setIsExpanded((prev) => !prev);
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Header with title and collapse toggle */}
      <div className="flex items-center justify-between bg-[var(--surface-2)] border-b border-[var(--border-hairline)] px-4 py-3 rounded-t-lg">
        <h3 className="text-sm font-semibold text-[var(--text-high)]">{title}</h3>
        <button
          onClick={toggleExpanded}
          className="p-1 hover:bg-[var(--surface-3)] rounded transition-colors duration-200"
          aria-label={isExpanded ? "Collapse charts" : "Expand charts"}
        >
          <ChevronDown
            size={18}
            className={`text-[var(--text-muted)] transition-transform duration-300 ${
              isExpanded ? "rotate-0" : "-rotate-90"
            }`}
          />
        </button>
      </div>

      {/* Content area with smooth collapse/expand animation */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="bg-[var(--surface-2)] rounded-b-lg">{children}</div>
      </div>
    </div>
  );
}
