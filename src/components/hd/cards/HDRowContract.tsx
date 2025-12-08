/**
 * HDRowContract - Options contract row with hover effects and liquidity indicator
 *
 * Features:
 * - Selection highlight with brand accent border
 * - Hover state with subtle background change
 * - Liquidity indicator (green/amber/red dot based on bid-ask spread)
 * - Price flash animation on updates
 */

import { Contract } from "../../../types";
import { formatPrice, cn } from "../../../lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";

interface HDRowContractProps {
  contract: Contract;
  selected?: boolean;
  onClick?: () => void;
}

/**
 * Determine liquidity status based on bid-ask spread
 */
function getLiquidityStatus(contract: Contract): {
  color: string;
  label: string;
  tooltip: string;
} {
  const spread = (contract.ask || 0) - (contract.bid || 0);
  const spreadPercent = contract.mid > 0 ? (spread / contract.mid) * 100 : 100;

  if (spreadPercent < 5 || spread < 0.05) {
    return {
      color: "bg-green-500",
      label: "Tight",
      tooltip: `Spread: $${spread.toFixed(2)} (${spreadPercent.toFixed(1)}%) - Very liquid`,
    };
  }

  if (spreadPercent < 15 || spread < 0.2) {
    return {
      color: "bg-amber-500",
      label: "Moderate",
      tooltip: `Spread: $${spread.toFixed(2)} (${spreadPercent.toFixed(1)}%) - Moderate liquidity`,
    };
  }

  return {
    color: "bg-red-500",
    label: "Wide",
    tooltip: `Spread: $${spread.toFixed(2)} (${spreadPercent.toFixed(1)}%) - Poor liquidity`,
  };
}

export function HDRowContract({ contract, selected, onClick }: HDRowContractProps) {
  const liquidity = getLiquidityStatus(contract);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full grid grid-cols-7 gap-3 px-3 py-2 border-b border-[var(--border-hairline)]",
        "text-left text-xs",
        "transition-all duration-100 ease-out",
        // Hover state
        "hover:bg-[var(--surface-3)]",
        // Selection state
        selected && "bg-[var(--brand-primary)]/10 border-l-2 border-l-[var(--brand-primary)]",
        !selected && "border-l-2 border-l-transparent"
      )}
    >
      {/* Strike + Type */}
      <div>
        <span
          className={cn(
            "font-medium",
            contract.type === "C"
              ? "text-[var(--accent-positive)]"
              : "text-[var(--accent-negative)]"
          )}
        >
          {contract.strike}
          {contract.type}
        </span>
      </div>

      {/* Expiry */}
      <div className="text-[var(--text-muted)]">{contract.expiry}</div>

      {/* Mid price */}
      <div className="text-[var(--text-high)] tabular-nums font-medium">
        ${formatPrice(contract.mid)}
      </div>

      {/* Delta */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="text-[var(--text-muted)] tabular-nums cursor-help">
            <span className="opacity-60">Δ</span> {contract.delta?.toFixed(2) || "--"}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="text-xs bg-[var(--surface-2)] border-[var(--border-hairline)]"
        >
          Delta: Price change per $1 underlying move
        </TooltipContent>
      </Tooltip>

      {/* IV */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="text-[var(--text-muted)] tabular-nums cursor-help">
            <span className="opacity-60">IV</span>{" "}
            {contract.iv ? `${contract.iv.toFixed(0)}%` : "--"}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="text-xs bg-[var(--surface-2)] border-[var(--border-hairline)]"
        >
          Implied Volatility: Market's expectation of price movement
        </TooltipContent>
      </Tooltip>

      {/* Volume + Liquidity indicator */}
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", liquidity.color)} />
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            className="text-xs bg-[var(--surface-2)] border-[var(--border-hairline)]"
          >
            {liquidity.tooltip}
          </TooltipContent>
        </Tooltip>
        <span className="text-[var(--text-muted)] tabular-nums">
          {contract.volume.toLocaleString()}
        </span>
      </div>

      {/* Open Interest */}
      <div className="text-[var(--text-muted)] tabular-nums">
        {contract.openInterest.toLocaleString()}
      </div>
    </button>
  );
}
