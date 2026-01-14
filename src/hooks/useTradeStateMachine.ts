import { useState, useCallback, useMemo } from "react";
import {
  Trade,
  Ticker,
  Contract,
  TradeState,
  AlertType,
  TradeUpdate,
  DiscordChannel,
} from "../types";
import type { PriceOverrides } from "../components/hd/alerts/HDAlertComposer";
import type { KeyLevels } from "../lib/riskEngine/types";
import { calculateRisk } from "../lib/riskEngine/calculator";
import {
  inferTradeTypeByDTE,
  DEFAULT_DTE_THRESHOLDS,
  RISK_PROFILES,
} from "../lib/riskEngine/profiles";
import { adjustProfileByConfluence } from "../lib/riskEngine/confluenceAdjustment";
import { useAppToast } from "./useAppToast";
import { useAuth } from "../contexts/AuthContext";
import { useDiscord } from "./useDiscord";
import { useSettingsStore } from "../stores/settingsStore";
import { useTradeStore } from "../stores/tradeStore";
import {
  createTradeApi,
  updateTradeApi,
  deleteTradeApi,
  addTradeUpdateApi,
} from "../lib/api/tradeApi";
import { createTradeThread, addThreadUpdateBySymbol } from "../lib/api/tradeThreadApi";
import type { TradeThreadUpdateType, TradeThreadUpdatePayload } from "../types/tradeThreads";
import { recordAlertHistory } from "../lib/supabase/database";
import { discordAlertLimiter, formatWaitTime } from "../lib/utils/rateLimiter";
import { roundPrice } from "../lib/utils";
import { getInitialConfluence } from "./useTradeConfluenceMonitor";
import { tradeHookLogger as log } from "../lib/utils/logger";
import { calculateNetPnLPercent } from "../services/pnlCalculator";
import { getEntryPriceFromUpdates } from "../lib/tradePnl";
import { ActiveTradePollingService } from "../services/ActiveTradePollingService";

// Domain layer imports
import {
  startTradeAction,
  commitTradeAction,
  validateTransition,
  intentToAlertType,
  intentToUpdateKind,
  type TradeActionIntent,
  type AlertDraft,
} from "../domain/tradeActions";

// ============================================================================
// TRADE STATE MACHINE - Database-First Architecture
// ============================================================================
//
// This hook provides actions for the trade lifecycle.
// State is managed by the Zustand store (tradeStore.ts) as the SINGLE SOURCE OF TRUTH.
//
// Key principles:
// 1. NO local state duplication - all trade state comes from the store
// 2. NO circular sync - store is updated directly, not through callbacks
// 3. Actions persist to DB FIRST, then reload from store
// 4. UI-only state (activeTicker, contracts, showAlert) is kept local
// ============================================================================

// Import from centralized viewRouter
import { type FocusTarget, deriveFocus } from "../domain/viewRouter";

// Re-export for backward compatibility
export type { FocusTarget };

// Helper to get risk defaults from TP settings store
function getRiskDefaultsFromStore() {
  const { tpSettings } = useSettingsStore.getState();
  return {
    mode: tpSettings.tpMode,
    tpPercent: tpSettings.tpPercent,
    slPercent: tpSettings.slPercent,
    dteThresholds: DEFAULT_DTE_THRESHOLDS,
  };
}

interface UseTradeStateMachineProps {
  onExitedTrade?: (trade: Trade) => void;
  onEnteredTrade?: (trade: Trade) => void;
  onMobileTabChange?: (tab: "live" | "active" | "history" | "settings") => void;
  keyLevels?: KeyLevels | null;
}

interface TradeStateMachineState {
  activeTicker: Ticker | null;
  contracts: Contract[];
  currentTrade: Trade | null;
  previewTrade: Trade | null; // Preview trade (WATCHING state only, not persisted)
  tradeState: TradeState;
  alertType: AlertType;
  alertOptions: { updateKind?: "trim" | "generic" | "sl" | "take-profit"; trimPercent?: number };
  showAlert: boolean;
  activeTrades: Trade[];
  focus: FocusTarget;
  isTransitioning: boolean; // True when a state transition is in progress (prevents duplicate actions)
  // Domain layer state
  alertDraft: AlertDraft | null; // New canonical draft from domain layer
}

interface TradeStateMachineActions {
  handleTickerClick: (ticker: Ticker) => void;
  handleContractSelect: (
    contract: Contract,
    options?: {
      confluenceData?: { trend?: any; volatility?: any; liquidity?: any };
      voiceReasoning?: string;
      explicitTicker?: Ticker;
      tradeType?: "scalp" | "day" | "swing";
    }
  ) => void;
  /** Directly loads strategy to LOADED state (persists to DB without alert) */
  handleLoadStrategy: (
    contract: Contract,
    options?: {
      confluenceData?: { trend?: any; volatility?: any; liquidity?: any };
      voiceReasoning?: string;
      explicitTicker?: Ticker;
      tradeType?: "scalp" | "day" | "swing";
    }
  ) => void;
  handleActiveTradeClick: (trade: Trade, watchlist: Ticker[]) => void;
  handleSendAlert: (
    channelIds: string[],
    challengeIds: string[],
    comment?: string,
    priceOverrides?: PriceOverrides
  ) => void;
  handleLoadAndAlert: (
    channelIds: string[],
    challengeIds: string[],
    comment?: string,
    priceOverrides?: PriceOverrides
  ) => void;
  handleEnterAndAlert: (
    channelIds: string[],
    challengeIds: string[],
    comment?: string,
    priceOverrides?: PriceOverrides
  ) => void;
  handleEnterTrade: (
    channelIds?: string[],
    challengeIds?: string[],
    comment?: string,
    priceOverrides?: PriceOverrides
  ) => void;
  handleCancelAlert: () => void;
  handleDiscard: () => void;
  handleUnloadTrade: () => void;
  handleTrim: (trimPercent?: number) => void;
  handleTakeProfit: (sendAlert?: boolean) => void;
  handleUpdate: () => void;
  handleUpdateSL: () => void;
  handleTrailStop: () => void;
  handleAdd: () => void;
  handleExit: (sendAlert?: boolean) => void;
  setActiveTicker: (ticker: Ticker | null) => void;
  setContracts: (contracts: Contract[]) => void;
  setAlertType: (type: AlertType) => void;
}

