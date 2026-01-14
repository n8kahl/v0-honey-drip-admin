/**
 * NowPanelTrade - Trade Details View (Definitive Trade Lifecycle UI - LOADED State)
 *
 * COCKPIT LAYOUT - Fixed grid with no scrolling and no collapsible sections.
 *
 * Displayed when focus.kind === "trade".
 * Shows different views based on trade state:
 * - WATCHING: Contract preview using cockpit layout
 * - LOADED: HDLoadedTradeCard + Discord alerts using cockpit layout
 * - ENTERED: Routes to NowPanelManage (handled in NowPanel.tsx)
 * - EXITED: TradeRecap using cockpit layout
 */

import React, { useMemo, useState, useCallback } from "react";
import type { Trade, TradeState, Ticker } from "../../types";
import type { SymbolFeatures } from "../../lib/strategy/engine";
import { HDLiveChart } from "../hd/charts/HDLiveChart";
import { useKeyLevels } from "../../hooks/useKeyLevels";
import { buildChartLevelsForTrade } from "../../lib/riskEngine/chartLevels";
import { useSymbolData, useMarketDataStore } from "../../stores/marketDataStore";
import { cn } from "../../lib/utils";
import {
  fmtPrice,
  fmtPct,
  fmtDelta,
  fmtDTE,
  fmtSpread,
  getPnlStyle,
  chipStyle,
} from "../../ui/semantics";
import { Zap, Share2, Copy, Bell, BellOff, X } from "lucide-react";
import type { DiscordChannel, Challenge } from "../../types";

// Cockpit components
import {
  CockpitLayout,
  CockpitHeader,
  CockpitPlanPanel,
  CockpitContractPanel,
  CockpitActionsBar,
  type CockpitViewState,
} from "./cockpit";
import { ConfluencePanelPro } from "./panels/ConfluencePanelPro";

interface NowPanelTradeProps {
  trade: Trade;
  tradeState: TradeState;
  activeTicker: Ticker | null;
  watchlist?: Ticker[];
  // Alert settings for LOADED state
  channels?: DiscordChannel[];
  challenges?: Challenge[];
  selectedChannels?: string[];
  selectedChallenges?: string[];
  onChannelsChange?: (channels: string[]) => void;
  onChallengesChange?: (challenges: string[]) => void;
  onEnterAndAlert?: (channelIds: string[], challengeIds: string[]) => void;
  /** Cancel/unload the trade */
  onCancel?: () => void;
}

