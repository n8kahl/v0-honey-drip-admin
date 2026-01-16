/**
 * NowPanelManage - Live Trade Cockpit for ENTERED Trades
 *
 * COCKPIT LAYOUT - Fixed grid with no scrolling and no collapsible sections.
 *
 * Uses useActiveTradeLiveModel as the canonical data source for live metrics.
 *
 * Displays:
 * - Dual pricing (underlying + contract) in header
 * - Live chart with trade levels
 * - Confluence panel (key levels, MTF, flow)
 * - Management summary (P&L, R-Multiple, progress)
 * - Contract/Greeks info
 * - State-driven actions (TP, SL→BE, Trim, Trail, Exit)
 *
 * Only displayed when trade.state === "ENTERED"
 */

import React, { useMemo, useEffect, useCallback } from "react";
import type { Trade, Ticker } from "../../types";
import { useActiveTradeLiveModel } from "../../hooks/useActiveTradeLiveModel";
import { useMarketDataStore } from "../../stores/marketDataStore";
import { isContractExpired } from "../../stores/tradeStore";
import { useKeyLevels } from "../../hooks/useKeyLevels";
import { HDLiveChart } from "../hd/charts/HDLiveChart";
import { buildChartLevelsForTrade } from "../../lib/riskEngine/chartLevels";

// Cockpit components
import {
  CockpitLayout,
  CockpitHeader,
  CockpitPlanPanel,
  CockpitContractPanel,
  CockpitActionsBar,
  CockpitConfluencePanel,
  CockpitRightPanel,
  type CockpitViewState,
} from "./cockpit";
import { HDStaleBanner, useStaleLevel } from "../hd/common/HDStaleBanner";
import { useFlowContext } from "../../hooks/useFlowContext";

// ============================================================================
// Props
// ============================================================================

