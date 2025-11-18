import React, { useEffect, useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useMarketStore } from '../../stores/marketStore';
import { useTradeStore } from '../../stores/tradeStore';
import { useStreamingOptionsChain } from '../../hooks/useStreamingOptionsChain';
import { Ticker, Contract } from '../../types';
import { HDLiveChart } from '../hd/HDLiveChart';
import { HDContractGrid } from '../hd/HDContractGrid';
import { HDMacroPanel } from '../hd/HDMacroPanel';
import { HDCommandRail } from '../hd/HDCommandRail';
import { ActiveTradesDock } from '../trading/ActiveTradesDock';
import { QuickOrderBar } from '../trading/QuickOrderBar';
import { cn } from '../../lib/utils';

interface ConfluencePill {
  label: string;
  value: number;
  color: string;
}

const ConfluenceBar: React.FC<{ ticker: string }> = ({ ticker }) => {
  // Placeholder: Replace with actual confluence hook
  const pills: ConfluencePill[] = [
    { label: 'BOS', value: 85, color: 'bg-green-500' },
    { label: 'POI', value: 72, color: 'bg-blue-500' },
    { label: 'FVG', value: 68, color: 'bg-purple-500' },
  ];

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-2)] border-b border-[var(--border-hairline)]">
      <span className="text-xs text-[var(--text-muted)] mr-2">Confluence:</span>
      {pills.map((pill) => (
        <div
          key={pill.label}
          className={cn(
            'px-2 py-1 rounded text-[10px] font-medium text-white',
            pill.color
          )}
        >
          {pill.label} {pill.value}%
        </div>
      ))}
    </div>
  );
};

const EmptyState: React.FC = () => {
  const setShowAddTickerDialog = useUIStore((s) => s.setShowAddTickerDialog);
  
  return (
    <div className="flex-1 flex items-center justify-center bg-[var(--surface-1)]">
      <div className="text-center max-w-md px-4">
        <h2 className="text-xl font-semibold text-[var(--text-high)] mb-2">
          Select a Symbol
        </h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          Click any ticker in the watchlist to view its full trading cockpit with live chart, options chain, and confluence analysis.
        </p>
        <button
          onClick={() => setShowAddTickerDialog(true)}
          className="px-4 py-2 rounded bg-[var(--brand-primary)] text-white text-sm font-medium hover:opacity-90 transition"
        >
          Add Ticker to Watchlist
        </button>
      </div>
    </div>
  );
};

type MainCockpitProps = { symbol?: string };

