import React, { useEffect } from "react";
import { Trade, Ticker, Challenge, DiscordChannel } from "../types";
import { HDPanelWatchlist } from "./hd/dashboard/HDPanelWatchlist";
import { HDVoiceHUD } from "./hd/voice/HDVoiceHUD";
import { HDDialogChallengeDetail } from "./hd/forms/HDDialogChallengeDetail";
import { HDMacroPanel } from "./hd/dashboard/HDMacroPanel";
import { HDWatchlistRail } from "./hd/layout/HDWatchlistRail";
import { HDActiveTradesPanel } from "./hd/dashboard/HDActiveTradesPanel";
import { MobileNowPlayingSheet } from "./MobileNowPlayingSheet";
import { MobileWatermark } from "./MobileWatermark";

import { useVoiceCommands } from "../hooks/useVoiceCommands";
import { streamingManager } from "../lib/massive/streaming-manager";
import { useTradeStateMachine } from "../hooks/useTradeStateMachine";
import { useKeyLevels } from "../hooks/useKeyLevels";
import { NowPanel } from "./trading/NowPanel";
import { ActionRail } from "./trading/ActionRail";
import { useStreamingOptionsChain } from "../hooks/useStreamingOptionsChain";
import type { CompositeSignal } from "../lib/composite/CompositeSignal";
import { useDiscord } from "../hooks/useDiscord";
import { useSettingsStore } from "../stores/settingsStore";
import { useMarketStore } from "../stores/marketStore";
import { useTradeStore } from "../stores/tradeStore";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";

// Default confluence object to prevent undefined errors in child components
const DEFAULT_CONFLUENCE = {
  loading: false,
  error: undefined,
  trend: undefined,
  volatility: undefined,
  liquidity: undefined,
};

interface DesktopLiveCockpitSlimProps {
  watchlist: Ticker[];
  challenges: Challenge[];
  onTickerClick: (ticker: Ticker) => void;
  onAddTicker?: () => void;
  onRemoveTicker?: (ticker: Ticker) => void;
  onAddChallenge?: () => void;
  onRemoveChallenge?: (challenge: Challenge) => void;
  onExitedTrade?: (trade: Trade) => void;
  onEnteredTrade?: (trade: Trade) => void;
  channels: DiscordChannel[];
  onMobileTabChange?: (tab: "live" | "active" | "history" | "settings") => void;
  onVoiceNavigate?: (
    destination: "live" | "active" | "history" | "settings" | "monitoring"
  ) => void;
  onOpenActiveTrade?: (tradeId: string) => void;
  onOpenReviewTrade?: (tradeId: string) => void;
  activeTab?: "live" | "active" | "history" | "settings";
  compositeSignals?: CompositeSignal[];
  onVoiceStateChange?: (state: {
    isListening: boolean;
    isProcessing: boolean;
    waitingForWakeWord: boolean;
    onToggle: () => void;
  }) => void;
}