interface NowPanelManageProps {
  trade: Trade;
  activeTicker: Ticker | null;
  watchlist?: Ticker[];
  // Action callbacks
  onTrim?: (percent: number) => void;
  onMoveSLToBreakeven?: () => void;
  onTrailStop?: () => void;
  onAdd?: () => void;
  onExit?: (sendAlert: boolean) => void;
  onTakeProfit?: (sendAlert: boolean) => void;
  onBroadcastUpdate?: (message: string) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function NowPanelManage({
  trade,
  activeTicker,
  watchlist = [],
  onTrim,
  onMoveSLToBreakeven,
  onTrailStop,
  onExit,
  onTakeProfit,
}: NowPanelManageProps) {
  // Use canonical live model hook - SINGLE SOURCE OF TRUTH
  const liveModel = useActiveTradeLiveModel(trade);

  // Get additional context data
  const symbolData = useMarketDataStore((s) => s.symbols[trade.ticker]);
  const { keyLevels } = useKeyLevels(trade.ticker);
  const flowContext = useFlowContext(trade.ticker);

  // Get subscribe action from store
  const subscribe = useMarketDataStore((s) => s.subscribe);
  const subscribedSymbols = useMarketDataStore((s) => s.subscribedSymbols);

  // Auto-subscribe symbol when trade enters ENTERED state
  useEffect(() => {
    if (trade?.ticker && trade.state === "ENTERED") {
      if (!subscribedSymbols.has(trade.ticker)) {
        console.log(`[NowPanelManage] Auto-subscribing ${trade.ticker} for live market data`);
        subscribe(trade.ticker);
      }
    }
  }, [trade?.ticker, trade?.state, subscribe, subscribedSymbols]);

  // Get current price
  const currentPrice = useMemo(() => {
    const fromWatchlist = watchlist.find((t) => t.symbol === trade.ticker);
    return fromWatchlist?.last || activeTicker?.last || liveModel?.underlyingPrice || 0;
  }, [trade.ticker, watchlist, activeTicker, liveModel?.underlyingPrice]);

  // Build chart levels for trade visualization
  // Pass current underlying price and live option prices for TP/SL calculation
  const chartLevels = useMemo(() => {
    const levels = buildChartLevelsForTrade(
      trade,
      keyLevels || undefined,
      undefined,
      liveModel?.underlyingPrice,
      {
        targetPrice: liveModel?.targetPrice,
        stopLoss: liveModel?.stopLoss,
        currentMid: liveModel?.effectiveMid,
      }
    );
    console.log("[NowPanelManage] Chart levels built:", {
      levelsCount: levels.length,
      levels: levels.map((l) => ({ type: l.type, label: l.label, price: l.price })),
      inputs: {
        underlyingPrice: liveModel?.underlyingPrice,
        targetPrice: liveModel?.targetPrice,
        stopLoss: liveModel?.stopLoss,
        currentMid: liveModel?.effectiveMid,
        delta: trade.contract?.delta,
      },
    });
    return levels;
  }, [
    trade,
    keyLevels,
    liveModel?.underlyingPrice,
    liveModel?.targetPrice,
    liveModel?.stopLoss,
    liveModel?.effectiveMid,
  ]);

  // Determine cockpit view state (entered or expired)
  // CRITICAL: Use isContractExpired which checks for 4PM ET close time, NOT midnight UTC
  const viewState: CockpitViewState = useMemo(() => {
    const contract = trade.contract;
    if (contract?.expiry && isContractExpired(contract.expiry)) {
      return "expired";
    }
    return "entered";
  }, [trade.contract]);

  // Underlying data freshness with enhanced staleness detection
  const lastUpdateTime = symbolData?.lastUpdated ? new Date(symbolData.lastUpdated) : null;
  const lastUpdateTs = symbolData?.lastUpdated || null;
  const staleLevel = useStaleLevel(lastUpdateTs);
  const isStale = staleLevel === "stale" || staleLevel === "critical" || liveModel?.optionIsStale;

  // Refresh symbol data - use refreshStaleSymbols which will fetch latest data
  const refreshStaleSymbols = useMarketDataStore((s) => s.refreshStaleSymbols);
  const handleRetryData = useCallback(() => {
    if (refreshStaleSymbols) {
      refreshStaleSymbols();
    }
  }, [refreshStaleSymbols]);

  // Render stale banner for critical staleness
  const staleBanner = useMemo(() => {
    if (staleLevel === "live" || staleLevel === "delayed") return null;
    return (
      <HDStaleBanner
        lastUpdateTime={lastUpdateTs}
        staleLevel={staleLevel}
        dataSource={`${trade.ticker} live data`}
        onRetry={handleRetryData}
        onDismiss={() => {}}
      />
    );
  }, [staleLevel, lastUpdateTs, trade.ticker, handleRetryData]);

  // Loading state if model not yet available
  if (!liveModel) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--brand-primary)] border-t-transparent animate-spin" />
          <span className="text-sm text-[var(--text-muted)]">Loading live data...</span>
        </div>
      </div>
    );
  }

  return (
    <CockpitLayout
      viewState={viewState}
      symbol={trade.ticker}
      trade={trade}
      contract={trade.contract}
      activeTicker={activeTicker}
      keyLevels={keyLevels}
      staleBanner={staleBanner}
      data-testid="now-panel-manage-cockpit"
    >
      {{
        /* ========== HEADER ========== */
        header: (
          <CockpitHeader
            viewState={viewState}
            symbol={trade.ticker}
            trade={trade}
            contract={trade.contract}
            activeTicker={activeTicker}
            underlyingPrice={liveModel.underlyingPrice}
            underlyingChange={liveModel.underlyingChangePercent}
            contractBid={liveModel.bid}
            contractAsk={liveModel.ask}
            contractMid={liveModel.effectiveMid}
            lastUpdateTime={lastUpdateTime}
            isStale={isStale}
          />
        ),

        /* ========== CHART ========== */
        chart: (
          <div className="h-full w-full relative">
            <HDLiveChart
              ticker={trade.ticker}
              height="100%"
              initialTimeframe="5"
              indicators={{
                ema: { periods: [9, 21] },
                vwap: { enabled: true, bands: false },
              }}
              events={[]}
              levels={chartLevels}
              showControls={true}
              showHeader={true}
            />
            {/* Active Trade Indicator - positioned below header controls */}
            <div className="absolute top-10 right-2 z-10 px-2 py-1 bg-[var(--accent-positive)]/20 backdrop-blur rounded text-[10px] font-medium text-[var(--accent-positive)] border border-[var(--accent-positive)]/30 flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-positive)] animate-pulse" />
              LIVE
            </div>
          </div>
        ),

        /* ========== CONFLUENCE PANEL (Compact Bar for ENTERED) ========== */
        confluence: (
          <CockpitConfluencePanel
            symbol={trade.ticker}
            keyLevels={keyLevels}
            currentPrice={currentPrice}
            compact={true}
          />
        ),

        /* ========== UNIFIED RIGHT PANEL (P&L, Flow, Levels, Activity) ========== */
        plan: (
          <CockpitRightPanel
            viewState={viewState}
            symbol={trade.ticker}
            trade={trade}
            contract={trade.contract}
            keyLevels={keyLevels}
            currentPrice={currentPrice}
            underlyingPrice={liveModel.underlyingPrice}
            lastQuoteTime={lastUpdateTime}
            flowContext={flowContext}
            pnl={{
              percent: liveModel.pnlPercent ?? 0,
              dollars: liveModel.pnlDollars ?? 0,
              rMultiple: liveModel.rMultiple,
              progressToTarget: liveModel.progressToTarget,
              targetPrice: liveModel.targetPrice,
              stopLoss: liveModel.stopLoss,
              currentMid: liveModel.effectiveMid,
            }}
          />
        ),

        /* ========== CONTRACT PANEL (Deprecated - handled by CockpitRightPanel) ========== */
        contractPanel: null,

        /* ========== ACTIONS BAR ========== */
        actions: (
          <CockpitActionsBar
            viewState={viewState}
            trade={trade}
            contract={trade.contract}
            hasDiscordChannels={true}
            onTakeProfit={onTakeProfit}
            onMoveStop={onMoveSLToBreakeven}
            onTrim={onTrim}
            onExit={onExit}
          />
        ),
      }}
    </CockpitLayout>
  );
}

export default NowPanelManage;
