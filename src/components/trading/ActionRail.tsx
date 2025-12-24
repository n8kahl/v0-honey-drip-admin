/**
 * ActionRail - Right Panel Component
 *
 * Always visible panel containing state-dependent content:
 *
 * WATCHING state with symbol focus (Setup Mode):
 * - Contract tile (auto-selected or manual)
 * - Time/Theta summary
 * - Targets (TP1/TP2/SL)
 * - Discord channels (preselected)
 * - Load+Alert / Enter+Alert / Dismiss buttons
 *
 * LOADED state:
 * - State badge
 * - Risk box editor
 * - Discord controls
 * - Enter/Unload buttons
 *
 * ENTERED state (Manage Mode):
 * - Position tile (LOCKED)
 * - Time/Theta tile (decay tracking)
 * - AI Guidance module
 * - Quick actions (Trim, Move SL, Trail)
 * - Exit section (Take Profit, Full Exit)
 *
 * EXITED state:
 * - State badge
 * - Final P&L recap
 * - Share/duplicate actions
 */

import React, { useState, useEffect, useMemo } from "react";
import type {
  Trade,
  TradeState,
  AlertType,
  DiscordChannel,
  Challenge,
  Contract,
} from "../../types";
import type { PriceOverrides } from "../hd/alerts/HDAlertComposer";
import { ActionRailStateBadge } from "./ActionRailStateBadge";
import { ActionRailRiskBox } from "./ActionRailRiskBox";
import { ActionRailDiscord } from "./ActionRailDiscord";
import { ActionRailActions } from "./ActionRailActions";
import { ActionRailManage } from "./ActionRailManage";
import { useSettingsStore } from "../../stores/settingsStore";
import { cn, formatPrice } from "../../lib/utils";
import { getStateStyle, fmtDTE, fmtMetric, chipStyle } from "../../ui/semantics";
import {
  Hash,
  Trophy,
  Send,
  Play,
  X,
  Clock,
  Target,
  TrendingUp,
  Star,
  RefreshCw,
} from "lucide-react";

// ============================================================================
// Props
// ============================================================================

export interface ActionRailProps {
  tradeState: TradeState;
  currentTrade: Trade | null;
  showAlert: boolean;
  alertType: AlertType;
  alertOptions?: { updateKind?: "trim" | "generic" | "sl" | "take-profit"; trimPercent?: number };
  channels: DiscordChannel[];
  challenges: Challenge[];
  isTransitioning?: boolean; // True when a state transition is in progress
  // Alert callbacks (for LOADED/ENTERED states)
  onSendAlert: (
    channelIds: string[],
    challengeIds: string[],
    comment?: string,
    priceOverrides?: PriceOverrides
  ) => void;
  onEnterAndAlert: (
    channelIds: string[],
    challengeIds: string[],
    comment?: string,
    priceOverrides?: PriceOverrides
  ) => void;
  onCancelAlert: () => void;
  onUnload: () => void;
  // Trade action callbacks
  onEnter?: () => void;
  onTrim: (trimPercent?: number) => void;
  onMoveSL: () => void;
  onTrailStop: () => void;
  onAdd: () => void;
  onExit: (sendAlert?: boolean) => void;
  onTakeProfit: (sendAlert?: boolean) => void;
  // Setup mode props - Always passed, ActionRail decides when to use based on tradeState
  // focusedSymbol can be null when no symbol is selected
  setupMode?: {
    focusedSymbol: string | null;
    activeContract: Contract | null;
    recommendedContract: Contract | null;
    contractSource: "recommended" | "manual" | null;
    currentPrice: number;
    tradeType: "Scalp" | "Day" | "Swing" | "LEAP";
    isTransitioning?: boolean; // True when a state transition is in progress
    onLoadAndAlert: (channelIds: string[], challengeIds: string[]) => void;
    onEnterAndAlert: (channelIds: string[], challengeIds: string[]) => void;
    onDiscard: () => void;
    onRevertToRecommended?: () => void;
  };
}

