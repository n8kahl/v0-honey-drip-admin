import React from "react";
import { Ticker, Contract, Trade, TradeState, AlertType } from "../../types";
import { HDLiveChartContextAware } from "../hd/charts/HDLiveChartContextAware";
import { HDContractGrid } from "../hd/common/HDContractGrid";
import { HDLoadedLayout } from "./HDLoadedLayout";
import { HDEnteredTradeCard } from "../hd/cards/HDEnteredTradeCard";
import { HDActiveTradePanel } from "../hd/dashboard/HDActiveTradePanel";
import { HDPanelFocusedTrade } from "../hd/dashboard/HDPanelFocusedTrade";
import { HDPriceSparkline } from "../hd/charts/HDPriceSparkline";
import { MobileWatermark } from "../MobileWatermark";
import { useMemo } from "react";
import { useKeyLevels } from "../../hooks/useKeyLevels";
import { buildChartLevelsForTrade } from "../../lib/riskEngine/chartLevels";
import type { KeyLevels } from "../../lib/riskEngine/types";
import type { CompositeSignal } from "../../lib/composite/CompositeSignal";
import { useContractRecommendation } from "../../hooks/useContractRecommendation";
import honeyDripLogo from "../../assets/1ccfd6d57f7ce66b9991f55ed3e9ec600aadd57a.png";

interface TradingWorkspaceProps {
  watchlist: Ticker[];
  activeTicker: Ticker | null;
  contracts: Contract[];
  currentTrade: Trade | null;
  tradeState: TradeState;
  showAlert: boolean;
  alertType: AlertType;
  onContractSelect: (c: Contract) => void;
  onEnterTrade: () => void;
  onDiscard: () => void;
  onAutoTrim?: () => void;
  // Active trade action callbacks
  onTrim?: () => void;
  onTrailStop?: () => void;
  onMoveSL?: () => void;
  onAdd?: () => void;
  onExit?: () => void;
  // Composite signals for contract recommendation
  compositeSignals?: CompositeSignal[];
}