export const MainCockpit: React.FC<MainCockpitProps> = ({ symbol }) => {
  const storeSymbol = useUIStore((s) => s.mainCockpitSymbol);
  const mainCockpitSymbol = symbol ?? storeSymbol;
  const setMainCockpitSymbol = useUIStore((s) => s.setMainCockpitSymbol);
  const watchlist = useMarketStore((s) => s.watchlist);
  const setActiveTrades = useTradeStore((s) => s.setActiveTrades);
  const setContracts = useTradeStore((s) => s.setContracts);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  // Find active ticker from watchlist
  const activeTicker = mainCockpitSymbol
    ? watchlist.find((t) => t.symbol === mainCockpitSymbol)
    : null;

  // Fetch options chain
  const { contracts: streamingContracts, loading: optionsLoading } = useStreamingOptionsChain(
    mainCockpitSymbol || ''
  );

  useEffect(() => {
    if (streamingContracts && mainCockpitSymbol) {
      setContracts(streamingContracts);
    }
  }, [streamingContracts, mainCockpitSymbol, setContracts]);

  // Reset selected contract when symbol changes
  useEffect(() => {
    setSelectedContract(null);
  }, [mainCockpitSymbol]);

  const handleContractSelect = (contract: Contract) => {
    console.log('[v0] MainCockpit: Contract selected:', contract);
    setSelectedContract(contract);
  };

  const handleRemoveTicker = (ticker: Ticker) => {
    // If removing the active ticker, clear cockpit
    if (ticker.symbol === mainCockpitSymbol) {
      setMainCockpitSymbol(null);
    }
  };

  // Empty state when no symbol selected
  if (!mainCockpitSymbol || !activeTicker) {
    return (
      <div className="flex h-screen">
        {/* Desktop: Watchlist Rail */}
        <div className="hidden lg:flex">
          <HDCommandRail
            onTickerClick={(ticker) => setMainCockpitSymbol(ticker.symbol)}
            onAddTicker={() => useUIStore.getState().setShowAddTickerDialog(true)}
            onRemoveTicker={handleRemoveTicker}
            activeTicker={mainCockpitSymbol || undefined}
          />
        </div>
        <EmptyState />
        <ActiveTradesDock />
      </div>
    );
  }

  const currentPrice = activeTicker.last || 0;

  return (
    <>
      {/* Desktop Layout: Grid */}
      <div className="hidden lg:grid lg:grid-cols-[280px_1fr] h-screen">
        {/* Left: Watchlist Rail */}
        <div className="border-r border-[var(--border-hairline)]">
          <HDCommandRail
            onTickerClick={(ticker) => setMainCockpitSymbol(ticker.symbol)}
            onAddTicker={() => useUIStore.getState().setShowAddTickerDialog(true)}
            onRemoveTicker={handleRemoveTicker}
            activeTicker={mainCockpitSymbol}
          />
        </div>

        {/* Right: Cockpit Grid */}
        <div className="grid grid-rows-[60%_25%_15%] overflow-hidden">
          {/* Top 60%: Chart + Quick Order Bar */}
          <div className="flex flex-col border-b border-[var(--border-hairline)] overflow-hidden">
            <div className="flex-1 relative">
              <HDLiveChart
                ticker={mainCockpitSymbol}
                initialTimeframe="5"
                indicators={{
                  ema: { periods: [9, 21, 50] },
                  vwap: { enabled: true, bands: false },
                  bollinger: { period: 20, stdDev: 2 }
                }}
                events={[]}
                levels={[]}
              />
            </div>
            <QuickOrderBar
              symbol={mainCockpitSymbol}
              currentPrice={currentPrice}
              selectedContract={selectedContract}
            />
          </div>

          {/* Middle 25%: Options Chain + Quick Order Bar */}
          <div className="flex flex-col border-b border-[var(--border-hairline)] overflow-hidden">
            <div className="flex-shrink-0">
              <ConfluenceBar ticker={mainCockpitSymbol} />
            </div>
            <div className="flex-1 overflow-y-auto">
              {optionsLoading ? (
                <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)]">
                  Loading options chain...
                </div>
              ) : streamingContracts && streamingContracts.length > 0 ? (
                <HDContractGrid
                  contracts={streamingContracts}
                  currentPrice={currentPrice}
                  ticker={mainCockpitSymbol}
                  onContractSelect={handleContractSelect}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)]">
                  No options data available
                </div>
              )}
            </div>
          </div>

          {/* Bottom 15%: Macro/Confluence/Strategies */}
          <div className="overflow-y-auto bg-[var(--surface-1)] p-3">
            <HDMacroPanel />
          </div>
        </div>
      </div>

      {/* Mobile Layout: Full Screen Cockpit */}
      <div className="lg:hidden flex flex-col h-screen">
        {/* Top: Mini Chart + Confluence Pills + Quick Order */}
        <div className="flex-shrink-0 border-b border-[var(--border-hairline)]">
          <div className="h-48">
            <HDLiveChart
              ticker={mainCockpitSymbol}
              initialTimeframe="5"
              indicators={{
                ema: { periods: [9] },
                vwap: { enabled: false },
                bollinger: undefined
              }}
              events={[]}
              levels={[]}
            />
          </div>
          <ConfluenceBar ticker={mainCockpitSymbol} />
          <QuickOrderBar
            symbol={mainCockpitSymbol}
            currentPrice={currentPrice}
            selectedContract={selectedContract}
          />
        </div>

        {/* Middle: Options Chain (scrollable) */}
        <div className="flex-1 overflow-y-auto pb-24">
          {optionsLoading ? (
            <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)]">
              Loading options chain...
            </div>
          ) : streamingContracts && streamingContracts.length > 0 ? (
            <HDContractGrid
              contracts={streamingContracts}
              currentPrice={currentPrice}
              ticker={mainCockpitSymbol}
              onContractSelect={handleContractSelect}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)]">
              No options data available
            </div>
          )}
        </div>

        {/* Bottom: Active Trades Dock (peekable) */}
        <ActiveTradesDock />
      </div>
    </>
  );
};

export default MainCockpit;