// ============================================================================
// Main Component
// ============================================================================

export function ActionRail({
  tradeState,
  currentTrade,
  showAlert,
  alertType,
  alertOptions,
  channels,
  challenges,
  onSendAlert,
  onEnterAndAlert,
  onCancelAlert,
  onUnload,
  onEnter,
  onTrim,
  onMoveSL,
  onTrailStop,
  onAdd,
  onExit,
  onTakeProfit,
  setupMode,
}: ActionRailProps) {
  // Track if Discord composer is expanded
  const [discordExpanded, setDiscordExpanded] = useState(false);

  // Auto-expand Discord composer when showAlert is true (e.g., after contract selection)
  // This ensures the alert is editable immediately
  useEffect(() => {
    if (showAlert) {
      setDiscordExpanded(true);
    }
  }, [showAlert]);

  // Determine which mode we're in based on BOTH tradeState and currentTrade.state
  // Use currentTrade.state as the source of truth when it exists, since it's directly from the trade object
  // This fixes race conditions where tradeState (from derived selectors) lags behind the actual trade state
  const effectiveTradeState = currentTrade?.state ?? tradeState;

  const isSetupMode = effectiveTradeState === "WATCHING" && setupMode?.focusedSymbol;
  const isLoadedMode = effectiveTradeState === "LOADED" && currentTrade;
  const isManageMode = effectiveTradeState === "ENTERED" && currentTrade;
  const isExitedMode = effectiveTradeState === "EXITED" && currentTrade;
  // Show trade content for any persisted trade state (LOADED/ENTERED/EXITED)
  const hasTradeContent = currentTrade != null;

  return (
    <div className="w-[30rem] flex-shrink-0 border-l border-[var(--border-hairline)] flex flex-col h-full bg-[var(--surface-1)] overflow-hidden">
      {/* State Badge - Always at top, use effective state for consistency */}
      <ActionRailStateBadge state={effectiveTradeState} />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* WATCHING + symbol focus → Setup Mode */}
        {isSetupMode ? (
          <SetupModeContent setupMode={setupMode!} channels={channels} challenges={challenges} />
        ) : /* ENTERED state → Manage Mode */
        isManageMode ? (
          <>
            {/* Show Discord Composer when showAlert is true (Take Profit / Exit) */}
            {showAlert ? (
              <ActionRailDiscord
                trade={currentTrade}
                channels={channels}
                challenges={challenges}
                showAlert={showAlert}
                alertType={alertType}
                alertOptions={alertOptions}
                expanded={true}
                onToggleExpanded={() => {}}
                onSendAlert={onSendAlert}
                onEnterAndAlert={onEnterAndAlert}
                onCancelAlert={onCancelAlert}
              />
            ) : (
              <ActionRailManage
                trade={currentTrade!}
                channels={channels}
                challenges={challenges}
                onTrim={(percent) => onTrim(percent)}
                onMoveSLToBreakeven={() => onMoveSL()}
                onTrailStop={onTrailStop}
                onAdd={onAdd}
                onExit={(sendAlert) => onExit(sendAlert)}
                onTakeProfit={(sendAlert) => onTakeProfit(sendAlert)}
              />
            )}
          </>
        ) : /* LOADED/EXITED → Standard content */
        hasTradeContent ? (
          <>
            {/* Risk Box - Visible when trade exists */}
            {currentTrade && <ActionRailRiskBox trade={currentTrade} />}

            {/* Discord Controls - Force expanded for LOADED state (user needs Enter Trade buttons) */}
            <ActionRailDiscord
              trade={currentTrade}
              channels={channels}
              challenges={challenges}
              showAlert={showAlert}
              alertType={alertType}
              alertOptions={alertOptions}
              expanded={!!isLoadedMode || discordExpanded}
              onToggleExpanded={() => !isLoadedMode && setDiscordExpanded(!discordExpanded)}
              onSendAlert={onSendAlert}
              onEnterAndAlert={onEnterAndAlert}
              onCancelAlert={onCancelAlert}
            />

            {/* Action Buttons - Only for EXITED state (LOADED uses HDAlertComposer buttons) */}
            {isExitedMode && (
              <ActionRailActions
                tradeState={tradeState}
                currentTrade={currentTrade}
                onEnter={onEnter}
                onUnload={onUnload}
                onTrim={onTrim}
                onMoveSL={onMoveSL}
                onTrailStop={onTrailStop}
                onAdd={onAdd}
                onExit={onExit}
                onTakeProfit={onTakeProfit}
              />
            )}
          </>
        ) : (
          <EmptyRailState tradeState={tradeState} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Setup Mode Content (WATCHING state with symbol focus)
// ============================================================================

interface SetupModeContentProps {
  setupMode: NonNullable<ActionRailProps["setupMode"]>;
  channels: DiscordChannel[];
  challenges: Challenge[];
}

function SetupModeContent({ setupMode, channels, challenges }: SetupModeContentProps) {
  const {
    focusedSymbol,
    activeContract,
    recommendedContract,
    contractSource,
    currentPrice,
    tradeType,
    isTransitioning = false,
    onLoadAndAlert,
    onEnterAndAlert,
    onDiscard,
    onRevertToRecommended,
  } = setupMode;

  // Get default channels from settings
  const getDefaultChannels = useSettingsStore((s) => s.getDefaultChannels);
  const getActiveChallenges = useSettingsStore((s) => s.getActiveChallenges);

  // Track selected channels and challenges
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);

  // Initialize with defaults when contract changes
  useEffect(() => {
    if (activeContract) {
      const defaults = getDefaultChannels("load");
      if (defaults.length > 0) {
        setSelectedChannels(defaults.map((c) => c.id));
      } else if (channels.length > 0) {
        setSelectedChannels([channels[0].id]);
      }
    } else {
      setSelectedChannels([]);
    }
    setSelectedChallenges([]);
  }, [activeContract?.id, getDefaultChannels, channels]);

  // Toggle channel selection
  const toggleChannel = (channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId]
    );
  };

  // Toggle challenge selection
  const toggleChallenge = (challengeId: string) => {
    setSelectedChallenges((prev) =>
      prev.includes(challengeId) ? prev.filter((id) => id !== challengeId) : [...prev, challengeId]
    );
  };

  // Calculate contract metrics
  const contractMetrics = useMemo(() => {
    if (!activeContract) return null;

    const typeLabel = activeContract.type === "C" ? "CALL" : "PUT";
    const dte = activeContract.daysToExpiry ?? 0;
    const dteInfo = fmtDTE(dte);
    const mid = activeContract.mid ?? 0;
    const spread = activeContract.ask - activeContract.bid;
    const spreadPct = mid > 0 ? (spread / mid) * 100 : 0;

    return {
      typeLabel,
      dte,
      dteInfo,
      mid,
      spread,
      spreadPct,
      delta: activeContract.delta,
      theta: activeContract.theta,
      iv: activeContract.iv,
      volume: activeContract.volume,
      openInterest: activeContract.openInterest,
    };
  }, [activeContract]);

  const hasChannelsSelected = selectedChannels.length > 0;
  const activeChallenges = getActiveChallenges();
  const isManualSelection = contractSource === "manual";

  return (
    <div className="flex flex-col h-full animate-fade-in-up">
      {/* Contract Tile */}
      {activeContract && contractMetrics && (
        <div className="p-3 border-b border-[var(--border-hairline)]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
                Contract
              </span>
              {contractSource && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                    contractSource === "recommended"
                      ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
                      : "bg-[var(--surface-3)] text-[var(--text-muted)]"
                  )}
                >
                  {contractSource === "recommended" && <Star className="w-2.5 h-2.5" />}
                  {contractSource === "recommended" ? "Recommended" : "Manual"}
                </span>
              )}
            </div>
            {isManualSelection && onRevertToRecommended && recommendedContract && (
              <button
                onClick={onRevertToRecommended}
                className="flex items-center gap-1 text-[10px] text-[var(--text-faint)] hover:text-[var(--brand-primary)] transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Revert
              </button>
            )}
          </div>

          {/* Contract Details */}
          <div className="p-2 rounded bg-[var(--surface-2)] border border-[var(--border-hairline)]">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-sm font-semibold text-[var(--text-high)]">
                {focusedSymbol ?? ""} ${activeContract.strike}
                {contractMetrics.typeLabel[0]}
              </span>
              <span className={cn("text-xs font-medium", contractMetrics.dteInfo.className)}>
                {contractMetrics.dteInfo.text}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-2">
              <div>
                <div className="text-[10px] text-[var(--text-faint)] uppercase">Mid</div>
                <div className="text-xs font-medium text-[var(--text-high)]">
                  ${formatPrice(contractMetrics.mid)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[var(--text-faint)] uppercase">Delta</div>
                <div className="text-xs font-medium text-[var(--text-high)]">
                  {contractMetrics.delta?.toFixed(2) ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[var(--text-faint)] uppercase">Spread</div>
                <div
                  className={cn(
                    "text-xs font-medium",
                    contractMetrics.spreadPct > 5
                      ? "text-[var(--accent-negative)]"
                      : "text-[var(--text-high)]"
                  )}
                >
                  {contractMetrics.spreadPct.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Secondary metrics */}
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[var(--border-hairline)]">
              {contractMetrics.theta && (
                <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                  <Clock className="w-3 h-3" />Θ {contractMetrics.theta.toFixed(2)}
                </div>
              )}
              {contractMetrics.iv && (
                <div className="text-[10px] text-[var(--text-muted)]">
                  IV {(contractMetrics.iv * 100).toFixed(0)}%
                </div>
              )}
              {contractMetrics.volume > 0 && (
                <div className="text-[10px] text-[var(--text-muted)]">
                  Vol {contractMetrics.volume.toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {/* Trade Type Badge */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-[var(--text-faint)] uppercase">Type:</span>
            <span
              className={chipStyle(
                tradeType === "Scalp"
                  ? "fail"
                  : tradeType === "Day"
                    ? "warn"
                    : tradeType === "Swing"
                      ? "brand"
                      : "success"
              )}
            >
              {tradeType}
            </span>
          </div>
        </div>
      )}

      {/* Targets Section (simplified) */}
      {activeContract && (
        <div className="p-3 border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-1.5 mb-2">
            <Target className="w-3 h-3 text-[var(--text-muted)]" />
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              Quick Targets
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className={chipStyle("success")}>TP1: +20%</span>
            <span className={chipStyle("success")}>TP2: +40%</span>
            <span className={chipStyle("fail")}>SL: -25%</span>
          </div>
        </div>
      )}

      {/* Discord Channels */}
      {channels.length > 0 && activeContract && (
        <div className="p-3 border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-1.5 mb-2">
            <Hash className="w-3 h-3 text-[var(--text-muted)]" />
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              Discord
            </span>
            {!hasChannelsSelected && (
              <span className="text-[10px] text-[var(--accent-negative)]">(required)</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {channels.slice(0, 4).map((channel) => (
              <button
                key={channel.id}
                onClick={() => toggleChannel(channel.id)}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all hover-lift-sm",
                  selectedChannels.includes(channel.id)
                    ? "bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] border border-[var(--brand-primary)]/30"
                    : "bg-[var(--surface-3)] text-[var(--text-muted)] border border-[var(--border-hairline)] hover:border-[var(--text-faint)]"
                )}
              >
                #{channel.name}
              </button>
            ))}
            {channels.length > 4 && (
              <span className="px-2 py-1 text-[10px] text-[var(--text-faint)]">
                +{channels.length - 4}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Challenges (Optional) */}
      {activeChallenges.length > 0 && activeContract && (
        <div className="p-3 border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-1.5 mb-2">
            <Trophy className="w-3 h-3 text-[var(--text-muted)]" />
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              Challenges
            </span>
            <span className="text-[10px] text-[var(--text-faint)]">(optional)</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeChallenges.slice(0, 3).map((challenge) => (
              <button
                key={challenge.id}
                onClick={() => toggleChallenge(challenge.id)}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all hover-lift-sm",
                  selectedChallenges.includes(challenge.id)
                    ? "bg-[var(--accent-positive)]/20 text-[var(--accent-positive)] border border-[var(--accent-positive)]/30"
                    : "bg-[var(--surface-3)] text-[var(--text-muted)] border border-[var(--border-hairline)] hover:border-[var(--text-faint)]"
                )}
              >
                {challenge.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {activeContract && (
        <div className="p-3 mt-auto space-y-2">
          {/* Load and Alert - Primary */}
          <button
            onClick={() => {
              console.warn("[ActionRail] Load and Alert clicked", {
                selectedChannels,
                selectedChallenges,
                hasChannelsSelected,
                activeContract: activeContract?.id,
                isTransitioning,
              });
              if (!isTransitioning) {
                onLoadAndAlert(selectedChannels, selectedChallenges);
              }
            }}
            disabled={!hasChannelsSelected || isTransitioning}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2.5 rounded font-medium text-sm transition-all btn-press",
              hasChannelsSelected && !isTransitioning
                ? "bg-[var(--brand-primary)] text-black hover:bg-[var(--brand-primary-hover)]"
                : "bg-[var(--surface-3)] text-[var(--text-faint)] cursor-not-allowed"
            )}
          >
            {isTransitioning ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {isTransitioning ? "Loading..." : "Load and Alert"}
          </button>

          {/* Enter and Alert - Secondary */}
          <button
            onClick={() => {
              if (!isTransitioning) {
                onEnterAndAlert(selectedChannels, selectedChallenges);
              }
            }}
            disabled={!hasChannelsSelected || isTransitioning}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2.5 rounded font-medium text-sm transition-all btn-press",
              hasChannelsSelected && !isTransitioning
                ? "bg-[var(--accent-positive)] text-white hover:bg-[var(--accent-positive)]/90"
                : "bg-[var(--surface-3)] text-[var(--text-faint)] cursor-not-allowed"
            )}
          >
            {isTransitioning ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {isTransitioning ? "Entering..." : "Enter and Alert"}
          </button>

          {/* Dismiss - Tertiary */}
          <button
            onClick={onDiscard}
            disabled={isTransitioning}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2 rounded font-medium text-xs transition-all",
              isTransitioning
                ? "text-[var(--text-faint)] cursor-not-allowed"
                : "text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-3)]"
            )}
          >
            <X className="w-3.5 h-3.5" />
            Dismiss
          </button>
        </div>
      )}

      {/* Empty state when no contract */}
      {!activeContract && (
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div className="space-y-2">
            <div className="text-[var(--text-muted)] text-sm">Select a contract</div>
            <p className="text-[var(--text-faint)] text-xs">
              Choose from the options chain to load or enter
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Empty Rail State (contextual message based on trade state)
// ============================================================================

function EmptyRailState({ tradeState }: { tradeState: TradeState }) {
  // When WATCHING, user has selected a symbol but no trade yet
  // The center panel (NowPanelSymbol) has contract analysis tiles
  // This rail will show setup content when a contract is selected
  if (tradeState === "WATCHING") {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="space-y-2">
          <div className="text-[var(--text-muted)] text-sm">Select a contract</div>
          <p className="text-[var(--text-faint)] text-xs">
            Choose from the options chain to load or enter a trade
          </p>
        </div>
      </div>
    );
  }

  // Default: no symbol selected
  return (
    <div className="flex-1 flex items-center justify-center p-6 text-center">
      <div className="space-y-2">
        <div className="text-[var(--text-muted)] text-sm">Select a symbol</div>
        <p className="text-[var(--text-faint)] text-xs">
          Click a symbol from watchlist to get started
        </p>
      </div>
    </div>
  );
}

export default ActionRail;
