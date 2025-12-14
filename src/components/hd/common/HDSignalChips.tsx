/**
 * HDSignalChips - Compact confluence component badges
 *
 * Collapsed mode: Shows only passing chips as tiny badges (MTF, RSI, VOL, VWAP)
 * Expanded mode: Shows full checklist with pass/fail icons
 */

import { cn } from "../../../lib/utils";
import { Check, Circle } from "lucide-react";

interface ConfluenceComponents {
  trendAlignment?: boolean;
  rsiConfirm?: boolean;
  volumeConfirm?: boolean;
  aboveVWAP?: boolean;
}

interface HDSignalChipsProps {
  components: ConfluenceComponents;
  max?: number; // default 3, for collapsed view
  showAll?: boolean; // for expanded view, show all with pass/fail
  className?: string;
}

// Mapping of component keys to display info
const CHIP_CONFIG = [
  {
    key: "trendAlignment" as const,
    short: "MTF",
    full: "Multi-Timeframe Trend Alignment",
  },
  { key: "rsiConfirm" as const, short: "RSI", full: "RSI Momentum Confirmation" },
  { key: "volumeConfirm" as const, short: "VOL", full: "Volume Confirmation" },
  { key: "aboveVWAP" as const, short: "VWAP", full: "Above VWAP" },
];

export function HDSignalChips({
  components,
  max = 3,
  showAll = false,
  className,
}: HDSignalChipsProps) {
  if (showAll) {
    // Expanded mode: show all with pass/fail icons
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        {CHIP_CONFIG.map((chip) => {
          const isPassing = components[chip.key] ?? false;
          return (
            <div
              key={chip.key}
              className="flex items-center gap-2 text-xs"
              data-testid={`signal-checklist-${chip.short.toLowerCase()}`}
            >
              {isPassing ? (
                <Check className="w-3.5 h-3.5 text-[var(--accent-positive)]" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-zinc-500" />
              )}
              <span className={cn(isPassing ? "text-[var(--text-high)]" : "text-zinc-500")}>
                {chip.full}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // Collapsed mode: show only passing chips, up to max
  const passingChips = CHIP_CONFIG.filter((chip) => components[chip.key] ?? false).slice(0, max);

  if (passingChips.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {passingChips.map((chip) => (
        <div
          key={chip.key}
          className={cn(
            "px-1 py-0.5 rounded text-[8px] font-bold",
            "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)]",
            "border border-[var(--accent-positive)]/30"
          )}
          data-testid={`signal-chip-${chip.short.toLowerCase()}`}
          title={chip.full}
        >
          {chip.short}
        </div>
      ))}
    </div>
  );
}

export default HDSignalChips;