export function DesktopLiveCockpitSlim(props: DesktopLiveCockpitSlimProps) {
  const {
    watchlist,
    challenges,
    onTickerClick,
    onAddTicker,
    onRemoveTicker,
    onAddChallenge,
    compositeSignals,
    onRemoveChallenge,
    onExitedTrade,
    onEnteredTrade,
    channels,
    onMobileTabChange,
    onVoiceNavigate,
    onOpenActiveTrade,
    onOpenReviewTrade,
    onVoiceStateChange,
  } = props;

  const { user } = useAuth();

  // Store access for direct state updates
  const setCurrentTradeId = useTradeStore((s) => s.setCurrentTradeId);
  const deleteTrade = useTradeStore((s) => s.deleteTrade);

  // Compute keyLevels for active ticker in real-time
  // Get current trade from store to compute keyLevels
  const storeCurrentTrade = useTradeStore((s) => s.getCurrentTrade());
  const levelsTicker = storeCurrentTrade?.ticker || "";
  const { keyLevels: computedKeyLevels } = useKeyLevels(levelsTicker, {
    timeframe: "5",
    lookbackDays: 5,
    orbWindow: 5,
    enabled: Boolean(levelsTicker),
  });

  const {
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
    actions,
  } = useTradeStateMachine({
    onExitedTrade,
    onEnteredTrade,
    onMobileTabChange,
    keyLevels: computedKeyLevels,
  });

  // Fetch options chain when activeTicker changes
  const {
    contracts: streamingContracts,
    loading: optionsLoading,
    error: optionsError,
    isStale: optionsStale,
    asOf: optionsAsOf,
  } = useStreamingOptionsChain(activeTicker?.symbol || "");

  useEffect(() => {
    if (streamingContracts && activeTicker) {
      actions.setContracts(streamingContracts);
    }
  }, [streamingContracts, activeTicker, actions]);

  // Discord integration for voice alerts
  const discord = useDiscord();
  const getDefaultChannels = useSettingsStore((s) => s.getDefaultChannels);
  const discordAlertsEnabled = useSettingsStore((s) => s.discordAlertsEnabled);

  const voice = useVoiceCommands({
    watchlist,
    activeTrades,
    currentTrade,
    onAddTicker: async (symbol: string) => {
      const userId = user?.id || "00000000-0000-0000-0000-000000000001";
      const ticker: Ticker = {
        id: crypto.randomUUID(),
        symbol: symbol.toUpperCase(),
        last: 0,
        change: 0,
        changePercent: 0,
      };
      await useMarketStore.getState().addTicker(userId, ticker);
    },
    onRemoveTicker,
    onLoadContract: (contract, ticker, reasoning) => {
      // Set active ticker for UI state
      actions.setActiveTicker(ticker);
      // Pass ticker explicitly to avoid race condition with state update
      actions.handleContractSelect(contract, undefined, reasoning, ticker);
    },
    onEnterTrade: actions.handleEnterTrade,
    onTrimTrade: actions.handleTrim,
    onUpdateSL: actions.handleUpdateSL,
    onExitTrade: actions.handleExit,
    onAddPosition: actions.handleAdd,
    onSendAlert: async (alert) => {
      if (!discordAlertsEnabled) {
        toast.info("Discord alerts disabled", {
          description: "Enable in Settings → Discord to send alerts to channels.",
        });
        return;
      }

      const alertType = alert.alert.alertType;
      const channelType =
        alertType === "entry" ? "enter" : alertType === "exit" ? "exit" : "update";
      const defaultChannels = getDefaultChannels(channelType);

      if (defaultChannels.length === 0) {
        toast.warning("No Discord channels configured", {
          description: `Set up ${channelType} channels in Settings → Discord.`,
        });
        return;
      }

      console.warn("[v0] Sending voice smart alert to Discord:", {
        alertType,
        channels: defaultChannels.map((c) => c.name),
        contract: alert.alert.contract,
      });

      try {
        // Create a minimal trade object for Discord formatting
        const tradeForAlert: Trade = {
          id: "voice-alert-" + Date.now(),
          ticker: alert.alert.ticker,
          contract: alert.alert.contract!,
          state: "LOADED",
          tradeType: "Day", // Will be inferred by Discord client from DTE
          targetPrice: alert.alert.contract?.mid,
          stopLoss: undefined,
          underlyingPriceAtLoad: alert.alert.price,
          updates: [],
          discordChannels: defaultChannels.map((c) => c.id),
          challenges: [],
        };

        if (alertType === "entry") {
          await discord.sendEntryAlert(
            defaultChannels,
            { ...tradeForAlert, entryPrice: alert.alert.price, state: "ENTERED" },
            alert.reasoning
          );
          toast.success("Entry alert sent", {
            description: `${alert.alert.ticker} ${alert.alert.contract?.strike}${alert.alert.contract?.type}`,
          });
        } else if (alertType === "exit") {
          await discord.sendExitAlert(
            defaultChannels,
            { ...tradeForAlert, state: "EXITED", exitPrice: alert.alert.price },
            alert.reasoning
          );
          toast.success("Exit alert sent", {
            description: `${alert.alert.ticker} exited`,
          });
        } else {
          // Load/update alerts
          await discord.sendLoadAlert(defaultChannels, tradeForAlert, alert.reasoning);
          toast.success("Alert sent", {
            description: `${alert.alert.ticker} ${alert.alert.contract?.strike}${alert.alert.contract?.type}`,
          });
        }
      } catch (error) {
        console.error("[v0] Failed to send voice alert to Discord:", error);
        toast.error("Failed to send alert", {
          description: "Check console for details",
        });
      }
    },
    onNavigate: onVoiceNavigate,
  });

  // Report voice state to parent (for header mic button)
  useEffect(() => {
    if (onVoiceStateChange) {
      onVoiceStateChange({
        isListening: voice.isListening,
        isProcessing: voice.hudState === "processing",
        waitingForWakeWord: voice.waitingForWakeWord,
        onToggle: () => {
          if (voice.isListening) {
            voice.stopListening();
          } else {
            voice.startListening();
          }
        },
      });
    }
  }, [voice.isListening, voice.hudState, voice.waitingForWakeWord, onVoiceStateChange]);

  useEffect(() => {
    const handles = watchlist.map((t) =>
      streamingManager.subscribe(t.symbol, ["quotes"], () => {})
    );
    return () => handles.forEach((h) => streamingManager.unsubscribe(h));
  }, [watchlist]);

  // Subscribe to loaded and entered trades for real-time pricing
  useEffect(() => {
    const tradesToSubscribe = activeTrades.filter(
      (t) => t.state === "LOADED" || t.state === "ENTERED"
    );
    const handles = tradesToSubscribe.map((trade) =>
      streamingManager.subscribe(trade.ticker, ["quotes"], () => {})
    );
    return () => handles.forEach((h) => streamingManager.unsubscribe(h));
  }, [activeTrades]);

  const handleTickerClick = (ticker: Ticker) => {
    actions.handleTickerClick(ticker);
    onTickerClick(ticker);
  };

  return (
    <>
      <div className="relative flex flex-col lg:flex-row h-[calc(100vh-7rem)] lg:h-[calc(100vh-8rem)] overflow-hidden">
        {voice.hudState && (
          <div className="hidden lg:block">
            <HDVoiceHUD
              state={voice.hudState}
              transcript={voice.transcript}
              command={voice.command || undefined}
              error={voice.error}
              onConfirm={voice.confirmAction}
              onCancel={voice.cancelAction}
              onRetry={voice.retryAction}
            />
          </div>
        )}
        {/* Watchlist: Left Rail */}
        <div className="hidden lg:flex">
          <HDWatchlistRail
            onTickerClick={handleTickerClick}
            onAddTicker={onAddTicker}
            onRemoveTicker={onRemoveTicker}
            onLoadedTradeClick={(trade) => {
              // Use the proper handler - this sets up focus and alertType
              actions.handleActiveTradeClick(trade, watchlist);
            }}
            onActiveTradeClick={(trade) => {
              // Use the proper state machine handler for active trades
              // This ensures chart renders by setting activeTicker
              actions.handleActiveTradeClick(trade, watchlist);
            }}
            onRemoveLoadedTrade={async (trade) => {
              // Use deleteTrade from store - it optimistically removes from state AND deletes from DB
              try {
                await deleteTrade(trade.id);
              } catch (error) {
                console.error("[HDWatchlistRail] Failed to remove trade:", error);
              }
            }}
            activeTicker={activeTicker?.symbol}
            activeTrades={activeTrades}
          />
        </div>

        {/* Legacy Mobile: Show full panel on mobile only */}
        <div className="w-full lg:hidden border-b border-[var(--border-hairline)] overflow-y-auto">
          <div className="p-3 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]">
            <HDMacroPanel />
          </div>
          <HDPanelWatchlist
            watchlist={watchlist}
            hotTrades={activeTrades}
            challenges={challenges}
            allTrades={activeTrades}
            activeTicker={activeTicker?.symbol}
            expandLoadedList={false}
            onTickerClick={handleTickerClick}
            onHotTradeClick={(trade) => {
              // Use the proper handler for trade clicks
              actions.handleActiveTradeClick(trade, watchlist);
            }}
            onChallengeClick={() => {}}
            onAddTicker={onAddTicker}
            onAddChallenge={onAddChallenge}
            onRemoveChallenge={onRemoveChallenge}
            onRemoveTicker={onRemoveTicker}
            onRemoveLoadedTrade={async (trade: Trade) => {
              // Use deleteTrade from store - it optimistically removes from state AND deletes from DB
              try {
                await deleteTrade(trade.id);
              } catch (error) {
                console.error("Failed to remove trade:", error);
              }
            }}
            onOpenActiveTrade={onOpenActiveTrade}
            onOpenReviewTrade={onOpenReviewTrade}
            compositeSignals={compositeSignals}
          />
        </div>
        {/* CENTER: NowPanel - Single focus target display */}
        <div className="flex-1 min-w-0 overflow-hidden relative flex flex-col">
          {/* Loading/Error states */}
          {activeTicker && optionsLoading && (
            <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--brand-primary)] border-t-transparent animate-spin" />
                Loading options chain for {activeTicker.symbol}...
              </div>
            </div>
          )}
          {activeTicker && optionsError && (
            <div className="flex-1 flex items-center justify-center text-[var(--accent-negative)] text-sm">
              Error loading options chain: {optionsError}
            </div>
          )}
          {/* Subtle, non-blocking stale badge */}
          {optionsStale && !optionsLoading && !optionsError && (
            <div className="absolute top-2 right-2 z-10 text-xs text-[var(--data-stale)] bg-[var(--data-stale)]/10 border border-[var(--data-stale)]/30 rounded px-2 py-1">
              Stale · {optionsAsOf ? new Date(optionsAsOf).toLocaleTimeString() : "unknown"}
            </div>
          )}
          {/* NowPanel - handles empty, symbol, and trade focus states */}
          {!optionsLoading && !optionsError && (
            <NowPanel
              focus={focus}
              activeTicker={activeTicker}
              currentTrade={currentTrade}
              tradeState={tradeState}
              contracts={contracts}
              activeTrades={activeTrades}
              onContractSelect={(contract) => actions.handleContractSelect(contract)}
              compositeSignals={compositeSignals}
              watchlist={watchlist}
              isTransitioning={isTransitioning}
            />
          )}
        </div>

        {/* RIGHT: ActionRail - State-aware actions and Discord */}
        <div className="hidden lg:flex">
          <ActionRail
            tradeState={tradeState}
            currentTrade={currentTrade}
            showAlert={showAlert}
            alertType={alertType}
            alertOptions={alertOptions}
            channels={channels}
            challenges={challenges}
            onSendAlert={actions.handleSendAlert}
            onEnterAndAlert={actions.handleEnterAndAlert}
            onCancelAlert={actions.handleCancelAlert}
            onUnload={actions.handleUnloadTrade}
            onEnter={actions.handleEnterTrade}
            onTrim={actions.handleTrim}
            onMoveSL={actions.handleUpdateSL}
            onTrailStop={actions.handleTrailStop}
            onAdd={actions.handleAdd}
            onTakeProfit={actions.handleTakeProfit}
            onExit={actions.handleExit}
            isTransitioning={isTransitioning}
            setupMode={{
              // Always pass setupMode object - ActionRail decides when to show based on tradeState
              // This prevents race conditions where setupMode becomes undefined before tradeState updates
              focusedSymbol: activeTicker?.symbol ?? null,
              activeContract: previewTrade?.contract ?? currentTrade?.contract ?? null,
              recommendedContract: null,
              contractSource: previewTrade?.contract
                ? "manual"
                : currentTrade?.contract
                  ? "manual"
                  : null,
              currentPrice: activeTicker?.last ?? 0,
              tradeType: previewTrade?.tradeType ?? currentTrade?.tradeType ?? "Day",
              isTransitioning,
              onLoadAndAlert: (channelIds, challengeIds) =>
                actions.handleLoadAndAlert(channelIds, challengeIds, undefined, undefined),
              onEnterAndAlert: (channelIds, challengeIds) =>
                actions.handleEnterAndAlert(channelIds, challengeIds, undefined, undefined),
              onDiscard: actions.handleDiscard,
              onRevertToRecommended: undefined,
            }}
          />
        </div>
        <HDDialogChallengeDetail
          open={false}
          onOpenChange={() => {}}
          challenge={null}
          trades={activeTrades}
          channels={channels}
          onTradeClick={(trade) => {
            if (trade.state === "ENTERED" && onOpenActiveTrade) onOpenActiveTrade(trade.id);
            else if (trade.state === "EXITED" && onOpenReviewTrade) onOpenReviewTrade(trade.id);
          }}
        />
      </div>
      <div className="lg:hidden">
        <MobileNowPlayingSheet
          trade={currentTrade}
          ticker={activeTicker?.symbol}
          state={tradeState}
          hideWhenAlert={showAlert}
          confluence={DEFAULT_CONFLUENCE}
          onEnter={actions.handleEnterTrade}
          onDiscard={actions.handleDiscard}
          onAction={(type) => {
            if (type === "trim") actions.handleTrim();
            else if (type === "update-sl") actions.handleUpdateSL();
            else if (type === "update") actions.handleUpdate();
            else if (type === "add") actions.handleAdd();
            else if (type === "exit") actions.handleExit();
          }}
        />
      </div>
      {showAlert && currentTrade && (
        <div className="lg:hidden fixed inset-0 z-[100] bg-[var(--bg-base)] flex flex-col">
          {/* Command Center: Right Panel (Desktop only) */}
          <div className="hidden lg:flex">
            <HDActiveTradesPanel
              onTradeClick={(trade) => {
                // Use the proper handler for trade clicks
                actions.handleActiveTradeClick(trade, watchlist);
              }}
              onTrimClick={(trade) => {
                // Focus on trade first, then trigger trim
                setCurrentTradeId(trade.id);
                actions.handleTrim();
              }}
              onMoveSLClick={(trade) => {
                // Focus on trade first, then trigger SL update
                setCurrentTradeId(trade.id);
                actions.handleUpdateSL();
              }}
              onExitClick={(trade) => {
                // Focus on trade first, then trigger exit
                setCurrentTradeId(trade.id);
                actions.handleExit();
              }}
            />
          </div>
        </div>
      )}
      <div className="lg:hidden">
        <MobileWatermark />
      </div>
    </>
  );
}
