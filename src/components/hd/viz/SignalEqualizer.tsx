/**
 * SignalEqualizer.tsx
 *
 * Visualizes the 5 pillars of confluence (Trend, Momentum, Volume, Volatility, Structure)
 * as an equalizer-style bar chart.
 *
 * Features:
 * - Color-coded bars based on score intensity
 * - Hover tooltips with detailed "Why" context
 * - "Trap detection" (e.g., High Trend but Low Volume)
 */

import React from "react";
import { cn } from "../../../lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip";
import { Info } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface SignalPillar {
  id: "trend" | "momentum" | "volume" | "volatility" | "structure";
  label: string;
  score: number; // 0-100
  detail: string; // "RSI 32 (Oversold)"
  status: "good" | "neutral" | "bad" | "warning";
}

interface SignalEqualizerProps {
  pillars: SignalPillar[];
  overallScore: number;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const PILLAR_CONFIG = {
  trend: { icon: "📈", description: "Multi-Timeframe Trend Alignment" },
  momentum: { icon: "🚀", description: "RSI & Stochastic Momentum" },
  volume: { icon: "📊", description: "Relative Volume & Order Flow" },
  volatility: { icon: "⚡", description: "ATR & Bollinger Width" },
  structure: { icon: "🏗️", description: "Key Levels & VWAP" },
};

// ============================================================================
// Component
// ============================================================================

export function SignalEqualizer({ pillars, overallScore, className }: SignalEqualizerProps) {
  const getBarColor = (status: SignalPillar["status"]) => {
    switch (status) {
      case "good":
        return "bg-[var(--accent-positive)]";
      case "neutral":
        return "bg-[var(--text-muted)]";
      case "bad":
        return "bg-[var(--accent-negative)]";
      case "warning":
        return "bg-amber-500"; // For "Traps" (e.g. divergence)
      default:
        return "bg-[var(--surface-3)]";
    }
  };

  return (
    <div
      className={cn(
        "p-3 sm:p-4 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)]",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
            Signal Quality
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-3 h-3 text-[var(--text-faint)]" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-[200px] text-xs">
                  Breakdown of the 5 key factors driving the confluence score.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-xl sm:text-2xl font-bold font-mono text-[var(--text-high)]">
            {Math.round(overallScore)}
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">/ 100</span>
        </div>
      </div>

      {/* Equalizer Bars */}
      <div className="space-y-3">
        {pillars.map((pillar) => (
          <div key={pillar.id} className="group">
            {/* Label Row */}
            <div className="flex items-center justify-between mb-1.5 text-xs">
              <div className="flex items-center gap-1.5 text-[var(--text-med)]">
                <span>{PILLAR_CONFIG[pillar.id].icon}</span>
                <span className="font-medium">{pillar.label}</span>
              </div>
              <span
                className={cn(
                  "tabular-nums opacity-0 group-hover:opacity-100 transition-opacity",
                  pillar.status === "good"
                    ? "text-[var(--accent-positive)]"
                    : pillar.status === "bad"
                      ? "text-[var(--accent-negative)]"
                      : "text-[var(--text-muted)]"
                )}
              >
                {pillar.detail}
              </span>
            </div>

            {/* Bar Track */}
            <TooltipProvider>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <div className="h-2 w-full rounded-full bg-[var(--surface-3)] overflow-hidden cursor-help">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        getBarColor(pillar.status)
                      )}
                      style={{ width: `${Math.max(5, pillar.score)}%` }}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  <div className="font-bold mb-0.5">{PILLAR_CONFIG[pillar.id].description}</div>
                  <div>
                    Status: <span className="font-medium">{pillar.detail}</span>
                  </div>
                  <div>Score contribution: {pillar.score}%</div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ))}
      </div>
    </div>
  );
}