export const TradingWorkspace: React.FC<TradingWorkspaceProps> = ({
  watchlist,
  activeTicker,
  contracts,
  currentTrade,
  tradeState,
  showAlert,
  alertType,
  onContractSelect,
  onEnterTrade,
  onDiscard,
  onAutoTrim,
  onTrim,
  onTrailStop,
  onMoveSL,
  onAdd,
  onExit,
  compositeSignals,
}) => {
  const currentPrice = activeTicker
    ? watchlist.find((t) => t.symbol === activeTicker.symbol)?.last || activeTicker.last
    : 0;

  // Get contract recommendation based on active signals (with ATM fallback using trend)
  const recommendation = useContractRecommendation({
    symbol: activeTicker?.symbol || "",
    contracts,
    activeSignals: compositeSignals || [],
    currentPrice,
    changePercent: activeTicker?.changePercent,
  });

  const enteredTrade = tradeState === "ENTERED" && currentTrade && !showAlert ? currentTrade : null;
  // Enable key level computation for LOADED and ENTERED states
  const levelsTicker = currentTrade?.ticker || activeTicker?.symbol || "";
  const { keyLevels: computedKeyLevels } = useKeyLevels(levelsTicker, {
    timeframe: "5",
    lookbackDays: 5,
    orbWindow: 5,
    enabled: Boolean(levelsTicker && (tradeState === "LOADED" || tradeState === "ENTERED")),
  });
  const [chartHeight, setChartHeight] = React.useState(360);
  React.useEffect(() => {
    const update = () => setChartHeight(window.innerWidth < 768 ? 260 : 360);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Decide which ticker drives the global chart
  const chartTicker = useMemo(() => {
    if (currentTrade && (tradeState === "LOADED" || tradeState === "ENTERED")) {
      return currentTrade.ticker;
    }
    if (activeTicker) return activeTicker.symbol;
    return null;
  }, [currentTrade, tradeState, activeTicker]);

  const enteredTradeEvents = useMemo(() => {
    if (!enteredTrade) return [] as any[];
    return [
      ...(enteredTrade.entryTime
        ? [
            {
              type: "enter" as const,
              timestamp: new Date(enteredTrade.entryTime).getTime(),
              price: enteredTrade.entryPrice || enteredTrade.contract.mid,
              label: "Enter",
            },
          ]
        : []),
      ...(enteredTrade.updates || [])
        .filter((update) => update.type)
        .map((update) => ({
          type: update.type as any,
          timestamp: new Date(update.timestamp).getTime(),
          price: update.price || enteredTrade.contract.mid,
          label: update.type.charAt(0).toUpperCase() + update.type.slice(1),
        })),
    ];
  }, [enteredTrade]);

  const enteredChartLevels = useMemo(() => {
    if (!enteredTrade) return [] as any[];
    const keyLevels: KeyLevels = computedKeyLevels || {
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
    };
    return buildChartLevelsForTrade(enteredTrade, keyLevels);
  }, [enteredTrade, computedKeyLevels]);

  // Add loaded trade chart levels (for LOADED state)
  const loadedChartLevels = useMemo(() => {
    if (!currentTrade || tradeState !== "LOADED") return [] as any[];
    const keyLevels: KeyLevels = computedKeyLevels || {
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
    };
    return buildChartLevelsForTrade(currentTrade, keyLevels);
  }, [currentTrade, tradeState, computedKeyLevels]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0a0a] relative">
      <MobileWatermark />
      {/* Chart area - context-aware chart for WATCHING/LOADED/ENTERED */}
      {chartTicker && (
        <div className="p-4 lg:p-6 pointer-events-auto relative z-20 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0a0a0a]/80">
          <HDLiveChartContextAware
            ticker={chartTicker}
            tradeState={tradeState}
            currentTrade={currentTrade}
            activeTicker={activeTicker}
            hasLoadedContract={tradeState === "LOADED" || tradeState === "ENTERED"}
            levels={
              tradeState === "LOADED"
                ? loadedChartLevels
                : tradeState === "ENTERED"
                  ? enteredChartLevels
                  : []
            }
            height={chartHeight}
            className="pointer-events-auto"
          />
        </div>
      )}
      {/* Active Trade Panel - Full trade cockpit for ENTERED trades */}
      {tradeState === "ENTERED" && currentTrade && (
        <div className="p-4 lg:p-6 pt-0 pointer-events-auto relative z-10">
          <HDActiveTradePanel
            trade={currentTrade}
            onAutoTrim={onAutoTrim}
            onTrim={onTrim}
            onTrailStop={onTrailStop}
            onMoveSL={onMoveSL}
            onAdd={onAdd}
            onExit={onExit}
          />
        </div>
      )}
      {/* Two-column layout: Show for WATCHING (symbol selected) and LOADED states */}
      {(tradeState === "WATCHING" || tradeState === "LOADED") && activeTicker && (
        <HDLoadedLayout
          trade={
            currentTrade || {
              id: "",
              userId: "",
              ticker: activeTicker.symbol,
              tradeType: "Day",
              state: "WATCHING",
              contract: contracts[0] || {
                id: "",
                symbol: activeTicker.symbol,
                type: "C",
                strike: 0,
                expiry: new Date().toISOString(),
                bid: 0,
                ask: 0,
                mid: currentPrice,
                volume: 0,
                openInterest: 0,
                impliedVolatility: 0,
                daysToExpiry: 0,
              },
              entryPrice: undefined,
              targetPrice: undefined,
              stopLoss: undefined,
              discordChannels: [],
              challenges: [],
              updates: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          }
          contracts={contracts}
          currentPrice={currentPrice}
          ticker={activeTicker.symbol}
          activeTicker={activeTicker}
          onContractSelect={onContractSelect}
          onEnter={onEnterTrade}
          onDiscard={onDiscard}
          recommendation={recommendation}
        />
      )}
      {!currentTrade && !activeTicker && (
        <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.08]">
            <img
              src={honeyDripLogo}
              alt="Honey Drip"
              className="w-auto h-[50vh] max-w-[60vw] object-contain"
            />
          </div>
          <div className="relative z-10 text-center space-y-4 max-w-md">
            <h3 className="text-xl lg:text-2xl font-semibold text-white">Honey Drip Admin</h3>
            <p className="text-zinc-400 text-sm lg:text-base leading-relaxed">
              Select a Ticker from the Watchlist or Loaded Trades to begin
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
