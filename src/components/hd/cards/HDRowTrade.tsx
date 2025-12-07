import { Trade } from "../../../types";
import { HDTagTradeType } from "../common/HDTagTradeType";
import { formatPercent, cn } from "../../../lib/utils";
import { ensureArray } from "../../../lib/utils/validation";
import { X, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { HDConfluenceDiscsCompact } from "../signals/HDConfluenceDiscs";
import { HDSetupTypeBadgeCompact } from "../signals/HDSetupTypeBadge";
import { useSettingsStore } from "../../../stores/settingsStore";

interface HDRowTradeProps {
  trade: Trade;
  active?: boolean;
  isFlashing?: boolean; // When confluence changes significantly
  onClick?: () => void;
  onRemove?: () => void;
}

export function HDRowTrade({ trade, active, isFlashing, onClick, onRemove }: HDRowTradeProps) {
  const navigate = useNavigate();
  const getChallengeById = useSettingsStore((s) => s.getChallengeById);
  const isPositive = (trade.movePercent || 0) >= 0;
  const isLoaded = trade.state === "LOADED";

  // Get challenge names for display
  const tradeChallenges = ensureArray(trade.challenges);
  const challengeNames = tradeChallenges
    .map((cid) => getChallengeById(cid)?.name)
    .filter(Boolean) as string[];

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/trades/${trade.id}`);
    }
  };

  // Determine flash animation class based on confluence change
  const flashClass = isFlashing
    ? trade.confluence && trade.confluence.score < 40
      ? "animate-flash-urgent"
      : "animate-flash-warning"
    : "";

  return (
    <div
      className={cn(
        "w-full flex items-start justify-between p-3 transition-colors border-b border-[var(--border-hairline)] last:border-b-0 group",
        active
          ? "bg-[var(--brand-primary)]/10 border-l-2 border-l-[var(--brand-primary)]"
          : "hover:bg-[var(--surface-1)]",
        flashClass
      )}
    >
      <button onClick={handleClick} className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={cn(
              "font-medium",
              active ? "text-[var(--text-high)]" : "text-[var(--text-high)]"
            )}
          >
            {trade.ticker}
          </span>
          <HDTagTradeType type={trade.tradeType} />
          {/* Setup type badge */}
          {trade.setupType && <HDSetupTypeBadgeCompact setupType={trade.setupType} />}
          {/* Challenge badges */}
          {challengeNames.length > 0 && (
            <div className="flex items-center gap-1">
              <Trophy className="w-3 h-3 text-amber-500" />
              <span className="text-[9px] text-amber-500 font-medium truncate max-w-[80px]">
                {challengeNames.length === 1
                  ? challengeNames[0]
                  : `${challengeNames.length} challenges`}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span>
            {trade.contract.strike}
            {trade.contract.type} • {trade.contract.expiry}
          </span>
          {/* Confluence discs */}
          {trade.confluence && <HDConfluenceDiscsCompact confluence={trade.confluence} />}
        </div>
      </button>

      <div className="flex items-start gap-2">
        <div className="flex flex-col items-end gap-1">
          {isLoaded ? (
            <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wide bg-blue-500/20 text-blue-400 border border-blue-500/30">
              📋 Loaded
            </span>
          ) : trade.movePercent !== undefined ? (
            <>
              <span
                className={cn(
                  "text-sm tabular-nums font-medium",
                  isPositive ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
                )}
              >
                {formatPercent(trade.movePercent)}
              </span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded text-[9px] uppercase tracking-wide",
                  isPositive
                    ? "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)] border border-[var(--accent-positive)]/30"
                    : "bg-[var(--accent-negative)]/20 text-[var(--accent-negative)] border border-[var(--accent-negative)]/30"
                )}
              >
                ✓ Active
              </span>
            </>
          ) : null}
        </div>

        {/* Remove button - only show for loaded trades */}
        {onRemove && isLoaded && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="w-6 h-6 flex items-center justify-center rounded-[var(--radius)] opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--accent-negative)] hover:bg-[var(--surface-3)] transition-all flex-shrink-0"
            title="Remove loaded trade"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