export function NowPanelTrade({
  trade,
  tradeState,
  activeTicker,
  watchlist = [],
  channels = [],
  challenges = [],
  selectedChannels = [],
  selectedChallenges = [],
  onChannelsChange,
  onChallengesChange,
  onEnterAndAlert,
  onCancel,
}: NowPanelTradeProps) {
  const [sendDiscordAlert, setSendDiscordAlert] = useState(true);

  // Get current price
  const currentPrice = useMemo(() => {
    const fromWatchlist = watchlist.find((t) => t.symbol === trade.ticker);
    return fromWatchlist?.last || activeTicker?.last || 0;
  }, [trade.ticker, watchlist, activeTicker]);

  // Get key levels
  const { keyLevels } = useKeyLevels(trade.ticker);
  const chartLevels = useMemo(
    () => buildChartLevelsForTrade(trade, keyLevels || undefined),
    [trade, keyLevels]
  );

  // Determine cockpit view state
  const viewState: CockpitViewState = useMemo(() => {
    if (tradeState === "WATCHING") return "watch";
    if (tradeState === "LOADED") return "loaded";
    if (tradeState === "EXITED") return "exited";
    if (tradeState === "ENTERED") return "entered";
    return "watch";
  }, [tradeState]);

  // Underlying data freshness
  const symbolData = useMarketDataStore((state) => state.symbols[trade.ticker]);
  const lastUpdateTime = symbolData?.lastUpdated ? new Date(symbolData.lastUpdated) : null;
  const isStale = symbolData?.lastUpdated ? Date.now() - symbolData.lastUpdated > 10000 : true;

  // Handle enter trade action
  const handleEnterTrade = useCallback(
    (sendAlert: boolean) => {
      if (onEnterAndAlert) {
        onEnterAndAlert(sendAlert ? selectedChannels : [], selectedChallenges);
      }
    },
    [onEnterAndAlert, selectedChannels, selectedChallenges]
  );

  // Calculate plan metrics from trade
  const planMetrics = useMemo(() => {
    const contract = trade.contract;
    if (!contract) return null;
    const entry = contract.mid ?? 0;
    const target = trade.targetPrice ?? entry * 1.5;
    const stop = trade.stopLoss ?? entry * 0.5;
    const rr = stop > 0 && entry > stop ? (target - entry) / (entry - stop) : 0;
    return {
      entry,
      target,
      stop,
      rr,
    };
  }, [trade]);

  // "Why" bullets for plan panel
  const whyBullets = useMemo(() => {
    const bullets: string[] = [];
    if (trade.contract) {
      bullets.push(`${trade.contract.strike}${trade.contract.type} contract loaded`);
    }
    if (planMetrics?.rr && planMetrics.rr >= 1.5) {
      bullets.push(`R:R of ${planMetrics.rr.toFixed(1)}:1`);
    }
    if (trade.tradeType) {
      bullets.push(`${trade.tradeType} trade style`);
    }
    return bullets.length > 0 ? bullets : ["Ready to enter on trigger"];
  }, [trade, planMetrics]);

  return (
    <CockpitLayout
      viewState={viewState}
      symbol={trade.ticker}
      trade={trade}
      contract={trade.contract}
      activeTicker={activeTicker}
      keyLevels={keyLevels}
      data-testid="now-panel-trade-cockpit"
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
            underlyingPrice={currentPrice}
            underlyingChange={activeTicker?.changePercent}
            contractBid={trade.contract?.bid}
            contractAsk={trade.contract?.ask}
            contractMid={trade.contract?.mid}
            lastUpdateTime={lastUpdateTime}
            isStale={isStale}
          />
        ),

        /* ========== CHART ========== */
        chart: (
          <div className="h-full w-full relative">
            <HDLiveChart
              ticker={trade.ticker}
              height={180}
              initialTimeframe="5"
              indicators={{
                ema: { periods: [9, 21] },
                vwap: { enabled: true, bands: false },
              }}
              events={[]}
              levels={chartLevels}
              showControls={false}
              showHeader={false}
            />
          </div>
        ),

        /* ========== CONFLUENCE PANEL ========== */
        confluence: (
          <ConfluencePanelPro
            symbol={trade.ticker}
            viewState={viewState}
            keyLevels={keyLevels}
            currentPrice={currentPrice}
            showDegradationWarnings={viewState !== "watch"}
          />
        ),

        /* ========== PLAN PANEL ========== */
        plan: (
          <CockpitPlanPanel
            viewState={viewState}
            symbol={trade.ticker}
            trade={trade}
            contract={trade.contract}
            entryPrice={planMetrics?.entry}
            stopLoss={planMetrics?.stop}
            targetPrice={planMetrics?.target}
            riskReward={planMetrics?.rr}
            confidence={75}
            whyBullets={whyBullets}
          />
        ),

        /* ========== CONTRACT PANEL ========== */
        contractPanel: (
          <CockpitContractPanel
            symbol={trade.ticker}
            trade={trade}
            contract={trade.contract}
            activeTicker={activeTicker}
            underlyingPrice={currentPrice}
            underlyingChange={activeTicker?.changePercent}
            lastQuoteTime={lastUpdateTime}
          />
        ),

        /* ========== ACTIONS BAR ========== */
        actions: (
          <CockpitActionsBar
            viewState={viewState}
            trade={trade}
            contract={trade.contract}
            hasDiscordChannels={channels.length > 0}
            onEnterTrade={handleEnterTrade}
            onExit={(sendAlert) => {
              // For exited state, this would close/review the trade
            }}
          />
        ),
      }}
    </CockpitLayout>
  );
}

export default NowPanelTrade;
