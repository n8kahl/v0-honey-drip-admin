/**
 * OpportunityMatrix - Scatter chart visualizing trade setups
 *
 * X-axis: AI Score (0-100)
 * Y-axis: Risk/Reward Ratio
 * Z-axis (bubble size): Volatility
 * Color: Direction (green=long, red=short)
 */

import { useEffect, useMemo, useState } from "react";
import { cn } from "../../../../lib/utils";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Cell,
} from "recharts";
import type { TooltipProps } from "recharts";
import { Target, TrendingUp, TrendingDown } from "lucide-react";
import type { OpportunityDot } from "../../../../types/radar-visuals";

export interface OpportunityMatrixProps {
  data: OpportunityDot[];
  onAddTicker?: (symbol: string) => void;
  className?: string;
}

export function OpportunityMatrix({ data, onAddTicker, className }: OpportunityMatrixProps) {
  // Mobile responsive state
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if we're in browser
    if (typeof window === "undefined") return;

    const checkMobile = () => window.innerWidth < 768;

    // Set initial state
    setIsMobile(checkMobile());

    // Add resize listener
    const handler = () => setIsMobile(checkMobile());
    window.addEventListener("resize", handler);

    return () => window.removeEventListener("resize", handler);
  }, []);

  // Prepare data for scatter chart
  const chartData = useMemo(() => {
    return data.map((dot) => ({
      ...dot,
      x: dot.score,
      y: dot.rrRatio,
      z: dot.volatility * 10, // Scale for bubble size
    }));
  }, [data]);

  // Track viewport size to swap chart/table views responsively
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 768;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile(); // Sync on mount in case of SSR

    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl bg-[var(--surface-1)] border border-[var(--border-hairline)] p-6",
          className
        )}
      >
        <div className="text-center py-8">
          <Target className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-50" />
          <p className="text-sm text-[var(--text-muted)]">
            No opportunities detected. Add symbols to watchlist or wait for setups to form.
          </p>
        </div>
      </div>
    );
  }

  // Mobile view: Table
  if (isMobile) {
    return (
      <div
        className={cn(
          "rounded-xl bg-[var(--surface-1)] border border-[var(--border-hairline)] overflow-hidden",
          className
        )}
      >
        <div className="px-4 py-3 border-b border-[var(--border-hairline)]">
          <h3 className="font-semibold text-[var(--text-high)]">Opportunities</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-2)]">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-muted)]">
                  Symbol
                </th>
                <th className="px-4 py-2 text-center text-xs font-medium text-[var(--text-muted)]">
                  Score
                </th>
                <th className="px-4 py-2 text-center text-xs font-medium text-[var(--text-muted)]">
                  R:R
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-[var(--text-muted)]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((dot) => (
                <tr key={dot.symbol} className="border-b border-[var(--border-hairline)]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {dot.direction === "long" ? (
                        <TrendingUp className="w-3 h-3 text-green-400" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-red-400" />
                      )}
                      <span className="font-medium text-[var(--text-high)]">{dot.symbol}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-[var(--text-high)]">
                    {dot.score}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-[var(--text-high)]">
                    {dot.rrRatio.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onAddTicker?.(dot.symbol)}
                      className="px-2 py-1 text-xs rounded bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary)]/90"
                    >
                      Add
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Desktop view: Scatter chart
  return (
    <div
      className={cn(
        "rounded-xl bg-[var(--surface-1)] border border-[var(--border-hairline)] overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-hairline)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-[var(--brand-primary)]" />
            <h3 className="font-semibold text-[var(--text-high)]">Opportunity Matrix</h3>
            <span className="text-xs text-[var(--text-muted)]">{data.length} setups detected</span>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-[var(--text-muted)]">Long</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-[var(--text-muted)]">Short</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-hairline)" />

            {/* Prime Setup Zone (top-right) */}
            <ReferenceArea
              x1={70}
              x2={100}
              y1={2}
              y2={5}
              fill="var(--brand-primary)"
              fillOpacity={0.1}
              stroke="var(--brand-primary)"
              strokeOpacity={0.3}
              strokeDasharray="4 4"
              label={{
                value: "Prime Setup Zone",
                position: "insideTopRight",
                fill: "var(--brand-primary)",
                fontSize: 11,
                fontWeight: 600,
              }}
            />

            <XAxis
              type="number"
              dataKey="x"
              name="AI Score"
              domain={[0, 100]}
              label={{
                value: "AI Score",
                position: "insideBottom",
                offset: -10,
                style: { fill: "var(--text-muted)", fontSize: 12 },
              }}
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            />

            <YAxis
              type="number"
              dataKey="y"
              name="Risk/Reward"
              domain={[0, 5]}
              label={{
                value: "Risk/Reward Ratio",
                angle: -90,
                position: "insideLeft",
                style: { fill: "var(--text-muted)", fontSize: 12 },
              }}
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            />

            <ZAxis type="number" dataKey="z" range={[40, 200]} name="Volatility" />

            <Tooltip content={<CustomTooltip onAddTicker={onAddTicker} />} />

            <Scatter
              data={chartData}
              onClick={(data) => {
                if (data && onAddTicker) {
                  onAddTicker(data.symbol);
                }
              }}
              style={{ cursor: "pointer" }}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.direction === "long" ? "#22c55e" : "#ef4444"}
                  fillOpacity={0.7}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>

        {/* Help Text */}
        <p className="text-xs text-[var(--text-muted)] text-center mt-2">
          Click any dot to add to Battle Plan • Larger bubbles = higher volatility
        </p>
      </div>
    </div>
  );
}

// Custom tooltip
type OpportunityTooltipProps = TooltipProps<number, string> & {
  onAddTicker?: (symbol: string) => void;
};

function CustomTooltip({ active, payload, onAddTicker }: OpportunityTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload as OpportunityDot;

  return (
    <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] p-3 shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        {data.direction === "long" ? (
          <TrendingUp className="w-4 h-4 text-green-400" />
        ) : (
          <TrendingDown className="w-4 h-4 text-red-400" />
        )}
        <span className="font-bold text-[var(--text-high)]">{data.symbol}</span>
        <span
          className={cn(
            "text-xs px-1.5 py-0.5 rounded",
            data.direction === "long"
              ? "bg-green-500/20 text-green-400"
              : "bg-red-500/20 text-red-400"
          )}
        >
          {data.direction.toUpperCase()}
        </span>
      </div>

      <div className="space-y-1 text-xs mb-3">
        <div className="flex justify-between gap-4">
          <span className="text-[var(--text-muted)]">AI Score:</span>
          <span className="font-mono font-medium text-[var(--text-high)]">{data.score}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[var(--text-muted)]">Risk/Reward:</span>
          <span className="font-mono font-medium text-[var(--text-high)]">
            {data.rrRatio.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[var(--text-muted)]">Volatility:</span>
          <span className="font-mono font-medium text-[var(--text-high)]">
            {data.volatility.toFixed(1)}%
          </span>
        </div>
        {data.setups.length > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-[var(--text-muted)]">Setup:</span>
            <span className="font-medium text-[var(--text-high)]">{data.setups.join(", ")}</span>
          </div>
        )}
      </div>

      {onAddTicker && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddTicker(data.symbol);
          }}
          className="w-full px-3 py-1.5 text-xs rounded bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary)]/90 transition-colors"
        >
          Add to Battle Plan
        </button>
      )}
    </div>
  );
}

export default OpportunityMatrix;
