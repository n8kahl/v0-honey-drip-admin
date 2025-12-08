/**
 * HDRecommendedContractPreview - Shows recommended contract as a preview card
 * Displayed when a ticker is selected but no contract has been chosen yet
 * User can click "Analyze Contract" to select it
 */

import React from "react";
import { Target, TrendingUp, Clock, Zap } from "lucide-react";
import type { Contract } from "../../../types";
import type { ContractRecommendation } from "../../../hooks/useContractRecommendation";
import { HDButton } from "../common/HDButton";
import { cn } from "../../../lib/utils";

interface HDRecommendedContractPreviewProps {
  recommendation: ContractRecommendation | null;
  ticker: string;
  currentPrice: number;
  onSelectContract: (contract: Contract) => void;
  className?: string;
}

export function HDRecommendedContractPreview({
  recommendation,
  ticker,
  currentPrice,
  onSelectContract,
  className = "",
}: HDRecommendedContractPreviewProps) {
  // No recommendation available
  if (!recommendation || !recommendation.bestContract) {
    return (
      <div
        className={cn(
          "border border-[var(--border-hairline)] rounded-lg bg-[var(--surface-1)] p-6",
          className
        )}
      >
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-[var(--surface-2)] flex items-center justify-center">
            <Target className="w-6 h-6 text-[var(--text-muted)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-high)]">Select a Contract</h3>
          <p className="text-sm text-[var(--text-muted)] max-w-xs mx-auto">
            Choose a contract from the options chain to analyze and load as a trade
          </p>
        </div>
      </div>
    );
  }

  const { bestContract, strategyDescription, confidence } = recommendation;

  // Format expiry date
  const expiryDate = new Date(bestContract.expiry);
  const expiryFormatted = expiryDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  // Confidence badge colors
  const confidenceColors: Record<string, string> = {
    high: "bg-green-500/20 text-green-400 border-green-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low: "bg-red-500/20 text-red-400 border-red-500/30",
    none: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };

  // Option type display
  const optionType = bestContract.type === "C" ? "Call" : "Put";
  const optionColor = bestContract.type === "C" ? "text-green-400" : "text-red-400";

  return (
    <div
      className={cn(
        "border border-[var(--border-hairline)] rounded-lg bg-[var(--surface-1)] overflow-hidden",
        className
      )}
    >
      {/* Header with Best Pick badge */}
      <div className="px-4 py-3 border-b border-[var(--border-hairline)] bg-[var(--surface-2)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[var(--brand-primary)]" />
          <span className="text-sm font-semibold text-[var(--text-high)]">
            Recommended Contract
          </span>
        </div>
        <span
          className={cn(
            "text-[10px] font-medium px-2 py-0.5 rounded-full border",
            confidenceColors[confidence]
          )}
        >
          {confidence.charAt(0).toUpperCase() + confidence.slice(1)} Confidence
        </span>
      </div>

      {/* Contract Details */}
      <div className="p-4 space-y-4">
        {/* Main contract info */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-[var(--text-high)]">
              {ticker} ${bestContract.strike}
              <span className={cn("ml-2 text-lg font-semibold", optionColor)}>{optionType}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-[var(--text-muted)]">
              <Clock className="w-3.5 h-3.5" />
              <span>{expiryFormatted}</span>
              <span className="text-[var(--text-faint)]">•</span>
              <span>{bestContract.daysToExpiry} DTE</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-[var(--brand-primary)]">
              ${bestContract.mid.toFixed(2)}
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              ${bestContract.bid.toFixed(2)} / ${bestContract.ask.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Strategy description */}
        {strategyDescription && (
          <div className="px-3 py-2 bg-[var(--surface-2)] rounded-md">
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--brand-primary)] mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm text-[var(--text-med)]">{strategyDescription.description}</p>
                <p className="text-xs text-[var(--text-muted)]">{strategyDescription.rationale}</p>
              </div>
            </div>
          </div>
        )}

        {/* Contract metrics grid */}
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
              Delta
            </div>
            <div className="text-sm font-semibold text-[var(--text-high)]">
              {bestContract.delta?.toFixed(2) || "-"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">IV</div>
            <div className="text-sm font-semibold text-[var(--text-high)]">
              {bestContract.iv ? `${(bestContract.iv * 100).toFixed(0)}%` : "-"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
              Volume
            </div>
            <div className="text-sm font-semibold text-[var(--text-high)]">
              {bestContract.volume.toLocaleString()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">OI</div>
            <div className="text-sm font-semibold text-[var(--text-high)]">
              {bestContract.openInterest.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Underlying price context */}
        <div className="flex items-center justify-between text-sm border-t border-[var(--border-hairline)] pt-3">
          <span className="text-[var(--text-muted)]">{ticker} Current Price</span>
          <span className="font-semibold text-[var(--text-high)]">${currentPrice.toFixed(2)}</span>
        </div>

        {/* Action button */}
        <HDButton
          variant="primary"
          onClick={() => onSelectContract(bestContract)}
          className="w-full"
        >
          <Target className="w-4 h-4 mr-2" />
          Analyze Contract
        </HDButton>
      </div>
    </div>
  );
}