export function useTradeStateMachine({
  onExitedTrade,
  onEnteredTrade,
  onMobileTabChange,
  keyLevels,
}: UseTradeStateMachineProps = {}): TradeStateMachineState & { actions: TradeStateMachineActions } {
  const toast = useAppToast();
  const discord = useDiscord();
  const auth = useAuth();
  const userId = auth?.user?.id || "00000000-0000-0000-0000-000000000001";

  // ========================================
  // STORE SELECTORS - Single Source of Truth
  // ========================================
  // Subscribe to store state - these trigger re-renders when values change
  const activeTrades = useTradeStore((s) => s.activeTrades);
  const previewTrade = useTradeStore((s) => s.previewTrade);
  const setFocusedTrade = useTradeStore((s) => s.setFocusedTrade);
  const loadTrades = useTradeStore((s) => s.loadTrades);

  // Subscribe to currentTradeId directly - this ensures focus computation reacts
  // when setFocusedTrade(null) clears the trade ID
  const currentTradeId = useTradeStore((s) => s.currentTradeId);

  // Use store's derived selectors - SINGLE SOURCE OF TRUTH (no duplicate logic)
  // These call into the store's getCurrentTrade() and getTradeState() methods
  const currentTrade = useTradeStore((s) => s.getCurrentTrade());
  const tradeState: TradeState = useTradeStore((s) => s.getTradeState());

  // UI State from store - centralized to prevent race conditions
  const isTransitioning = useTradeStore((s) => s.ui.isTransitioning);
  const setIsTransitioning = useTradeStore((s) => s.setIsTransitioning);

  // ========================================
  // LOCAL UI STATE (component-specific, not shared)
  // ========================================
  const [activeTicker, setActiveTicker] = useState<Ticker | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [alertType, setAlertType] = useState<AlertType>("load");
  const [alertOptions, setAlertOptions] = useState<{
    updateKind?: "trim" | "generic" | "sl" | "take-profit";
    trimPercent?: number;
  }>({});
  const [showAlert, setShowAlert] = useState(false);
  const [_isCreatingTrade, setIsCreatingTrade] = useState(false); // Unused, kept for potential future use

  // Domain layer state - canonical alert draft
  const [alertDraft, setAlertDraft] = useState<AlertDraft | null>(null);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;

  // ========================================
  // HELPER FUNCTIONS
  // ========================================
  const openAlertComposer = useCallback(
    (
      type: AlertType,
      options?: { updateKind?: "trim" | "generic" | "sl" | "take-profit"; trimPercent?: number }
    ) => {
      setAlertType(type);
      setAlertOptions(options || {});
      setShowAlert(true);
    },
    []
  );

  const showAlertToast = useCallback(
    (type: string, ticker: string, channels: DiscordChannel[]) => {
      const channelNames = channels.map((c) => c.name).join(", ");
      const title = `${type.toUpperCase()} · ${ticker}`;
      const desc = channelNames ? `Sent to: ${channelNames}` : "Alert dispatched";
      toast.success(title, { description: desc } as any);
    },
    [toast]
  );

  const getDiscordChannelsForAlert = useCallback(
    (channelIds: string[], challengeIds: string[]): DiscordChannel[] => {
      const settingsStore = useSettingsStore.getState();
      const channels: DiscordChannel[] = [];

      channelIds.forEach((id) => {
        const channel = settingsStore.getChannelById(id);
        if (channel?.webhookUrl) {
          channels.push(channel);
        }
      });

      challengeIds.forEach((challengeId) => {
        const challenge = settingsStore.getChallengeById(challengeId);
        if (challenge?.defaultChannel) {
          const channel = settingsStore.discordChannels.find(
            (ch) => ch.name.toLowerCase() === challenge.defaultChannel.toLowerCase()
          );
          if (channel?.webhookUrl && !channels.some((c) => c.id === channel.id)) {
            channels.push(channel);
          }
        }
      });

      return channels;
    },
    []
  );

  // ========================================
  // ACTIONS
  // ========================================

  const handleTickerClick = useCallback(
    (ticker: Ticker) => {
      log.info("Ticker clicked", { symbol: ticker.symbol, last: ticker.last });
      setActiveTicker(ticker);
      setFocusedTrade(null); // Atomic clear of both previewTrade and currentTradeId
    },
    [setFocusedTrade]
  );

  const handleActiveTradeClick = useCallback(
    (trade: Trade, watchlist: Ticker[]) => {
      log.info("Active trade clicked", {
        tradeId: trade.id,
        ticker: trade.ticker,
        state: trade.state,
      });

      // Focus on this trade in the store (atomic update)
      setFocusedTrade(trade);

      // Find and set the activeTicker so the chart renders
      const ticker = watchlist.find((w) => w.symbol === trade.ticker);
      if (ticker) {
        setActiveTicker(ticker);
      } else {
        setActiveTicker({
          id: trade.ticker,
          symbol: trade.ticker,
          last: trade.currentPrice || trade.entryPrice || 0,
          change: 0,
          changePercent: 0,
        });
      }

      // CRITICAL FIX: Don't automatically set alertType="exit" for ENTERED trades
      // This was causing immediate exits - let user explicitly choose action via ActionRail buttons
      // Only clear any existing draft to prevent stale state
      setAlertDraft(null);
      setShowAlert(false);

      log.info("Trade focused, alertType NOT auto-set", {
        tradeId: trade.id,
        state: trade.state,
        reason: "User must explicitly choose action via ActionRail",
      });
    },
    [setFocusedTrade]
  );

  const handleContractSelect = useCallback(
    async (
      contract: Contract,
      options?: {
        confluenceData?: { trend?: any; volatility?: any; liquidity?: any };
        voiceReasoning?: string;
        explicitTicker?: Ticker;
        tradeType?: "scalp" | "day" | "swing";
      }
    ) => {
      const ticker = options?.explicitTicker || activeTicker;
      const tradeTypeOverride = options?.tradeType;
      const confluenceData = options?.confluenceData;
      const voiceReasoning = options?.voiceReasoning;

      if (!ticker) {
        log.warn("Contract select failed: No ticker selected");
        toast.error("Unable to create trade: No ticker selected");
        return;
      }

      const correlationId = log.actionStart("handleContractSelect", {
        ticker: ticker.symbol,
        strike: contract.strike,
        type: contract.type,
        expiry: contract.expiry,
        mid: contract.mid,
      });

      setIsCreatingTrade(true);

      try {
        // Calculate initial TP/SL (round to avoid floating point artifacts)
        let targetPrice = roundPrice(contract.mid * 1.5);
        let stopLoss = roundPrice(contract.mid * 0.5);
        const underlyingPrice = ticker.last;
        let targetUnderlyingPrice: number | undefined;
        let stopUnderlyingPrice: number | undefined;

        // Determine trade type: Manual override > DTE-inferred
        // riskEngineTradeType = uppercase for calculateRisk ("SCALP", "DAY", "SWING")
        // displayTradeType = title case for Trade object ("Scalp", "Day", "Swing")
        const inferredRiskType = inferTradeTypeByDTE(
          contract.expiry,
          new Date(),
          DEFAULT_DTE_THRESHOLDS
        );
        const riskEngineTradeType = tradeTypeOverride
          ? (tradeTypeOverride.toUpperCase() as "SCALP" | "DAY" | "SWING")
          : inferredRiskType;
        const displayTradeType: Trade["tradeType"] = tradeTypeOverride
          ? tradeTypeOverride === "scalp"
            ? "Scalp"
            : tradeTypeOverride === "swing"
              ? "Swing"
              : "Day"
          : inferredRiskType === "SCALP"
            ? "Scalp"
            : inferredRiskType === "SWING"
              ? "Swing"
              : inferredRiskType === "LEAP"
                ? "LEAP"
                : "Day";

        try {
          // Risk profile computed but not yet integrated into calculateRisk
          // TODO: Pass adjusted profile to risk calculations
          let _riskProfile = RISK_PROFILES[riskEngineTradeType];
          if (
            confluenceData &&
            (confluenceData.trend || confluenceData.volatility || confluenceData.liquidity)
          ) {
            _riskProfile = adjustProfileByConfluence(_riskProfile, confluenceData);
          }

          const risk = calculateRisk({
            entryPrice: contract.mid,
            currentUnderlyingPrice: underlyingPrice,
            currentOptionMid: contract.mid,
            keyLevels: keyLevels || {
              preMarketHigh: 0,
              preMarketLow: 0,
              orbHigh: 0,
              orbLow: 0,
              priorDayHigh: 0,
              priorDayLow: 0,
              vwap: 0,
              vwapUpperBand: 0,
              vwapLowerBand: 0,
              bollingerUpper: 0,
              bollingerLower: 0,
              weeklyHigh: 0,
              weeklyLow: 0,
              monthlyHigh: 0,
              monthlyLow: 0,
              quarterlyHigh: 0,
              quarterlyLow: 0,
              yearlyHigh: 0,
              yearlyLow: 0,
            },
            expirationISO: contract.expiry,
            tradeType: riskEngineTradeType,
            delta: contract.delta ?? 0.5,
            gamma: contract.gamma ?? 0,
            defaults: getRiskDefaultsFromStore(),
          });
          if (risk.targetPrice) targetPrice = risk.targetPrice;
          if (risk.stopLoss) stopLoss = risk.stopLoss;
          if (risk.targetUnderlyingPrice) targetUnderlyingPrice = risk.targetUnderlyingPrice;
          if (risk.stopUnderlyingPrice) stopUnderlyingPrice = risk.stopUnderlyingPrice;
        } catch {
          /* fallback silently */
        }

        // Get initial confluence
        const direction: "LONG" | "SHORT" = contract.type === "C" ? "LONG" : "SHORT";
        const initialConfluence = await getInitialConfluence(
          ticker.symbol,
          direction,
          keyLevels || null
        );

        // Create preview trade (NOT persisted to DB yet)
        const previewTradeObj: Trade = {
          id: crypto.randomUUID(),
          ticker: ticker.symbol,
          state: "WATCHING",
          contract,
          tradeType: displayTradeType,
          targetPrice,
          stopLoss,
          movePercent: 0,
          discordChannels: [],
          challenges: [],
          updates: [],
          confluence: initialConfluence || undefined,
          confluenceUpdatedAt: initialConfluence ? new Date() : undefined,
          underlyingPriceAtLoad: underlyingPrice,
          targetUnderlyingPrice,
          stopUnderlyingPrice,
          voiceContext: voiceReasoning,
        };

        // Set as preview in store (single source of truth) - atomic update
        setFocusedTrade(previewTradeObj);

        // Use domain layer to create draft with proper defaults
        const draft = startTradeAction("LOAD", { trade: previewTradeObj });
        if (draft) {
          setAlertDraft(draft);
        }

        // Backward compatibility: set legacy state
        setAlertType("load");
        setShowAlert(true);

        log.actionEnd("handleContractSelect", correlationId, {
          previewTradeId: previewTradeObj.id,
          ticker: ticker.symbol,
          targetPrice,
          stopLoss,
        });
      } catch (error) {
        log.actionFail("handleContractSelect", correlationId, error, { ticker: ticker.symbol });
        toast.error("Failed to create trade", {
          description: error instanceof Error ? error.message : "Unknown error occurred",
        } as any);
        setFocusedTrade(null); // Atomic clear on error
        setShowAlert(false);
      } finally {
        setIsCreatingTrade(false);
      }
    },
    [activeTicker, toast, keyLevels, setFocusedTrade]
  );

  // ========================================
  // LOAD STRATEGY - Directly persist to LOADED (no alert)
  // ========================================
  const handleLoadStrategy = useCallback(
    async (
      contract: Contract,
      options?: {
        confluenceData?: { trend?: any; volatility?: any; liquidity?: any };
        voiceReasoning?: string;
        explicitTicker?: Ticker;
        tradeType?: "scalp" | "day" | "swing";
      }
    ) => {
      const ticker = options?.explicitTicker || activeTicker;
      const tradeTypeOverride = options?.tradeType;
      const confluenceData = options?.confluenceData;
      const voiceReasoning = options?.voiceReasoning;

      if (!ticker) {
        log.warn("Load strategy failed: No ticker selected");
        toast.error("Unable to load trade: No ticker selected");
        return;
      }

      // GUARD: Prevent duplicate transitions
      if (isTransitioning) {
        log.warn("Load strategy blocked: transition already in progress");
        return;
      }

      const correlationId = log.actionStart("handleLoadStrategy", {
        ticker: ticker.symbol,
        strike: contract.strike,
        type: contract.type,
        expiry: contract.expiry,
      });

      setIsTransitioning(true);

      try {
        // Calculate initial TP/SL (round to avoid floating point artifacts)
        let targetPrice = roundPrice(contract.mid * 1.5);
        let stopLoss = roundPrice(contract.mid * 0.5);
        const underlyingPrice = ticker.last;
        let targetUnderlyingPrice: number | undefined;
        let stopUnderlyingPrice: number | undefined;

        // Determine trade type: Manual override > DTE-inferred
        const inferredRiskType = inferTradeTypeByDTE(
          contract.expiry,
          new Date(),
          DEFAULT_DTE_THRESHOLDS
        );
        const riskEngineTradeType = tradeTypeOverride
          ? (tradeTypeOverride.toUpperCase() as "SCALP" | "DAY" | "SWING")
          : inferredRiskType;
        const displayTradeType: Trade["tradeType"] = tradeTypeOverride
          ? tradeTypeOverride === "scalp"
            ? "Scalp"
            : tradeTypeOverride === "swing"
              ? "Swing"
              : "Day"
          : inferredRiskType === "SCALP"
            ? "Scalp"
            : inferredRiskType === "SWING"
              ? "Swing"
              : inferredRiskType === "LEAP"
                ? "LEAP"
                : "Day";

        try {
          let _riskProfile = RISK_PROFILES[riskEngineTradeType];
          if (
            confluenceData &&
            (confluenceData.trend || confluenceData.volatility || confluenceData.liquidity)
          ) {
            _riskProfile = adjustProfileByConfluence(_riskProfile, confluenceData);
          }

          const risk = calculateRisk({
            entryPrice: contract.mid,
            currentUnderlyingPrice: underlyingPrice,
            currentOptionMid: contract.mid,
            keyLevels: keyLevels || {
              preMarketHigh: 0,
              preMarketLow: 0,
              orbHigh: 0,
              orbLow: 0,
              priorDayHigh: 0,
              priorDayLow: 0,
              vwap: 0,
              vwapUpperBand: 0,
              vwapLowerBand: 0,
              bollingerUpper: 0,
              bollingerLower: 0,
              weeklyHigh: 0,
              weeklyLow: 0,
              monthlyHigh: 0,
              monthlyLow: 0,
              quarterlyHigh: 0,
              quarterlyLow: 0,
              yearlyHigh: 0,
              yearlyLow: 0,
            },
            expirationISO: contract.expiry,
            tradeType: riskEngineTradeType,
            delta: contract.delta ?? 0.5,
            gamma: contract.gamma ?? 0,
            defaults: getRiskDefaultsFromStore(),
          });
          if (risk.targetPrice) targetPrice = risk.targetPrice;
          if (risk.stopLoss) stopLoss = risk.stopLoss;
          if (risk.targetUnderlyingPrice) targetUnderlyingPrice = risk.targetUnderlyingPrice;
          if (risk.stopUnderlyingPrice) stopUnderlyingPrice = risk.stopUnderlyingPrice;
        } catch {
          /* fallback silently */
        }

        // Get initial confluence
        const direction: "LONG" | "SHORT" = contract.type === "C" ? "LONG" : "SHORT";
        const initialConfluence = await getInitialConfluence(
          ticker.symbol,
          direction,
          keyLevels || null
        );

        // 1. PERSIST TO DATABASE DIRECTLY AS LOADED
        const dbTrade = await createTradeApi(userId, {
          ticker: ticker.symbol,
          contract,
          tradeType: displayTradeType,
          targetPrice,
          stopLoss,
          status: "loaded",
          discordChannelIds: [],
          challengeIds: [],
          confluence: initialConfluence || undefined,
          confluenceUpdatedAt: initialConfluence ? new Date().toISOString() : undefined,
        });

        // 2. OPTIMISTIC UPDATE - Add to activeTrades immediately
        const loadedTrade: Trade = {
          id: dbTrade.id,
          ticker: ticker.symbol,
          state: "LOADED",
          contract,
          tradeType: displayTradeType,
          targetPrice,
          stopLoss,
          movePercent: 0,
          discordChannels: [],
          challenges: [],
          updates: [],
          confluence: initialConfluence || undefined,
          confluenceUpdatedAt: initialConfluence ? new Date() : undefined,
          underlyingPriceAtLoad: underlyingPrice,
          targetUnderlyingPrice,
          stopUnderlyingPrice,
          voiceContext: voiceReasoning,
        };

        useTradeStore.setState((state) => ({
          activeTrades: [...state.activeTrades, loadedTrade],
          previewTrade: null,
          currentTradeId: dbTrade.id,
        }));

        // Clear alert state since we're not showing alert composer
        setShowAlert(false);
        setAlertType("enter");

        // 3. BACKGROUND RELOAD - Refresh from DB to get any server-side computed data
        loadTrades(userId).catch((err) => {
          log.warn("Background loadTrades failed", { error: err?.message });
        });

        log.transition("SYMBOL", "LOADED", { tradeId: dbTrade.id, ticker: ticker.symbol });
        log.actionEnd("handleLoadStrategy", correlationId, {
          dbTradeId: dbTrade.id,
          ticker: ticker.symbol,
          targetPrice,
          stopLoss,
        });

        toast.success(`${ticker.symbol} strategy loaded`, {
          description: `${contract.strike}${contract.type} ready for entry`,
        });
      } catch (error) {
        log.actionFail("handleLoadStrategy", correlationId, error, { ticker: ticker.symbol });
        toast.error("Failed to load strategy", {
          description: error instanceof Error ? error.message : "Unknown error occurred",
        } as any);
      } finally {
        setIsTransitioning(false);
      }
    },
    [activeTicker, userId, toast, keyLevels, loadTrades, isTransitioning]
  );

  // ========================================
  // LOAD AND ALERT - Persist WATCHING → LOADED
  // ========================================
  const handleLoadAndAlert = useCallback(
    async (
      channelIds: string[],
      challengeIds: string[],
      comment?: string,
      priceOverrides?: PriceOverrides
    ) => {
      // CRITICAL: For WATCHING state, use previewTrade to ensure we load the displayed contract
      // This fixes the bug where clicking "Load and Alert" on a new contract loads the wrong one
      const trade = previewTrade || currentTrade;

      // GUARD: Prevent duplicate transitions
      if (isTransitioning) {
        log.warn("Load blocked: transition already in progress", { tradeId: trade?.id });
        return;
      }

      if (!trade || !userId) {
        log.warn("Load blocked: trade or user missing", { hasTrade: !!trade, hasUserId: !!userId });
        toast.error("Unable to load trade: Trade or user missing");
        return;
      }

      // GUARD: Only allow from WATCHING state
      if (trade.state !== "WATCHING" && tradeState !== "WATCHING") {
        log.warn("Load blocked: invalid state", {
          tradeId: trade.id,
          state: trade.state,
          tradeState,
        });
        toast.error("Trade already loaded or entered");
        return;
      }

      const correlationId = log.actionStart("handleLoadAndAlert", {
        tradeId: trade.id,
        ticker: trade.ticker,
        fromState: trade.state,
        channelCount: channelIds.length,
        challengeCount: challengeIds.length,
      });

      const effectiveTargetPrice = priceOverrides?.targetPrice ?? trade.targetPrice;
      const effectiveStopLoss = priceOverrides?.stopLoss ?? trade.stopLoss;

      setIsTransitioning(true);
      try {
        // 1. PERSIST TO DATABASE FIRST
        const dbTrade = await createTradeApi(userId, {
          ticker: trade.ticker,
          contract: trade.contract,
          tradeType: trade.tradeType,
          targetPrice: effectiveTargetPrice,
          stopLoss: effectiveStopLoss,
          status: "loaded",
          discordChannelIds: channelIds,
          challengeIds: challengeIds,
          setupType: trade.setupType,
          confluence: trade.confluence,
          confluenceUpdatedAt: trade.confluenceUpdatedAt?.toISOString(),
        });

        // 2. OPTIMISTIC UPDATE - Immediately update local state so UI transitions
        // This prevents the race condition where tradeState stays "WATCHING" because
        // loadTrades() is async and activeTrades hasn't been updated yet
        const loadedTrade: Trade = {
          ...trade,
          id: dbTrade.id,
          state: "LOADED",
          discordChannels: channelIds,
          challenges: challengeIds,
          targetPrice: effectiveTargetPrice,
          stopLoss: effectiveStopLoss,
        };

        useTradeStore.setState((state) => ({
          activeTrades: [...state.activeTrades, loadedTrade],
          previewTrade: null,
          currentTradeId: dbTrade.id,
        }));

        setAlertType("enter");
        setShowAlert(false);
        setContracts([]);

        // 3. EXPLICIT CHALLENGE LINKING - Ensures junction table is populated
        // This fixes race condition where server's async insert may not complete
        if (challengeIds.length > 0) {
          try {
            await useTradeStore.getState().linkTradeToChallenges(dbTrade.id, challengeIds);
          } catch (error) {
            console.warn("[Trade] Failed to link challenges:", error);
          }
        }

        // 4. BACKGROUND RELOAD - Refresh from DB to get any server-side computed data
        // Fire and forget - the optimistic update already updated the UI
        loadTrades(userId).catch((err) => {
          log.warn("Background loadTrades failed", { error: err?.message });
        });

        // 4. CREATE TRADE THREAD FOR MEMBER SUBSCRIPTIONS
        try {
          await createTradeThread({
            symbol: trade.ticker,
            contractId:
              trade.contract.id ||
              `${trade.ticker}_${trade.contract.strike}_${trade.contract.type}_${trade.contract.expiry}`,
            contract: {
              strike: trade.contract.strike,
              type: trade.contract.type,
              expiry: trade.contract.expiry,
            },
            entryPrice: trade.contract.mid,
            targetPrice: effectiveTargetPrice,
            stopLoss: effectiveStopLoss,
            tradeType: trade.tradeType,
            message: comment,
          });
          log.info("TradeThread created for member subscriptions", { ticker: trade.ticker });
        } catch (error) {
          // Don't fail the whole operation if TradeThread creation fails
          log.warn("Failed to create TradeThread (non-blocking)", { error, ticker: trade.ticker });
        }

        // 5. SEND DISCORD ALERT (NON-BLOCKING)
        const channels = getDiscordChannelsForAlert(channelIds, challengeIds);
        const discordAlertsEnabled = useSettingsStore.getState().discordAlertsEnabled;

        if (discordAlertsEnabled && channels.length > 0) {
          // Fire and forget - don't await
          discord
            .sendLoadAlert(channels, { ...trade, id: dbTrade.id, state: "LOADED" }, comment, {
              targetPrice: effectiveTargetPrice,
              stopLoss: effectiveStopLoss,
              targetUnderlyingPrice:
                priceOverrides?.targetUnderlyingPrice ?? trade.targetUnderlyingPrice,
              stopUnderlyingPrice: priceOverrides?.stopUnderlyingPrice ?? trade.stopUnderlyingPrice,
            })
            .catch((error) => {
              console.error("[Discord] Failed to send LOAD alert:", error);
            });
        }

        log.transition("WATCHING", "LOADED", { tradeId: dbTrade.id, ticker: trade.ticker });
        log.actionEnd("handleLoadAndAlert", correlationId, {
          dbTradeId: dbTrade.id,
          ticker: trade.ticker,
          channelsSent: channels.length,
        });

        showAlertToast("load", trade.ticker, channels);
      } catch (error) {
        log.actionFail("handleLoadAndAlert", correlationId, error, {
          tradeId: trade.id,
          ticker: trade.ticker,
        });
        toast.error("Failed to load trade", {
          description: error instanceof Error ? error.message : "Unknown error occurred",
        } as any);
      } finally {
        setIsTransitioning(false);
      }
    },
    [
      currentTrade,
      previewTrade, // CRITICAL: Must include previewTrade since we use it for WATCHING state
      userId,
      toast,
      discord,
      loadTrades,
      getDiscordChannelsForAlert,
      showAlertToast,
      isTransitioning,
      tradeState,
    ]
  );

  // ========================================
  // ENTER AND ALERT - Persist WATCHING/LOADED → ENTERED
  // ========================================
  const handleEnterAndAlert = useCallback(
    async (
      channelIds: string[],
      challengeIds: string[],
      comment?: string,
      priceOverrides?: PriceOverrides
    ) => {
      // CRITICAL: For WATCHING state, use previewTrade to ensure we enter the displayed contract
      // currentTrade may return a stale persisted trade if timing/state issues occur
      // This fixes the bug where clicking "Enter and Alert" on a new contract enters the wrong one
      const trade = tradeState === "WATCHING" ? previewTrade : currentTrade;

      // GUARD: Prevent duplicate transitions
      if (isTransitioning) {
        log.warn("Enter blocked: transition already in progress", { tradeId: trade?.id });
        return;
      }

      if (!trade || !userId) {
        log.warn("Enter blocked: trade or user missing", {
          hasTrade: !!trade,
          hasUserId: !!userId,
        });
        toast.error("Unable to enter trade: Trade or user missing");
        return;
      }

      // GUARD: Only allow from WATCHING or LOADED state
      const effectiveState = tradeState || trade.state;
      if (effectiveState === "ENTERED") {
        log.warn("Enter blocked: trade already ENTERED", { tradeId: trade.id });
        toast.error("Trade already entered");
        return;
      }
      if (effectiveState === "EXITED") {
        log.warn("Enter blocked: trade already EXITED", { tradeId: trade.id });
        toast.error("Cannot enter an exited trade");
        return;
      }

      const correlationId = log.actionStart("handleEnterAndAlert", {
        tradeId: trade.id,
        ticker: trade.ticker,
        fromState: effectiveState,
        channelCount: channelIds.length,
      });

      setIsTransitioning(true);
      const finalEntryPrice = priceOverrides?.entryPrice || trade.contract.mid;

      // VALIDATION: Prevent entry with very low prices that cause degenerate stop loss
      const MIN_ENTRY_PRICE = 0.05; // $0.05 minimum
      if (finalEntryPrice < MIN_ENTRY_PRICE) {
        setIsTransitioning(false);
        toast.error("Entry price too low", {
          description: `Contract price must be at least $${MIN_ENTRY_PRICE.toFixed(2)} to enter trade. Current: $${finalEntryPrice.toFixed(2)}`,
        });
        log.warn("Entry rejected: price too low", {
          tradeId: trade.id,
          ticker: trade.ticker,
          entryPrice: finalEntryPrice,
          minRequired: MIN_ENTRY_PRICE,
        });
        return;
      }

      // Calculate TP/SL with hybrid approach for cheap options
      let targetPrice = priceOverrides?.targetPrice ?? roundPrice(finalEntryPrice * 1.5);
      let stopLoss: number;

      if (priceOverrides?.stopLoss) {
        // User provided explicit stop loss
        stopLoss = priceOverrides.stopLoss;
      } else if (finalEntryPrice < 0.1) {
        // For cheap options ($0.05-$0.10), use fixed dollar stop instead of percentage
        // This prevents stop === entry when using percentage-based calculation
        stopLoss = Math.max(0.01, roundPrice(finalEntryPrice - 0.05));
        log.info("Using fixed dollar stop for cheap option", {
          entryPrice: finalEntryPrice,
          stopLoss,
          reason: "entry < $0.10",
        });
      } else {
        // Normal percentage-based stop for options >= $0.10
        stopLoss = roundPrice(finalEntryPrice * 0.5);
      }

      // VALIDATION: Ensure stop loss is always different from entry (prevent degenerate condition)
      const MIN_STOP_DISTANCE = 0.01; // At least $0.01 apart
      if (Math.abs(stopLoss - finalEntryPrice) < MIN_STOP_DISTANCE) {
        const originalStop = stopLoss;
        stopLoss = Math.max(0.01, roundPrice(finalEntryPrice - 0.05));
        log.warn("Stop loss adjusted to prevent degenerate condition", {
          entryPrice: finalEntryPrice,
          originalStop,
          adjustedStop: stopLoss,
          reason: "stop too close to entry",
        });
      }

      // Recalculate TP/SL if not provided
      if (!priceOverrides?.targetPrice || !priceOverrides?.stopLoss) {
        try {
          const tradeType = inferTradeTypeByDTE(
            trade.contract.expiry,
            new Date(),
            DEFAULT_DTE_THRESHOLDS
          );
          const risk = calculateRisk({
            entryPrice: finalEntryPrice,
            currentUnderlyingPrice: finalEntryPrice,
            currentOptionMid: finalEntryPrice,
            keyLevels: keyLevels || {
              preMarketHigh: 0,
              preMarketLow: 0,
              orbHigh: 0,
              orbLow: 0,
              priorDayHigh: 0,
              priorDayLow: 0,
              vwap: 0,
              vwapUpperBand: 0,
              vwapLowerBand: 0,
              bollingerUpper: 0,
              bollingerLower: 0,
              weeklyHigh: 0,
              weeklyLow: 0,
              monthlyHigh: 0,
              monthlyLow: 0,
              quarterlyHigh: 0,
              quarterlyLow: 0,
              yearlyHigh: 0,
              yearlyLow: 0,
            },
            expirationISO: trade.contract.expiry,
            tradeType,
            delta: trade.contract.delta ?? 0.5,
            gamma: trade.contract.gamma ?? 0,
            defaults: getRiskDefaultsFromStore(),
          });
          if (!priceOverrides?.targetPrice && risk.targetPrice) targetPrice = risk.targetPrice;
          if (!priceOverrides?.stopLoss && risk.stopLoss) stopLoss = risk.stopLoss;
        } catch {
          /* fallback silently */
        }
      }

      try {
        let dbTradeId = trade.id;

        if (trade.state === "WATCHING") {
          // WATCHING → ENTERED: Create new trade in database
          const dbTrade = await createTradeApi(userId, {
            ticker: trade.ticker,
            contract: trade.contract,
            tradeType: trade.tradeType,
            targetPrice,
            stopLoss,
            entryPrice: finalEntryPrice,
            entryTime: new Date(),
            status: "entered",
            discordChannelIds: channelIds,
            challengeIds: challengeIds,
            setupType: trade.setupType,
            confluence: trade.confluence,
            confluenceUpdatedAt: trade.confluenceUpdatedAt?.toISOString(),
          });
          dbTradeId = dbTrade.id;
        } else if (trade.state === "LOADED") {
          // LOADED → ENTERED: Update existing trade
          await updateTradeApi(userId, trade.id, {
            status: "entered",
            entry_price: finalEntryPrice,
            entry_time: new Date().toISOString(),
            target_price: targetPrice,
            stop_loss: stopLoss,
          });
        }

        // RELOAD FROM DATABASE
        await loadTrades(userId);

        // CRITICAL FIX: Reset alertType to prevent stale state causing accidental exits
        // After entry, clear alert state so next action starts fresh
        setAlertType("update"); // Neutral state
        setShowAlert(false);
        log.info("Alert type reset after successful entry", {
          tradeId: dbTradeId,
          reason: "Prevent accidental exit from stale alertType",
        });

        // EXPLICIT CHALLENGE LINKING - Ensures junction table is populated
        // This fixes race condition where server's async insert may not complete
        // before loadTrades() runs, causing trades to not appear in challenges
        if (challengeIds.length > 0 && dbTradeId) {
          try {
            await useTradeStore.getState().linkTradeToChallenges(dbTradeId, challengeIds);
            // Reload again to get the updated challenges array
            await loadTrades(userId);
          } catch (error) {
            console.warn("[Trade] Failed to link challenges:", error);
          }
        }

        // FOCUS ON TRADE - Use atomic update to prevent race conditions
        useTradeStore.setState({
          previewTrade: null,
          currentTradeId: dbTradeId,
        });
        setShowAlert(false);

        // REGISTER FOR ACTIVE TRADE POLLING - Start polling for real-time P&L updates
        const enteredTrade = useTradeStore.getState().activeTrades.find((t) => t.id === dbTradeId);
        if (enteredTrade) {
          ActiveTradePollingService.registerTrade(enteredTrade);
        }

        // SEND DISCORD ALERT (NON-BLOCKING)
        const channels = getDiscordChannelsForAlert(channelIds, challengeIds);
        const discordAlertsEnabled = useSettingsStore.getState().discordAlertsEnabled;

        if (discordAlertsEnabled && channels.length > 0) {
          if (!discordAlertLimiter.canProceed()) {
            const waitTime = discordAlertLimiter.getWaitTime();
            toast.error("Discord alert rate limit exceeded", {
              description: `Wait ${formatWaitTime(waitTime)} before sending more.`,
            } as any);
          } else {
            // Fire and forget - don't await
            discord
              .sendEntryAlert(
                channels,
                {
                  ...trade,
                  id: dbTradeId,
                  state: "ENTERED",
                  entryPrice: finalEntryPrice,
                  targetPrice,
                  stopLoss,
                },
                comment,
                undefined,
                undefined,
                {
                  entryPrice: finalEntryPrice,
                  targetPrice,
                  stopLoss,
                  targetUnderlyingPrice:
                    priceOverrides?.targetUnderlyingPrice ?? trade.targetUnderlyingPrice,
                  stopUnderlyingPrice:
                    priceOverrides?.stopUnderlyingPrice ?? trade.stopUnderlyingPrice,
                }
              )
              .then((results) => {
                recordAlertHistory({
                  userId,
                  tradeId: dbTradeId,
                  alertType: "enter",
                  channelIds: channels.map((c) => c.id),
                  challengeIds,
                  successCount: results.success,
                  failedCount: results.failed,
                  tradeTicker: trade.ticker,
                }).catch(console.error);
              })
              .catch((error) => {
                console.error("[Discord] Failed to send ENTER alert:", error);
              });
          }
        }

        if (isMobile && onMobileTabChange) {
          onMobileTabChange("active");
        }

        // Callback for navigation to trade detail page
        if (onEnteredTrade) {
          onEnteredTrade({
            ...trade,
            id: dbTradeId,
            state: "ENTERED",
            entryPrice: finalEntryPrice,
            targetPrice,
            stopLoss,
          });
        }

        log.transition(effectiveState, "ENTERED", { tradeId: dbTradeId, ticker: trade.ticker });
        log.actionEnd("handleEnterAndAlert", correlationId, {
          dbTradeId,
          ticker: trade.ticker,
          entryPrice: finalEntryPrice,
          channelsSent: channels.length,
        });

        showAlertToast("enter", trade.ticker, channels);
      } catch (error) {
        log.actionFail("handleEnterAndAlert", correlationId, error, {
          tradeId: trade.id,
          ticker: trade.ticker,
        });
        toast.error("Failed to enter trade", {
          description: error instanceof Error ? error.message : "Unknown error occurred",
        } as any);
      } finally {
        setIsTransitioning(false);
      }
    },
    [
      currentTrade,
      previewTrade, // CRITICAL: Must include previewTrade since we use it for WATCHING state
      userId,
      toast,
      discord,
      keyLevels,
      loadTrades,
      getDiscordChannelsForAlert,
      showAlertToast,
      isMobile,
      onMobileTabChange,
      onEnteredTrade,
      isTransitioning,
      tradeState,
    ]
  );

  // ========================================
  // SEND ALERT - Generic handler for all alert types
  // ========================================
  const handleSendAlert = useCallback(
    async (
      channelIds: string[],
      challengeIds: string[],
      comment?: string,
      priceOverrides?: PriceOverrides
    ) => {
      const trade = currentTrade;

      if (!trade || !userId) {
        log.warn("Send alert blocked: trade or user missing", { alertType, hasTrade: !!trade });
        toast.error("Unable to send alert: Trade or user missing");
        return;
      }

      log.info("handleSendAlert called", {
        alertType,
        tradeId: trade.id,
        ticker: trade.ticker,
        state: trade.state,
        channelCount: channelIds.length,
      });

      // Route to specific handlers based on alertType
      if (alertType === "load") {
        return handleLoadAndAlert(channelIds, challengeIds, comment, priceOverrides);
      }

      if (alertType === "enter") {
        return handleEnterAndAlert(channelIds, challengeIds, comment, priceOverrides);
      }

      // For other alert types (trim, update, exit, etc.)
      // CRITICAL FIX: Use priceOverrides.currentPrice for exit calculations instead of ignoring it
      const effectiveCurrent =
        priceOverrides?.currentPrice ??
        trade.currentPrice ??
        trade.entryPrice ??
        trade.contract.mid;
      const effectiveStopLoss = priceOverrides?.stopLoss ?? trade.stopLoss;
      const message = comment || "";
      const entryPriceForPnl =
        trade.entryPrice ??
        getEntryPriceFromUpdates(trade.updates || []) ??
        priceOverrides?.entryPrice ??
        trade.contract?.mid ??
        0;
      const quantity = trade.quantity || 1;
      const trimPercent = priceOverrides?.trimPercent ?? alertOptions?.trimPercent;
      const updatePnlPercent =
        entryPriceForPnl > 0
          ? calculateNetPnLPercent(entryPriceForPnl, effectiveCurrent, quantity)
          : undefined;

      let updateType: TradeUpdate["type"] | null = null;
      let dbUpdates: Record<string, any> = {};

      switch (alertType) {
        case "trim":
          updateType = "trim";
          // Persist current_price for trim
          if (priceOverrides?.currentPrice) {
            dbUpdates.current_price = priceOverrides.currentPrice;
          }
          break;
        case "update":
          updateType =
            alertOptions.updateKind === "sl"
              ? "update-sl"
              : alertOptions.updateKind === "take-profit"
                ? "trim"
                : "update";
          // CRITICAL FIX: Persist ALL price overrides for updates
          if (alertOptions.updateKind === "sl" && effectiveStopLoss !== undefined) {
            dbUpdates.stop_loss = effectiveStopLoss;
            log.info("Persisting stop loss update", {
              stopLoss: effectiveStopLoss,
              tradeId: trade.id,
            });
          }
          if (alertOptions.updateKind === "take-profit") {
            // Persist target price for take-profit updates
            if (priceOverrides?.targetPrice !== undefined) {
              dbUpdates.target_price = priceOverrides.targetPrice;
            }
            if (priceOverrides?.currentPrice !== undefined) {
              dbUpdates.current_price = priceOverrides.currentPrice;
            }
          }
          // For generic updates, persist any edited prices
          if (alertOptions.updateKind === "generic") {
            if (priceOverrides?.targetPrice !== undefined) {
              dbUpdates.target_price = priceOverrides.targetPrice;
            }
            if (priceOverrides?.stopLoss !== undefined) {
              dbUpdates.stop_loss = priceOverrides.stopLoss;
            }
            if (priceOverrides?.currentPrice !== undefined) {
              dbUpdates.current_price = priceOverrides.currentPrice;
            }
          }
          break;
        case "update-sl":
          updateType = "update-sl";
          // CRITICAL FIX: Persist stop loss for explicit update-sl alerts
          if (effectiveStopLoss !== undefined) {
            dbUpdates.stop_loss = effectiveStopLoss;
            log.info("Persisting stop loss update (update-sl)", {
              stopLoss: effectiveStopLoss,
              tradeId: trade.id,
            });
          }
          break;
        case "trail-stop":
          updateType = "trail-stop";
          // Persist the trailing stop value
          if (effectiveStopLoss !== undefined) {
            dbUpdates.stop_loss = effectiveStopLoss;
            dbUpdates.stop_mode = "trailing";
          }
          break;
        case "add":
          updateType = "add";
          // Persist current price when adding to position
          if (priceOverrides?.currentPrice !== undefined) {
            dbUpdates.current_price = priceOverrides.currentPrice;
          }
          break;
        case "exit": {
          // CRITICAL FIX: Use effectiveCurrent (from priceOverrides) instead of ignoring user edits
          const exitPrice = effectiveCurrent;
          const movePercent = trade.entryPrice
            ? ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100
            : 0;
          updateType = "exit";
          dbUpdates = {
            status: "exited",
            exit_price: exitPrice,
            exit_time: new Date().toISOString(),
            move_percent: movePercent,
          };
          log.info("Exit using effective current price", {
            exitPrice,
            originalCurrent: trade.currentPrice,
            override: priceOverrides?.currentPrice,
          });
          break;
        }
      }

      try {
        // Persist to database
        if (Object.keys(dbUpdates).length > 0) {
          await updateTradeApi(userId, trade.id, dbUpdates);

          // OPTIMISTIC UPDATE: Immediately update the store with the new values
          // This ensures prices are reflected throughout the UI without waiting for loadTrades()
          const storePatch: Partial<Trade> = {};
          if (dbUpdates.stop_loss !== undefined) {
            storePatch.stopLoss = dbUpdates.stop_loss;
          }
          if (dbUpdates.target_price !== undefined) {
            storePatch.targetPrice = dbUpdates.target_price;
          }
          if (dbUpdates.current_price !== undefined) {
            storePatch.currentPrice = dbUpdates.current_price;
          }
          if (dbUpdates.entry_price !== undefined) {
            storePatch.entryPrice = dbUpdates.entry_price;
          }

          if (Object.keys(storePatch).length > 0) {
            useTradeStore.getState().applyTradePatch(trade.id, storePatch);
            log.debug("Optimistic update applied to store", {
              tradeId: trade.id,
              fields: Object.keys(storePatch),
            });
          }
        }

        if (updateType) {
          const trimPercentForUpdate = updateType === "trim" ? (trimPercent ?? 50) : undefined;
          let updateResponse: any = null;

          try {
            updateResponse = await addTradeUpdateApi(
              userId,
              trade.id,
              updateType,
              effectiveCurrent,
              message,
              updatePnlPercent,
              trimPercentForUpdate
            );
          } catch (error) {
            console.warn("[useTradeStateMachine] Trade update insert failed", error);
          }

          const responsePayload = updateResponse || {};
          const rawPrice =
            responsePayload.price !== null && responsePayload.price !== undefined
              ? Number(responsePayload.price)
              : (effectiveCurrent ?? 0);
          const rawPnl =
            responsePayload.pnl_percent !== null && responsePayload.pnl_percent !== undefined
              ? Number(responsePayload.pnl_percent)
              : updatePnlPercent;
          const rawTrim =
            responsePayload.trim_percent !== null && responsePayload.trim_percent !== undefined
              ? Number(responsePayload.trim_percent)
              : trimPercentForUpdate;
          const timestampValue = responsePayload.timestamp || responsePayload.created_at;
          const mappedUpdate: TradeUpdate = {
            id: responsePayload.id || crypto.randomUUID(),
            type: (responsePayload.type || updateType) as TradeUpdate["type"],
            timestamp: timestampValue ? new Date(timestampValue) : new Date(),
            message: responsePayload.message ?? message ?? "",
            price: Number.isFinite(rawPrice) ? rawPrice : (effectiveCurrent ?? 0),
            pnlPercent: Number.isFinite(rawPnl ?? NaN) ? rawPnl : undefined,
            trimPercent: Number.isFinite(rawTrim ?? NaN) ? rawTrim : undefined,
          };

          const store = useTradeStore.getState();
          const existingUpdates = store.getTradeById(trade.id)?.updates || [];
          if (!existingUpdates.some((update) => update.id === mappedUpdate.id)) {
            store.applyTradePatch(trade.id, { updates: [...existingUpdates, mappedUpdate] });
          }
        }

        // Send TradeThread update for member subscribers (non-blocking)
        try {
          let threadUpdateType: TradeThreadUpdateType | null = null;
          let threadPayload: TradeThreadUpdatePayload = {};

          switch (alertType) {
            case "trim":
              threadUpdateType = "TRIM";
              threadPayload = {
                trimPercent: trimPercent ?? 50,
                message: message || "Position trimmed",
              };
              break;
            case "update":
              if (alertOptions.updateKind === "sl") {
                threadUpdateType = "STOP_MOVE";
                threadPayload = {
                  stopPrice: priceOverrides?.stopLoss ?? trade.stopLoss,
                  message: message || "Stop loss updated",
                };
              } else if (alertOptions.updateKind === "take-profit") {
                threadUpdateType = "TRIM";
                threadPayload = {
                  exitPrice: effectiveCurrent,
                  pnlPercent: updatePnlPercent ?? (trade.movePercent || 0),
                  trimPercent: trimPercent ?? 50,
                  message: message || "Taking profit",
                };
              } else {
                threadUpdateType = "UPDATE";
                threadPayload = { message: message || "General update" };
              }
              break;
            case "update-sl":
              threadUpdateType = "STOP_MOVE";
              threadPayload = {
                stopPrice: priceOverrides?.stopLoss ?? trade.stopLoss,
                message: message || "Stop loss updated",
              };
              break;
            case "trail-stop":
              threadUpdateType = "STOP_MOVE";
              threadPayload = {
                stopPrice: trade.stopLoss,
                message: "Trailing stop activated",
              };
              break;
            case "add":
              threadUpdateType = "UPDATE";
              threadPayload = { message: message || "Added to position" };
              break;
            case "exit": {
              threadUpdateType = "EXIT";
              const exitPnlPercent = trade.entryPrice
                ? ((effectiveCurrent - trade.entryPrice) / trade.entryPrice) * 100
                : 0;
              threadPayload = {
                exitPrice: effectiveCurrent,
                pnlPercent: exitPnlPercent,
                message: message || `Exit at $${effectiveCurrent.toFixed(2)}`,
              };
              break;
            }
          }

          if (threadUpdateType) {
            addThreadUpdateBySymbol(trade.ticker, threadUpdateType, message, threadPayload)
              .then((result) => {
                if (result) {
                  log.info("TradeThread update sent", {
                    ticker: trade.ticker,
                    type: threadUpdateType,
                  });
                }
              })
              .catch(console.warn);
          }
        } catch (err) {
          log.warn("Failed to send TradeThread update (non-blocking)", { error: err });
        }

        // Handle exit - clear state BEFORE reloading to prevent race condition
        // where auto-select triggers during the reload
        if (alertType === "exit") {
          log.info("Exit: Clearing state BEFORE loadTrades to prevent race condition", {
            tradeId: trade.id,
            ticker: trade.ticker,
          });
          // Clear ticker FIRST to prevent auto-select race condition
          setActiveTicker(null);
          setFocusedTrade(null); // Atomic clear of both previewTrade and currentTradeId
          setShowAlert(false);

          // OPTIMISTIC UPDATE: Immediately move trade from activeTrades to historyTrades
          // This ensures UI updates instantly without waiting for DB reload
          const exitedTrade: Trade = {
            ...trade,
            state: "EXITED",
            exitPrice: effectiveCurrent,
            exitTime: new Date(),
            movePercent: trade.entryPrice
              ? ((effectiveCurrent - trade.entryPrice) / trade.entryPrice) * 100
              : 0,
          };
          useTradeStore.setState((state) => ({
            activeTrades: state.activeTrades.filter((t) => t.id !== trade.id),
            historyTrades: [...state.historyTrades, exitedTrade],
          }));

          // UNREGISTER FROM ACTIVE TRADE POLLING - Stop polling for this trade
          ActiveTradePollingService.unregisterTrade(trade.id);
        }

        // Reload from database
        log.debug("Reloading trades from database", { alertType });
        await loadTrades(userId);

        // Handle exit callbacks
        if (alertType === "exit") {
          log.transition(trade.state, "EXITED", { tradeId: trade.id, ticker: trade.ticker });

          if (onExitedTrade && trade) {
            onExitedTrade({ ...trade, state: "EXITED" });
          }

          if (isMobile && onMobileTabChange) {
            onMobileTabChange("live");
          }
        }

        if (alertType !== "exit") {
          setShowAlert(false);
        }

        log.info("Alert sent successfully", { alertType, tradeId: trade.id, ticker: trade.ticker });

        // Send Discord alert (NON-BLOCKING)
        const channels = getDiscordChannelsForAlert(channelIds, challengeIds);
        const discordAlertsEnabled = useSettingsStore.getState().discordAlertsEnabled;

        if (discordAlertsEnabled && channels.length > 0) {
          // Wrapped in IIFE to handle logic without blocking main thread
          (async () => {
            try {
              switch (alertType) {
                case "trim":
                  await discord.sendUpdateAlert(
                    channels,
                    trade,
                    "trim",
                    message || "Position trimmed"
                  );
                  break;
                case "update":
                  await discord.sendUpdateAlert(
                    channels,
                    trade,
                    alertOptions.updateKind === "sl" ? "update-sl" : "generic",
                    message
                  );
                  break;
                case "update-sl":
                  await discord.sendUpdateAlert(
                    channels,
                    trade,
                    "update-sl",
                    message || "Stop loss updated"
                  );
                  break;
                case "trail-stop":
                  await discord.sendTrailingStopAlert(channels, trade);
                  break;
                case "add":
                  await discord.sendUpdateAlert(
                    channels,
                    trade,
                    "generic",
                    message || "Added to position"
                  );
                  break;
                case "exit": {
                  // Handle gains image if requested
                  let imageUrl: string | undefined;
                  if (priceOverrides?.includeGainsImage) {
                    log.info("Gains image requested for exit alert", { tradeId: trade.id });
                    // TODO: Implement image generation using html-to-image or server-side rendering
                    // For now, imageUrl remains undefined
                  }
                  // Spread trade with exit data - using effectiveCurrent (with user's price override)
                  await discord.sendExitAlert(
                    channels,
                    {
                      ...trade,
                      exitPrice: effectiveCurrent,
                      exitTime: new Date(),
                      movePercent: trade.entryPrice
                        ? ((effectiveCurrent - trade.entryPrice) / trade.entryPrice) * 100
                        : 0,
                    },
                    message,
                    imageUrl
                  );
                  break;
                }
              }
            } catch (error) {
              console.error(`[Discord] Failed to send ${alertType.toUpperCase()} alert:`, error);
            }
          })();
        }

        showAlertToast(alertType, trade.ticker, channels);
      } catch (error) {
        log.error("Failed to send alert", {
          alertType,
          tradeId: trade.id,
          ticker: trade.ticker,
          error: error instanceof Error ? error.message : String(error),
        });
        toast.error(`Failed to save ${alertType}`, {
          description: error instanceof Error ? error.message : "Unknown error occurred",
        } as any);
      }
    },
    [
      currentTrade,
      alertType,
      alertOptions,
      userId,
      toast,
      discord,
      loadTrades,
      handleLoadAndAlert,
      handleEnterAndAlert,
      setFocusedTrade,
      getDiscordChannelsForAlert,
      showAlertToast,
      isMobile,
      onMobileTabChange,
      onExitedTrade,
    ]
  );

  const handleEnterTrade = useCallback(
    (
      channelIds?: string[],
      challengeIds?: string[],
      comment?: string,
      priceOverrides?: PriceOverrides
    ) => {
      handleEnterAndAlert(channelIds || [], challengeIds || [], comment, priceOverrides);
    },
    [handleEnterAndAlert]
  );

  const handleCancelAlert = useCallback(() => {
    setShowAlert(false);
    setAlertDraft(null); // Clear domain layer draft
    if (isMobile && onMobileTabChange) {
      onMobileTabChange("live");
    }
  }, [isMobile, onMobileTabChange]);

  const handleDiscard = useCallback(() => {
    setFocusedTrade(null); // Atomic clear of both previewTrade and currentTradeId
    setShowAlert(false);
    setAlertDraft(null); // Clear domain layer draft
  }, [setFocusedTrade]);

  const handleUnloadTrade = useCallback(async () => {
    const trade = currentTrade;
    if (!trade || trade.state !== "LOADED" || !userId) {
      log.warn("Unload blocked: invalid state", {
        hasTrade: !!trade,
        state: trade?.state,
        hasUserId: !!userId,
      });
      return;
    }

    const correlationId = log.actionStart("handleUnloadTrade", {
      tradeId: trade.id,
      ticker: trade.ticker,
    });

    try {
      await deleteTradeApi(userId, trade.id);
      await loadTrades(userId);

      setFocusedTrade(null); // Atomic clear
      setShowAlert(false);

      log.actionEnd("handleUnloadTrade", correlationId, {
        tradeId: trade.id,
        ticker: trade.ticker,
      });
      toast.success(`${trade.ticker} unloaded`);
    } catch (error) {
      log.actionFail("handleUnloadTrade", correlationId, error, { tradeId: trade.id });
      toast.error("Failed to unload trade");
    }

    if (isMobile && onMobileTabChange) {
      onMobileTabChange("live");
    }
  }, [currentTrade, userId, loadTrades, setFocusedTrade, toast, isMobile, onMobileTabChange]);

  const handleTrim = useCallback(
    (trimPercent?: number) => {
      if (!currentTrade) return;
      // Use domain layer to create draft
      const draft = startTradeAction("TRIM", { trade: currentTrade });
      if (draft) {
        setAlertDraft(draft);
        // Backward compatibility: also set legacy state
        setAlertType(intentToAlertType("TRIM"));
        setAlertOptions({ updateKind: intentToUpdateKind("TRIM"), trimPercent });
        setShowAlert(true);
      } else {
        log.warn("handleTrim: Invalid transition", { state: currentTrade.state });
        toast.error("Cannot trim from current state");
      }
    },
    [currentTrade, toast]
  );

  const handleUpdate = useCallback(() => {
    if (!currentTrade) return;
    openAlertComposer("update", { updateKind: "generic" });
  }, [currentTrade, openAlertComposer]);

  const handleUpdateSL = useCallback(() => {
    if (!currentTrade) return;
    // Use domain layer to create draft
    const draft = startTradeAction("UPDATE_SL", { trade: currentTrade });
    if (draft) {
      setAlertDraft(draft);
      // Backward compatibility: also set legacy state
      setAlertType(intentToAlertType("UPDATE_SL"));
      setAlertOptions({ updateKind: intentToUpdateKind("UPDATE_SL") });
      setShowAlert(true);
    } else {
      log.warn("handleUpdateSL: Invalid transition", { state: currentTrade.state });
      toast.error("Cannot update stop loss from current state");
    }
  }, [currentTrade, toast]);

  const handleTrailStop = useCallback(() => {
    if (!currentTrade) return;
    // Use domain layer to create draft
    const draft = startTradeAction("TRAIL_STOP", { trade: currentTrade });
    if (draft) {
      setAlertDraft(draft);
      // Backward compatibility: also set legacy state
      setAlertType(intentToAlertType("TRAIL_STOP"));
      setAlertOptions({});
      setShowAlert(true);
    } else {
      log.warn("handleTrailStop: Invalid transition", { state: currentTrade.state });
      toast.error("Cannot activate trailing stop from current state");
    }
  }, [currentTrade, toast]);

  const handleAdd = useCallback(() => {
    if (!currentTrade) return;
    // Use domain layer to create draft
    const draft = startTradeAction("ADD", { trade: currentTrade });
    if (draft) {
      setAlertDraft(draft);
      // Backward compatibility: also set legacy state
      setAlertType(intentToAlertType("ADD"));
      setAlertOptions({});
      setShowAlert(true);
    } else {
      log.warn("handleAdd: Invalid transition", { state: currentTrade.state });
      toast.error("Cannot add to position from current state");
    }
  }, [currentTrade, toast]);

  const handleTakeProfit = useCallback(
    (_sendAlert?: boolean) => {
      // Read directly from store to avoid stale closure
      const storeState = useTradeStore.getState();
      const trade = storeState.currentTradeId
        ? storeState.activeTrades.find((t) => t.id === storeState.currentTradeId)
        : null;

      if (!trade) return;

      // Use domain layer - TRIM intent for take profit
      const draft = startTradeAction("TRIM", { trade });
      if (draft) {
        setAlertDraft(draft);
        // Backward compatibility: also set legacy state
        setAlertType("update");
        setAlertOptions({ updateKind: "take-profit", trimPercent: 50 });
        setShowAlert(true);
      } else {
        log.warn("handleTakeProfit: Invalid transition", { state: trade.state });
        toast.error("Cannot take profit from current state");
      }
    },
    [toast]
  );

  const handleExit = useCallback(
    async (_sendAlert?: boolean) => {
      // Read directly from store to avoid stale closure
      const storeState = useTradeStore.getState();
      const trade = storeState.currentTradeId
        ? storeState.activeTrades.find((t) => t.id === storeState.currentTradeId)
        : null;

      if (!trade) return;

      // DETECT EXPIRATION / NULL PRICE - Force manual exit bypassing alert composer
      const isExpired = trade.contract.expiry && new Date(trade.contract.expiry) < new Date();
      const isZeroPrice =
        (!trade.currentPrice || trade.currentPrice === 0) &&
        (!trade.contract.mid || trade.contract.mid === 0);

      if (isExpired || isZeroPrice) {
        // === DIRECT EXIT FOR EXPIRED CONTRACTS ===
        // Bypass all alert machinery and directly update DB + store
        const now = new Date();
        const entryPrice = trade.entryPrice || 0;
        const exitPrice = 0; // Expired worthless
        const movePercent = entryPrice > 0 ? -100 : 0; // Total loss

        try {
          // 1. Update database directly
          await updateTradeApi(userId, trade.id, {
            status: "exited",
            exit_price: exitPrice,
            exit_time: now.toISOString(),
            move_percent: movePercent,
          });

          // 2. Optimistically move trade from activeTrades to historyTrades
          const exitedTrade: Trade = {
            ...trade,
            state: "EXITED",
            exitPrice,
            exitTime: now,
            movePercent,
          };
          useTradeStore.setState((state) => ({
            activeTrades: state.activeTrades.filter((t) => t.id !== trade.id),
            historyTrades: [...state.historyTrades, exitedTrade],
            currentTradeId: null, // Clear focus
          }));

          // 3. Show success toast
          toast.success("Expired Position Cleared", {
            description: `${trade.ticker} expired contract removed from active trades.`,
          });

          // 4. Reload trades from DB
          await loadTrades(userId);

          log.info("Expired contract manually exited", { tradeId: trade.id, ticker: trade.ticker });
        } catch (err) {
          console.error("[handleExit] Failed to exit expired trade:", err);
          toast.error("Failed to clear expired position", {
            description: err instanceof Error ? err.message : "Unknown error",
          });
        }
        return;
      }

      // Use domain layer to create draft
      const draft = startTradeAction("EXIT", { trade });
      if (draft) {
        setAlertDraft(draft);
        // Backward compatibility: also set legacy state
        setAlertType(intentToAlertType("EXIT"));
        setAlertOptions({});
        setShowAlert(true);
      } else {
        log.warn("handleExit: Invalid transition", { state: trade.state });
        toast.error("Cannot exit from current state");
      }
    },
    [toast, userId, loadTrades]
  );

  // ========================================
  // COMPUTED FOCUS TARGET
  // ========================================
  // Uses centralized viewRouter for single source of truth
  const focus: FocusTarget = useMemo(
    () => deriveFocus(currentTradeId, currentTrade, activeTicker),
    [currentTradeId, currentTrade, activeTicker]
  );

  return {
    // State (from store + local UI state)
    activeTicker,
    contracts,
    currentTrade,
    previewTrade,
    tradeState,
    alertType,
    alertOptions,
    showAlert,
    activeTrades,
    focus,
    isTransitioning,
    // Domain layer state
    alertDraft,
    // Actions
    actions: {
      handleTickerClick,
      handleContractSelect,
      handleLoadStrategy,
      handleActiveTradeClick,
      handleSendAlert,
      handleLoadAndAlert,
      handleEnterAndAlert,
      handleEnterTrade,
      handleCancelAlert,
      handleDiscard,
      handleUnloadTrade,
      handleTrim,
      handleTakeProfit,
      handleUpdate,
      handleUpdateSL,
      handleTrailStop,
      handleAdd,
      handleExit,
      setActiveTicker,
      setContracts,
      setAlertType,
    },
  };
}
