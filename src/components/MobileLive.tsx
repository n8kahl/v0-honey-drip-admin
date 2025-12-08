import { useMemo, useState } from "react";
import { Ticker, Trade, TradeState } from "../types";
import { HDRowWatchlist } from "./hd/cards/HDRowWatchlist";
import { MobileNowPlaying } from "./MobileNowPlaying";
import { HDContractGrid } from "./hd/common/HDContractGrid";
import { HDMobileSparklinePreview } from "./hd/charts/HDMobileSparklinePreview";
import { HDMobileChartModal } from "./hd/charts/HDMobileChartModal";
import { Plus, Radio } from "lucide-react";
import { useMassiveData } from "../hooks/useMassiveData";
import { useAppToast } from "../hooks/useAppToast";

interface MobileLiveProps {
  watchlist: Ticker[];
  activeTrades?: Trade[];
  loadedTrades?: Trade[];
  onTickerClick: (ticker: Ticker) => void;
  onRemoveTicker?: (ticker: Ticker) => void;
}

type SourceTab = "watchlist" | "active" | "loaded";

export function MobileLive({
  watchlist,
  activeTrades = [],
  loadedTrades = [],
  onTickerClick,
  onRemoveTicker,
}: MobileLiveProps) {
  const toast = useAppToast();
  const [activeTicker, setActiveTicker] = useState<Ticker | null>(null);
  const [showContracts, setShowContracts] = useState(false);
  const [contracts, setContracts] = useState<any[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [currentTrade, setCurrentTrade] = useState<Trade | null>(null);
  const [tradeState, setTradeState] = useState<TradeState>("WATCHING");
  const [showChartModal, setShowChartModal] = useState(false);
  const [source, setSource] = useState<SourceTab>("watchlist");

  const { fetchOptionsChain } = useMassiveData();

  const resolvedList: Ticker[] = useMemo(() => {
    if (source === "watchlist") return watchlist;
    if (source === "active") {
      return activeTrades.map(
        (t) =>
          ({
            id: t.id,
            symbol: t.ticker,
            name: t.ticker,
            last: t.currentPrice ?? t.contract?.mid ?? 0,
            changePercent: t.movePercent ?? 0,
            change: t.movePrice ?? 0,
            bid: t.contract?.bid,
            ask: t.contract?.ask,
            volume: t.contract?.volume,
          }) as unknown as Ticker
      );
    }
    // loaded trades
    return loadedTrades.map(
      (t) =>
        ({
          id: t.id,
          symbol: t.ticker,
          name: t.ticker,
          last: t.contract?.mid ?? 0,
          changePercent: t.movePercent ?? 0,
          change: t.movePrice ?? 0,
          bid: t.contract?.bid,
          ask: t.contract?.ask,
          volume: t.contract?.volume,
        }) as unknown as Ticker
    );
  }, [source, watchlist, activeTrades, loadedTrades]);

  const handleTickerClick = async (ticker: Ticker) => {
    setActiveTicker(ticker);
    setTradeState("WATCHING");
    setCurrentTrade(null);
    setShowContracts(true);
    setContractsLoading(true);
    onTickerClick(ticker);

    try {
      console.log("[v0] Mobile: Fetching real options chain for", ticker.symbol);
      const realContracts = await fetchOptionsChain(ticker.symbol);
      console.log("[v0] Mobile: Received", realContracts.length, "contracts");
      setContracts(realContracts);
    } catch (error) {
      console.error("[v0] Mobile: Failed to fetch options chain:", error);
      toast.error("Failed to load options chain");
      setContracts([]);
    } finally {
      setContractsLoading(false);
    }
  };

  const handleContractSelect = (contract: any) => {
    if (!activeTicker) return;

    const trade: Trade = {
      id: `trade-${Date.now()}`,
      ticker: activeTicker.symbol,
      contract,
      tradeType: "Day",
      state: "LOADED",
      updates: [],
      discordChannels: [],
      challenges: [],
    };
    setCurrentTrade(trade);
    setTradeState("LOADED");
    setShowContracts(false);
  };

  const handleEnter = () => {
    if (!currentTrade) return;

    const enteredTrade: Trade = {
      ...currentTrade,
      state: "ENTERED",
      entryPrice: currentTrade.contract.mid,
      entryTime: new Date(),
      currentPrice: currentTrade.contract.mid,
      targetPrice: currentTrade.contract.mid * 1.5,
      stopLoss: currentTrade.contract.mid * 0.85,
      movePercent: 0,
      updates: [
        {
          id: "1",
          type: "enter",
          timestamp: new Date(),
          message: `Entering ${currentTrade.ticker} ${currentTrade.contract.strike}${currentTrade.contract.type} at mid $${currentTrade.contract.mid.toFixed(2)}`,
          price: currentTrade.contract.mid,
        },
      ],
    };
    setCurrentTrade(enteredTrade);
    setTradeState("ENTERED");
  };

  const handleDiscard = () => {
    setCurrentTrade(null);
    setTradeState("WATCHING");
  };

  if (showContracts) {
    return (
      <>
        <div className="h-[calc(100vh-4rem-4rem)] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]">
            <button onClick={() => setShowContracts(false)} className="text-[var(--brand-primary)]">
              ← Back
            </button>
            <h2 className="text-[var(--text-high)]">{activeTicker?.symbol} Contracts</h2>
            <div className="w-12" />
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-3 bg-[var(--surface-1)]">
              <HDMobileSparklinePreview
                ticker={activeTicker?.symbol || ""}
                currentPrice={activeTicker?.last || 0}
                bars={25}
                onTap={() => setShowChartModal(true)}
              />
            </div>

            {contractsLoading ? (
              <div className="flex items-center justify-center py-8 text-[var(--text-muted)] text-sm">
                Loading contracts…
              </div>
            ) : contracts.length > 0 ? (
              <HDContractGrid
                contracts={contracts}
                currentPrice={activeTicker?.last || 0}
                ticker={activeTicker?.symbol || ""}
                onContractSelect={handleContractSelect}
              />
            ) : (
              <div className="flex items-center justify-center py-8 text-[var(--text-muted)] text-sm">
                No contracts available for this ticker.
              </div>
            )}
          </div>
        </div>

        <HDMobileChartModal
          isOpen={showChartModal}
          onClose={() => setShowChartModal(false)}
          ticker={activeTicker?.symbol || ""}
          currentPrice={activeTicker?.last || 0}
          dailyChange={activeTicker?.changePercent || 0}
        />
      </>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem-4rem)] flex flex-col">
      {/* Status strip */}
      <div className="px-4 py-2 border-b border-[var(--border-hairline)] bg-[var(--surface-1)] flex items-center justify-between text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>Alerts ready</span>
        </div>
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-[var(--brand-primary)]" />
          <span>Session live</span>
        </div>
      </div>

      {/* Source selector + add */}
      <div className="px-4 py-3 border-b border-[var(--border-hairline)] bg-[var(--surface-1)] flex items-center justify-between gap-2">
        <div className="inline-flex bg-[var(--surface-2)] rounded-full p-1 border border-[var(--border-hairline)]">
          {(["watchlist", "active", "loaded"] as SourceTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setSource(tab)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                source === tab
                  ? "bg-[var(--brand-primary)] text-black font-semibold"
                  : "text-[var(--text-muted)]"
              }`}
            >
              {tab === "watchlist" ? "Watchlist" : tab === "active" ? "Active" : "Loaded"}
            </button>
          ))}
        </div>
        <button className="w-9 h-9 flex items-center justify-center rounded-[var(--radius)] text-[var(--text-muted)] hover:text-[var(--brand-primary)]">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-[var(--surface-2)]">
        {resolvedList.map((ticker) => (
          <HDRowWatchlist
            key={ticker.id}
            ticker={ticker}
            active={ticker.symbol === activeTicker?.symbol}
            onClick={() => handleTickerClick(ticker)}
            onRemove={onRemoveTicker ? () => onRemoveTicker(ticker) : undefined}
          />
        ))}

        {resolvedList.length === 0 && (
          <div className="flex items-center justify-center py-8 text-[var(--text-muted)] text-sm">
            Nothing here yet.
          </div>
        )}
      </div>

      <MobileNowPlaying
        trade={currentTrade}
        ticker={activeTicker?.symbol}
        state={tradeState}
        onEnter={handleEnter}
        onDiscard={handleDiscard}
      />
    </div>
  );
}
