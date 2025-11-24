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
      if (stored !== null) {
        return stored === "true";
      }
    } catch {
      // localStorage not available
    }
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
      <div className="flex items-center justify-between bg-slate-900 border-b border-slate-700 px-4 py-3 rounded-t-lg">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <button
          onClick={toggleExpanded}
          className="p-1 hover:bg-slate-800 rounded transition-colors duration-200"
          aria-label={isExpanded ? "Collapse charts" : "Expand charts"}
        >
          <ChevronDown
            size={18}
            className={`text-slate-400 transition-transform duration-300 ${
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
        <div className="bg-slate-950 rounded-b-lg">{children}</div>
      </div>
    </div>
  );
}
