/**
 * ActionRail - Center column contract-aware tiles container
 *
 * Contains: AICoachTile, ProfitTargetsTile, TimeDecayThetaTile
 * Updates when contract selection changes.
 *
 * NOTE: Inline alert flow has been moved to trading/ActionRail.tsx (right column)
 * This component focuses only on contract analysis tiles for the center workspace.
 */

import { cn } from "../../../lib/utils";
import { AICoachTile } from "./AICoachTile";
import { TimeDecayThetaTile } from "./TimeDecayThetaTile";
import { ProfitTargetsTile } from "./ProfitTargetsTile";
import type { Contract, Trade } from "../../../types";
import type { CoachingResponse } from "../../../lib/ai/types";

interface ActionRailProps {
  symbol: string;
  contract: Contract | null;
  recommendedContract?: Contract | null;
  entryPrice?: number;
  underlyingPrice?: number;
  tradeType?: "Scalp" | "Day" | "Swing" | "LEAP";
  onLoadContract?: (contract: Contract) => void;
  // AI Coach props
  trade?: Trade | null;
  coachResponse?: CoachingResponse | null;
  coachLoading?: boolean;
  coachProcessing?: boolean;
  coachError?: string | null;
  onCoachRefresh?: () => void;
  className?: string;
}

// Build contract context for AI Coach when no trade exists
function buildContractContext(
  symbol: string,
  contract: Contract | null,
  tradeType: "Scalp" | "Day" | "Swing" | "LEAP"
) {
  if (!contract) return null;
  return {
    symbol,
    contractType: contract.type as "call" | "put",
    strike: contract.strike,
    dte: contract.daysToExpiry ?? 0,
    delta: contract.delta,
    tradeType,
  };
}

export function ActionRail({
  symbol,
  contract,
  recommendedContract,
  entryPrice,
  underlyingPrice,
  tradeType = "Day",
  onLoadContract,
  // AI Coach props
  trade,
  coachResponse,
  coachLoading = false,
  coachProcessing = false,
  coachError,
  onCoachRefresh,
  className,
}: ActionRailProps) {
  // Use active contract or fall back to recommended
  const activeContract = contract || recommendedContract || null;
  const effectiveEntry = entryPrice || activeContract?.mid;

  // Build contract context for AI Coach when no trade exists
  const contractContext = buildContractContext(symbol, activeContract, tradeType);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 w-[340px] flex-shrink-0 p-3 border-l border-[var(--border-hairline)] overflow-y-auto",
        className
      )}
    >
      {/* AI Coach Tile - Always at top */}
      <AICoachTile
        trade={trade}
        latestResponse={coachResponse}
        isLoading={coachLoading}
        isProcessing={coachProcessing}
        error={coachError}
        onRefresh={onCoachRefresh}
        contractContext={contractContext}
      />

      {/* Profit Targets Tile - ABOVE Time Decay, EXPANDED by default */}
      <ProfitTargetsTile
        contract={activeContract}
        entryPrice={effectiveEntry}
        underlyingPrice={underlyingPrice}
        tradeType={tradeType}
        defaultExpanded={true}
      />

      {/* Time Decay Tile - Below targets */}
      <TimeDecayThetaTile
        contract={activeContract}
        recommendedContract={recommendedContract}
        ticker={symbol}
      />

      {/* Legacy: Load & Alert Button */}
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
