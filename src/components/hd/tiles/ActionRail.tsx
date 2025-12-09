/**
 * ActionRail - Right column container for contract-aware tiles
 *
 * Contains: TimeDecayThetaTile, ProfitTargetsTile, Load & Alert button
 * Updates when contract selection changes.
 */

import { cn } from "../../../lib/utils";
import { TimeDecayThetaTile } from "./TimeDecayThetaTile";
import { ProfitTargetsTile } from "./ProfitTargetsTile";
import type { Contract } from "../../../types";

interface ActionRailProps {
  symbol: string;
  contract: Contract | null;
  recommendedContract?: Contract | null;
  entryPrice?: number;
  tradeType?: "Scalp" | "Day" | "Swing" | "LEAP";
  onLoadContract?: (contract: Contract) => void;
  className?: string;
}

export function ActionRail({
  symbol,
  contract,
  recommendedContract,
  entryPrice,
  tradeType = "Day",
  onLoadContract,
  className,
}: ActionRailProps) {
  // Use active contract or fall back to recommended
  const activeContract = contract || recommendedContract || null;
  const effectiveEntry = entryPrice || activeContract?.mid;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 w-[280px] flex-shrink-0 p-3 border-l border-[var(--border-hairline)] overflow-y-auto",
        className
      )}
    >
      {/* Time Decay Tile */}
      <TimeDecayThetaTile
        contract={activeContract}
        recommendedContract={recommendedContract}
        ticker={symbol}
      />

      {/* Profit Targets Tile */}
      <ProfitTargetsTile
        contract={activeContract}
        entryPrice={effectiveEntry}
        tradeType={tradeType}
      />

      {/* Load & Alert Button */}
      {activeContract && onLoadContract && (
        <button
          onClick={() => onLoadContract(activeContract)}
          className={cn(
            "w-full py-3 rounded font-medium text-sm transition-colors",
            "bg-[var(--brand-primary)] text-black",
            "hover:bg-[var(--brand-primary-hover)]",
            "btn-press"
          )}
        >
          Load & Alert
        </button>
      )}

      {/* Empty state */}
      {!activeContract && (
        <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-faint)]">
          Select a contract from the options chain
        </div>
      )}
    </div>
  );
}

export default ActionRail;
